# Plano de Modernização — Koda

> Objetivo: reduzir atrito de desenvolvimento, aumentar segurança de tipos e tornar o
> código testável, **sem reescrever a stack**. Modernização incremental sobre a base
> atual (Electron 41 + React 19 + TypeScript 6 + Vite 7 + Tailwind 4).

---

## Princípios

- **Incremental**: cada fase é independente e entrega valor isolado, sem quebrar o app.
- **Schema/contrato primeiro**: sempre que houver uma fronteira (IPC, tools, configs,
  APIs externas), definir o contrato uma vez e derivar os tipos dos dois lados.
- **Sem mudança de stack**: continuar em Electron. `node-pty`, `webview` e módulos
  nativos tornam a migração pra Tauri/outros uma reescrita, não uma modernização.
- **CI como portão**: typecheck + lint + testes rodando em todo PR.

---

## Status das fases

| Fase | Status |
|---|---|
| 1. IPC tipado | ✅ Concluída (2026-11-14) |
| 2. Testes | 🟡 Em andamento (unit core/tools ✅; providers ✅; serviços ✅; só e2e Playwright pendente) |
| 3. Qualidade/lint/strict | ⏳ Pendente |
| 4. Zod | ⏳ Pendente |
| 5. Zustand | ⏳ Pendente |
| 6. Schema-first tools | ⏳ Pendente |
| 7. Servidor MCP + SSE/API | ⏳ Pendente |

---

## Fase 1 — Tipar o barramento IPC (maior fonte de bugs) — ✅ Concluída

**Problema**: o `window.koda` (preload) é tipado à mão no `global.d.ts`, e os handlers
no main são registrados separadamente. Qualquer divergência entre os dois lados só
aparece em runtime.

**Ações**:
- [x] Criar `src/shared/ipc.ts` com as assinaturas de todos os canais IPC:
      `IPC_CHANNELS` (constantes de ~70 canais) + tipos de domínio + interface `KodaApi`.
- [x] Nomear explicitamente cada canal e tipar payload/resposta (tipos de domínio
      compartilhados: `AgentInfo`, `SetupConfig`, `GitCommit`, `DirEntry`, etc.).
- [x] Importar o contrato no **preload** (`src/preload/index.ts`) e implementar
      `const api: KodaApi = { ... }` — o typecheck garante conformidade.
- [x] Importar o mesmo contrato no **renderer**: `src/renderer/global.d.ts` agora
      declara `window.koda: KodaApi` (removeu ~78 linhas de tipos manuais).
- [x] Handlers (`src/main/ipc/*`) passaram a usar `IPC_CHANNELS` — eliminando typos de canal.
- [x] Typecheck + build limpos (`npm run typecheck`, `npm run build`).

**Bugs encontrados e corrigidos com a tipagem estrita**:
- 🐛 `openFile` — renderer chamava `(workspaceId, filePath, line?)`, mas o preload
  enviava `(filePath, line?)` ao handler (workspaceId era aberto como arquivo).
- 🐛 Métodos ausentes no `global.d.ts`: `discordIsEnabled`, `discordUpdateActivity`,
  `discordClearActivity`.
- 🐛 Acessos sem guarda a `res.info` (possivelmente `undefined`) em `useAgentInit`
  e `useMessageActions`.

**Critério de sucesso**: renomear um canal IPC no main quebra o typecheck no renderer
imediatamente, sem rodar o app. ✅ (typecheck agora falha se preload ⇄ contrato ⇄
renderer divergirem)

**Observação**: validação de payloads em runtime ainda não existe — fica para a
Fase 4 (Zod).

---

## Fase 2 — Testes automatizados (lacuna crítica) — 🟡 Em andamento

**Problema**: ~22k linhas de lógica (agente, tools, providers, serviços) e **zero
testes**. Todo refactor é uma aposta.

