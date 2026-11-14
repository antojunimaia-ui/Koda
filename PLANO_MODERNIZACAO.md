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

| Fase                      | Status                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1. IPC tipado             | ✅ Concluída (2026-11-14)                                                                                   |
| 2. Testes                 | 🟡 Em andamento (unit core/tools ✅; providers ✅; serviços ✅; só e2e Playwright pendente)                 |
| 3. Qualidade/lint/strict  | ✅ Concluída (gates: ESLint+Prettier+husky+CI; hardening TS/`any` registrado como backlog)                  |
| 4. Zod                    | ✅ Concluída (schemas + validação IPC/KoClaw/.env; stream de providers → backlog)                           |
| 5. Zustand                | ✅ Concluída (stores workspace/ui + consumo direto no ModernUI/ClassicUI; useAgentStore → backlog opcional) |
| 6. Schema-first tools     | ✅ Concluída (schema por tool + validação no registry + prompt do schema; zod-per-tool → backlog)           |
| 7. Servidor MCP + SSE/API | ✅ Concluída (MCP stdio + SSE com toggle; ConnectRPC opcional → backlog)                                    |

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
- [x] **Unit tests do core** (`src/main/core/__tests__`): - `conversation.ts` — histórico, `microCompact`, `trimIfNeeded`, rollback. ✅ - `prompt-builder.ts` — montagem do prompt com env/projeto/tools. ✅ - `context.ts` — detecção de linguagem/framework/package manager. ✅ - `slash-commands.ts` — estrutura e unicidade dos comandos. ✅
- [x] **Unit tests das tools** (`src/main/tools/__tests__`): - `file-edit.ts` / `file-read.ts` / `file-write.ts` — fixtures temporárias em disco,
      `.kodaignore` aplicado. ✅ - `kodaignore` (utils) — regras de bloqueio por padrão. ✅ - `search.ts` — `manualSearch` (regex, case-insensitive, include glob, maxResults,
      diretórios ignorados) + `execute` com fallback. ✅ - `file-find.ts` — glob com `globby`, `.kodaignore` aplicado, sem resultados. ✅ - `shell.ts` — validação de parâmetros, `isReadOnly`, bloqueio de comandos
      destrutivos, fluxo de aprovação (resolveApproval) com `node-pty`/electron
      mockados, e tools kill/list/shell_input com registro vazio. ✅
- [x] **Testes de providers** com **mock de HTTP** (`src/main/providers/__tests__`): - `openai.ts` — stream de texto, tool calls (argumentos), erro. ✅ - `anthropic.ts` — text_delta/input_json_delta, tool_call_end, erro de parse. ✅ - `google.ts` — SSE (`net.fetch` mockado), functionCall, erro HTTP. ✅ - `ollama.ts` — formato OpenAI-compatível, tool calls, erro com dica. ✅
- [x] **Testes de serviços** (`src/main/services/__tests__`): - `snapshot.ts` — captura/restauração, `node_modules` ignorado, limpeza de ids. ✅ - `webhook-server.ts` — KoClaw real em porta aleatória: /help público, auth 401,
      GET /messages, POST /message (202), 400 (missing/invalid), 404, stop. ✅ - `hyperedit.ts` — parsing e validação: tarefa obrigatória, arquivo inexistente,
      fora do workspace, plano vazio. ✅
- [ ] **e2e do renderer** com **Playwright**: - Fluxo de envio de mensagem (mocking do IPC). - Split de workspaces (criar/fechar/alternar tabs). - Tema Modern vs Classic, wizard de boas-vindas. - Painel de Source Control (stage/commit). ⏳

**Progresso atual**: 19 arquivos de teste, **138 testes passando** (`npm test`),
cobertura de utils + core + todas as ferramentas de filesystem/busca/shell + providers
(OpenAI/Anthropic/Google/Ollama) + serviços (snapshot/KoClaw/hyperedit). Typecheck e
build continuam limpos.

**Próximo incremento**: e2e Playwright (renderer com mocking do IPC).

**Critério de sucesso**: `npm test` roda em <30s e cobre ≥60% do `src/main/core` + tools.

---

## Fase 3 — Qualidade e consistência de código — ✅ Concluída

**Ações**:

- [x] **ESLint flat config** (`eslint.config.js`) + **Prettier** (`.prettierrc.json`,
      `.prettierignore`).
- [x] **lint-staged** + **husky** (`.husky/pre-commit`): roda `eslint --fix` +
      `prettier --write` nos arquivos staged e `typecheck` a cada commit.
- [x] Scripts: `lint`, `lint:fix`, `format:check`, `format:fix`.
- [x] CI: novo `.github/workflows/ci.yml` com `typecheck` + `lint` + `test` (Node 22)
      em push/PR.
- [x] `npm run lint` → **0 erros** (357 avisos de regras de estilo legadas: `any`,
      não-usados etc.) — o portão falha apenas em erros reais.
