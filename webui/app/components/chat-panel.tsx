"use client";

import { useState, useRef, useEffect, useCallback, type FormEvent, type KeyboardEvent } from "react";
import { useChatStore, generateId, type Message } from "../store/chat-store";

// ─── Icons ───────────────────────────────────────────────────────────────────

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8V4H8" />
      <rect width="16" height="12" x="4" y="8" rx="2" />
      <path d="M2 14h2" />
      <path d="M20 14h2" />
      <path d="M15 13v2" />
      <path d="M9 13v2" />
    </svg>
  );
}

// ─── Tool Call Card ──────────────────────────────────────────────────────────

function ToolCallCard({
  name,
  args,
  result,
  isError,
}: {
  name: string;
  args: string;
  result?: string;
  isError?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  let parsedArgs: Record<string, string> = {};
  try {
    parsedArgs = JSON.parse(args || "{}");
  } catch {
    // keep empty
  }

  return (
    <div className="my-2 rounded-lg border border-gray-700/60 overflow-hidden bg-gray-800/50 animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700/30 transition-colors"
      >
        <span className="flex-shrink-0 text-emerald-400">
          {result ? (isError ? <ErrorIcon /> : <CheckIcon />) : <WrenchIcon />}
        </span>
        <span className="font-mono font-medium text-gray-200">{name}</span>
        {parsedArgs.path && (
          <span className="truncate text-gray-400 font-mono">
            {parsedArgs.path}
          </span>
        )}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`ml-auto text-gray-500 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-gray-700/40">
          {parsedArgs.path && (
            <div className="mt-2 text-xs">
              <span className="text-gray-500">Path: </span>
              <span className="text-gray-300 font-mono">{parsedArgs.path}</span>
            </div>
          )}
          {parsedArgs.content && (
            <div className="mt-1 text-xs">
              <span className="text-gray-500">Content: </span>
              <pre className="mt-1 p-2 bg-gray-900/60 rounded text-gray-300 font-mono text-xs overflow-x-auto max-h-32 overflow-y-auto whitespace-pre-wrap">
                {parsedArgs.content.length > 500
                  ? parsedArgs.content.slice(0, 500) + "..."
                  : parsedArgs.content}
              </pre>
            </div>
          )}
          {result && (
            <div className="mt-2 text-xs">
              <span className="text-gray-500">Result: </span>
              <pre
                className={`mt-1 p-2 rounded font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap ${
                  isError
                    ? "bg-red-900/20 text-red-300 border border-red-800/30"
                    : "bg-gray-900/60 text-gray-300"
                }`}
              >
                {result.length > 1000
                  ? result.slice(0, 1000) + "\n...(truncated)"
                  : result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Message Component ───────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  const [toolStates, setToolStates] = useState<
    Record<string, { args: string; result?: string; isError?: boolean }>
  >({});

  // Collect tool calls from the store's message updates
  // Tool calls and results are rendered as part of assistant messages
  useEffect(() => {
    if (msg.toolCalls) {
      setToolStates((prev) => {
        const next = { ...prev };
        for (const tc of msg.toolCalls || []) {
          if (!next[tc.id]) {
            next[tc.id] = { args: tc.arguments };
          }
        }
        return next;
      });
    }
  }, [msg.toolCalls]);

  useEffect(() => {
    if (msg.toolResults) {
      setToolStates((prev) => {
        const next = { ...prev };
        for (const tr of msg.toolResults || []) {
          next[tr.toolCallId] = {
            ...next[tr.toolCallId],
            result: tr.content,
            isError: tr.isError,
          };
        }
        return next;
      });
    }
  }, [msg.toolResults]);

  return (
    <div
      className={`flex gap-3 animate-slide-in ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser
            ? "bg-emerald-600/20 text-emerald-400"
            : "bg-gray-700/50 text-gray-300"
        }`}
      >
        {isUser ? <UserIcon /> : <BotIcon />}
      </div>

      {/* Content */}
      <div
        className={`max-w-[75%] min-w-0 ${isUser ? "text-right" : "text-left"}`}
      >
        {/* Role label */}
        <div
          className={`text-xs text-gray-500 mb-1 ${isUser ? "text-right" : "text-left"}`}
        >
          {isUser ? "You" : "LLM Injector"}
        </div>

        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            isUser
              ? "bg-emerald-600/20 text-gray-100 rounded-tr-md"
              : "bg-gray-800/60 text-gray-200 rounded-tl-md border border-gray-700/30"
          }`}
        >
          {/* Tool calls rendered above the text */}
          {!isUser && Object.keys(toolStates).length > 0 && (
            <div className="mb-2 space-y-1">
              {Object.entries(toolStates).map(([id, state]) => (
                <ToolCallCard
                  key={id}
                  name={
                    msg.toolCalls?.find((tc) => tc.id === id)?.name ||
                    "tool"
                  }
                  args={state.args}
                  result={state.result}
                  isError={state.isError}
                />
              ))}
            </div>
          )}

          {/* Text content */}
          {msg.content ? (
            <div className="message-content whitespace-pre-wrap break-words">
              {msg.content}
            </div>
          ) : !isUser && msg.isStreaming ? (
            <div className="typing-indicator flex items-center gap-1 py-1">
              <span />
              <span />
              <span />
            </div>
          ) : null}

          {/* Streaming tool call indicator */}
          {!isUser && msg.isStreaming && Object.keys(toolStates).length > 0 && (
            <div className="typing-indicator flex items-center gap-1 py-1 mt-1">
              <span />
              <span />
              <span />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat Panel ──────────────────────────────────────────────────────────────

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const appendToMessage = useChatStore((s) => s.appendToMessage);
  const settings = useChatStore((s) => s.settings);
  const isGenerating = useChatStore((s) => s.isGenerating);
  const setIsGenerating = useChatStore((s) => s.setIsGenerating);
  const setConnectionStatus = useChatStore((s) => s.setConnectionStatus);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input
  useEffect(() => {
    if (!isGenerating) {
      inputRef.current?.focus();
    }
  }, [isGenerating]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    setInput("");

    // Add user message
    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: trimmed,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    // Add placeholder assistant message
    const assistantId = generateId();
    addMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: Date.now(),
    });

    setIsGenerating(true);
    setConnectionStatus("connecting");

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const chatHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          apiUrl: settings.apiUrl,
          temperature: settings.temperature,
          maxTokens: settings.maxTokens,
          readOnly: settings.readOnly,
          workspacePath: settings.workspacePath,
        }),
        signal: abort.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      setConnectionStatus("connected");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed2 = line.trim();
          if (!trimmed2 || !trimmed2.startsWith("data: ")) continue;
          const data = trimmed2.slice(6);

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "token":
                appendToMessage(assistantId, event.content);
                break;
              case "tool_call": {
                const currentMsg = useChatStore.getState().messages.find(
                  (m) => m.id === assistantId
                );
                updateMessage(assistantId, {
                  toolCalls: [
                    ...(currentMsg?.toolCalls || []),
                    {
                      id: event.id,
                      name: event.name,
                      arguments: event.arguments,
                    },
                  ],
                });
                break;
              }
              case "tool_result": {
                const currentMsg2 = useChatStore.getState().messages.find(
                  (m) => m.id === assistantId
                );
                updateMessage(assistantId, {
                  toolResults: [
                    ...(currentMsg2?.toolResults || []),
                    {
                      toolCallId: event.id,
                      content: event.content,
                      isError: event.isError,
                    },
                  ],
                });
                break;
              }
              case "error":
                appendToMessage(
                  assistantId,
                  `\n\n⚠️ Error: ${event.content}`
                );
                break;
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        const errMsg =
          error instanceof Error ? error.message : "Unknown error";
        appendToMessage(
          assistantId,
          `\n\n⚠️ Connection error: ${errMsg}`
        );
        setConnectionStatus("disconnected");
      }
    } finally {
      updateMessage(assistantId, { isStreaming: false });
      setIsGenerating(false);
      abortRef.current = null;
    }
  }, [
    input,
    isGenerating,
    messages,
    settings,
    addMessage,
    updateMessage,
    appendToMessage,
    setIsGenerating,
    setConnectionStatus,
  ]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-600/10 flex items-center justify-center mb-4">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-400"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-200 mb-2">
              LLM Injector
            </h2>
            <p className="text-sm text-gray-500 max-w-md">
              Ask me to read, create, or modify files. I can explore your
              workspace and execute file operations using your local LLM.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                "List files in my workspace",
                "Create a new Python script",
                "Read and explain a file",
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion);
                    inputRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-xs rounded-full border border-gray-700/50 text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800/50 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700/50 bg-gray-900/80 backdrop-blur-sm px-4 py-3">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask LLM Injector to work with files..."
                rows={1}
                disabled={isGenerating}
                className="w-full resize-none rounded-xl border border-gray-700/50 bg-gray-800/50 px-4 py-3 pr-12 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 disabled:opacity-50 transition-colors"
                style={{
                  minHeight: "48px",
                  maxHeight: "200px",
                  height: "auto",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                }}
              />
            </div>
            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-red-600/80 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                aria-label="Stop generating"
              >
                <StopIcon />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white flex items-center justify-center transition-colors"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-600">
            <span>Shift+Enter for new line</span>
            <span>
              {settings.readOnly ? "🔒 Read-only mode" : "📝 Read-write mode"}
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