**Ações**:
- [x] Adicionar **Vitest** v5 como runner de testes (`vitest.config.ts`, `node`).
- [x] `npm run test` + `npm run test:watch` no `package.json`.
- [x] **Unit tests do core** (`src/main/core/__tests__`):
      - `conversation.ts` — histórico, `microCompact`, `trimIfNeeded`, rollback. ✅
      - `prompt-builder.ts` — montagem do prompt com env/projeto/tools. ✅
      - `context.ts` — detecção de linguagem/framework/package manager. ✅
      - `slash-commands.ts` — estrutura e unicidade dos comandos. ✅
- [x] **Unit tests das tools** (`src/main/tools/__tests__`):
      - `file-edit.ts` / `file-read.ts` / `file-write.ts` — fixtures temporárias em disco,
        `.kodaignore` aplicado. ✅
      - `kodaignore` (utils) — regras de bloqueio por padrão. ✅
      - `search.ts` — `manualSearch` (regex, case-insensitive, include glob, maxResults,
        diretórios ignorados) + `execute` com fallback. ✅
      - `file-find.ts` — glob com `globby`, `.kodaignore` aplicado, sem resultados. ✅
      - `shell.ts` — validação de parâmetros, `isReadOnly`, bloqueio de comandos
        destrutivos, fluxo de aprovação (resolveApproval) com `node-pty`/electron
        mockados, e tools kill/list/shell_input com registro vazio. ✅
- [x] **Testes de providers** com **mock de HTTP** (`src/main/providers/__tests__`):
      - `openai.ts` — stream de texto, tool calls (argumentos), erro. ✅
      - `anthropic.ts` — text_delta/input_json_delta, tool_call_end, erro de parse. ✅
      - `google.ts` — SSE (`net.fetch` mockado), functionCall, erro HTTP. ✅
      - `ollama.ts` — formato OpenAI-compatível, tool calls, erro com dica. ✅
- [x] **Testes de serviços** (`src/main/services/__tests__`):
      - `snapshot.ts` — captura/restauração, `node_modules` ignorado, limpeza de ids. ✅
      - `webhook-server.ts` — KoClaw real em porta aleatória: /help público, auth 401,
        GET /messages, POST /message (202), 400 (missing/invalid), 404, stop. ✅
      - `hyperedit.ts` — parsing e validação: tarefa obrigatória, arquivo inexistente,
        fora do workspace, plano vazio. ✅
- [ ] **e2e do renderer** com **Playwright**:
      - Fluxo de envio de mensagem (mocking do IPC).
      - Split de workspaces (criar/fechar/alternar tabs).
      - Tema Modern vs Classic, wizard de boas-vindas.
      - Painel de Source Control (stage/commit). ⏳

**Progresso atual**: 19 arquivos de teste, **138 testes passando** (`npm test`),
cobertura de utils + core + todas as ferramentas de filesystem/busca/shell + providers
(OpenAI/Anthropic/Google/Ollama) + serviços (snapshot/KoClaw/hyperedit). Typecheck e
build continuam limpos.

**Próximo incremento**: e2e Playwright (renderer com mocking do IPC).

**Critério de sucesso**: `npm test` roda em <30s e cobre ≥60% do `src/main/core` + tools.

---

## Fase 3 — Qualidade e consistência de código

**Ações**:
- [ ] **ESLint flat config** (`eslint.config.js`) + **Prettier**.
- [ ] **lint-staged** + **husky**: rodar lint + format + typecheck no pre-commit.
- [ ] Subir **strict mode** do TS (`tsconfig.json`): habilitar
      `noImplicitAny`, `strictNullChecks` (se ainda não), `noUncheckedIndexedAccess`,
      `exactOptionalPropertyTypes` (se viável).
- [ ] Eliminar usos de `any` — inventário atual (ex: `setPendingImages: (imgs: any)`,
      `handleSendForWs`, `sharedUIProps`, `onQuestionsSubmit: (answers: any)`).
