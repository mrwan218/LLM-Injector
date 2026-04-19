#!/usr/bin/env bash
# ============================================================================
# LLM Injector — Automatic Installation Script
# ============================================================================
# This script installs all dependencies for both the CLI and WebUI.
#
# Usage:
#   chmod +x install.sh
#   ./install.sh              # Full install (CLI + WebUI)
#   ./install.sh --cli-only   # Install only the Python CLI
#   ./install.sh --webui-only # Install only the WebUI
#   ./install.sh --skip-checks # Skip system requirement checks
#
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; }

banner() {
    echo -e "${CYAN}"
    echo "  ╔══════════════════════════════════════════╗"
    echo "  ║         LLM Injector Installer           ║"
    echo "  ║   CLI + WebUI — One-click setup          ║"
    echo "  ╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

check_cmd() {
    if command -v "$1" &>/dev/null; then
        local version
        version=$("$1" "$2" 2>/dev/null || true)
        success "$1 found ${version:+($version)}"
        return 0
    else
        error "$1 is not installed."
        return 1
    fi
}

separator() {
    echo -e "${BOLD}────────────────────────────────────────────${NC}"
}

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
CLI_ONLY=false
WEBUI_ONLY=false
SKIP_CHECKS=false

for arg in "$@"; do
    case "$arg" in
        --cli-only)     CLI_ONLY=true ;;
        --webui-only)   WEBUI_ONLY=true ;;
        --skip-checks)  SKIP_CHECKS=true ;;
        --help|-h)
            echo "Usage: $0 [--cli-only] [--webui-only] [--skip-checks]"
            echo ""
            echo "  --cli-only      Install only the Python CLI (no WebUI)"
            echo "  --webui-only    Install only the Next.js WebUI (no Python CLI)"
            echo "  --skip-checks   Skip system requirement checks"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            warn "Unknown argument: $arg"
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Determine project directory
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ---------------------------------------------------------------------------
# Start
# ---------------------------------------------------------------------------
banner

# ---------------------------------------------------------------------------
# Step 1: Check system requirements
# ---------------------------------------------------------------------------
if ! $SKIP_CHECKS; then
    echo -e "${BOLD}Step 1: Checking system requirements${NC}"
    separator

    PYTHON_OK=false
    NODE_OK=false

    # Check Python 3
    if check_cmd python3 --version 2>/dev/null; then
        PYTHON_CMD="python3"
        PYTHON_OK=true
    elif check_cmd python --version 2>/dev/null; then
        # Verify it's Python 3+
        PY_VER=$(python --version 2>&1 | grep -oP '\d+')
        if [ "$PY_VER" -ge 3 ]; then
            PYTHON_CMD="python"
            PYTHON_OK=true
        else
            error "Python 2 detected. Python 3.9+ is required."
        fi
    fi

    if [ "$PYTHON_OK" = false ]; then
        error "Python 3.9+ is required but not found."
        echo -e "  Install it from: ${CYAN}https://www.python.org/downloads/${NC}"
        exit 1
    fi

    # Check pip
    if ! command -v pip3 &>/dev/null && ! command -v pip &>/dev/null; then
        warn "pip not found. Attempting to install..."
        $PYTHON_CMD -m ensurepip --upgrade 2>/dev/null || {
            error "Could not install pip. Please install it manually."
            exit 1
        }
    fi
    success "pip found"

    # Check Node.js (only if WebUI is needed)
    if ! $CLI_ONLY; then
        if check_cmd node --version 2>/dev/null; then
            NODE_OK=true
        else
            error "Node.js 18+ is required for the WebUI but not found."
            echo -e "  Install it from: ${CYAN}https://nodejs.org/${NC}"
            echo -e "  Or use: ${CYAN}curl -fsSL https://fnm.vercel.app/install | bash && fnm install 18${NC}"
            exit 1
        fi

        # Check npm
        if check_cmd npm --version 2>/dev/null; then
            true
        else
            error "npm not found. It should come with Node.js."
            exit 1
        fi
    fi

    # Check git (optional)
    if command -v git &>/dev/null; then
        success "git found"
    else
        warn "git not found (optional, for version control)"
    fi

    echo ""
else
    info "Skipping system requirement checks (--skip-checks)"
fi

