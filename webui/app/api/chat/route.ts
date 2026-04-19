import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

// ─── Tool Definitions ───────────────────────────────────────────────────────

const TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "read_file",
      description:
        "Read the contents of a file from the workspace. Returns the file content as a string.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file within the workspace",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file in the workspace. Creates the file (and any parent directories) if it doesn't exist. Overwrites if it does.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file within the workspace",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description:
        "List files and directories at the given path in the workspace. Returns names and types.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Relative path to the directory. Use '.' for the workspace root.",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "file_info",
      description:
        "Get metadata about a file or directory: size, modification time, type.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file or directory",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_file",
      description:
        "Delete a file or directory from the workspace. Be careful - this cannot be undone.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the file or directory to delete",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_directory",
      description: "Create a new directory (and any parent directories) in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "Relative path to the directory to create",
          },
        },
        required: ["path"],
      },
    },
  },
];

// ─── Security ────────────────────────────────────────────────────────────────

const DANGEROUS_EXTENSIONS = new Set([
  ".exe", ".bat", ".cmd", ".ps1", ".sh", ".com", ".msi", ".dll", ".so",
  ".dylib", ".sys", ".vbs", ".wsf", ".hta",
]);

function sandboxPath(workspaceRoot: string, relativePath: string): string {
  const resolved = path.resolve(workspaceRoot, relativePath);
  if (!resolved.startsWith(workspaceRoot + path.sep) && resolved !== workspaceRoot) {
    throw new Error(`Access denied: path "${relativePath}" escapes workspace`);
  }
  return resolved;
}

// ─── Tool Execution ─────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  workspaceRoot: string,
  readOnly: boolean
): Promise<string> {
  const filePath = typeof args.path === "string" ? args.path : "";

  // Write/delete operations blocked in read-only mode
  if (readOnly && ["write_file", "delete_file", "create_directory"].includes(name)) {
    return `Error: Operation "${name}" is blocked in read-only mode.`;
  }

  try {
    switch (name) {
      case "read_file": {
        const abs = sandboxPath(workspaceRoot, filePath);
        const content = await fs.readFile(abs, "utf-8");
        return content;
      }

      case "write_file": {
        const abs = sandboxPath(workspaceRoot, filePath);
        const content = typeof args.content === "string" ? args.content : "";
        const ext = path.extname(filePath).toLowerCase();
        if (ext && DANGEROUS_EXTENSIONS.has(ext)) {
          return `Error: File extension "${ext}" is blocked for security.`;
        }
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content, "utf-8");
        return `File written successfully: ${filePath}`;
      }

      case "list_directory": {
        const abs = sandboxPath(workspaceRoot, filePath);
        const entries = await fs.readdir(abs, { withFileTypes: true });
        const listing = entries
          .map((e) => `${e.isDirectory() ? "📁" : "📄"} ${e.name}`)
          .join("\n");
        return listing || "(empty directory)";
      }

      case "file_info": {
        const abs = sandboxPath(workspaceRoot, filePath);
        const stat = await fs.stat(abs);
        const info = [
          `Type: ${stat.isDirectory() ? "Directory" : "File"}`,
          `Size: ${stat.size} bytes`,
          `Modified: ${stat.mtime.toISOString()}`,
          `Created: ${stat.birthtime.toISOString()}`,
        ];
        return info.join("\n");
      }

      case "delete_file": {
        const abs = sandboxPath(workspaceRoot, filePath);
        const stat = await fs.stat(abs);
        if (stat.isDirectory()) {
          await fs.rm(abs, { recursive: true, force: true });
        } else {
          await fs.unlink(abs);
        }
        return `Deleted successfully: ${filePath}`;
      }

      case "create_directory": {
        const abs = sandboxPath(workspaceRoot, filePath);
        await fs.mkdir(abs, { recursive: true });
        return `Directory created: ${filePath}`;
      }

      default:
        return `Error: Unknown tool "${name}"`;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return `Error: ${message}`;
  }
}

