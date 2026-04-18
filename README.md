<div align="center"><pre>
:::    ::: ::::::::  :::::::::      :::
:+:   :+: :+:    :+: :+:    :+:   :+: :+:
+:+  +:+  +:+    +:+ +:+    +:+  +:+   +:+
+#++:++   +#+    +:+ +#+    +:+ +#++:++#++:
+#+  +#+  +#+    +#+ +#+    +#+ +#+     +#+
#+#   #+# #+#    #+# #+#    #+# #+#     #+#
###    ### ########  #########  ###     ###
</pre></div>

<div align="center">

**Koda is your ideal development partner.**

[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-v26.0.0-cyan)](package.json)
[![Electron](https://img.shields.io/badge/Electron-41.x-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Koda is a fully autonomous software engineering agent that runs as a native desktop application. No IDE extensions, no cloud servers, no clipboard gymnastics — it reads your codebase, edits files, runs commands, and ships code directly in your local environment.

[Features](#-features) • [Modes](#-operation-modes) • [Tools](#-tool-arsenal) • [Providers](#-supported-providers) • [Installation](#-installation) • [Build](#-build--distribution) • [Architecture](#-architecture)

</div>

---

## Features

- **Autonomous pair-programming** — Koda reads your project structure, understands the architecture, and edits files directly. No copy-paste required.
- **Snapshot & rollback** — before every message, Koda captures a full in-memory snapshot of all workspace files. Hover any user message and click `↺` to restore both files and agent memory to that exact point.
- **Persistent project sessions** — conversation history and pinned files are saved to disk per working directory (MD5-hashed path in `userData/sessions/`) and restored automatically when you switch back to a project.
- **Task queue** — send the next task while the agent is still working. Koda queues it and fires it automatically when the current task finishes.
- **Real PTY terminal** — native shell integration via `node-pty`. Koda spawns background processes, waits for output patterns, sends stdin (passwords, `y/n` prompts), and kills processes by PID — all autonomously.
- **Interactive terminal panel** — a full `xterm.js` terminal for you to use directly, independent of the agent, with resize support and ANSI rendering.
- **Split-view panels** — browser preview and terminal panel share the left side with a draggable vertical divider. The main horizontal divider is also resizable.
- **Built-in browser preview** — a `<webview>`-based browser panel with navigation controls, defaulting to `localhost:5173`. Useful for inspecting running apps without leaving Koda.
- **Web navigation agent** — via [`operantid.js`](https://www.npmjs.com/package/operantid.js), Koda can spawn a sub-agent that controls a real browser to navigate, interact with UI elements, and extract data from websites.
- **Shell approval system** — non-read-only commands pause for your approval inline, with three levels: once, base command (session), or full string (session). Allowlists persist in `localStorage`.
- **4 operation modes** — Fast, Planner, Colab, and Teach & Code, selectable from a dropdown in the TitleBar.
- **Planner mode** — for complex tasks, Koda enters a read-only exploration cycle, writes a detailed Markdown plan, and waits for your explicit approval before touching any file.
- **Collaborative mode** — Koda can open a multi-turn session with a second LLM (the "advisor") for architectural brainstorming, then proceed with the implementation.
- **Teach & Code mode** — Koda acts as a technical mentor, explaining every non-obvious decision with trade-offs and alternatives as it codes.
- **Skills system** — Markdown-based skill files inject specialized instructions into the agent's context on demand. Invoke with `/skill-name [message]` or let the agent load them autonomously via `load_skill`. Global skills live in `~/.koda/skills/`, project-local in `.koda/skills/`.
- **Dynamic slash menu** — typing `/` in the chat input opens a live-filtered dropdown listing all native commands and available skills, with keyboard navigation identical to `@` file mentions.
- **Inline diff viewer** — `file_edit` outputs render as a side-by-side visual diff with line numbers, additions in cyan and deletions in rose, grouped by hunk.
- **System notifications** — native OS notification fires when a long task (>3s) completes and the window is not in focus.
- **Remote Control API** — built-in HTTP server (default port `3141`) exposes `POST /task`, `GET /status`, `POST /reset`, and `GET /messages`. Pair with Tailscale for secure remote access from any device on your network. Tasks appear in chat with a `🌐 Remote` badge.
- **MCP support** — connect any Model Context Protocol server (local process or external SSE endpoint). Tools are discovered at runtime via JSON-RPC handshake and injected into the agent's arsenal dynamically.
- **LSP integration** — semantic queries via `typescript-language-server`: hover types, go-to-definition, and symbol resolution without reading entire files.
- **13 LLM providers** — dynamic model listing via API. Switch providers and models from the UI without restarting.
- **File tracker** — every file the agent reads or modifies is tracked in-session and surfaced in the context panel.
- **At-mentions (`@`)** — type `@` to open a file selector. Koda now automatically expands these mentions in the backend, reading the file content and injecting it directly into the prompt (capped at 50KB to maintain speed).
- **Drag & drop** — drop image files to attach them to the next message; drop code files to inject an `@[path]` mention automatically.
- **Configurable verbosity** — toggle output visibility per tool type (shell, file_read, file_edit, search, LSP, browser, etc.) without affecting agent context.
- **4 built-in themes** — Tokyo Night, GitHub Dark, Cyberpunk Neon, Monokai. Live preview, JSON-based, fully customizable.
- **Dual-UI Architecture** — toggle instantly between a retro `Classic CLI` and a sleek `Modern Pro` workspace layout via Settings.
- **Resizing Resilience** — integrated "Shield Overlays" that prevent WebViews (Browser/Terminal) from intercepting mouse events during layout resizing, ensuring smooth UI scaling.
- **Provider & State Persistence** — Koda now remembers your chosen Provider, Model, and API Key even after restarts, restoring your specific environment automatically.
- **Dual-UI Split-Panes** — The Modern UI now features the same robust split-pane architecture for Browser and Terminal as the Classic UI, with perfect layout synchronization.
- **Context-aware system prompt** — the system prompt is rebuilt dynamically on every session, injecting the current working directory, OS, shell, project name, framework, and available tools.

---

## Operation Modes

Switchable from the TitleBar via a dropdown selector. The active mode is enforced at the API level — tools that don't belong to the current mode are completely hidden from the LLM.

### ⚡ Fast *(default)*

Immediate autonomous execution. The agent acts on your request without any planning step. `enter_plan_mode` and `exit_plan_mode` are removed from the tool list entirely — the LLM cannot see or invoke them.

### 📋 Planner

Before writing any code, Koda enters a read-only exploration cycle using only `file_read`, `search`, `list_dir`, `file_find`, and `lsp_query`. It then calls `exit_plan_mode` with a complete Markdown plan. A modal appears in the UI for you to **Approve** or **Reject**. Destructive tools (`file_write`, `file_edit`, `shell`) are blocked at the registry level until approval is granted.

### 👥 Colab

Activates three additional tools: `start_collaboration`, `send_to_advisor`, and `end_collaboration`. Koda can open a multi-turn conversation with a second model instance (configured as `advisorModel` in settings) to brainstorm architecture before implementing.

### 🎓 Teach & Code

Koda acts as a technical mentor. For every non-obvious change, it explains why that approach was chosen over common alternatives, using code comparisons when helpful. Ideal for learning a codebase or understanding architectural decisions as they happen.

---

## Tool Arsenal

All tools extend `BaseTool` and are registered in `ToolRegistry`. The registry enforces mode restrictions and plan-mode write locks before every execution.

| Tool | Description |
| :--- | :--- |
| `shell` | Spawns a PTY process via `node-pty`. Always runs in the background. Returns PID immediately. Requires user approval for non-read-only commands (configurable allowlist). |
| `shell_wait` | Polls a background PTY's output buffer for a regex/string pattern, or waits for process exit. Configurable timeout (default 30s). |
| `shell_input` | Writes raw stdin to a running PTY process. Used for interactive prompts, REPL inputs, and password fields. |
| `kill_pty` | Sends SIGINT (Ctrl+C) or SIGKILL to a background PTY by PID. |
| `list_pty` | Lists all active background PTY PIDs. |
| `file_read` | Reads file content with optional `start_line`/`end_line` range. Returns numbered lines and language detection. |
| `file_write` | Creates or overwrites a file. Auto-creates parent directories. |
| `file_edit` | Replaces an exact string match within a file. Returns a colored unified diff. Safe: only replaces the first occurrence if multiple matches exist. |
| `file_find` | Glob-pattern file search via `globby`. Respects `.gitignore`. |
| `list_dir` | Lists directory contents with file sizes. Supports recursive mode (max depth 3) and hidden file toggle. |
| `search` | Regex search across files. Uses `ripgrep` when available, falls back to a manual Node.js walker. Supports glob include filters and case-insensitive mode. |
| `lsp_query` | Semantic queries via `typescript-language-server`: `hover` (types/JSDoc) and `goToDefinition`. Lazy-initializes a singleton LSP client on first use. |
| `browser_agent` | Spawns `operant-runner.js` as a child process. Passes task and URL via stdin as JSON. The sub-agent controls a real browser and returns a report. |
| `enter_plan_mode` | Transitions the agent to read-only plan mode. *(Planner mode only)* |
| `exit_plan_mode` | Presents the Markdown plan to the user and awaits approval via a Promise that resolves through IPC. *(Planner mode only)* |
| `start_collaboration` | Initializes an advisor LLM session with a dedicated system prompt. *(Colab mode only)* |
| `send_to_advisor` | Sends a message to the advisor and streams back the response. *(Colab mode only)* |
| `end_collaboration` | Terminates the advisor session and clears its conversation state. *(Colab mode only)* |
| `load_skill` | Loads a skill by name from `~/.koda/skills/` or `.koda/skills/` and injects its instructions into context. The agent calls this autonomously when it detects a matching task domain. |

### Shell Approval System

When the agent calls `shell`, Koda checks the command against:

1. A **read-only safelist** (e.g. `ls`, `cat`, `git status`) — auto-approved.
2. A **base command allowlist** (e.g. `npm`) — persisted in `localStorage` and synced to the main process.
3. A **full command allowlist** (e.g. `npm install`) — same persistence.

If none match, the UI shows an approval prompt with three options: *Accept Once*, *Accept Base Command* (session), or *Accept Full Command* (session). The agent's PTY execution is suspended via a `Promise` until the user responds.

---

## Supported Providers

Models are fetched dynamically via each provider's API. Just enter your key and select from the dropdown — no hardcoded model lists.

| Provider | Notes |
| :--- | :--- |
| **OpenRouter** | Hundreds of models via a single key |
| **OpenAI** | GPT-4o, o1, o3 families; filtered from `/v1/models` |
| **Anthropic** | All Claude models; falls back to a curated list if the models API is unavailable |
| **Google Gemini** | All Gemini models from `/v1beta/models` |
| **Groq** | All models from the Groq platform |
| **DeepSeek** | All DeepSeek models |
| **Mistral AI** | All Mistral models including Codestral |
| **Together AI** | All models from the Together platform |
| **xAI** | Grok family |
| **Fireworks AI** | Fireworks models via API |
| **Zhipu AI** | GLM family; falls back to a curated list |
| **Koda Cloud** | Premium models (Claude 3.7, Gemini 2.0) via secure proxy—no local keys needed |
| **Ollama** | Local models via `/v1/models` or legacy `/api/tags` |
| **Llama.cpp** | Local inference via HTTP server on port 8080 |

Provider auto-detection: when you call `/model --<name>`, Koda infers the provider from the model name string (e.g. `claude` → Anthropic, `gemini` → Google, `grok` → xAI).

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or higher
- Git in your `PATH`
- An API key from any supported provider

### Development

```bash
git clone https://github.com/antojunimaia-ui/Koda.git
cd Koda
npm install
npm run dev:clean
```

> Use `dev:clean` to wipe `dist-electron/` before starting. Stale build artifacts cause subtle IPC failures.

API keys are stored in `localStorage` via the settings panel (⚙️ in the TitleBar). No `.env` file is required for the UI — but you can use one for CLI/dev overrides.

### Environment Variables (optional)

```env
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-...
ANTHROPIC_MODEL=claude-sonnet-4-20250514
MAX_TOKENS=8192
TEMPERATURE=0.3
```

Koda looks for `.env` in the current working directory, `~/.koda/.env`, and the build root — in that order.

---

## Native Commands

Type these directly in the chat input:

| Command | Description |
| :--- | :--- |
| `/help` | Shows the command reference |
| `/clear` or `/reset` | Clears conversation history and agent memory |
| `/tokens` or `/cost` | Displays estimated token usage for the current context |
| `/model --<name>` | Switches the active model |
| `/apikey <key>` | Sets the API key inline |
| `/<skill-name> [message]` | Activates a skill and optionally sends a task in the same message |

---

## Remote Control API

Koda includes a built-in HTTP server for remote task execution. Enable it in **Settings → Remote Control**.

| Method | Path | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/status` | Public | Agent status, busy state, current project and model |
| `POST` | `/task` | Token | Send a task — body: `{ "message": "..." }` |
| `POST` | `/reset` | Token | Reset conversation remotely |
| `GET` | `/messages` | Token | Retrieve full conversation history as JSON |

The server listens on `0.0.0.0:3141` (configurable). Pair with **[Tailscale](https://tailscale.com)** to access it securely from any device on your private network — GitHub Actions, bots, scripts, other agents.

```bash
curl -X POST http://100.x.x.x:3141/task \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"message": "run the test suite and fix any failures"}'
```

Tasks sent via the API appear in chat with a `🌐 Remote` badge.

---

## Build & Distribution

```bash
# Windows — NSIS installer (.exe)
npm run dist

# Linux — AppImage
npm run dist:linux

# macOS — DMG
npm run dist:mac
```

Output goes to `release-build/`. `node-pty` and `operantid.js` are unpacked from the ASAR archive since they require native binaries.

---

## Architecture

```
src/
├── main/                        # Electron Main Process (Node.js)
│   ├── index.ts                 # App bootstrap + all IPC handlers
│   ├── core/
│   │   ├── agent.ts             # Agent class: provider lifecycle, message loop, tool orchestration
│   │   ├── conversation.ts      # Message history, microCompact, trimIfNeeded, rollback
│   │   ├── prompt-builder.ts    # Dynamic system prompt assembly (env + project + tools)
│   │   └── context.ts           # Project detection (language, framework, package manager)
│   ├── providers/               # 13 LLM provider implementations (all extend BaseProvider)
│   │   └── base.ts              # BaseProvider, Message, StreamChunk, ToolCall interfaces
│   ├── tools/                   # 18 agent tools (all extend BaseTool)
│   │   ├── index.ts             # ToolRegistry: registration, mode filtering, plan-mode lock, format adapters
│   │   ├── shell.ts             # ShellTool + PTY registry + KillPty/ListPty/ShellInput/ShellWait
│   │   ├── file-edit.ts         # String-replace edit with unified diff output
│   │   ├── collaborate.ts       # Advisor LLM session (StartColab/SendColab/EndColab)
│   │   ├── plan.ts              # Plan mode state machine + approval Promise
│   │   └── mcp-tool.ts          # Dynamic MCP tool wrapper
│   ├── services/
│   │   ├── snapshot.ts          # In-memory workspace snapshots (create/restore/list)
│   │   ├── session-manager.ts   # Disk-persisted project sessions (userData/sessions/<md5>.json)
│   │   ├── mcp-manager.ts       # MCP server lifecycle + JSON-RPC tool discovery + callTool
│   │   ├── lsp-client.ts        # typescript-language-server client (hover, goToDefinition)
│   │   ├── file-tracker.ts      # In-session file access tracker (read/modified)
│   │   ├── skill-manager.ts     # Loads .md skills from ~/.koda/skills/ and .koda/skills/
│   │   └── webhook-server.ts    # HTTP remote control server (0.0.0.0, token auth)
│   ├── config/
│   │   └── settings.ts          # AppSettings, .env loading, provider defaults
│   └── utils/
│       ├── diff.ts              # Unified diff generation + string-replace logic
│       ├── tokens.ts            # Token estimation (~4 chars/token heuristic)
│       ├── syntax.ts            # Language detection from file extension
│       └── logger.ts            # Logging utilities
├── preload/
│   └── index.ts                 # contextBridge: exposes window.koda API to renderer
└── renderer/                    # React 19 + Tailwind CSS 4
    ├── App.tsx                  # Main UI orchestrator: state management, dual-ui toggle
    ├── components/
    │   ├── classic/ClassicUI.tsx# Cyberpunk terminal-inspired interface
    │   ├── modern/ModernUI.tsx  # Sleek, minimal backdrop-blur interface
    │   ├── TitleBar.tsx         # Mode switcher (Fast/Planner/Colab) + panel toggles + window controls
    │   ├── TerminalPanel.tsx    # xterm.js terminal connected to a live PTY
    │   ├── BrowserPreview.tsx   # Electron <webview> browser panel with navigation controls
    │   ├── MCPSettings.tsx      # MCP server configuration UI (add/edit/delete/enable)
    │   └── BrailleSpinner.tsx   # Animated thinking indicator
    └── themes/                  # JSON theme definitions (Tokyo Night, GitHub Dark, Cyberpunk, Monokai)
```

### Message Processing Loop

```
User sends message
  → IPC: renderer → main
  → createSnapshot(messageId, conversationLength)   // full workspace captured in memory
  → agent.processMessage()
      → conversation.addUser(message, images?)
      → loop:
          → conversation.trimIfNeeded()             // microCompact + token-limit trim
          → provider.chat(messages, tools)          // streaming
              → StreamChunk: text → onText() → IPC → UI
              → StreamChunk: tool_call_start → onToolStart() → IPC → UI
              → StreamChunk: tool_call_end → pendingToolCalls[]
          → conversation.addAssistant(text, toolCalls)
          → for each toolCall:
              → toolRegistry.execute(name, args)    // mode check + plan-mode lock
              → onToolEnd(name, result) → IPC → UI
              → conversation.addToolResult(id, output)
          → if no tool calls: break
```

### Context Management

`Conversation` maintains a `messages[]` array with a 100k token soft limit (estimated at ~4 chars/token). Before trimming, `microCompact` scans old tool results for compactable tools (file reads, shell output, etc.) and replaces their content with a placeholder, preserving the structural history. If still over the limit, old messages are dropped and replaced with a summary notice, always keeping the system message and the last 10 turns.

### Snapshot System

Snapshots are stored in a `Map<messageId, WorkspaceSnapshot>` in the main process memory. Each snapshot captures all non-ignored text files under 2MB. On rollback, files are restored from the snapshot and the agent's `conversation.messages` array is truncated to the saved length — keeping files and memory perfectly in sync. Snapshots are cleared forward from the restored point to prevent branching inconsistencies.

---

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening PRs. Key points: strict TypeScript (avoid `any`), focused PRs (one thing per PR), Conventional Commits, and never commit API keys.

---

## License

Distributed under the **[BSD 3-Clause License](./LICENSE)**.

---

<div align="center">
  Built by <strong>antojunimaia-ui and pedrodev2026</strong>.
</div>
