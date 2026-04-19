"use client";

import { useEffect, useState } from "react";
import { useChatStore } from "../store/chat-store";

// ─── Icons ───────────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// ─── Simple syntax highlighting ──────────────────────────────────────────────

function highlightSyntax(content: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";

  let escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Basic syntax highlighting for common languages
  if (["py", "js", "ts", "jsx", "tsx", "rs", "go", "sh", "bash", "yml", "yaml", "toml"].includes(ext)) {
    // Comments
    if (ext === "py") {
      escaped = escaped.replace(/(#.*$)/gm, '<span style="color:#6a9955">$1</span>');
    } else if (ext === "rs") {
      escaped = escaped.replace(/(\/\/.*$)/gm, '<span style="color:#6a9955">$1</span>');
    } else {
      escaped = escaped.replace(/(\/\/.*$)/gm, '<span style="color:#6a9955">$1</span>');
    }

    // Strings (double and single quoted)
    escaped = escaped.replace(
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
      '<span style="color:#ce9178">$1</span>'
    );

    // Keywords for Python
    if (ext === "py") {
      escaped = escaped.replace(
        /\b(import|from|def|class|return|if|elif|else|for|while|try|except|finally|with|as|raise|pass|break|continue|yield|lambda|and|or|not|in|is|True|False|None|async|await)\b/g,
        '<span style="color:#569cd6">$1</span>'
      );
    }

    // Keywords for JS/TS
    if (["js", "ts", "jsx", "tsx"].includes(ext)) {
      escaped = escaped.replace(
        /\b(const|let|var|function|return|if|else|for|while|switch|case|break|continue|new|this|class|extends|import|export|default|from|async|await|try|catch|finally|throw|typeof|instanceof|in|of|null|undefined|true|false|interface|type|enum)\b/g,
        '<span style="color:#569cd6">$1</span>'
      );
    }
  }

  // JSON highlighting
  if (ext === "json") {
    escaped = escaped.replace(
      /("(?:[^"\\]|\\.)*")\s*:/g,
      '<span style="color:#9cdcfe">$1</span>:'
    );
    escaped = escaped.replace(
      /:\s*("(?:[^"\\]|\\.)*")/g,
      ': <span style="color:#ce9178">$1</span>'
    );
  }

  return escaped;
}

// ─── File Viewer ─────────────────────────────────────────────────────────────

export function FileViewer() {
  const viewerFile = useChatStore((s) => s.viewerFile);
  const viewerContent = useChatStore((s) => s.viewerContent);
  const closeFileViewer = useChatStore((s) => s.closeFileViewer);
  const settings = useChatStore((s) => s.settings);

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lineCount, setLineCount] = useState(0);

  // Load file content when viewer opens
  useEffect(() => {
    if (viewerFile) {
      setLoading(true);
      setContent("");

      // We need to read the file content - since our files API doesn't have a read endpoint,
      // we'll create a workaround by using the workspace path
      // In a real scenario, the backend would serve file content
      // For now, we'll display a message to use the chat to read files
      const loadContent = async () => {
        try {
          // Try to fetch the raw file content through a simple approach
          // We use the fact that the workspace files are local
          const res = await fetch(
            `/api/files?workspacePath=${encodeURIComponent(settings.workspacePath)}&readFile=${encodeURIComponent(viewerFile)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.content) {
              setContent(data.content);
              setLineCount(data.content.split("\n").length);
            } else {
              setContent(viewerContent || "File is empty.");
              setLineCount(0);
            }
          } else {
            setContent(
              viewerContent ||
                `Unable to read file content. Ask the LLM to read this file using the chat interface.`
            );
          }
        } catch {
          setContent(
            viewerContent ||
              `Unable to read file content. Ask the LLM to read this file using the chat interface.`
          );
        } finally {
          setLoading(false);
        }
      };

      loadContent();
    }
  }, [viewerFile, viewerContent, settings.workspacePath]);

  if (!viewerFile) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeFileViewer();
      }}
    >
      <div className="w-full max-w-3xl max-h-[80vh] mx-4 bg-gray-800 border border-gray-700/50 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50 bg-gray-800/80">
          <div className="flex items-center gap-2 min-w-0">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flex-shrink-0"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-sm text-gray-200 truncate font-mono">
              {viewerFile}
            </span>
            {!loading && lineCount > 0 && (
              <span className="text-[10px] text-gray-500 flex-shrink-0">
                {lineCount} lines
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopy}
              disabled={loading}
              className="p-1.5 rounded-md hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
              title={copied ? "Copied!" : "Copy content"}
            >
              {copied ? (
                <CheckCircleIcon />
              ) : (
                <CopyIcon />
              )}
            </button>
            <button
              onClick={closeFileViewer}
              className="p-1.5 rounded-md hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-xs text-gray-500 animate-pulse">
                Loading file content...
              </div>
            </div>
          ) : (
            <pre className="p-4 text-sm font-mono leading-relaxed text-gray-300 whitespace-pre-wrap break-words">
              {content ? (
                <span
                  dangerouslySetInnerHTML={{
                    __html: highlightSyntax(content, viewerFile),
                  }}
                />
              ) : (
                <span className="text-gray-600 italic">No content</span>
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