// ─── SSE Helpers ─────────────────────────────────────────────────────────────

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    messages: chatMessages,
    apiUrl,
    temperature,
    maxTokens,
    readOnly,
    workspacePath,
  } = body;

  if (!apiUrl) {
    return new Response(sse({ type: "error", content: "API URL is required" }), {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const workspaceRoot = path.resolve(workspacePath || ".");

  const systemMessage: ChatMessage = {
    role: "system",
    content: `You are LLM Injector, an AI assistant that can perform file system operations on the user's behalf.

You have access to tools that let you read, write, list, and manage files in the workspace directory.

Important guidelines:
- Always use the tools to interact with files. Do not guess file contents.
- When asked to create files, think about the best structure and content.
- When asked to read files, summarize the important parts and provide relevant details.
- Be careful with delete operations — confirm with the user if the request is ambiguous.
- Use list_directory to explore the workspace before making assumptions.
- For code files, provide clear, well-commented, and functional code.
- If a tool call fails, analyze the error and try a different approach.

The workspace root is: ${workspaceRoot}`,
  };

  // Build conversation history - use array of mixed message types for the tool-use loop
  const allMessages: Record<string, unknown>[] = [systemMessage, ...(chatMessages || [])];

  // Streaming encoder
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(sse(event)));
      };

      let loopCount = 0;
      const MAX_TOOL_LOOPS = 15; // Prevent infinite loops

      try {
        while (loopCount < MAX_TOOL_LOOPS) {
          loopCount++;

          // Call LLM API
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "default",
              messages: allMessages,
              temperature: temperature ?? 0.7,
              max_tokens: maxTokens ?? 4096,
              stream: true,
              tools: TOOLS,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            send({
              type: "error",
              content: `LLM API error (${response.status}): ${errText}`,
            });
            break;
          }

          // Handle streaming response
          let fullContent = "";
          let toolCalls: ToolCall[] = [];

          const reader = response.body?.getReader();
          if (!reader) {
            send({ type: "error", content: "No response body from LLM API" });
            break;
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                if (!delta) continue;

                // Handle text content
                if (delta.content) {
                  fullContent += delta.content;
                  send({ type: "token", content: delta.content });
                }

                // Handle tool calls in streaming
                if (delta.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    while (toolCalls.length <= idx) {
                      toolCalls.push({
                        id: "",
                        type: "function",
                        function: { name: "", arguments: "" },
                      });
                    }
                    if (tc.id) toolCalls[idx].id = tc.id;
                    if (tc.function?.name) {
                      toolCalls[idx].function.name += tc.function.name;
                    }
                    if (tc.function?.arguments) {
                      toolCalls[idx].function.arguments += tc.function.arguments;
                    }
                  }
                }
              } catch {
                // Skip malformed JSON chunks
              }
            }
          }

          // If no tool calls, we're done — just send the final text
          if (toolCalls.length === 0) {
            send({ type: "done", content: fullContent });
            break;
          }

          // Process tool calls
          // Add assistant message with tool calls to conversation
          allMessages.push({
            role: "assistant",
            content: fullContent || "",
            tool_calls: toolCalls,
          });

          // Notify client about each tool call
          for (const tc of toolCalls) {
            const toolName = tc.function.name;
            let toolArgs: Record<string, unknown> = {};
            try {
              toolArgs = JSON.parse(tc.function.arguments || "{}");
            } catch {
              toolArgs = {};
            }

            send({
              type: "tool_call",
              id: tc.id,
              name: toolName,
              arguments: tc.function.arguments,
            });

            // Execute the tool
            const result = await executeTool(
              toolName,
              toolArgs,
              workspaceRoot,
              readOnly ?? false
            );

            send({
              type: "tool_result",
              id: tc.id,
              name: toolName,
              content: result,
              isError: result.startsWith("Error:"),
            });

            // Add tool result to conversation for next LLM call
            allMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });
          }
        }

        if (loopCount >= MAX_TOOL_LOOPS) {
          send({
            type: "error",
            content: "Maximum tool call loop reached. Please simplify your request.",
          });
        }

        send({ type: "done" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send({ type: "error", content: `Stream error: ${message}` });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
