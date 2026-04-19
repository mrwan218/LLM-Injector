import { create } from "zustand";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
  timestamp: number;
}

export interface Settings {
  apiUrl: string;
  temperature: number;
  maxTokens: number;
  readOnly: boolean;
  workspacePath: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  modified?: string;
  children?: FileEntry[];
}

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

// ─── Store ───────────────────────────────────────────────────────────────────

interface ChatStore {
  // Messages
  messages: Message[];
  addMessage: (msg: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  clearMessages: () => void;
  appendToMessage: (id: string, text: string) => void;

  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Settings
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;

  // UI
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeConfigTab: "files" | "config";
  setActiveConfigTab: (tab: "files" | "config") => void;

  // File viewer
  viewerFile: string | null;
  viewerContent: string | null;
  openFileViewer: (path: string, content: string) => void;
  closeFileViewer: () => void;

  // Loading state
  isGenerating: boolean;
  setIsGenerating: (val: boolean) => void;
}

let messageIdCounter = 0;

export const useChatStore = create<ChatStore>((set, get) => ({
  // Messages
  messages: [],
  addMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  clearMessages: () => set({ messages: [] }),
  appendToMessage: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m
      ),
    })),

  // Connection
  connectionStatus: "disconnected",
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Settings
  settings: {
    apiUrl: "http://localhost:1234/v1/chat/completions",
    temperature: 0.7,
    maxTokens: 4096,
    readOnly: false,
    workspacePath: ".",
  },
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),

  // UI
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  activeConfigTab: "files",
  setActiveConfigTab: (tab) => set({ activeConfigTab: tab }),

  // File viewer
  viewerFile: null,
  viewerContent: null,
  openFileViewer: (path, content) =>
    set({ viewerFile: path, viewerContent: content }),
  closeFileViewer: () => set({ viewerFile: null, viewerContent: null }),

  // Loading
  isGenerating: false,
  setIsGenerating: (val) => set({ isGenerating: val }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function generateId(): string {
  messageIdCounter += 1;
  return `msg-${Date.now()}-${messageIdCounter}`;
}
