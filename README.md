# Koda 🧠

<div align="center">

**O Agente Autônomo Avançado de Engenharia de Software**

[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33.2.1-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

O Koda transcende o limite dos chatbots tradicionais. Rodando localmente como um aplicativo Electron Desktop, ele possui autonomia real para entender projetos gigantescos, gerenciar seu sistema de arquivos, executar comandos e escrever código no seu ambiente local.

[Funcionalidades](#-principais-features) •
[Instalação](#-instalação) •
[Comandos](#-comandos-nativos) •
[Build](#-build) •
[Licença](#-licença)

</div>

---

## ⚙️ Modos de Operação

O Koda oferece dois modos distintos de trabalho, selecionáveis diretamente na barra de título (TitleBar):

- ⚡ **Fast**: O modo padrão. O Agente executa suas solicitações de forma direta e imediata. Ideal para tarefas rápidas, consultas de código ou pequenas refatorações.
- 📋 **Planner**: O modo tático. Antes de realizar qualquer alteração destrutiva ou execução de comando, o Agente entra em um ciclo de exploração, cria um plano detalhado em Markdown e solicita sua **aprovação**. É o modo recomendado para grandes mudanças arquiteturais.

---

## 🚀 Principais Features

- 🤖 **Pair-Programming Autônomo**: Você não precisa copiar e colar código. O Koda acessa seu repositório, compreende a arquitetura e edita os arquivos diretamente.
- ⚡ **Integração Real (PTY Terminal)**: Graças a ferramentas integradas e um pseudoterminal real em segundo plano (`node-pty`), o Koda pode rodar comandos: instalar dependências, compilar o código, checar o status do git e controlar processos, tudo de forma autônoma.
- 📋 **Planner Mode (Modo de Planejamento)**: Para refinamentos arquiteturais e mudanças destrutivas, o Koda desenha um "plano tático" do que será alterado antes de tocar no código. Revise, edite e **Aprove** ou **Rejeite** cada passo visualmente na interface.
- 🏷️ **At-Mentions (@)**: Mencione arquivos diretamente no chat digitando `@`. Um seletor inteligente aparecerá para você escolher o arquivo, facilitando a entrega de contexto para o agente.
- 🧠 **Aguda Inteligência de Código via LSP**: O Koda integra regras semânticas (Language Server Protocol), possuindo auto-complete interno, análise de linting em tempo real e resolução precisa de dependências espalhadas pelo projeto.
- 🌍 **Agnóstico de Modelos (LLM)**: Nativamente, o Koda suporta os maiores provedores do mercado e sincroniza a lista de modelos dinamicamente via API. Você não precisará decorar IDs de modelos obscuros, basta selecionar num dropdown!
  - **OpenRouter**: Acesso liberado a centenas de LLMs abertos e fechados em uma única API.
  - **OpenAI**: `gpt-4o`, `o1`, `o3`.
  - **Anthropic**: Família `claude-3-7-sonnet`.
  - **Google**: Modelos otimizados `gemini-2.0-pro` e `flash`.
- 💻 **Interface "Hacker" de Alta Performance**: Focado puramente na produtividade. Sem distrações. Design premium voltado à performance e clareza na leitura de código, integrado com um emulador de terminal sólido (`xterm.js`).

---

## 💻 Instalação

### Pré-requisitos

Certifique-se de que sua máquina atende aos requisitos básicos:

- [Node.js](https://nodejs.org/) (Versão 20 ou superior)
- Git instalado no seu `PATH`
- Chave de API de um provedor LLM habilitado (OpenAI, Anthropic ou Google Gemini)

### Rodando o Koda em Desenvolvimento

1. **Clone o Repositório:**

   ```bash
   git clone https://github.com/antojunimaia-ui/Koda.git
   cd Koda
   ```

2. **Instalação das Dependências:**
   Instale os pacotes principais e dependências nativas (necessário um compilador C++ no sistema para o `node-pty`):

   ```bash
   npm install
   ```

3. **Iniciando o Ambiente:**
   Sempre inicie através do nosso script estendido, para evitar builds duplicados indesejados no dev-server do Vite/Electron:

   ```bash
   npm run dev:clean
   ```

> 🔒 **Privacidade Global**: Nenhuma dependência de arquivo `.env` é exigida para usar a IA! Suas chaves de API são salvas de forma permanente e segura no `localStorage` local da sua máquina através do menu de configurações (ícone de engrenagem).

---

## 🛠 Comandos Nativos

Dentro do Koda, utilizar atalhos te dá velocidade e controle granular pela interface baseada em Chat. Utilize os **Slash Commands** listados abaixo no input:

| Comando | Descrição |
| :--- | :--- |
| `/help` | Exibe o menu de ajuda com os comandos disponíveis. |
| `/clear` | Limpa toda a interface visual de mensagens. |
| `/reset` | Limpa a memória de contexto da conversa atual. |
| `/cd <path>` | Altera o diretório de trabalho (`CWD`) do Agente. |
| `/model --<name>` | Troca rapidamente o modelo atual via comando. |
| `/apikey <key>` | Define a chave de API diretamente via chat. |

---

## 📦 Build e Publicação

Para uso isolado cotidiano, o Koda conta com scripts do popular framework **Electron-Builder**. Ele gerará o executável auto-suficiente pulando a compilação demorada das dependências nativas de PTY, fornecendo assim uma experiência *Plug-And-Play*.

<details>
<summary><strong>Compilar App para Windows (.exe)</strong></summary>

```bash
npm run dist
```

Ao final do build, você encontrará o instalador (`Koda Setup.exe`) e a variante Unpacked alocada na pasta `./release-build`.
</details>

<details>
<summary><strong>Compilar App para Linux (.AppImage)</strong></summary>

```bash
npm run dist:linux
```

Requer dependências padrão de empacotamento ativas na sua Distro (Ubuntu/Debian).
</details>

<details>
<summary><strong>Compilar App para macOS (.dmg)</strong></summary>

```bash
npm run dist:mac
```

Gera o instalador nativo (.dmg) otimizado para o ecossistema Apple, garantindo uma experiência fluida e integrada ao macOS.
</details>

---

## 📜 Licença

Toda essa estrutura foi licenciada e é distribuída abertamente sob as normas de uso da **[Licença BSD 3-Clause](./LICENSE)**. Fique livre para clonar, explorar e moldar o seu próprio Koda!

## 🚀 O Futuro

Se você tiver alguma ideia de como melhorar o Koda, sinta-se à vontade para preencher o arquivo [FUTURE.md](./FUTURE.md).

---
<div align="center">
  Desenvolvido com inteligência por antojunimaia-ui. © 2026.
</div>
