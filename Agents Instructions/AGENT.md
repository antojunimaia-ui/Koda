# Koda Agent Guidelines 🤖

Este documento é a **Única Fonte de Verdade** para qualquer Agente de IA que atue no repositório do Koda AI. Ele contém o conhecimento técnico destilado de toda a arquitetura do sistema. **Leia-o inteiro antes de qualquer tarefa.**

---

## 🎯 Visão Geral do Ecossistema

O Koda é um agente de engenharia autônomo construído com **Electron 33 + React 19 + TypeScript 5.7 + Vite 6**. Diferente de extensões de IDE, ele é uma aplicação **standalone** focada em autonomia total do sistema de arquivos e integração nativa com terminal.

- **Versão atual**: `26.18.4` (veja `package.json`)
- **Licença**: BSD-3-Clause
- **Repositório**: `antojunimaia-ui/Koda`
- **Entrypoint Main**: `src/main/index.ts` → compilado para `dist-electron/index.js`
- **Entrypoint Renderer**: `index.html` → `src/renderer/main.tsx`

---

## 🏗️ Arquitetura Core

```text
src/
├── main/                     # Node.js / Electron Main Process
│   ├── index.ts              # ★ Entrypoint principal — IPC handlers, janela, PTY
│   ├── core/
│   │   ├── agent.ts          # ★ Classe Agent — loop de pensamento, tool dispatch
│   │   ├── context.ts        # Detecção automática de linguagem/framework do projeto
│   │   ├── conversation.ts   # Gerenciamento do histórico de mensagens
│   │   └── prompt-builder.ts # Montagem modular do system prompt (env + regras)
│   ├── providers/            # Adaptadores de LLM (ver seção Provedores)
│   ├── tools/
│   │   ├── base.ts           # ★ BaseTool — classe abstrata para todas as Tools
│   │   ├── index.ts          # ★ ToolRegistry — registro e execução de Tools
│   │   └── *.ts              # Implementações individuais (ver seção Tools)
│   ├── services/
│   │   ├── file-tracker.ts   # Rastreamento de arquivos lidos/modificados
│   │   ├── lsp-client.ts     # Cliente LSP (typescript-language-server)
│   │   └── snapshot.ts       # ★ Sistema de snapshot/rollback por messageId
│   ├── config/
│   │   └── settings.ts       # Configurações via .env (provider, model, apiKey…)
│   └── utils/
│       ├── diff.ts           # Utilitário de diff textual (usa pacote `diff`)
│       ├── logger.ts         # Logger interno
│       ├── symbols.ts        # Símbolos unicode (spinners, ícones)
│       ├── syntax.ts         # Syntax highlighting no terminal
│       └── tokens.ts         # Estimativa de tokens
├── preload/
│   └── index.ts              # ★ Bridge IPC — expõe window.koda ao Renderer
└── renderer/
    ├── App.tsx               # ★ UI central — toda a lógica de chat e estado
    ├── main.tsx              # Bootstrap React
    ├── index.css             # ★ Design system Tailwind 4 (tokens CSS + estilos)
    ├── global.d.ts           # Tipagens de window.koda
    ├── components/
    │   ├── TitleBar.tsx      # Barra de título customizada (drag, controles)
    │   └── BrailleSpinner.tsx # Spinner animado em Braille
    └── themes/               # Temas do xterm.js
```

---

## 🔌 Provedores de LLM Suportados

O provider é configurado via `LLM_PROVIDER` no `.env`. Cada provider tem seu adaptador em `src/main/providers/`.

| Provider | Arquivo | Env Key | Modelo Padrão |
|---|---|---|---|
| `openai` | `openai.ts` | `OPENAI_API_KEY` | `gpt-4o` |
| `anthropic` | `anthropic.ts` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| `google` | `google.ts` | `GOOGLE_API_KEY` | `gemini-2.0-flash` |
| `openrouter` | `openrouter.ts` | `OPENROUTER_API_KEY` | `anthropic/claude-3.7-sonnet` |
| `ollama` | `ollama.ts` | `OLLAMA_API_KEY` | `llama3` |
| `llamacpp` | `llamacpp.ts` | `LLAMACPP_API_KEY` | `local-model` |
| `groq` | `groq.ts` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| `deepseek` | `deepseek.ts` | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| `mistral` | `mistral.ts` | `MISTRAL_API_KEY` | `codestral-latest` |
| `together` | `together.ts` | `TOGETHER_API_KEY` | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| `xai` | `xai.ts` | `XAI_API_KEY` | `grok-beta` |
| `zhipu` | `zhipu.ts` | `ZHIPU_API_KEY` | `glm-5` |
| `maritaca` | `maritaca.ts` | `MARITACA_API_KEY` | `sabia-4` |

