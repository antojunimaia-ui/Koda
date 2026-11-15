# Koda v26.15.11 — Fix do PTY no Linux/macOS (asar)

Esta versão corrige o **terminal do agente (PTY)**, que ainda falhava ao
carregar no Linux (AppImage) e macOS (DMG) na 26.1.6.

## O que acontecia

Mesmo com o `pty.node` compilado dentro do pacote, o app falhava ao iniciar:

```
Error: Failed to load native module: pty.node
checked: build/Release, build/Debug, prebuilds/linux-x64
Cannot find module './prebuilds/linux-x64//pty.node'
```

**Causa raiz:** o pacote `node-pty` era empacotado dentro do arquivo **asar**
do Electron, enquanto o binário nativo (`.node`) ficava no payload desempacotado.
Ao resolver caminhos relativos ao asar, o módulo não encontra o binário.

## O que foi corrigido

- `node-pty` agora é **excluído do asar** e distribuído como pasta física em
  `resources/node_modules/node-pty` (caminho real, layout original).
- O processo principal registra `resources/node_modules` no resolvedor de
  módulos antes de carregar `node-pty`, garantindo que o binário seja achado
  em disco.
- A carga ficou lazy e injetável, mantendo os testes verdes.

## Como instalar

### Linux (AppImage)

```bash
curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-linux.sh | bash
```

Ou manualmente: baixe `koda.AppImage` e rode:

```bash
chmod +x koda.AppImage
./koda.AppImage
```

### macOS (DMG)

```bash
curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-macos.sh | bash
```

Ou manualmente: baixe `Koda-26.15.11.dmg`, arraste para Aplicativos. Se o
Gatekeeper bloquear: `xattr -cr /Applications/Koda.app`.

### Windows

Instalador NSIS usual (`Koda-Setup-26.15.11-x64.exe` / `-ia32.exe`).
