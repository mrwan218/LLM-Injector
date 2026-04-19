"""
tools.py – File system operations with security constraints.

This module provides the core tool functions that the LLM can invoke:
  - read_file:    Read contents of a text file (max 1 MB)
  - write_file:   Write / overwrite a text file (max 10 MB)
  - list_directory: List files and subdirectories
  - file_info:    Get metadata (size, modified time, type)
  - delete_file:  Delete a file (optional, respects read-only mode)
  - create_directory: Create a new directory

Security features:
  - Workspace sandboxing (ALLOWED_BASE restriction)
  - Path traversal prevention via os.path.realpath
  - File size limits for read and write
  - Blocked extension filtering
  - Read-only mode toggle
  - Operation logging
"""

import os
import sys
import json
import stat
import logging
from datetime import datetime, timezone
from typing import Optional

# ---------------------------------------------------------------------------
# Configuration defaults (can be overridden via config.yaml)
# ---------------------------------------------------------------------------
ALLOWED_BASE: str = os.path.abspath("./workspace")
READ_ONLY: bool = False
MAX_READ_BYTES: int = 1 * 1024 * 1024       # 1 MB
MAX_WRITE_BYTES: int = 10 * 1024 * 1024      # 10 MB
SESSION_QUOTA_MB: int = 50                    # Total bytes allowed per session
BLOCKED_EXTENSIONS: set = {".exe", ".sh", ".bat", ".cmd", ".ps1", ".com", ".msi", ".scr", ".pif"}
ALLOWED_EXTENSIONS: Optional[set] = None      # None = allow all except blocked

# Session-level byte tracking
_session_bytes_read: int = 0
_session_bytes_written: int = 0
_session_quota: int = SESSION_QUOTA_MB * 1024 * 1024

# ---------------------------------------------------------------------------
# Logger setup
# ---------------------------------------------------------------------------
logger = logging.getLogger("llm_injector.tools")


# ---------------------------------------------------------------------------
# Configuration loader
# ---------------------------------------------------------------------------
def configure(cfg: dict) -> None:
    """Apply settings from a config dictionary (loaded from config.yaml)."""
    global ALLOWED_BASE, READ_ONLY, MAX_READ_BYTES, MAX_WRITE_BYTES
    global SESSION_QUOTA_MB, BLOCKED_EXTENSIONS, ALLOWED_EXTENSIONS, _session_quota

    if "workspace" in cfg:
        ALLOWED_BASE = os.path.abspath(cfg["workspace"])

    if "read_only" in cfg:
        READ_ONLY = bool(cfg["read_only"])

    if "max_read_size_mb" in cfg:
        MAX_READ_BYTES = int(cfg["max_read_size_mb"]) * 1024 * 1024

    if "max_write_size_mb" in cfg:
        MAX_WRITE_BYTES = int(cfg["max_write_size_mb"]) * 1024 * 1024

    if "session_quota_mb" in cfg:
        SESSION_QUOTA_MB = int(cfg["session_quota_mb"])
        _session_quota = SESSION_QUOTA_MB * 1024 * 1024

    if "blocked_extensions" in cfg:
        BLOCKED_EXTENSIONS = set(cfg["blocked_extensions"])

    if "allowed_extensions" in cfg and cfg["allowed_extensions"]:
        ALLOWED_EXTENSIONS = set(cfg["allowed_extensions"])

    # Ensure workspace directory exists
    os.makedirs(ALLOWED_BASE, exist_ok=True)


# ---------------------------------------------------------------------------
# Security helpers
# ---------------------------------------------------------------------------
def safe_path(user_path: str) -> str:
    """
    Resolve *user_path* inside the allowed workspace and return the
    canonical absolute path.  Raises PermissionError on any violation.
    """
    if not user_path:
        raise PermissionError("Empty file path provided.")

    # Reject absolute paths that don't start with the allowed base
    if os.path.isabs(user_path):
        raise PermissionError(
            f"Absolute paths are not allowed: '{user_path}'. "
            "Please use a relative path inside the workspace."
        )

    full = os.path.realpath(os.path.join(ALLOWED_BASE, user_path))

    if not full.startswith(ALLOWED_BASE + os.sep) and full != ALLOWED_BASE:
        raise PermissionError(
            f"Access denied – path escapes workspace: '{user_path}'"
        )

    return full


def _check_extension(filepath: str) -> None:
    """Raise PermissionError if the file extension is blocked or not allowed."""
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    if ext in BLOCKED_EXTENSIONS:
        raise PermissionError(
            f"File extension '{ext}' is blocked for security reasons."
        )

    if ALLOWED_EXTENSIONS is not None and ext not in ALLOWED_EXTENSIONS:
        raise PermissionError(
            f"File extension '{ext}' is not in the allowed extensions list."
        )


