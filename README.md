# Koda AI 🧠

O Koda é um Agente Autônomo Avançado de Engenharia de Software, desenhado para se integrar profundamente no seu ambiente de desenvolvimento. Rodando localmente como um aplicativo Electron Desktop, o Koda transcende o limite dos chatbots tradicionais: ele tem autonomia para ler arquivos, entender projetos gigantescos, listar diretórios, criar e modificar o seu código cirurgicamente.

## 🚀 Principais Features

- **Pair-Programming Autônomo**: Você não precisa copiar e colar código. O Koda edita diretamente os arquivos do seu projeto.
- **Integração Real (PTY Terminal)**: O Koda possui ferramentas integradas para criar um pseudoterminal real em background. Ele pode rodar comandos, compilar projetos, instalar dependências e fechar portas tudo sozinho.
- **Plan Mode 📋**: Para arquiteturas ou tarefas não-triviais, o Koda acessa um "modo de planejamento" (ativado localmente ou com `/plan`). Ele irá navegar no seu sistema de arquivos sem modificar nada, traçará um plano tático descrevendo todos os arquivos que irá alterar, e você poderá **Aprovar e Executar** ou **Rejeitar e Refinar** utilizando o painel de aprovação visual nativo do Koda.
- **Aguda Inteligência de Código via LSP**: Ao injetar semânticas de Language Server Protocol (LSP), o Koda não baseia sua edição só no texto; ele obtém auto-complete real, erros do linter em tempo de execução e dependências.
- **Flexibilidade Multimodelo (Agnóstico)**: Nativamente suporta os 3 maiores canhões da indústria: OpenAI (`gpt-4o` ou `o1/o3`), Anthropic (`claude-3-7-sonnet` etc.) e Google (`gemini-2.0-flash`).  
- **Interface Hacker "Dark & Solid"**: Nada de glassmorphisms ou designs confusos. Uma interface voltada a performance, focada em entregar o conteúdo, com scroll suave, e uma UI de terminal robusta baseada no `xterm.js`.

---

## 💻 Instalação / Como Rodar

### Pré-requisitos

- [Node.js](https://nodejs.org/) (versão 20+)
- Uma chave de API válida (OpenAI, Anthropic ou Google Gemini)

### Rodando o App de Desenvolvimento

1. **Clone do repositório**:

   ```bash
   git clone https://github.com/antojunimaia-ui/Koda.git
   cd Koda
   ```

2. **Instalação das dependências e limpeza (para Electron nativo)**:
   Recomendamos sempre usar o script de clean na inicialização para evitar builds duplos indesejados no dev-server do Electron:

   ```bash
   npm install
   npm run dev:clean
   ```

3. **Iniciando o Koda**:
   O UI será renderizado assim que a inicialização paralela de plugins ocorrer.

Nenhuma `.env` é necessária no seu PC. Apenas inicie e, no chat do Koda, digite `/agent`. Vai abrir uma tela de configurações na própria Interface para você informar seu Provider, Modelo preferido, e esconder sua API Key com segurança no `localStorage`.

---

## 🛠 Comandos Nativos (Slash Commands)

Dentro do fluxo de chat principal do Koda, você domina sua sessão com comandos rápidos:

- `/help` - Exibe uma lista de comandos internos.
- `/clear` - Limpa a timeline visual da interface.
- `/reset` - Faz um Wipe da memória de longo-curto prazo do Agente (Bom quando o contexto estiver lotado).
- `/plan` - Força o próximo *prompt* em modo planejamento. (Ex: `/plan Construir o sistema de Login`)
- `/agent` - Abre as configurações da API.
- `/cd <caminho>` - Muda o `cwd` do agente sem reiniciar a janela inteira.
- `/model --<nome_do_modelo>` - Troca seu modelo (ex: `/model --gpt-4o`).

---

## 📦 Build Nativo (Windows / Linux)

Você pode compilar o projeto em um executável autossustentável Windows usando o processo NSIS provido pelo Electron-Builder.

```bash
npm run dist
npm run dist:linux
```

O Electron-Builder pulará recompilações de dependências pesadas (`node-pty`) e usufruirá dos pré-builds dentro do diretório gerado `release/`. Lá, você encontrará o `Koda Setup 1.0.0.exe`, e caso esteja no Linux, o Koda para Linux estara nesta pasta tambem.

---

## 📜 Licença

Este software e estrutura estão liberados e mantidos sob os termos normativos da **[Licença BSD-3](./LICENSE)**. (C) 2026, antojunimaia-ui.
