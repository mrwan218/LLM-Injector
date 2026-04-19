@echo off
REM ============================================================================
REM LLM Injector — Automatic Installation Script (Windows)
REM ============================================================================
REM This script installs all dependencies for both the CLI and WebUI.
REM
REM Usage:
REM   install.bat              Full install (CLI + WebUI)
REM   install.bat --cli-only   Install only the Python CLI
REM   install.bat --webui-only Install only the WebUI
REM   install.bat --skip-checks Skip system requirement checks
REM ============================================================================

setlocal enabledelayedexpansion

set "CLI_ONLY=false"
set "WEBUI_ONLY=false"
set "SKIP_CHECKS=false"

REM Parse arguments
for %%a in (%*) do (
    if "%%a"=="--cli-only" set "CLI_ONLY=true"
    if "%%a"=="--webui-only" set "WEBUI_ONLY=true"
    if "%%a"=="--skip-checks" set "SKIP_CHECKS=true"
    if "%%a"=="--help" (
        echo Usage: %~nx0 [--cli-only] [--webui-only] [--skip-checks]
        echo.
        echo   --cli-only      Install only the Python CLI (no WebUI)
        echo   --webui-only    Install only the Next.js WebUI (no Python CLI)
        echo   --skip-checks   Skip system requirement checks
        echo   --help          Show this help message
        exit /b 0
    )
)

REM Get the directory where this script lives
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

echo.
echo  ========================================
echo  =      LLM Injector Installer         =
echo  =     CLI + WebUI Setup (Windows)     =
echo  ========================================
echo.

REM ---------------------------------------------------------------------------
REM Step 1: Check system requirements
REM ---------------------------------------------------------------------------
if not "%SKIP_CHECKS%"=="true" (
    echo [Step 1] Checking system requirements...
    echo ----------------------------------------

    REM Check Python
    where python >nul 2>&1
    if %ERRORLEVEL%==0 (
        for /f "tokens=2" %%v in ('python --version 2^>^&1') do (
            echo [OK] Python %%v found
        )
    ) else (
        echo [ERROR] Python 3.9+ is required but not found.
        echo   Download from: https://www.python.org/downloads/
        echo   Make sure to check "Add Python to PATH" during install.
        pause
        exit /b 1
    )

    REM Check pip
    where pip >nul 2>&1
    if %ERRORLEVEL%==0 (
        echo [OK] pip found
    ) else (
        echo [WARN] pip not found. Attempting to install...
        python -m ensurepip --upgrade
        if %ERRORLEVEL% neq 0 (
            echo [ERROR] Could not install pip.
            pause
            exit /b 1
        )
    )

    if not "%CLI_ONLY%"=="true" (
        REM Check Node.js
        where node >nul 2>&1
        if %ERRORLEVEL%==0 (
            for /f "tokens=2" %%v in ('node --version 2^>^&1') do (
                echo [OK] Node.js %%v found
            )
        ) else (
            echo [ERROR] Node.js 18+ is required for the WebUI but not found.
            echo   Download from: https://nodejs.org/
            pause
            exit /b 1
        )

        REM Check npm
        where npm >nul 2>&1
        if %ERRORLEVEL%==0 (
            echo [OK] npm found
        ) else (
            echo [ERROR] npm not found.
            pause
            exit /b 1
        )
    )

    echo.
) else (
    echo [INFO] Skipping system requirement checks (--skip-checks)
)

REM ---------------------------------------------------------------------------
REM Step 2: Install Python CLI
REM ---------------------------------------------------------------------------
if not "%WEBUI_ONLY%"=="true" (
    echo [Step 2] Setting up Python CLI...
    echo ----------------------------------------

    set "VENV_DIR=%SCRIPT_DIR%venv"

    if exist "%VENV_DIR%" (
        echo [WARN] Virtual environment already exists at venv\
        echo [INFO] To recreate, delete the venv folder and re-run this script.
    ) else (
        echo [INFO] Creating virtual environment...
        python -m venv venv
        if %ERRORLEVEL% neq 0 (
            echo [ERROR] Failed to create virtual environment.
            pause
            exit /b 1
        )
        echo [OK] Virtual environment created
    )

    echo [INFO] Activating virtual environment...
    call venv\Scripts\activate.bat
    echo [OK] Virtual environment activated

    echo [INFO] Upgrading pip...
    python -m pip install --upgrade pip --quiet
    echo [OK] pip upgraded

    if exist "requirements.txt" (
        echo [INFO] Installing Python dependencies...
        pip install -r requirements.txt --quiet
        if %ERRORLEVEL% neq 0 (
            echo [ERROR] Failed to install Python dependencies.
            pause
            exit /b 1
        )
        echo [OK] Python dependencies installed
    ) else (
        echo [ERROR] requirements.txt not found!
        pause
        exit /b 1
    )

    if not exist "workspace" (
        echo [INFO] Creating workspace directory...
        mkdir workspace
        echo [OK] Workspace directory created
    ) else (
        echo [OK] Workspace directory exists
    )

    REM Create sample files if workspace is empty
    dir /b workspace | findstr "^" >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [INFO] Creating sample workspace files...
        echo Hello, World! This is a test file. > workspace\hello.txt
        (
            echo # Workspace Notes
            echo.
            echo This directory is your sandboxed workspace.
            echo LLM Injector can read, write, and manage files here.
            echo.
            echo ## Getting Started
            echo 1. Start LLM Studio and load a model
            echo 2. Run: python llm_injector.py
            echo 3. Try: "What files are in the workspace?"
        ) > workspace\notes.md
        echo [OK] Sample files created
    )

    echo.
)

REM ---------------------------------------------------------------------------
REM Step 3: Install WebUI
REM ---------------------------------------------------------------------------
if not "%CLI_ONLY%"=="true" (
    echo [Step 3] Setting up WebUI...
    echo ----------------------------------------

    set "WEBUI_DIR=%SCRIPT_DIR%webui"

    if not exist "%WEBUI_DIR%" (
        echo [ERROR] WebUI directory not found at webui\
        pause
        exit /b 1
    )

    cd /d "%WEBUI_DIR%"

    echo [INFO] Installing Node.js dependencies (this may take a moment^)...
    call npm install --loglevel=error
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo [OK] Node.js dependencies installed

    echo [INFO] Building Next.js WebUI...
    call npm run build --loglevel=error
    if %ERRORLEVEL% neq 0 (
        echo [WARN] Build had warnings, but install completed.
    ) else (
        echo [OK] WebUI built successfully
    )

    cd /d "%SCRIPT_DIR%"
    echo.
)

REM ---------------------------------------------------------------------------
REM Step 4: Summary
REM ---------------------------------------------------------------------------
echo [Step 4] Installation Complete!
echo ========================================
echo.
echo   LLM Injector is ready to use!
echo.

if not "%WEBUI_ONLY%"=="true" (
    echo   ^> Python CLI
    echo     Activate:  venv\Scripts\activate
    echo     Run:       python llm_injector.py
    echo     Read-only: python llm_injector.py --readonly
    echo.
)

if not "%CLI_ONLY%"=="true" (
    echo   ^> WebUI
    echo     Dev server: cd webui ^&^& npm run dev
    echo     Production: cd webui ^&^& npm start
    echo     Open:       http://localhost:3000
    echo.
)

echo   ^> Prerequisites
echo     Make sure LLM Studio is running with a loaded model
echo     Default API: http://localhost:1234/v1/chat/completions
echo.
echo   ^> Configuration
echo     Edit config.yaml to customize settings
echo.
echo   Repository: https://github.com/mrwan218/LLM-Injector
echo.
pause