def _check_quota(read_delta: int = 0, write_delta: int = 0) -> None:
    """Raise PermissionError if the session quota would be exceeded."""
    global _session_bytes_read, _session_bytes_written

    if _session_bytes_read + _session_bytes_written + read_delta + write_delta > _session_quota:
        raise PermissionError(
            f"Session quota exceeded ({SESSION_QUOTA_MB} MB). "
            "Please start a new session."
        )


def _is_binary(filepath: str) -> bool:
    """Heuristic check – read first 8192 bytes and look for null bytes."""
    try:
        with open(filepath, "rb") as f:
            chunk = f.read(8192)
        return b"\x00" in chunk
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------
def read_file(filepath: str) -> str:
    """
    Read and return the contents of *filepath* (relative to workspace).

    Returns the file content (truncated to MAX_READ_BYTES) on success,
    or an error message string on failure.
    """
    logger.info("read_file called – filepath=%s", filepath)

    try:
        real = safe_path(filepath)
        _check_extension(real)

        if not os.path.isfile(real):
            return f"Error: File not found – '{filepath}' does not exist in the workspace."

        file_size = os.path.getsize(real)
        _check_quota(read_delta=file_size)

        if _is_binary(real):
            return (
                f"Error: '{filepath}' appears to be a binary file. "
                "Only text files can be read."
            )

        with open(real, "r", encoding="utf-8") as f:
            content = f.read(MAX_READ_BYTES)

        global _session_bytes_read
        _session_bytes_read += file_size

        truncated = ""
        if file_size > MAX_READ_BYTES:
            truncated = (
                f"\n\n[WARNING] File truncated – showing first "
                f"{MAX_READ_BYTES // 1024} KB of {file_size // 1024} KB total."
            )

        logger.info("read_file success – %d bytes read from %s", file_size, filepath)
        return f"Successfully read '{filepath}':\n---\n{content}\n---{truncated}"

    except PermissionError as e:
        logger.warning("read_file permission denied – %s", e)
        return str(e)
    except UnicodeDecodeError:
        return f"Error: '{filepath}' is not a valid UTF-8 text file."
    except Exception as e:
        logger.error("read_file unexpected error – %s", e)
        return f"Error reading file: {str(e)}"


def write_file(filepath: str, content: str) -> str:
    """
    Write *content* to *filepath* (relative to workspace).
    Creates parent directories if they don't exist.
    Respects read-only mode and file size limits.
    """
    logger.info("write_file called – filepath=%s, content_length=%d", filepath, len(content))

    if READ_ONLY:
        logger.warning("write_file blocked – read-only mode enabled")
        return "Error: The system is in read-only mode. Write operations are disabled."

    try:
        real = safe_path(filepath)
        _check_extension(real)

        content_bytes = len(content.encode("utf-8"))
        if content_bytes > MAX_WRITE_BYTES:
            return (
                f"Error: Content size ({content_bytes // 1024} KB) exceeds "
                f"the maximum allowed write size ({MAX_WRITE_BYTES // 1024} KB)."
            )

        _check_quota(write_delta=content_bytes)

        # Create parent directories if needed
        parent = os.path.dirname(real)
        if parent:
            os.makedirs(parent, exist_ok=True)

        with open(real, "w", encoding="utf-8") as f:
            f.write(content)

        global _session_bytes_written
        _session_bytes_written += content_bytes

        logger.info("write_file success – %d bytes written to %s", content_bytes, filepath)
        return f"Successfully wrote {content_bytes // 1024} KB to '{filepath}'."

    except PermissionError as e:
        logger.warning("write_file permission denied – %s", e)
        return str(e)
    except Exception as e:
        logger.error("write_file unexpected error – %s", e)
        return f"Error writing file: {str(e)}"


def list_directory(directory: str = ".") -> str:
    """
    List files and subdirectories in *directory* (relative to workspace).
    Returns a formatted list with type indicators.
    """
    logger.info("list_directory called – directory=%s", directory)

    try:
        real = safe_path(directory)

        if not os.path.isdir(real):
            return f"Error: Directory not found – '{directory}' does not exist in the workspace."

        entries = sorted(os.listdir(real))
        if not entries:
            return f"Directory '{directory}' is empty."

        lines = [f"Contents of '{directory}' ({len(entries)} items):"]
        for entry in entries:
            full = os.path.join(real, entry)
            if os.path.isdir(full):
                lines.append(f"  [DIR]  {entry}/")
            else:
                size = os.path.getsize(full)
                lines.append(f"  [FILE] {entry}  ({size:,} bytes)")

        logger.info("list_directory success – %d entries in %s", len(entries), directory)
        return "\n".join(lines)

    except PermissionError as e:
        logger.warning("list_directory permission denied – %s", e)
        return str(e)
    except Exception as e:
        logger.error("list_directory unexpected error – %s", e)
        return f"Error listing directory: {str(e)}"