**Modelo override**: `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `GOOGLE_MODEL`, etc.

**Detecção automática de provider** pelo nome do modelo (em `agent.ts`):

- Contém `/` → `openrouter`
- Contém `claude` → `anthropic`
- Contém `gemini` → `google`
- Contém `gpt-`, `o1`, `o3` → `openai`
- Contém `llama`, `qwen`, `mistral`, `phi` → `ollama`
- Contém `local`, `localhost` → `llamacpp`
- Contém `groq` → `groq`
- Contém `deepseek` → `deepseek`
- Contém `mistral`, `codestral` → `mistral` (API)
- Contém `together` → `together`
- Contém `grok`, `xai` → `xai`
- Contém `glm`, `zhipu` → `zhipu`
- Contém `sabia`, `maritaca` → `maritaca`

---

## 🛠️ Tools Disponíveis

Todas as Tools ficam em `src/main/tools/` e **DEVEM** estender `BaseTool` (`base.ts`) e ser registradas no `ToolRegistry` (`index.ts`).

### Tools Registradas

| Nome da Tool | Arquivo | Tipo | Bloqueada no Plan Mode? |
|---|---|---|---|
| `file_read` | `file-read.ts` | Leitura | Não |
| `file_write` | `file-write.ts` | Escrita | **Sim** |
| `file_edit` | `file-edit.ts` | Escrita | **Sim** |
| `shell` | `shell.ts` | Execução | **Sim** |
| `shell_input` | `shell.ts` | Execução | Não |
| `shell_wait` | `shell.ts` | Execução | Não |
| `kill_pty` | `shell.ts` | Controle PTY | Não |
| `list_pty` | `shell.ts` | Controle PTY | Não |
| `search` | `search.ts` | Leitura | Não |
| `list_dir` | `list-dir.ts` | Leitura | Não |
| `file_find` | `file-find.ts` | Leitura | Não |
| `get_diagnostics` | `diagnostics.ts` | Análise | Não |
| `browser` | `browser.ts` | Leitura | Não |
| `lsp` | `lsp.ts` | Análise | Não |
| `enter_plan_mode` | `plan.ts` | Modo | Apenas no modo `planner` |
| `exit_plan_mode` | `plan.ts` | Modo | Apenas no modo `planner` |

### Regra do Plan Mode

O Plan Mode é ativado quando a UI envia a mensagem com o wrapper `[PLANNER MODE PROTOCOL - MANDATORY]`.

- **Fast Mode (padrão)**: O agente age de forma autônoma e imediata. As tools `enter_plan_mode` e `exit_plan_mode` são **invisíveis** neste modo.
- **Planner Mode**: `file_write`, `file_edit` e `shell` são **bloqueadas** pelo `ToolRegistry.execute()` com erro de restrição até o usuário aprovar via `window.koda.planResponse(true)`.

### Como criar uma nova Tool

```typescript
// src/main/tools/minha-tool.ts
import { BaseTool, ToolResult } from "./base.js";

export class MinhaTool extends BaseTool {
  name = "minha_tool";
  description = "Faz X dado Y.";
  parameters = [
    { name: "path", type: "string" as const, description: "Caminho do arquivo", required: true },
  ];

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const err = this.validateArgs(args);
    if (err) return this.failure(err);

