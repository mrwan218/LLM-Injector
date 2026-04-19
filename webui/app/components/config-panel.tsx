"use client";

import { useChatStore } from "../store/chat-store";

export function ConfigPanel() {
  const settings = useChatStore((s) => s.settings);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const clearMessages = useChatStore((s) => s.clearMessages);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-5">
      {/* API Configuration */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          LLM API
        </h3>
        <div className="space-y-3">
          <div>
            <label
              htmlFor="apiUrl"
              className="block text-xs text-gray-400 mb-1"
            >
              API URL
            </label>
            <input
              id="apiUrl"
              type="text"
              value={settings.apiUrl}
              onChange={(e) => updateSettings({ apiUrl: e.target.value })}
              placeholder="http://localhost:1234/v1/chat/completions"
              className="w-full text-xs bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-colors font-mono"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              LM Studio or Ollama-compatible endpoint
            </p>
          </div>
        </div>
      </section>

      {/* Generation Parameters */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Generation
        </h3>
        <div className="space-y-4">
          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="temperature"
                className="text-xs text-gray-400"
              >
                Temperature
              </label>
              <span className="text-xs text-emerald-400 font-mono">
                {settings.temperature.toFixed(1)}
              </span>
            </div>
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) =>
                updateSettings({ temperature: parseFloat(e.target.value) })
              }
              className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>Precise</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="maxTokens"
                className="text-xs text-gray-400"
              >
                Max Tokens
              </label>
              <span className="text-xs text-emerald-400 font-mono">
                {settings.maxTokens}
              </span>
            </div>
            <input
              id="maxTokens"
              type="range"
              min="256"
              max="16384"
              step="256"
              value={settings.maxTokens}
              onChange={(e) =>
                updateSettings({ maxTokens: parseInt(e.target.value, 10) })
              }
              className="w-full h-1.5 bg-gray-700 rounded-full appearance-none cursor-pointer accent-emerald-500"
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>256</span>
              <span>16384</span>
            </div>
          </div>
        </div>
      </section>

      {/* Security */}
      <section>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Security
        </h3>
        <div className="space-y-3">
          {/* Read-only toggle */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-300">Read-only mode</span>
              <p className="text-[10px] text-gray-600">
                Block file modifications and deletions
              </p>
            </div>
            <button
              onClick={() => updateSettings({ readOnly: !settings.readOnly })}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                settings.readOnly ? "bg-emerald-600" : "bg-gray-600"
              }`}
              role="switch"
              aria-checked={settings.readOnly}
              aria-label="Toggle read-only mode"
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  settings.readOnly ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Workspace Path */}
          <div>
            <label
              htmlFor="workspacePath"
              className="block text-xs text-gray-400 mb-1"
            >
              Workspace Path
            </label>
            <input
              id="workspacePath"
              type="text"
              value={settings.workspacePath}
              onChange={(e) =>
                updateSettings({ workspacePath: e.target.value })
              }
              placeholder="."
              className="w-full text-xs bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-colors font-mono"
            />
            <p className="text-[10px] text-gray-600 mt-1">
              All file operations are sandboxed to this directory
            </p>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="pt-2 border-t border-gray-700/40">
        <button
          onClick={() => {
            if (window.confirm("Clear all messages?")) {
              clearMessages();
            }
          }}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-700/50 text-gray-400 hover:text-red-400 hover:border-red-800/50 hover:bg-red-900/10 transition-colors"
        >
          Clear Chat History
        </button>
      </section>
    </div>
  );
}