def file_info(filepath: str) -> str:
    """
    Get metadata for *filepath*: size, type, modified time, permissions.
    """
    logger.info("file_info called – filepath=%s", filepath)

    try:
        real = safe_path(filepath)

        if not os.path.exists(real):
            return f"Error: Path not found – '{filepath}' does not exist in the workspace."

        stat_info = os.stat(real)
        is_dir = os.path.isdir(real)
        is_file = os.path.isfile(real)
        ftype = "directory" if is_dir else ("file" if is_file else "other")

        modified = datetime.fromtimestamp(stat_info.st_mtime, tz=timezone.utc)
        modified_str = modified.strftime("%Y-%m-%d %H:%M:%S UTC")

        perms = stat.filemode(stat_info.st_mode)

        info = {
            "path": filepath,
            "type": ftype,
            "size_bytes": stat_info.st_size,
            "size_human": _human_size(stat_info.st_size),
            "modified": modified_str,
            "permissions": perms,
        }

        if is_file:
            _, ext = os.path.splitext(filepath)
            info["extension"] = ext.lower() if ext else "(none)"

        logger.info("file_info success – %s", filepath)
        return json.dumps(info, indent=2)

    except PermissionError as e:
        logger.warning("file_info permission denied – %s", e)
        return str(e)
    except Exception as e:
        logger.error("file_info unexpected error – %s", e)
        return f"Error getting file info: {str(e)}"


def delete_file(filepath: str) -> str:
    """
    Delete a file (not a directory) from the workspace.
    Respects read-only mode.
    """
    logger.info("delete_file called – filepath=%s", filepath)

    if READ_ONLY:
        logger.warning("delete_file blocked – read-only mode enabled")
        return "Error: The system is in read-only mode. Delete operations are disabled."

    try:
        real = safe_path(filepath)

        if not os.path.isfile(real):
            return f"Error: File not found – '{filepath}' does not exist in the workspace."

        if os.path.isdir(real):
            return f"Error: '{filepath}' is a directory. Use delete_directory instead."

        os.remove(real)
        logger.info("delete_file success – removed %s", filepath)
        return f"Successfully deleted '{filepath}'."

    except PermissionError as e:
        logger.warning("delete_file permission denied – %s", e)
        return str(e)
    except Exception as e:
        logger.error("delete_file unexpected error – %s", e)
        return f"Error deleting file: {str(e)}"


def create_directory(directory: str) -> str:
    """
    Create a new directory inside the workspace.
    """
    logger.info("create_directory called – directory=%s", directory)

    if READ_ONLY:
        logger.warning("create_directory blocked – read-only mode enabled")
        return "Error: The system is in read-only mode. Directory creation is disabled."

    try:
        real = safe_path(directory)
        os.makedirs(real, exist_ok=True)
        logger.info("create_directory success – created %s", directory)
        return f"Successfully created directory '{directory}'."

    except PermissionError as e:
        logger.warning("create_directory permission denied – %s", e)
        return str(e)
    except Exception as e:
        logger.error("create_directory unexpected error – %s", e)
        return f"Error creating directory: {str(e)}"


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------
def _human_size(size: int) -> str:
    """Convert bytes to a human-readable string."""
    for unit in ("B", "KB", "MB", "GB"):
        if abs(size) < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"


def get_session_stats() -> dict:
    """Return current session byte usage statistics."""
    return {
        "bytes_read": _session_bytes_read,
        "bytes_written": _session_bytes_written,
        "quota_mb": SESSION_QUOTA_MB,
        "quota_used_pct": round(
            (_session_bytes_read + _session_bytes_written) / _session_quota * 100, 2
        ),
    }


# ---------------------------------------------------------------------------
# Tool registry – maps tool names to their functions and argument schemas
# ---------------------------------------------------------------------------
TOOL_REGISTRY = {
    "read_file": {
        "fn": read_file,
        "description": "Read contents of a text file",
        "arguments": {"filepath": {"type": "string", "required": True}},
    },
    "write_file": {
        "fn": write_file,
        "description": "Write or overwrite a text file",
        "arguments": {
            "filepath": {"type": "string", "required": True},
            "content": {"type": "string", "required": True},
        },
    },
    "list_directory": {
        "fn": list_directory,
        "description": "List files and subdirectories in a directory",
        "arguments": {"directory": {"type": "string", "required": False, "default": "."}},
    },
    "file_info": {
        "fn": file_info,
        "description": "Get file metadata (size, type, modified time)",
        "arguments": {"filepath": {"type": "string", "required": True}},
    },
    "delete_file": {
        "fn": delete_file,
        "description": "Delete a file from the workspace",
        "arguments": {"filepath": {"type": "string", "required": True}},
    },
    "create_directory": {
        "fn": create_directory,
        "description": "Create a new directory in the workspace",
        "arguments": {"directory": {"type": "string", "required": True}},
    },
}