    // ... lógica
    return this.success("resultado");
  }
}
```

Depois, registre em `src/main/tools/index.ts`:

```typescript
import { MinhaTool } from "./minha-tool.js";
// dentro do constructor do ToolRegistry:
this.register(new MinhaTool());
```

---

## 📡 Contrato de IPC (`window.koda`)

O bridge é definido em `src/preload/index.ts` e tipado em `src/renderer/global.d.ts`.

| Método | Handler IPC | Descrição |
|---|---|---|
| `koda.init()` | `agent:init` | Inicializa agent, provider e contexto |
| `koda.sendMessage(id, msg, images?)` | `agent:message` | Envia mensagem do usuário ao agente |
| `koda.snapshotRestore(id)` | `snapshot:restore` | Restaura arquivos + memória ao estado de `id` |
| `koda.reset()` | `agent:reset` | Limpa histórico de conversa |
| `koda.getTokens()` | `agent:tokens` | Retorna estimativa de tokens formatada |
| `koda.getInfo()` | `agent:info` | Retorna `{ provider, model, project, cwd }` |
| `koda.cd(path)` | `agent:cd` | Muda diretório de trabalho do agente |
| `koda.setApiKey(key)` | `agent:apikey` | Atualiza API key e recria provider |
| `koda.setModel(model)` | `agent:model` | Atualiza modelo (detecta provider automaticamente) |
| `koda.setup(config)` | `agent:setup` | Configura provider, model e apiKey de uma vez |
| `koda.getModels(provider, key)` | `agent:getModels` | Lista modelos disponíveis para um provider |
| `koda.planResponse(approved)` | `agent:plan_response` | Aprova ou rejeita o plano do agente |
| `koda.ptySendCtrlC(pid)` | `pty:ctrl_c` | Envia Ctrl+C para um PTY |
| `koda.ptyKill(pid)` | `pty:kill` | Mata um processo PTY |
| `koda.getFiles()` | `project:get_files` | Lista arquivos do projeto (excluindo ignored) |
| `koda.minimize/maximize/close()` | `window:*` | Controles da janela |
| `koda.selectDirectory()` | `window:open_directory` | Abre diálogo de seleção de pasta |
| `koda.onUpdate(cb)` | `agent:update` (evento) | Recebe atualizações em streaming do agente |

### Tipos de Update (`agent:update`)

```typescript
type UpdateType = "text" | "tool_start" | "tool_end" | "thought" | "error" | "done";
```

---

## 🔄 Sistema de Snapshot

O `src/main/services/snapshot.ts` captura o estado de todos os arquivos do projeto **antes** de cada mensagem processada. Isso permite o botão de "restore" na UI.

- **Cria snapshot**: `createSnapshot(messageId, conversationLength)` — chamado no Main
- **Restaura**: `restoreSnapshot(messageId)` — reescreve arquivos e retorna `conversationLength` anterior
- **Ignorados**: `node_modules/`, `.git/`, `dist/`, `dist-electron/`, `release-build/`, `release/`, lock files
- **Limite de arquivo**: arquivos > 2 MB são ignorados

---

## 🎨 Design System & UI

### CSS Tokens (definidos em `src/renderer/index.css`)

```css
--koda-bg: #0f172a          /* Background principal */
--koda-bg-alt: #0d1117      /* Background alternativo (mais escuro) */
--koda-sidebar: #1e293b     /* Painéis / sidebars */
--koda-accent: #22d3ee      /* ★ Cor de destaque primária (cyan) */
--koda-accent-alt: #d946ef  /* Destaque secundário (magenta) */
--koda-text: #e2e8f0        /* Texto principal */
--koda-text-dim: #94a3b8    /* Texto secundário / dimmed */
--koda-border: #334155      /* Bordas e separadores */
--koda-user-msg: rgba(30,41,59,0.4) /* Background de mensagens do usuário */
```

### Aliases Tailwind 4 (via `@theme`)

| Classe Tailwind | Valor |
|---|---|
| `text-cyan` / `border-cyan` | `#22d3ee` (accent) |
| `text-magenta` | `#d946ef` (accent-alt) |
| `bg-slate-900` | `#0f172a` |
| `bg-slate-800` | `#1e293b` |
| `border-slate-700` | `#334155` |
| `text-slate-300` | `#e2e8f0` |
| `text-slate-400` / `text-gray` | `#94a3b8` |

### Classes de Componente (em `index.css`)

- `.terminal-input-container` — container do input de chat
- `.terminal-scroll-area` — área scrollável com scrollbar estilizada
- `.terminal-box` — badge com borda cyan
- `.markdown-body` — container de renderização Markdown (já estilizado)
- `.custom-scrollbar` — scrollbar fina estilizada
- `.titlebar-drag` / `.no-drag` — controle de drag da janela

### Regras de UI

- **Fonte**: `JetBrains Mono`, `Fira Code`, `monospace` — **nunca mude a fonte base**
- **Markdown**: Renderizado via `marked` + `marked-highlight` + `highlight.js`
- **Terminal**: `xterm.js` + `xterm-addon-fit` via PTY real (`node-pty`). **Nunca simule um terminal.**
- **Tailwind versão**: **4.x** — use `@apply` no `index.css` para estilos globais. Não use classes Tailwind 3 que foram removidas.
- Cores de erro → `rose-500`. Destaque → `cyan`. Warning → `amber`.