- [ ] Tipar `window.koda` e remover `@ts-ignore` (ex: import de CSS no `App.tsx`).
- [ ] CI: adicionar jobs de `typecheck` + `lint` + `test` no workflow existente
      (`.github/workflows/dist.yml` ou novo `ci.yml`).

**Critério de sucesso**: zero `any` restantes no `src/`; PRs bloqueados se lint/type
falhar.

---

## Fase 4 — Validação de dados com Zod

**Problema**: entradas não confiáveis (configs, payloads do KoClaw, respostas de
providers, IPC do renderer) são validadas na mão ou não são.

**Ações**:
- [ ] Adicionar **zod** como dependência.
- [ ] Criar `src/shared/schemas.ts` com schemas reutilizáveis:
      - `KodaSettingsSchema`, `ProviderConfigSchema`, `WorkspaceSchema`.
      - `KoClawMessageSchema` (payload de `POST /message`).
      - `ToolCallSchema` / `StreamChunkSchema` (contrato do agente).
- [ ] Validar payloads de entrada nos handlers IPC antes de passar ao agente.
- [ ] Validar respostas de providers no `BaseProvider` (parsing seguro de stream).
- [ ] Validar configuração carregada do `.env` (via `config/settings.ts`).

**Critério de sucesso**: payload inválido de KoClaw retorna `400` com mensagem clara,
sem crash.

---

## Fase 5 — Estado do renderer mais limpo (opcional)

**Problema**: `App.tsx` faz composição de hooks com muito prop-drilling
(`sharedUIProps` com ~35 props). Adicionar features novas é ruidoso.

**Ações**:
- [ ] Adicionar **Zustand** (leve, sem boilerplate).
- [ ] Extrair stores por domínio:
      - `useWorkspaceStore` (workspaces, activeId, split) — já existe como hook; migrar.
      - `useSettingsStore` (kodaSettings, theme, show* flags).
      - `useAgentStore` (chunk buffers, streaming, task queue).
- [ ] Reduzir `sharedUIProps` — componentes passam a ler da store diretamente.
- [ ] Manter hooks existentes como fina camada sobre as stores (migração gradual).

**Critério de sucesso**: `App.tsx` perde ~40% das props transmitidas; novo painel
adiciona-se com <5 linhas no `App.tsx`.

---

## Fase 6 — Contrato schema-first para tools e agentes

**Problema**: cada tool define sua interface na mão; o registry replica regras de modo
e lock. Não há um schema único que descreva "o que uma tool é".

**Ações**:
- [ ] Definir `ToolDefinition` com **JSON Schema** (ou Zod) por tool: nome, descrição,
      parâmetros, saída, modos permitidos.
- [ ] Gerar o **system prompt** a partir do schema (em vez de texto hardcoded no
      `prompt-builder.ts`).
- [ ] Derivar tipos TS dos schemas (via `z.infer` ou `json-schema-to-ts`).
- [ ] Unificar `ToolRegistry` para validar argumentos antes da execução (permitir/
      rejeitar com mensagem clara pro agente).

**Critério de sucesso**: adicionar uma tool nova = criar um schema + implementação;
prompt, validação e tipos são gerados.

---

## Fase 7 — Modo Servidor MCP + evolução do KoClaw

### 7.1 Modo Servidor MCP

**Problema**: o Koda hoje é apenas *cliente* MCP. Expor as tools do agente como um
**servidor MCP** (JSON-RPC padrão) permite que qualquer cliente MCP (Claude Desktop,
outros agentes/IDEs) dirija o Koda — sem protocolo proprietário.

**Ações**:
- [ ] Implementar um servidor MCP nativo (`@modelcontextprotocol/sdk`) que expõe as
      tools registradas no `ToolRegistry` como ferramentas MCP (`tools/list`,
      `tools/call`).
- [ ] Mapear as tools existentes (file_*, shell, search, lsp_query, skill, etc.) para
      o schema MCP, reutilizando o contrato schema-first da Fase 6.
