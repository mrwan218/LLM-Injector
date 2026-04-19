import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { Dirent } from "fs";

// ─── Security Helpers ───────────────────────────────────────────────────────

const DANGEROUS_EXTENSIONS = new Set([
  ".exe",
  ".bat",
  ".cmd",
  ".ps1",
  ".sh",
  ".com",
  ".msi",
  ".dll",
  ".so",
  ".dylib",
  ".sys",
  ".vbs",
  ".wsf",
  ".hta",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50 MB total workspace

function getWorkspaceRoot(request: NextRequest): string {
  const ws = request.nextUrl.searchParams.get("workspacePath") || ".";
  return path.resolve(ws);
}

function sandboxPath(request: NextRequest, relativePath: string): string {
  const root = getWorkspaceRoot(request);
  const resolved = path.resolve(root, relativePath);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error("Access denied: path escapes workspace sandbox");
  }
  return resolved;
}

function getRelativePath(request: NextRequest, absolutePath: string): string {
  const root = getWorkspaceRoot(request);
  return path.relative(root, absolutePath);
}

// ─── File Tree Builder ──────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
  children?: FileEntry[];
}

async function buildFileTree(
  dirPath: string,
  request: NextRequest,
  depth = 0,
  maxDepth = 8
): Promise<FileEntry[]> {
  if (depth >= maxDepth) return [];

  const entries: FileEntry[] = [];
  let items: Dirent[];

  try {
    items = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // Sort: directories first, then alphabetical
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  // Skip common non-user directories
  const skipDirs = new Set([
    "node_modules",
    ".git",
    "__pycache__",
    ".next",
    ".venv",
    "venv",
    ".tox",
    "dist",
    ".cache",
  ]);

  for (const item of items) {
    if (item.name.startsWith(".") && depth === 0) continue; // skip hidden files at root
    if (item.isDirectory() && skipDirs.has(item.name)) continue;

    const fullPath = path.join(dirPath, item.name);
    const relativePath = getRelativePath(request, fullPath);

    if (item.isDirectory()) {
      const children = await buildFileTree(fullPath, request, depth + 1, maxDepth);
      entries.push({
        name: item.name,
        path: relativePath,
        isDirectory: true,
        children,
      });
    } else {
      try {
        const stat = await fs.stat(fullPath);
        entries.push({
          name: item.name,
          path: relativePath,
          isDirectory: false,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        });
      } catch {
        entries.push({
          name: item.name,
          path: relativePath,
          isDirectory: false,
        });
      }
    }
  }

  return entries;
}

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const root = getWorkspaceRoot(request);
    const tree = await buildFileTree(root, request);
    return NextResponse.json({ files: tree, root });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: relativePath, content } = body;

    if (!relativePath || typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing 'path' or 'content' in request body" },
        { status: 400 }
      );
    }

    // Security: Check extension
    const ext = path.extname(relativePath).toLowerCase();
    if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `File extension '${ext}' is blocked for security` },
        { status: 403 }
      );
    }

    // Security: Size limit
    if (Buffer.byteLength(content, "utf-8") > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File content exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024} MB` },
        { status: 413 }
      );
    }

    const absolutePath = sandboxPath(request, relativePath);

    // Ensure parent directory exists
    const parentDir = path.dirname(absolutePath);
    await fs.mkdir(parentDir, { recursive: true });

    await fs.writeFile(absolutePath, content, "utf-8");
    return NextResponse.json({ success: true, path: relativePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { path: relativePath } = body;

    if (!relativePath) {
      return NextResponse.json(
        { error: "Missing 'path' in request body" },
        { status: 400 }
      );
    }

    const absolutePath = sandboxPath(request, relativePath);

    // Prevent deleting the workspace root
    const root = getWorkspaceRoot(request);
    if (absolutePath === root) {
      return NextResponse.json(
        { error: "Cannot delete the workspace root" },
        { status: 403 }
      );
    }

    const stat = await fs.stat(absolutePath);
    if (stat.isDirectory()) {
      await fs.rm(absolutePath, { recursive: true, force: true });
    } else {
      await fs.unlink(absolutePath);
    }

    return NextResponse.json({ success: true, path: relativePath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
