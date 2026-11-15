# Koda 26.1.6 — Patch importante para Linux/macOS (PTY)

Esta versão é um **patch importante** para Linux e macOS: corrige o terminal
integrado (PTY) que estava ausente nos pacotes dessas plataformas.

---

## O que acontecia

Ao iniciar o Koda no Linux (AppImage) ou macOS (DMG), o app falhava no
processo principal com:

```
Error: Failed to load native module: pty.node
checked: build/Release, build/Debug, prebuilds/linux-x64
Cannot find module './prebuilds/linux-x64//pty.node'
```

**Causa raiz:**

- O módulo nativo `node-pty` 1.1.0 **não publica binário pré-compilado para
  `linux-x64`** — ele precisa ser compilado no momento do build.
- O pipeline de release usava `npm install --ignore-scripts` + `postinstall || true`,
  que **mascarava a falha da compilação** — então o AppImage/DMG era empacotado
  sem o `pty.node`.
- Resultado: qualquer uso do terminal do agente (`shell`, `shell_wait`,
  `shell_input`, `kill_pty`…) quebrava ao carregar o módulo nativo.

---

## O que foi corrigido

- O CI agora instala a toolchain de compilação no Linux
  (`build-essential`, `python3`) junto das dependências X11/secret.
- O rebuild de módulos nativos para Linux/macOS roda de verdade
  (`electron-builder install-app-deps`, sem mascarar erro) → `node-pty`
  compilado contra o Electron.
- Novo passo de verificação que **falha o build** se o binário nativo
  (`pty.node`) não existir antes de empacotar — impede releases futuras sem PTY.

---

## Como instalar

### Linux (AppImage)

Via script oficial:

```bash
curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-linux.sh | bash
```

Ou manualmente: baixe o `koda.AppImage` desta release e execute:

```bash
chmod +x koda.AppImage
./koda.AppImage
```

### macOS (DMG)

Via script oficial:

```bash
curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-macos.sh | bash
```

Ou manualmente: baixe o `Koda-26.1.6.dmg`, abra e arraste o Koda para
Aplicativos. Se o Gatekeeper bloquear, remova a quarentena:

```bash
xattr -cr /Applications/Koda.app
```

### Windows

Instalador NSIS habitual (`Koda-Setup-26.1.6-x64.exe` / `-ia32.exe`) — não
afetado por este patch.