---

## ⚠️ Princípios de Desenvolvimento

### TypeScript & Código

- **`strict: true`** no `tsconfig.json`. Zero erros de tipo.
- **Proibido usar `any`** exceto em transformações de respostas de APIs externas (OpenAI, Anthropic, Google), com comentário explicando.
- **Imports**: Use `.js` no sufixo mesmo para arquivos `.ts` (necessário para ESM com Electron). Ex: `import { X } from "./x.js"`.
- **`"type": "module"`** no `package.json` — o projeto é ESM puro.
- **Framer Motion** está disponível nas dependências implícitas; use-o para animações se necessário.

### Scripts de Build

```bash
npm run dev          # dev server (Vite + Electron)
npm run build        # build produção
npm run dist         # build + empacota instalador Windows (x64)
npm run dist:linux   # build + AppImage
npm run dist:mac     # build + dmg
npm run clean        # remove dist/ e dist-electron/
```

### Arquivos de Configuração

- **`.env`** (na raiz do projeto): define `LLM_PROVIDER`, `*_API_KEY`, `*_MODEL`, `MAX_TOKENS`, `TEMPERATURE`
- **`vite.config.ts`**: configuração Vite + plugin Electron
- **`tailwind.config.js`**: configuração Tailwind 4
- **`tsconfig.json`** + **`tsconfig.node.json`**: TypeScript configs (renderer e main, respectivamente)

---

## 🚀 Workflow do Agente (Como Atuar Aqui)

1. **Análise**: Sempre comece lendo `src/main/index.ts` (entrypoint Main) e `src/renderer/App.tsx` (UI central). Use `list_dir` e `search` para mapear o que for relevante.
2. **Plano**: Se for criar uma nova Tool ou mudar a UI de forma significativa, descreva o plano antes de editar.
3. **Execução**: Documente os arquivos que serão afetados antes de modificá-los.
4. **Respeito à Licença**: BSD-3-Clause. Novos arquivos não precisam de header de licença, mas não inclua dependências com licenças incompatíveis.
5. **Conventional Commits**: Leia `COMMIT_CONVENTIONS.md` para entender como fazer commits.

### Slash Commands internos do Koda

O Koda processa nativamente (sem chamar LLM) os seguintes comandos de chat:

- `/clear` ou `/reset` — limpa histórico de conversa
- `/tokens` ou `/cost` — exibe estimativa de uso de tokens
- `/help` — lista os comandos disponíveis

---

## 🔗 Referências Rápidas

| O que você quer                     | Onde olhar                                                                                           |
|-------------------------------------|------------------------------------------------------------------------------------------------------|
| Adicionar um provider novo          | `src/main/providers/base.ts` + criar `meu-provider.ts` + registrar em `agent.ts`                     |
| Adicionar uma Tool nova             | `src/main/tools/base.ts` + criar `minha-tool.ts` + registrar em `tools/index.ts`                     |
| Mudar system prompt base            | `src/main/config/settings.ts` → `getSystemPrompt()`                                                  |
| Mudar regras operacionais do agente | `src/main/core/prompt-builder.ts` → `buildCoreInstructions()`                                        |
| Mudar design do chat                | `src/renderer/App.tsx` + `src/renderer/index.css`                                                    |
| Adicionar um IPC handler            | `src/main/index.ts` (handler) + `src/preload/index.ts` (expose) + `src/renderer/global.d.ts` (tipos) |
| Configurar variáveis de ambiente    | `.env` na raiz do projeto                                                                            |

---

## 📜 Mandamentos Operacionais (Prompt Core)

Definidos em `src/main/core/prompt-builder.ts`, estes princípios regem o comportamento de baixo nível do agente:

1. **Análise Tool-First**: Priorize ler o código real em vez de supor. Use `grep_search` e `list_dir` antes de qualquer edição.
2. **Edições Atômicas e Precisas**: Foque na lógica solicitada. Respeite a indentação e o estilo existente do arquivo.
3. **Segurança e Raio de Ação**: Avisar brevemente o usuário antes de comandos shell destrutivos.
4. **Proibido Placeholders**: Nunca emita código incompleto (ex: `// ... resto do código`). Implemente a lógica total.
5. **Resolução Recursiva**: Se uma Tool falhar, analise o erro, crie uma nova hipótese e tente uma abordagem diferente imediatamente.

---

**Você é um braço direito do desenvolvedor. Seja rápido, preciso e mantenha a filosofia Open-Source do Koda viva.**