# ---------------------------------------------------------------------------
# Step 2: Install Python CLI
# ---------------------------------------------------------------------------
if ! $WEBUI_ONLY; then
    echo -e "${BOLD}Step 2: Setting up Python CLI${NC}"
    separator

    # Create virtual environment
    VENV_DIR="$SCRIPT_DIR/venv"

    if [ -d "$VENV_DIR" ]; then
        warn "Virtual environment already exists at $VENV_DIR"
        info "To recreate it, delete the folder and re-run this script."
    else
        info "Creating virtual environment..."
        $PYTHON_CMD -m venv "$VENV_DIR"
        success "Virtual environment created at $VENV_DIR"
    fi

    # Activate venv
    info "Activating virtual environment..."
    # shellcheck source=/dev/null
    source "$VENV_DIR/bin/activate"
    success "Virtual environment activated"

    # Upgrade pip
    info "Upgrading pip..."
    pip install --upgrade pip --quiet
    success "pip upgraded"

    # Install Python dependencies
    if [ -f "requirements.txt" ]; then
        info "Installing Python dependencies from requirements.txt..."
        pip install -r requirements.txt --quiet
        success "Python dependencies installed"
    else
        error "requirements.txt not found!"
        exit 1
    fi

    # Create workspace directory if it doesn't exist
    if [ ! -d "workspace" ]; then
        info "Creating workspace directory..."
        mkdir -p workspace
        success "Workspace directory created"
    else
        success "Workspace directory exists"
    fi

    # Create sample files if workspace is empty
    if [ -z "$(ls -A workspace)" ]; then
        info "Creating sample workspace files..."
        echo "Hello, World! This is a test file." > workspace/hello.txt
        cat > workspace/notes.md << 'EOF'
# Workspace Notes

This directory is your sandboxed workspace.
LLM Injector can read, write, and manage files here.

## Getting Started
1. Start LLM Studio and load a model
2. Run: python llm_injector.py
3. Try: "What files are in the workspace?"
EOF
        success "Sample files created"
    fi

    echo ""
fi

# ---------------------------------------------------------------------------
# Step 3: Install WebUI
# ---------------------------------------------------------------------------
if ! $CLI_ONLY; then
    echo -e "${BOLD}Step 3: Setting up WebUI${NC}"
    separator

    WEBUI_DIR="$SCRIPT_DIR/webui"

    if [ ! -d "$WEBUI_DIR" ]; then
        error "WebUI directory not found at $WEBUI_DIR"
        exit 1
    fi

    cd "$WEBUI_DIR"

    # Check if node_modules exists
    if [ -d "node_modules" ]; then
        warn "node_modules already exists. Running npm install to update..."
    fi

    # Install Node.js dependencies
    info "Installing Node.js dependencies (this may take a moment)..."
    npm install --loglevel=error

    if [ $? -eq 0 ]; then
        success "Node.js dependencies installed"
    else
        error "npm install failed!"
        exit 1
    fi

    # Build the Next.js project
    info "Building Next.js WebUI..."
    npm run build --loglevel=error

    if [ $? -eq 0 ]; then
        success "WebUI built successfully"
    else
        warn "Build had warnings, but install completed."
        warn "You can run 'npm run dev' to start the development server."
    fi

    cd "$SCRIPT_DIR"
    echo ""
fi

# ---------------------------------------------------------------------------
# Step 4: Summary
# ---------------------------------------------------------------------------
echo -e "${BOLD}Step 4: Installation Complete!${NC}"
separator
echo ""
echo -e "${GREEN}${BOLD}  LLM Injector is ready to use!${NC}"
echo ""

if ! $WEBUI_ONLY; then
    echo -e "  ${CYAN}▶ Python CLI${NC}"
    echo -e "    Activate venv:  ${BOLD}source venv/bin/activate${NC}"
    echo -e "    Run:            ${BOLD}python llm_injector.py${NC}"
    echo -e "    Read-only:      ${BOLD}python llm_injector.py --readonly${NC}"
    echo ""
fi

if ! $CLI_ONLY; then
    echo -e "  ${CYAN}▶ WebUI${NC}"
    echo -e "    Dev server:     ${BOLD}cd webui && npm run dev${NC}"
    echo -e "    Production:     ${BOLD}cd webui && npm start${NC}"
    echo -e "    Open browser:   ${BOLD}http://localhost:3000${NC}"
    echo ""
fi

echo -e "  ${CYAN}▶ Prerequisites${NC}"
echo -e "    Make sure ${BOLD}LLM Studio${NC} is running with a loaded model"
echo -e "    Default API: ${BOLD}http://localhost:1234/v1/chat/completions${NC}"
echo ""
echo -e "  ${CYAN}▶ Configuration${NC}"
echo -e "    Edit ${BOLD}config.yaml${NC} to customize settings"
echo ""
separator
echo -e "  ${BOLD}Repository:${NC} https://github.com/mrwan218/LLM-Injector"
echo ""
