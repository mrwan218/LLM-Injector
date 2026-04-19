#!/usr/bin/env python3
"""
LLM Injector – A wrapper for file system access via LLM Studio.

This program connects natural language requests to a locally running LLM
(via LLM Studio's OpenAI-compatible API) and safely executes file system
operations based on the model's structured tool-use responses.

Usage:
    python llm_injector.py [options]

Options:
    --workspace PATH    Workspace directory (default: ./workspace)
    --readonly          Enable read-only mode
    --api-url URL       LLM Studio API endpoint
    --config PATH       Path to config.yaml (default: ./config.yaml)
    --no-stream         Disable streaming responses
"""

import argparse
import json
import logging
import os
import re
import sys
from pathlib import Path

import yaml
import requests
from colorama import init as colorama_init, Fore, Style

# Import tool functions and registry
from tools import (
    TOOL_REGISTRY,
    configure,
    get_session_stats,
)

# ---------------------------------------------------------------------------
# ANSI colours (initialised by colorama for cross-platform support)
# ---------------------------------------------------------------------------
colorama_init(autoreset=True)
COLOR_USER = Fore.CYAN
COLOR_AI = Fore.GREEN
COLOR_TOOL = Fore.YELLOW
COLOR_ERROR = Fore.RED
COLOR_SYSTEM = Fore.MAGENTA
COLOR_DIM = Style.DIM

# ---------------------------------------------------------------------------
# System prompt template
# ---------------------------------------------------------------------------
SYSTEM_PROMPT_TEMPLATE = """\
You are an AI assistant that can interact with a file system on behalf of the user.

## Available Tools

{tool_descriptions}

## How to Use Tools

When you need to perform a file operation, output a JSON object with exactly this format:

```json
{{"tool": "tool_name", "arguments": {{"arg1": "value1", ...}}}}
```

### Rules:
1. You MUST output ONLY the JSON object – no other text, no markdown fencing, no explanation.
2. All file paths are RELATIVE to the workspace directory.
3. After receiving a tool result, use it to generate a natural language answer to the user.
4. If a tool returns an error, explain the error to the user in a friendly way.
5. NEVER try to access paths outside the workspace. The system will reject such attempts.
6. When listing directory contents, use list_directory first, then present results nicely.
7. When reading files, first confirm the file exists before reading.

### Available Tools:
{tool_list}
"""


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_CONFIG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.yaml")


