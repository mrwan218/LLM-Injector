# LLM Injector

A Python wrapper program that connects natural language requests to a locally running LLM (via LLM Studio's API) and safely executes file system operations based on the model's structured tool-use responses. Includes a modern WebUI built with Next.js.

## Overview

LLM Injector acts as a bridge between an LLM and your operating system, enabling the AI to interact with real files — without modifying LLM Studio itself. It provides a secure sandboxed environment where all file operations are restricted to a designated workspace directory.

**Key Features:**
- Read, write, list, and inspect files via natural language
- Workspace sandboxing with path traversal protection
- Configurable read-only mode
- Session-level byte quotas
- Blocked extension filtering
- Full operation logging
- Conversation memory across multiple turns
- Streaming response support
- **Modern WebUI with real-time chat, file browser, and configuration panel**

## Prerequisites

| Requirement | Details |
|---|---|
| Python | 3.9 or higher (for CLI) |
| Node.js | 18+ (for WebUI) |
| LLM Studio | Download from [lmstudio.ai](https://lmstudio.ai) |
| Local LLM | Any model supporting function calling (e.g., Llama 3, Mistral) |

---

## One-Click Install (Recommended)

An automatic installation script handles everything for you — Python venv, pip dependencies, Node.js modules, and the WebUI build.

### Linux / macOS

```bash
# Clone the repository
git clone https://github.com/mrwan218/LLM-Injector.git
cd LLM-Injector

# Make the script executable and run it
chmod +x install.sh
./install.sh
```

### Windows

```cmd
REM Clone the repository
git clone https://github.com/mrwan218/LLM-Injector.git
cd LLM-Injector

REM Run the installer
install.bat
```

### Install Options

| Option | Description |
|---|---|
| `./install.sh` | Full install (CLI + WebUI) |
| `./install.sh --cli-only` | Install only the Python CLI |
| `./install.sh --webui-only` | Install only the WebUI |
| `./install.sh --skip-checks` | Skip system requirement checks |
| `./install.sh --help` | Show all available options |

The script will:
1. Check for Python 3.9+ and Node.js 18+
2. Create a Python virtual environment and install pip dependencies
3. Create the workspace directory with sample files
4. Install Node.js dependencies and build the WebUI

---

## Quick Start — CLI

If you already ran the install script, the CLI is ready. Just activate the venv:

```bash
source venv/bin/activate    # Linux/Mac
venv\Scripts\activate       # Windows
```

### Manual Setup (without install script)

```bash
git clone https://github.com/mrwan218/LLM-Injector.git
cd LLM-Injector

python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Start LLM Studio

1. Launch **LM Studio**
2. Load a model (recommended: Llama 3, Mistral, or any model that supports JSON output)
3. Start the **local server** (usually on `http://localhost:1234`)
4. Verify the server is running by visiting `http://localhost:1234/v1/models` in your browser

### Run LLM Injector

```bash
# Basic usage (default settings)
python llm_injector.py

# Custom workspace directory
python llm_injector.py --workspace /path/to/my/workspace

# Read-only mode (no file modifications)
python llm_injector.py --readonly

# Custom API endpoint
python llm_injector.py --api-url http://localhost:8080/v1/chat/completions

# Using a specific config file
python llm_injector.py --config my_config.yaml
```

---

## Quick Start — WebUI

If you already ran the install script, the WebUI is built. Just start it:

```bash
cd webui
npm run dev    # Development server
cd .. && cd webui && npm start   # Production server
```

### Manual Setup (without install script)

```bash
cd webui
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Configure

- Click the **Settings** tab in the sidebar to configure:
  - **API URL** — Your LLM Studio endpoint (default: `http://localhost:1234/v1/chat/completions`)
  - **Temperature** — Controls response randomness (0–2)
  - **Max Tokens** — Maximum response length (256–16384)
  - **Read-Only Mode** — Disable file write operations
  - **Workspace Path** — Path to the sandboxed workspace directory

### Build for Production

```bash
cd webui
npm run build
npm start
```

---

## Example Conversation

```
You: What files are in the workspace?
AI: The workspace contains the following files:
  - hello.txt (45 bytes)
  - notes.md (320 bytes)

You: Read hello.txt
AI: The contents of hello.txt are:
  "Hello, World! This is a test file."

You: Create a new file called summary.txt with a summary of hello.txt
AI: Done! I've created summary.txt with the summary.
```

---

## Project Structure

```
llm_injector/
├── install.sh               # Auto-install script (Linux/Mac)
├── install.bat              # Auto-install script (Windows)
├── llm_injector.py          # Main CLI wrapper script with conversation loop
├── tools.py                 # File system functions + security checks
├── config.yaml              # User-configurable settings
├── requirements.txt         # Python dependencies
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── workspace/               # Default sandbox folder
│   ├── hello.txt            # Sample test file
│   └── notes.md             # Sample notes file
└── webui/                   # Next.js Web Application
    ├── package.json         # Node.js dependencies
    ├── next.config.js       # Next.js configuration
    ├── tsconfig.json        # TypeScript configuration
    ├── tailwind.config.ts   # Tailwind CSS configuration
    ├── postcss.config.js    # PostCSS configuration
    ├── app/
    │   ├── layout.tsx       # Root layout with dark theme
    │   ├── page.tsx         # Main page (sidebar + chat)
    │   ├── globals.css      # Global styles
    │   ├── api/
    │   │   ├── chat/route.ts    # SSE streaming chat endpoint
    │   │   └── files/route.ts   # File management API
    │   ├── store/
    │   │   └── chat-store.ts    # Zustand state management
    │   └── components/
    │       ├── chat-panel.tsx   # Chat interface
    │       ├── file-browser.tsx # File tree sidebar
    │       ├── config-panel.tsx # Settings panel
    │       └── file-viewer.tsx  # File content viewer
    └── ...
```

---

## Available Tools

| Tool | Description | Arguments |
|---|---|---|
| `read_file` | Read contents of a text file | `filepath` (required) |
| `write_file` | Write or overwrite a text file | `filepath` (required), `content` (required) |
| `list_directory` | List files and subdirectories | `directory` (optional, default ".") |
| `file_info` | Get file metadata | `filepath` (required) |
| `delete_file` | Delete a file | `filepath` (required) |
| `create_directory` | Create a new directory | `directory` (required) |

---

## Configuration (config.yaml)

Edit `config.yaml` to customize CLI behavior:

```yaml
# Workspace sandbox directory
workspace: "./workspace"

# Read-only mode (disables writes)
read_only: false

# File size limits
max_read_size_mb: 1
max_write_size_mb: 10

# Session quota (total bytes across all operations)
session_quota_mb: 50

# Blocked file extensions
blocked_extensions:
  - ".exe"
  - ".sh"
  - ".bat"
  - ".cmd"

# LLM Studio settings
api_url: "http://localhost:1234/v1/chat/completions"
model_name: "local-model"
temperature: 0.2
max_tokens: 2048
```

---

## Security

LLM Injector implements multiple layers of security:

1. **Workspace Sandboxing** — All file paths are resolved relative to the workspace directory. Any attempt to access paths outside the workspace (e.g., `../../../etc/passwd`) is rejected.

2. **Path Traversal Prevention** — Uses `os.path.realpath()` to canonicalize paths before validation, preventing directory traversal attacks.

3. **Extension Filtering** — Configurable lists of blocked and allowed file extensions prevent execution of dangerous file types (`.exe`, `.bat`, `.sh`, `.dll`, `.sys`, `.bin`, etc.).

4. **Size Limits** — Individual file read/write operations are capped, and a session-level quota prevents excessive resource usage.

5. **Read-Only Mode** — A single flag disables all write operations for safe exploration.

6. **Operation Logging** — Every tool call is logged with timestamps, arguments, and results for auditing.

---

## Built-in CLI Commands

While in the interactive CLI session:

| Command | Description |
|---|---|
| `exit` or `quit` | Exit the program |
| `stats` | Show session byte usage statistics |
| `clear` | Clear conversation history |

---

## WebUI Features

- **Real-time Streaming** — See LLM responses as they're generated with Server-Sent Events
- **Tool Call Visualization** — Watch tool calls and their results in expandable cards
- **File Browser** — Browse, create, and delete workspace files from the sidebar
- **File Viewer** — Click any file to view its contents in a modal with syntax highlighting
- **Configuration Panel** — Adjust API URL, temperature, max tokens, read-only mode, and workspace path
- **Dark Theme** — Professional dark UI inspired by modern AI chat interfaces
- **Responsive Layout** — Collapsible sidebar for more chat space

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Could not connect to LLM Studio" | Make sure LLM Studio is running and the local server is started |
| "Tool not recognized" | The LLM may be outputting malformed JSON — try a more capable model |
| Path traversal not blocked | Ensure you're using the latest version; check your config |
| Binary file error | Binary files are automatically detected and rejected for reading |
| WebUI 404 on files | Ensure the workspace directory exists and is accessible |
| WebUI not connecting | Verify the API URL in Settings matches your LLM Studio endpoint |
| Install script fails on Python | Make sure Python 3.9+ is in your PATH. On Windows, re-run the installer with "Add to PATH" checked |
| Install script fails on npm | Ensure Node.js 18+ is installed from [nodejs.org](https://nodejs.org) |
| Permission denied on install.sh | Run `chmod +x install.sh` first, then `./install.sh` |

---

## License

This project is provided as-is for educational and personal use. Use at your own risk.