- [ ] Limitar exposição por padrão: apenas tools seguras/leitura; `shell` e demais
      ferramentas mutáveis exigem opt-in explícito no Settings.
- [ ] Aplicar `.kodaignore` e validação de argumentos nas chamadas via MCP (mesma
      trilha do agente interno).
- [ ] Transporte: stdio (para `koda` como subprocesso) e/ou SSE (para acesso remoto),
      ambos configuráveis.
- [ ] Toggle no Settings: "Modo Servidor MCP" (desativado por padrão).

**Critério de sucesso**: conectar o Koda como servidor MCP a um cliente padrão e usar
`file_read`/`search` dele, com as mesmas proteções do agente interno.

### 7.2 SSE no KoClaw (com opção de desativar)

**Problema**: o KoClaw hoje é `202 → polling`. Agentes externos não recebem progresso
em tempo real.

**Ações**:
- [ ] Adicionar endpoint `GET /stream` (SSE) que emite eventos de progresso do agente:
      tokens/assistant, início/fim de tool call, status (processing/done/error).
- [ ] Manter `POST /message` e `GET /messages` intactos (compatibilidade com `curl`).
- [ ] Adicionar **toggle de desativação** no Settings (ex: `koclaw.streaming`):
      - Quando desativado, o servidor **não registra** a rota `/stream` e o modelo de
        polling continua funcionando normalmente.
      - Quando ativado, emitir eventos de forma assíncrona sem bloquear as respostas
        REST existentes.
- [ ] Transporte alternativo futuro: WebSocket (deixar extensível via camada de
      transporte).
- [ ] SSE respeita a mesma autenticação (Bearer token) das demais rotas.

**Critério de sucesso**: `curl -N /stream` mostra tokens em tempo real; com o toggle
desativado, a rota retorna `404` e o fluxo legacy de polling segue 100% funcional.

### 7.3 Contrato ConnectRPC opcional (quando houver demanda)

**Ações**:
- [ ] Manter REST/JSON como default (compatibilidade com `curl`).
- [ ] Adicionar **contrato ConnectRPC opcional** (`.proto` + código gerado) ao lado do
      REST, para agentes externos sérios ganharem cliente tipado e streaming.

**Critério de sucesso**: `curl -X POST /message` continua funcionando; novo cliente
gerado via Connect funciona contra o mesmo servidor.

---

## O que NÃO fazer

- ❌ Migrar para Tauri/outro runtime — reescrita, não modernização.
- ❌ Monorepo/pnpm por ora — complexidade sem ganho real para repo único.
- ❌ Trocar JSON por protobuf binário em fronteiras locais (IPC, KoClaw default).
- ❌ Reescrever UI do zero — modernizar por camadas.

---

## Ordem sugerida e checkpoint

| Fase | Esforço | Valor | Ordem |
|---|---|---|---|
| 1. IPC tipado | Baixo | Alto | ✅ Concluída |
| 2. Testes | Alto | Altíssimo | 2º (em paralelo com 3) |
| 3. Qualidade/lint/strict | Baixo | Alto | 3º |
| 4. Zod | Baixo | Médio | 4º |
| 5. Zustand | Médio | Médio | 5º |
| 6. Schema-first tools | Alto | Alto | 6º |
| 7. Servidor MCP + SSE/API | Alto | Alto | Sob demanda/7º |

**Checkpoint após Fase 1+2+3**:
- [x] `npm run typecheck` limpo e sincronizado com IPC (Fase 1 concluída).
- [ ] `npm test` cobrindo core + tools (Fase 2).
- [ ] CI verde com lint + testes em todo PR (Fase 3).

---

## Métricas de sucesso (após todas as fases)

- Zero `any` em `src/`; strict mode habilitado.
- Cobertura de testes ≥ 60% no core e ≥ 80% nas tools críticas.
- `App.tsx` com props reduzidas em ~40%.
- Nova tool adicionada sem editar prompt builder nem types manuais.
- KoClaw continua 100% compatível com `curl`.