def load_config(config_path: str) -> dict:
    """Load configuration from a YAML file, falling back to defaults."""
    cfg = {}
    if os.path.isfile(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = yaml.safe_load(f) or {}
        except Exception as e:
            print(f"{COLOR_ERROR}Warning: Could not load config file '{config_path}': {e}{Style.RESET_ALL}")
            print(f"{COLOR_SYSTEM}Using default settings.{Style.RESET_ALL}")
    return cfg


def build_system_prompt() -> str:
    """Generate the system prompt with tool descriptions embedded."""
    tool_descriptions = []
    tool_list = []

    for name, info in TOOL_REGISTRY.items():
        args_desc = []
        for arg_name, arg_info in info["arguments"].items():
            required = arg_info.get("required", False)
            default = arg_info.get("default", None)
            req_str = " (required)" if required else f" (optional, default: {json.dumps(default)})"
            args_desc.append(f'      - "{arg_name}": string{req_str}')

        args_block = "\n".join(args_desc)
        tool_descriptions.append(
            f'- **{name}**: {info["description"]}\n  Arguments:\n{args_block}'
        )
        tool_list.append(f'- {name}')

    return SYSTEM_PROMPT_TEMPLATE.format(
        tool_descriptions="\n\n".join(tool_descriptions),
        tool_list="\n".join(tool_list),
    )


# ---------------------------------------------------------------------------
# LLM API communication
# ---------------------------------------------------------------------------
def call_llm(
    messages: list,
    api_url: str,
    model_name: str,
    temperature: float = 0.2,
    max_tokens: int = 2048,
    stream: bool = False,
) -> str:
    """
    Send messages to the LLM Studio API and return the assistant's response content.
    Supports both regular and streaming modes.
    """
    payload = {
        "model": model_name,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }

    try:
        response = requests.post(api_url, json=payload, timeout=120)

        if response.status_code != 200:
            raise ConnectionError(
                f"LLM API returned HTTP {response.status_code}: {response.text[:500]}"
            )

        if stream:
            return _handle_streaming_response(response)
        else:
            data = response.json()
            return data["choices"][0]["message"]["content"]

    except requests.exceptions.ConnectionError:
        raise ConnectionError(
            "Could not connect to LLM Studio. "
            "Make sure LLM Studio is running and the API server is started. "
            f"Expected endpoint: {api_url}"
        )
    except requests.exceptions.Timeout:
        raise ConnectionError("LLM API request timed out (120s).")
    except KeyError:
        raise ConnectionError(f"Unexpected API response format: {response.text[:500]}")


def _handle_streaming_response(response) -> str:
    """Process a streaming SSE response and return the concatenated content."""
    content_parts = []
    print(f"{COLOR_AI}", end="", flush=True)

    for line in response.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data: "):
            continue

        data_str = line[6:]  # strip "data: " prefix
        if data_str.strip() == "[DONE]":
            break

        try:
            chunk = json.loads(data_str)
            delta = chunk.get("choices", [{}])[0].get("delta", {})
            token = delta.get("content", "")
            if token:
                print(token, end="", flush=True)
                content_parts.append(token)
        except json.JSONDecodeError:
            continue

    print(Style.RESET_ALL)
    return "".join(content_parts)


# ---------------------------------------------------------------------------
# Tool call parsing & dispatch
# ---------------------------------------------------------------------------
def try_parse_tool_call(text: str) -> dict | None:
    """
    Attempt to parse the LLM's output as a tool-call JSON object.
    Handles various formats: raw JSON, markdown-fenced JSON, etc.
    Returns the parsed dict or None if not a valid tool call.
    """
    text = text.strip()

    # Try direct JSON parse first
    try:
        parsed = json.loads(text)
        if "tool" in parsed and "arguments" in parsed:
            return parsed
    except json.JSONDecodeError:
        pass

    # Try extracting JSON from markdown code block
    json_block_pattern = r"```(?:json)?\s*\n?(\{.*?\})\s*\n?```"
    match = re.search(json_block_pattern, text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(1))
            if "tool" in parsed and "arguments" in parsed:
                return parsed
        except json.JSONDecodeError:
            pass

    # Try extracting first JSON object from the text
    brace_pattern = r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}"
    match = re.search(brace_pattern, text, re.DOTALL)
    if match:
        try:
            parsed = json.loads(match.group(0))
            if "tool" in parsed and "arguments" in parsed:
                return parsed
        except json.JSONDecodeError:
            pass

    return None


def execute_tool(tool_name: str, arguments: dict) -> str:
    """Look up and execute a tool by name with the given arguments."""
    if tool_name not in TOOL_REGISTRY:
        return f"Error: Unknown tool '{tool_name}'. Available tools: {', '.join(TOOL_REGISTRY.keys())}"

    tool_info = TOOL_REGISTRY[tool_name]
    fn = tool_info["fn"]

    # Validate required arguments
    missing = []
    for arg_name, arg_info in tool_info["arguments"].items():
        if arg_info.get("required", False) and arg_name not in arguments:
            missing.append(arg_name)

    if missing:
        return f"Error: Missing required argument(s) for '{tool_name}': {', '.join(missing)}"

    try:
        return fn(**arguments)
    except TypeError as e:
        return f"Error calling '{tool_name}': {str(e)}"


