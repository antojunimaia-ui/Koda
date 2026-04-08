# Koda Agent Guidelines 🤖

Este documento é a **Única Fonte de Verdade** para qualquer Agente de IA que atue no repositório do Koda AI. Ele contém o conhecimento técnico destilado de toda a arquitetura do sistema.

---

## 🎯 Visão Geral do Ecossistema

O Koda é um agente de engenharia autônomo construído com **Electron + React 19 + TypeScript**. Diferente de extensões de IDE, ele é uma aplicação standalone focada em autonomia total do sistema de arquivos e integração nativa com terminal.

### 🏗️ Arquitetura Core

- **Main Process (`src/main/`)**: Responsável pelo Node.js, acesso ao sistema, PTY, provedores de LLM e gerenciamento de ferramentas.
- **Renderer Process (`src/renderer/`)**: Interface visual moderna usando **Tailwind CSS 4.x**, **Vite** e **Framer Motion**.
- **Preload Bridge (`src/preload/`)**: Define a segurança e o contrato de IPC (`window.koda`).

---

## ⚠️ Princípios de Desenvolvimento de Elite

### 1. Protocolo de Ferramentas (Tools)

- **Localização**: As ferramentas ficam em `src/main/tools/`.
- **Classe Base**: Devem estender `BaseTool` e definir parâmetros claros para o LLM.
- **Modo Planner**: Ferramentas destrutivas (`file_write`, `file_edit`, `shell`) são **BLOQUEADAS** automaticamente no Main se `planMode` estiver ativo, a menos que o usuário aprove.
- **Registro**: Todas as ferramentas DEVEM ser registradas no `ToolRegistry` (`src/main/tools/index.ts`).

### 2. Interface e Consistência (Visual UI)

- **Aesthetic**: Estilo "Elite Engineer" — Dark Mode profundo (`#0f172a`), fontes mono para código, bordas sutis (`border-slate-700/50`).
- **Markdown**: O Koda renderiza Markdown via `marked` com syntax highlighting via `highlight.js`.
- **Terminal**: Utilizamos `xterm.js` via PTY nativo (`node-pty`). Nunca simule um terminal; use o PTY real.

### 3. Comunicação IPC (Main ↔ Renderer)

- O fluxo de mensagens é assíncrono.
- O Agente envia atualizações de status via `agent:update` (tipos: `text`, `tool_start`, `tool_end`, `error`).
- Use o `Agent.processMessage` no Main para gerenciar o loop de pensamento.

---

## 🛠 Diretrizes Técnicas Rigorosas

### TypeScript & Código

- **Zero type checking errors**: O projeto usa `strict: true`. Nunca ignore lints.
- **No `any`**: O uso de `any` só é permitido em transformações de tipos de APIs externas (ex: responses do OpenAI/Gemini), devidamente comentado.
- **Imports**: Use caminhos relativos ou aliases configurados. Mantenha a organização de módulos ESM.

### Estilização (Tailwind 4)

- O Koda usa a nova Alpha/Beta do Tailwind 4. Prefira `@apply` no `index.css` para padrões globais.
- Use a paleta de cores: `cyan-400` para destaques, `slate-900` para backgrounds, `rose-500` para erros críticos.

---

## 🚀 Workflow de Agente (Como atuar aqui)

1. **Análise**: Sempre comece lendo `src/main/index.ts` (Entrypoint) e `src/renderer/App.tsx` (UI central).
2. **Plano**: Se for criar uma nova 'Tool' ou mudar a UI, descreva o plano no chat antes de editar.
3. **Execução**: documente os arquivos que serão afetados.
4. **Respeito à Licença**: Este projeto é **BSD-3-Clause**. Garanta que novos arquivos incluam menção à licença se necessário.

---

**Você é um braço direito do desenvolvedor. Seja rápido, preciso e mantenha a filosofia Open-Source do Koda viva.**
