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

**O Agente Autônomo Avançado de Engenharia de Software**

[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-v26.8.4-cyan)](package.json)
[![Electron](https://img.shields.io/badge/Electron-33.x-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

O Koda transcende o limite dos chatbots tradicionais. Rodando localmente como um aplicativo Electron Desktop, ele possui autonomia real para entender projetos gigantescos, gerenciar seu sistema de arquivos, executar comandos e escrever código no seu ambiente local — sem nenhuma extensão de IDE, sem nenhum servidor externo.

[Funcionalidades](#-principais-features) •
[Modos](#%EF%B8%8F-modos-de-operação) •
[Ferramentas](#-arsenal-de-ferramentas) •
[Provedores](#-provedores-suportados) •
[Instalação](#-instalação) •
[Build](#-build-e-publicação)

</div>

---

## 🚀 Principais Features

- 🤖 **Pair-Programming Autônomo**: Você não precisa copiar e colar código. O Koda acessa seu repositório, compreende a arquitetura e edita os arquivos diretamente.
- ⏪ **Snapshots de Estado & Rollback**: Antes de cada mensagem, o Koda tira uma foto completa do seu workspace. Se o agente quebrar algo, passe o mouse sobre qualquer mensagem e clique em `↺` — os arquivos e a memória do agente são restaurados instantaneamente.
- ⚡ **Terminal PTY Real**: Integração nativa com `node-pty`. O Koda executa comandos, instala dependências, inicia servidores, envia inputs interativos (`y/n`, senhas) e aguarda por padrões específicos no output, tudo de forma autônoma.
- 📋 **Planner Mode**: Para mudanças arquiteturais complexas, o Koda entra em modo de planejamento, explora o código com ferramentas read-only, cria um plano em Markdown e solicita sua **aprovação** antes de tocar em qualquer arquivo.
- 🌍 **Agnóstico de Modelos (LLM)**: Suporta 13 provedores nativamente com sync dinâmico de modelos via API. Nunca mais decorar IDs obscuros.
- 🌐 **Agente de Navegação Web**: Via `operantid.js`, o Koda pode controlar um browser para navegar, testar UIs, interagir visualmente e extrair dados de sites.
- 🧠 **Inteligência Semântica via LSP**: Integração com Language Server Protocol para análise de código e resolução de dependências.
- 🏷️ **At-Mentions (`@`)**: Mencione arquivos diretamente no chat digitando `@`. Um seletor inteligente aparece para você escolher e entregar contexto ao agente.
- 🎨 **Sistema de Temas**: 4 temas curados inclusos (Tokyo Night, GitHub Dark, Cyberpunk Neon, Classic Monokai), com live preview e suporte para criar os seus próprios em JSON.

---

## ⚙️ Modos de Operação

O Koda opera em dois modos distintos, alternáveis diretamente na Titlebar:

### ⚡ Fast Mode *(padrão)*
Ação imediata e autônoma. O agente executa suas solicitações diretamente, sem fricções. As ferramentas de planejamento são **completamente removidas** do arsenal do agente a nível de API — para a IA, no modo Fast, o Planner não existe.

### 📋 Planner Mode
Antes de qualquer mudança no código, o Koda entra em um ciclo de exploração read-only, cria um **plano tático detalhado em Markdown** e aguarda sua **aprovação explícita**. Ideal para grandes refatorações ou mudanças arquiteturais.

---

## 🛠 Arsenal de Ferramentas

O Koda possui um conjunto completo de ferramentas que o agente pode invocar:

| Ferramenta | Descrição |
| :--- | :--- |
| `shell` | Executa comandos via PTY real em background. Retorna PID imediatamente. |
| `shell_wait` | Aguarda por um padrão (Regex/Text) ou pela saída de um processo PTY. |
| `shell_input` | Envia stdin a um processo PTY em execução (respostas, senhas, confirmações). |
| `kill_pty` | Para um processo PTY com Ctrl+C (SIGINT) ou force-kill (SIGKILL). |
| `list_pty` | Lista todos os processos PTY ativos com seus PIDs. |
| `file_read` | Lê o conteúdo de um arquivo com suporte a ranges de linhas. |
| `file_write` | Cria ou sobrescreve um arquivo por completo. |
| `file_edit` | Edita trechos específicos de um arquivo sem reescrever o resto. |
| `file_find` | Busca arquivos por nome ou padrão glob no projeto. |
| `list_dir` | Lista o conteúdo de um diretório, com detalhes de tamanho e tipo. |
| `search` | Busca por padrão (Regex) em arquivos, com suporte a ripgrep. |
| `lsp_query` | Consulta semântica via Language Server Protocol. |
| `browser_agent` | Inicia um sub-agente de navegação web via OperantID. |
| `enter_plan_mode` | *(Planner Mode only)* Inicia o ciclo de exploração read-only. |
| `exit_plan_mode` | *(Planner Mode only)* Apresenta o plano para aprovação do usuário. |

---

## 🌍 Provedores Suportados

O Koda sincroniza modelos dinamicamente via API. Basta inserir sua chave e selecionar no dropdown:

| Provedor | Modelos Padrão |
| :--- | :--- |
| **OpenRouter** | Acesso a centenas de LLMs (Claude, GPT, Llama, Gemini, etc.) |
| **OpenAI** | `gpt-4o`, `o1`, `o3` |
| **Anthropic** | `claude-sonnet-4`, `claude-3-7-sonnet` |
| **Google Gemini** | `gemini-2.0-flash`, `gemini-2.0-pro` |
| **Groq** | `llama-3.3-70b-versatile` — inferência ultra-rápida via LPU |
| **DeepSeek** | `deepseek-chat`, `deepseek-reasoner` |
| **Mistral AI** | `codestral-latest`, `mistral-large` |
| **Together AI** | `Llama-3.3-70B-Instruct-Turbo` |
| **xAI** | `grok-beta` |
| **Zhipu AI** | `glm-5`, `glm-4.7` |
| **Maritaca AI** | `sabia-4`, `sabiazinho-4` |
| **Ollama** | Qualquer modelo local instalado |
| **Llama.cpp** | Inferência local via servidor HTTP |

---

## 💻 Instalação

### Pré-requisitos

- [Node.js](https://nodejs.org/) 20 ou superior
- Git no `PATH`
- Chave de API de qualquer provedor LLM suportado

### Rodando em Modo de Desenvolvimento

1. **Clone o repositório:**

   ```bash
   git clone https://github.com/antojunimaia-ui/Koda.git
   cd Koda
   ```

2. **Instale as dependências:**

   ```bash
   npm install
   ```

3. **Inicie o ambiente de desenvolvimento:**

   > Sempre use `dev:clean` para evitar artefatos de build anteriores.

   ```bash
   npm run dev:clean
   ```

> 🔒 **Privacidade**: Nenhum arquivo `.env` é necessário. Suas chaves de API são armazenadas com segurança no `localStorage` local via menu de configurações (ícone ⚙️ na Titlebar).

---

## ⌨️ Comandos Nativos

Use **Slash Commands** diretamente no input do chat:

| Comando | Descrição |
| :--- | :--- |
| `/help` | Exibe o menu de ajuda. |
| `/clear` | Limpa a interface visual de mensagens. |
| `/reset` | Limpa a memória de contexto da conversa atual. |
| `/model --<name>` | Troca o modelo ativo via comando. |
| `/apikey <key>` | Define a chave de API diretamente pelo chat. |

---

## 📦 Build e Publicação

<details>
<summary><strong>Windows (.exe • NSIS Installer)</strong></summary>

```bash
npm run dist
```

Gera `release-build/Koda Setup <version>.exe` — instalador com opções de diretório, atalhos e ícone personalizados.
</details>

<details>
<summary><strong>Linux (.AppImage)</strong></summary>

```bash
npm run dist:linux
```

Requer dependências padrão de empacotamento na sua distro (Ubuntu/Debian).
</details>

<details>
<summary><strong>macOS (.dmg)</strong></summary>

```bash
npm run dist:mac
```

Gera instalador nativo `.dmg` otimizado para o ecossistema Apple.
</details>

---

## 🏗️ Arquitetura

```
src/
├── main/              # Processo principal do Electron (Node.js)
│   ├── core/          # Agent, Conversation, PromptBuilder, Context
│   ├── providers/     # 13 provedores LLM (OpenAI, Anthropic, Google, ...)
│   ├── services/      # Snapshot Manager, LSP Client
│   ├── tools/         # 15 ferramentas do agente
│   ├── config/        # Settings e detecção de ambiente
│   └── index.ts       # Entry point + IPC handlers
├── preload/           # Bridge segura de IPC (contextBridge)
└── renderer/          # Interface React 19 + Tailwind CSS 4
    ├── components/    # TitleBar, BrailleSpinner
    ├── themes/        # Tokyo Night, GitHub Dark, Cyberpunk, Monokai
    └── App.tsx        # UI principal (~1200 linhas)
```

---

## 🤝 Contribuindo

Leia o [CONTRIBUTING.md](./CONTRIBUTING.md) antes de abrir PRs. Sugestões de features podem ser enviadas via [FUTURE.md](./FUTURE.md).

---

## 📜 Licença

Distribuído sob a **[Licença BSD 3-Clause](./LICENSE)**. Sinta-se livre para clonar, explorar e moldar o seu próprio Koda.

---

<div align="center">
  Desenvolvido com inteligência por <strong>antojunimaia-ui</strong>. © 2026.
</div>