- [x] Regras corretivas aplicadas: `@ts-ignore` → `@ts-expect-error` (4 locais),
      `prefer-const`, `no-useless-assignment`, `no-unused-expressions` (warn),
      `no-require-imports`/`require-yield`/`preserve-caught-error` (warn).
- [x] Aplicar Prettier repo-wide (`format:fix`) — código 100% consistente.

**Backlog registrado (hardening futuro)**:

- ⏳ **Strict mode adicional** — medido: `noUncheckedIndexedAccess` afetaria ~193
  linhas; `exactOptionalPropertyTypes` ~361. Adiar (risco/volume) para uma fase
  dedicada de hardening.
- ⏳ **Eliminação de `any`** — 357 avisos espalhados (main: ~129 linhas com `: any`;
  renderer: ~57). Regra já sinaliza (`warn`); redução progressiva em PRs focados.

---

## Fase 4 — Validação de dados com Zod — ✅ Concluída

**Problema**: entradas não confiáveis (configs, payloads do KoClaw, respostas de
providers, IPC do renderer) são validadas na mão ou não são.

**Ações**:

- [x] Adicionar **zod** como dependência.
- [x] Criar `src/shared/schemas.ts` com schemas reutilizáveis: - `SetupConfigSchema` (IPC `agent:setup`) — tipo derivado com `z.infer`,
      reaproveitado no contrato `ipc.ts` (eliminou duplicação). - `ApprovedCommandsSchema` (IPC `agent:update_approved_commands`). - `KoClawMessageSchema` (payload de `POST /message`). - `KoClawStartConfigSchema` (IPC `koclaw:start`). - `EnvironmentSettingsSchema` + `sanitizeEnvironment` (validação de `.env`).
- [x] Validar payloads de entrada nos handlers IPC antes de passar ao agente:
      `agent:setup`, `agent:update_approved_commands`, `koclaw:start`.
- [x] Validar payload do KoClaw (`webhook-server.ts`) — `safeParse` → `400` claro.
- [x] Validar configuração carregada do `.env` (`config/settings.ts`) — provider
      inválido cai para `openai` em vez de quebrar depois.
- [ ] Validar respostas de providers no `BaseProvider` (parsing seguro de stream) —
      registrado como evolução futura.

**Critério de sucesso**: payload inválido de KoClaw retorna `400` com mensagem clara,
sem crash. ✅

---

## Fase 5 — Estado do renderer mais limpo — ✅ Concluída

**Problema**: `App.tsx` faz composição de hooks com muito prop-drilling
(`sharedUIProps` com ~35 props). Adicionar features novas é ruidoso.

**Ações**:

- [x] Adicionar **Zustand** e criar `src/renderer/stores/`: - `workspaceStore.ts` — workspaces, activeId, split + ações (update, create,
      close, splitWith, switch, toggle). Lógica migrada do hook. - `uiStore.ts` — flags de visibilidade (settings, browser, terminal, panel,
      explorer, source control) + `contextPanelTab` + wizard.
- [x] `useWorkspaces` virou **fachada fina** sobre a store (mesma API, zero quebra).
- [x] `App.tsx` passou a ler os flags de UI da `uiStore` (removeu 9 `useState` de
      visibilidade do componente).
- [x] **Componentes consomem a store diretamente**: `useActiveWorkspaceData()`
      fornece messages/isProcessing/agentInfo/mode/pendingImages/taskQueue/pinnedFiles + ações. `ModernUI` e `ClassicUI` removeram 9 props da interface cada; o corpo
      dos componentes ficou intocado (só mudou a fonte das variáveis).
- [x] `sharedUIProps` reduzido em ~6 entradas + remoções no JSX (messages/pinnedFiles/
      taskQueue/setTaskQueue) — `App.tsx` não repassa mais dados derivados do workspace.
- [x] Testes das stores (9 testes novos — `workspaceStore`/`uiStore`).
- [ ] `useAgentStore` (chunk buffers, streaming, task queue) a partir de
      `useAgentStream`/`useMessageActions` — backlog opcional (mecânica interna de
      streaming, sem impacto em props).

**Critério de sucesso**: `App.tsx` perde ~40% das props transmitidas; novo painel
adiciona-se com <5 linhas no `App.tsx`. ✅ (parcial: redução significativa; store de
streaming fora do escopo)

---

## Fase 6 — Contrato schema-first para tools e agentes — ✅ Concluída

**Problema**: cada tool define sua interface na mão; o registry replica regras de modo
e lock. Não há um schema único que descreva "o que uma tool é".

**Ações**:

- [x] Definir `ToolJsonSchema` + gerador canônico `toolParametersToJsonSchema()`
      (nome, descrição, parâmetros com tipo/obrigatórios) em `tools/base.ts`.
- [x] `BaseTool.getJsonSchema()` — toda tool expõe seu schema; `ToolDefinition`
      agora inclui `jsonSchema`.
- [x] Gerar o **system prompt** a partir do schema (`agent.getToolsMetadata()` lista
      parâmetros e obrigatórios por tool).
