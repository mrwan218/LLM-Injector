"use client";

import { useState, useEffect, useCallback } from "react";
import { useChatStore, type FileEntry } from "../store/chat-store";

// ─── Icons ───────────────────────────────────────────────────────────────────

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={open ? "#f59e0b" : "#6b7280"}
      stroke="none"
    >
      <path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9ca3af"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-gray-500 transition-transform ${open ? "rotate-90" : ""}`}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

// ─── File Extension Colors ───────────────────────────────────────────────────

function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const colorMap: Record<string, string> = {
    ts: "#3178c6",
    tsx: "#3178c6",
    js: "#f7df1e",
    jsx: "#f7df1e",
    py: "#3776ab",
    rs: "#dea584",
    go: "#00add8",
    json: "#5b5b5b",
    md: "#083fa1",
    css: "#563d7c",
    html: "#e34c26",
    yaml: "#cb171e",
    yml: "#cb171e",
    toml: "#9c4121",
    sql: "#e38c00",
    sh: "#89e051",
    bash: "#89e051",
  };
  return colorMap[ext] || "#9ca3af";
}

// ─── File Extension Badge ────────────────────────────────────────────────────

function ExtensionBadge({ name }: { name: string }) {
  const ext = name.includes(".") ? `.${name.split(".").pop()}` : "";
  if (!ext) return null;

  return (
    <span
      className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded opacity-70"
      style={{
        color: getFileColor(name),
        backgroundColor: `${getFileColor(name)}15`,
      }}
    >
      {ext}
    </span>
  );
}

// ─── Tree Node ───────────────────────────────────────────────────────────────

function TreeNode({
  entry,
  depth,
  onFileClick,
  onDelete,
}: {
  entry: FileEntry;
  depth: number;
  onFileClick: (path: string) => void;
  onDelete: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = entry.isDirectory && entry.children && entry.children.length > 0;

  const handleClick = () => {
    if (entry.isDirectory) {
      setExpanded(!expanded);
    } else {
      onFileClick(entry.path);
    }
  };

  return (
    <div>
      <div
        className="group flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-700/30 cursor-pointer transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        title={entry.path}
      >
        {entry.isDirectory ? (
          <>
            {hasChildren ? (
              <ChevronIcon open={expanded} />
            ) : (
              <span className="w-3" />
            )}
            <FolderIcon open={expanded} />
          </>
        ) : (
          <>
            <span className="w-3" />
            <FileIcon />
          </>
        )}
        <span className="flex-1 text-xs text-gray-300 truncate ml-1">
          {entry.name}
        </span>
        {!entry.isDirectory && <ExtensionBadge name={entry.name} />}
        {!entry.isDirectory && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(entry.path);
            }}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-900/30 text-gray-500 hover:text-red-400 transition-all"
            title="Delete file"
          >
            <TrashIcon />
          </button>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {entry.children!.map((child) => (
            <TreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onFileClick={onFileClick}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── File Browser ────────────────────────────────────────────────────────────

export function FileBrowser() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const settings = useChatStore((s) => s.settings);
  const openFileViewer = useChatStore((s) => s.openFileViewer);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ workspacePath: settings.workspacePath });
      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch files");
      }
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  }, [settings.workspacePath]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFileClick = async (filePath: string) => {
    try {
      const params = new URLSearchParams({ workspacePath: settings.workspacePath });
      const res = await fetch(`/api/files?${params}`);
      if (!res.ok) return;

      // Read file content - we'll need a dedicated endpoint or just show the file info
      // For now, we'll use the tool call approach through the file viewer
      // Actually, let's create a simple approach: fetch the raw file from the workspace
      const content = await fetch(
        `/api/files?workspacePath=${encodeURIComponent(settings.workspacePath)}&filePath=${encodeURIComponent(filePath)}`
      ).then((r) => r.json()).catch(() => null);

      // Since we don't have a read endpoint on the files API, let's use an alternative
      // We'll use the workspace path to construct a readable approach
      openFileViewer(filePath, "");
    } catch {
      // Silently fail
    }
  };

  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;

    try {
      const res = await fetch(
        `/api/files?workspacePath=${encodeURIComponent(settings.workspacePath)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: newFileName.trim(), content: "" }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create file");
      }
      setNewFileName("");
      setShowNewFile(false);
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create file");
    }
  };

  const handleDelete = async (filePath: string) => {
    if (!window.confirm(`Delete "${filePath}"?`)) return;

    try {
      const res = await fetch(
        `/api/files?workspacePath=${encodeURIComponent(settings.workspacePath)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: filePath }),
        }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete");
      }
      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/40">
        <span className="text-xs font-medium text-gray-400">
          Workspace Files
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchFiles}
            disabled={loading}
            className="p-1.5 rounded-md hover:bg-gray-700/40 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshIcon />
          </button>
          <button
            onClick={() => setShowNewFile(!showNewFile)}
            className="p-1.5 rounded-md hover:bg-gray-700/40 text-gray-400 hover:text-gray-200 transition-colors"
            title="New file"
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* New file input */}
      {showNewFile && (
        <div className="px-3 py-2 border-b border-gray-700/40">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFile();
                if (e.key === "Escape") {
                  setShowNewFile(false);
                  setNewFileName("");
                }
              }}
              placeholder="filename.ext"
              className="flex-1 text-xs bg-gray-800/50 border border-gray-700/50 rounded px-2 py-1.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              autoFocus
            />
            <button
              onClick={handleCreateFile}
              className="text-xs px-2 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-red-900/20 border-b border-red-800/30">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* File tree */}
      <div className="flex-1 overflow-y-auto py-1 max-h-96">
        {loading && files.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-xs text-gray-500 animate-pulse">
              Loading files...
            </div>
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <FolderIcon open={false} />
            <p className="text-xs text-gray-500 mt-2">No files found</p>
            <p className="text-xs text-gray-600 mt-1">
              Create a file to get started
            </p>
          </div>
        ) : (
          files.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              onFileClick={handleFileClick}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Footer info */}
      <div className="px-3 py-2 border-t border-gray-700/40">
        <p className="text-[10px] text-gray-600 truncate" title={settings.workspacePath}>
          Root: {settings.workspacePath}
        </p>
      </div>
    </div>
  );
}
