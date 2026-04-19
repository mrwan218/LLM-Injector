"use client";

import { useChatStore } from "./store/chat-store";
import { ChatPanel } from "./components/chat-panel";
import { FileBrowser } from "./components/file-browser";
import { ConfigPanel } from "./components/config-panel";
import { FileViewer } from "./components/file-viewer";

export default function Home() {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const activeConfigTab = useChatStore((s) => s.activeConfigTab);
  const setActiveConfigTab = useChatStore((s) => s.setActiveConfigTab);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-900">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-80 min-w-[320px]" : "w-0 min-w-0"
        } transition-all duration-300 ease-in-out bg-gray-850 border-r border-gray-700/50 flex flex-col overflow-hidden`}
        style={{ backgroundColor: "#1a1f2e" }}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
          <div className="flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-400"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <span className="font-semibold text-sm text-gray-200">
              LLM Injector
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded-md hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close sidebar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-gray-700/50">
          <button
            onClick={() => setActiveConfigTab("files")}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeConfigTab === "files"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Files
          </button>
          <button
            onClick={() => setActiveConfigTab("config")}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeConfigTab === "config"
                ? "text-emerald-400 border-b-2 border-emerald-400"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Settings
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeConfigTab === "files" ? <FileBrowser /> : <ConfigPanel />}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700/50 bg-gray-900/80 backdrop-blur-sm">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md hover:bg-gray-700/50 text-gray-400 hover:text-gray-200 transition-colors"
              aria-label="Open sidebar"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-gray-300 font-medium">Chat</span>
          </div>
          <div className="ml-auto text-xs text-gray-500">
            Powered by local LLM
          </div>
        </header>

        {/* Chat Area */}
        <ChatPanel />
      </main>

      {/* File Viewer Modal */}
      <FileViewer />
    </div>
  );
}