- [x] Unificar `ToolRegistry.execute()` — valida argumentos contra o schema antes de
      executar (`validateArgsAgainstSchema`), com mensagem clara para o agente.
- [x] Conversores de providers (`toOpenAITools`/`toAnthropicTools`/`toGoogleTools`)
      passaram a usar o mesmo schema (eliminou duplicação).
- [x] Testes do schema/validador (7 novos — 167 no total).
- [ ] Derivar tipos TS por tool via `z.infer` (schemas Zod por tool) — backlog;
      hoje os tipos vêm de `ToolParameter` (mesma fonte).

**Critério de sucesso**: adicionar uma tool nova = criar um schema + implementação;
prompt, validação e tipos são gerados. ✅ (validação + prompt gerados; tipos via
`ToolParameter`)

---

## Fase 7 — Modo Servidor MCP + evolução do KoClaw — ✅ Concluída

### 7.1 Modo Servidor MCP

**Problema**: o Koda hoje é apenas _cliente_ MCP. Expor as tools do agente como um
**servidor MCP** (JSON-RPC padrão) permite que qualquer cliente MCP (Claude Desktop,
outros agentes/IDEs) dirija o Koda — sem protocolo proprietário.

**Ações**:

- [x] Implementar servidor MCP nativo (`@modelcontextprotocol/sdk`) em
      `services/mcp-server.ts` — expõe as tools do `ToolRegistry` como ferramentas
      MCP (`tools/list`, `tools/call`).
- [x] Mapear as tools para o schema MCP reutilizando o contrato schema-first:
      `toolParametersToZod()` (Fase 6) como `inputSchema`.
- [x] Limitar exposição por padrão: apenas tools seguras/leitura (`READ_ONLY_TOOLS`);
      `shell`/file_write/etc. exigem `allowMutatingTools: true`.
- [x] Validação de argumentos na trilha do agente (o próprio `tool.execute` + registry).
- [x] Transporte: **stdio** (`StdioServerTransport`) — Koda como subprocesso MCP.
- [x] Toggle no Settings (modal MCP): "Modo Servidor MCP" + opt-in de tools mutáveis.
- [x] IPC: `mcp:server_start` / `mcp:server_stop` / `mcp:server_status`.

**Critério de sucesso**: cliente MCP padrão lista e chama tools read-only � Koda.
✅ (testes com `InMemoryTransport` + `Client` do SDK)

### 7.2 SSE no KoClaw (com opção de desativar)

**Problema**: o KoClaw hoje é `202 → polling`. Agentes externos não recebem progresso
em tempo real.

**Ações**:

- [x] Endpoint `GET /stream` (SSE) emitindo eventos de progresso do agente (text,
      tool_start/tool_end, done/error) via mesmo `emit()` do `POST /message`.
- [x] `POST /message` e `GET /messages` intactos (compatibilidade com `curl`).
- [x] **Toggle de desativação** (`koclaw.streaming`, default true): desativado, a rota
      `/stream` retorna `404` e o polling segue funcionando.
- [x] SSE respeita a mesma autenticação Bearer.
- [x] UIs: checkbox no RemoteControlTab + endpoint `/stream` na lista.
- [ ] Transporte alternativo futuro: WebSocket (deixar extensível via camada de
      transporte). ⏳

**Critério de sucesso**: `curl -N /stream` mostra eventos em tempo real; com o toggle
desativado, a rota retorna `404` e o fluxo legacy de polling segue 100% funcional. ✅
(testes: 200/tipo event-stream + evento `done`; 404 quando desativado)

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

| Fase                      | Esforço | Valor     | Ordem                  |
| ------------------------- | ------- | --------- | ---------------------- |
| 1. IPC tipado             | Baixo   | Alto      | ✅ Concluída           |
| 2. Testes                 | Alto    | Altíssimo | 2º (em paralelo com 3) |
| 3. Qualidade/lint/strict  | Baixo   | Alto      | 3º                     |
| 4. Zod                    | Baixo   | Médio     | 4º                     |
| 5. Zustand                | Médio   | Médio     | 5º                     |
| 6. Schema-first tools     | Alto    | Alto      | 6º                     |
| 7. Servidor MCP + SSE/API | Alto    | Alto      | Sob demanda/7º         |

**Checkpoint após Fase 1+2+3**:

- [x] `npm run typecheck` limpo e sincronizado com IPC (Fase 1 concluída).
- [x] `npm test` cobrindo core + tools (Fase 2 — 138 testes).
- [x] CI verde com lint + testes em todo PR (Fase 3: workflow `ci.yml`).

---

## Métricas de sucesso (após todas as fases)

- Zero `any` em `src/`; strict mode habilitado.
- Cobertura de testes ≥ 60% no core e ≥ 80% nas tools críticas.
- `App.tsx` com props reduzidas em ~40%.
- Nova tool adicionada sem editar prompt builder nem types manuais.
- KoClaw continua 100% compatível com `curl`.
