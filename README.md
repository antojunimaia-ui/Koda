<div align="center">

# Koda Electron 🧠
**O Agente Autônomo Avançado de Engenharia de Software**

[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-30.0.0-47848F?logo=electron&logoColor=white)](https://electronjs.org/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

O Koda transcende o limite dos chatbots tradicionais. Rodando localmente como um aplicativo Electron Desktop, ele possui autonomia real para entender projetos gigantescos, gerenciar seu sistema de arquivos, executar comandos e escrever código no seu ambiente local.

[Funcionalidades](#-principais-features) •
[Instalação](#-instalação) •
[Comandos](#-comandos-nativos) •
[Build](#-build) •
[Licença](#-licença)

</div>

---

## 🚀 Principais Features

- 🤖 **Pair-Programming Autônomo**: Você não precisa copiar e colar código. O Koda acessa seu repositório, compreende a arquitetura e edita os arquivos diretamente.
- ⚡ **Integração Real (PTY Terminal)**: Graças a ferramentas integradas e um pseudoterminal real em segundo plano (`node-pty`), o Koda pode rodar comandos: instalar dependências, compilar o código, checar o status do git e controlar processos, tudo de forma autônoma.
- 📋 **Plan Mode (Modo de Planejamento)**: Para refinamentos arquiteturais e mudanças destrutivas, o Koda desenha um "plano tático" do que será alterado antes de tocar no código. Revise, edite e **Aprove** ou **Rejeite** cada passo visualmente na interface. 
- 🧠 **Aguda Inteligência de Código via LSP**: O Koda integra regras semânticas (Language Server Protocol), possuindo auto-complete interno, análise de linting em tempo real e resolução precisa de dependências espalhadas pelo projeto.
- 🌍 **Agnóstico de Modelos (LLM)**: Nativamente, o Koda suporta os maiores provedores do mercado e sincroniza a lista de modelos dinamicamente via API. Você não precisará decorar IDs de modelos obscuros, basta selecionar num dropdown!
  - **OpenRouter**: Acesso liberado a centenas de LLMs abertos e fechados em uma única API.
  - **OpenAI**: `gpt-4o`, `o1`, `o3-mini`.
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

> 🔒 **Privacidade Global**: Nenhuma dependência de arquivo `.env` é exigida para usar a IA! Com o app rodando, apenas digite `/agent` no input de chat. A Central de Configurações salvará suas chaves da API de forma permanente no `localStorage` local da sua máquina. Ele nunca enviará ou sincronizará chaves num banco de dados cloud.

---

## 🛠 Comandos Nativos

Dentro do Koda, utilizar atalhos te dá velocidade e controle granular pela interface baseada em Chat. Utilize os **Slash Commands** listados abaixo:

| Comando | Descrição |
| :--- | :--- |
| `/help` | Inicia o manual de ajuda no chat com todos os comandos disponíveis no diretório. |
| `/agent` | Abre o painel modal para configuração de API Keys e alteração fácil de Modelos. |
| `/clear` | Limpa instantaneamente toda a interface visual e retira as mensagens ativas da tela. |
| `/reset` | Dá um Wipe na janela de contexto de longo/curto prazo do Agente. Ideal quando o contexto atingir o limite de tokens. |
| `/plan <task>` | Força o modelo base entrar no *Plan Mode* estrito e focar apenas em planejar, sem de fato interagir com ferramentas ou código diretamente. *(Ex: `/plan refatorar sistema de autenticação`)* |
| `/cd <diretório>` | Altera dinamicamente o `Current Working Directory (CWD)` do Agente sem necessidade de reiniciar a aplicação inteira. |
| `/model --<nome>` | Troca com velocidade via CLI embutida qual a mente principal do modelo. |

---

## 📦 Build e Publicação

Para uso isolado cotidiano, o Koda conta com scripts do popular framework **Electron-Builder**. Ele gerará o executável auto-suficiente pulando a compilação demorada das dependências nativas de PTY, fornecendo assim uma experiência *Plug-And-Play*.

<details>
<summary><strong>Compilar App para Windows (.exe)</strong></summary>

```bash
npm run dist
```
Ao final do build, você encontrará o instalador (`Koda Setup.exe`) e a variante Unpacked (descompactada e rápida) alocada nativamente na pasta `./release`.
</details>

<details>
<summary><strong>Compilar App para Linux (.deb / .AppImage)</strong></summary>

```bash
npm run dist:linux
```
Requer dependências padrão de empacotamento ativas na sua Distro (Ubuntu/Debian).
</details>

---

## 📜 Licença

Toda essa estrutura foi licenciada e é distribuída abertamente sob as normas de uso da **[Licença BSD 3-Clause](./LICENSE)**. Fique livre para clonar, explorar e moldar o seu próprio Koda!

---
<div align="center">
  Desenvolvido com inteligência por antojunimaia-ui. © 2026.
</div>