# ---------------------------------------------------------------------------
# Main conversation loop
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="LLM Injector – File system access via LLM Studio",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--workspace", type=str, default=None,
        help="Workspace directory path (default: from config.yaml or ./workspace)",
    )
    parser.add_argument(
        "--readonly", action="store_true",
        help="Enable read-only mode (blocks all write operations)",
    )
    parser.add_argument(
        "--api-url", type=str, default=None,
        help="LLM Studio API endpoint URL",
    )
    parser.add_argument(
        "--config", type=str, default=DEFAULT_CONFIG_PATH,
        help=f"Path to config.yaml (default: {DEFAULT_CONFIG_PATH})",
    )
    parser.add_argument(
        "--no-stream", action="store_true",
        help="Disable streaming responses (print full answer at once)",
    )
    parser.add_argument(
        "--max-tool-rounds", type=int, default=None,
        help="Maximum tool-call rounds per user message",
    )

    args = parser.parse_args()

    # -----------------------------------------------------------------------
    # Load and apply configuration
    # -----------------------------------------------------------------------
    cfg = load_config(args.config)

    # CLI flags override config file
    if args.workspace:
        cfg["workspace"] = args.workspace
    if args.readonly:
        cfg["read_only"] = True
    if args.api_url:
        cfg["api_url"] = args.api_url
    if args.max_tool_rounds is not None:
        cfg["max_tool_rounds"] = args.max_tool_rounds

    # Apply configuration to tools module
    configure(cfg)

    # Extract LLM settings
    api_url = cfg.get("api_url", "http://localhost:1234/v1/chat/completions")
    model_name = cfg.get("model_name", "local-model")
    temperature = float(cfg.get("temperature", 0.2))
    max_tokens = int(cfg.get("max_tokens", 2048))
    max_tool_rounds = int(cfg.get("max_tool_rounds", 10))
    use_stream = not args.no_stream
    log_level = cfg.get("log_level", "INFO").upper()

    # -----------------------------------------------------------------------
    # Set up logging
    # -----------------------------------------------------------------------
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    logger = logging.getLogger("llm_injector")

    # -----------------------------------------------------------------------
    # Test API connection
    # -----------------------------------------------------------------------
    print(f"{COLOR_SYSTEM}LLM Injector v1.0{Style.RESET_ALL}")
    print(f"{COLOR_SYSTEM}{'=' * 50}{Style.RESET_ALL}")
    print(f"  Workspace : {Fore.WHITE}{cfg.get('workspace', './workspace')}{Style.RESET_ALL}")
    print(f"  Read-only : {Fore.WHITE}{cfg.get('read_only', False)}{Style.RESET_ALL}")
    print(f"  API URL   : {Fore.WHITE}{api_url}{Style.RESET_ALL}")
    print(f"  Model     : {Fore.WHITE}{model_name}{Style.RESET_ALL}")
    print(f"  Streaming : {Fore.WHITE}{use_stream}{Style.RESET_ALL}")
    print(f"{COLOR_SYSTEM}{'=' * 50}{Style.RESET_ALL}")

    print(f"{COLOR_DIM}Testing connection to LLM Studio...{Style.RESET_ALL}")
    try:
        test_response = requests.get(api_url.replace("/v1/chat/completions", "/v1/models"), timeout=10)
        if test_response.status_code == 200:
            models = test_response.json().get("data", [])
            if models:
                print(f"{COLOR_SYSTEM}Connected! Available models: {Fore.WHITE}{', '.join(m['id'] for m in models)}{Style.RESET_ALL}")
            else:
                print(f"{COLOR_SYSTEM}Connected! (No models listed – API is reachable){Style.RESET_ALL}")
        else:
            print(f"{COLOR_ERROR}Warning: API responded with HTTP {test_response.status_code}{Style.RESET_ALL}")
    except Exception as e:
        print(f"{COLOR_ERROR}Warning: Could not reach LLM Studio API: {e}{Style.RESET_ALL}")
        print(f"{COLOR_ERROR}Make sure LLM Studio is running with the server started.{Style.RESET_ALL}")
        print()
        cont = input(f"{COLOR_DIM}Continue anyway? (y/n): {Style.RESET_ALL}").strip().lower()
        if cont != "y":
            print("Exiting.")
            sys.exit(1)

    # -----------------------------------------------------------------------
    # Build system prompt and start conversation
    # -----------------------------------------------------------------------
    system_prompt = build_system_prompt()
    messages = [{"role": "system", "content": system_prompt}]

    print()
    print(f"{COLOR_AI}LLM Injector ready. Type your requests in natural language.{Style.RESET_ALL}")
    print(f"{COLOR_DIM}Commands: 'exit', 'quit', 'stats', 'clear'{Style.RESET_ALL}")
    print()

    while True:
        try:
            user_input = input(f"{COLOR_USER}You: {Style.RESET_ALL}").strip()
        except (EOFError, KeyboardInterrupt):
            print(f"\n{COLOR_DIM}Goodbye!{Style.RESET_ALL}")
            break

        if not user_input:
            continue

        # Handle built-in commands
        cmd = user_input.lower()
        if cmd in ("exit", "quit"):
            print(f"{COLOR_DIM}Goodbye!{Style.RESET_ALL}")
            break

        if cmd == "stats":
            stats = get_session_stats()
            print(f"{COLOR_SYSTEM}Session Statistics:{Style.RESET_ALL}")
            print(f"  Bytes read    : {stats['bytes_read']:,} ({stats['bytes_read']/1024:.1f} KB)")
            print(f"  Bytes written : {stats['bytes_written']:,} ({stats['bytes_written']/1024:.1f} KB)")
            print(f"  Quota used    : {stats['quota_used_pct']}% of {stats['quota_mb']} MB")
            continue

        if cmd == "clear":
            messages = [{"role": "system", "content": system_prompt}]
            print(f"{COLOR_DIM}Conversation history cleared.{Style.RESET_ALL}")
            continue

        # Add user message to history
        messages.append({"role": "user", "content": user_input})

        # Tool-call loop
        round_count = 0
        while round_count < max_tool_rounds:
            round_count += 1

            try:
                llm_output = call_llm(
                    messages=messages,
                    api_url=api_url,
                    model_name=model_name,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    stream=False,  # Always non-streaming during tool loop
                )
            except ConnectionError as e:
                print(f"{COLOR_ERROR}{e}{Style.RESET_ALL}")
                messages.pop()  # Remove the failed user message
                break

            # Check if this is a tool call
            tool_call = try_parse_tool_call(llm_output)

            if tool_call is not None:
                tool_name = tool_call["tool"]
                tool_args = tool_call["arguments"]

                logger.info("Tool call round %d: %s(%s)", round_count, tool_name, tool_args)

                print(f"{COLOR_TOOL}[Tool Call] {tool_name}({json.dumps(tool_args, ensure_ascii=False)}){Style.RESET_ALL}")

                # Execute the tool
                tool_result = execute_tool(tool_name, tool_args)
                logger.info("Tool result: %s", tool_result[:200])

                print(f"{COLOR_DIM}[Result] {tool_result[:200]}{'...' if len(tool_result) > 200 else ''}{Style.RESET_ALL}")

                # Append to conversation history
                messages.append({"role": "assistant", "content": llm_output})
                messages.append({"role": "user", "content": f"Tool result: {tool_result}"})

                continue  # Loop back to LLM with the tool result

            # No tool call detected – this is the final answer
            # If streaming was enabled and we're in the final round, re-request with streaming
            if use_stream and round_count <= max_tool_rounds:
                # We already have the non-streamed result, just use it
                # (Re-requesting with stream would cost an extra API call)
                pass

            print(f"{COLOR_AI}AI: {llm_output}{Style.RESET_ALL}")
            messages.append({"role": "assistant", "content": llm_output})
            break

        else:
            # Exceeded max tool rounds
            print(f"{COLOR_ERROR}Warning: Reached maximum tool-call rounds ({max_tool_rounds}). "
                  f"Returning the last response as-is.{Style.RESET_ALL}")
            print(f"{COLOR_AI}AI: {llm_output}{Style.RESET_ALL}")
            messages.append({"role": "assistant", "content": llm_output})

        print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    main()
