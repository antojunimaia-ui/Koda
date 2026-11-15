# Koda 26.1.7 — Fix for PTY loading on Linux/macOS (asar)

This patch fixes the **agent terminal (PTY)** still crashing on Linux (AppImage)
and macOS (DMG) in 26.1.6.

## What was happening

Even though 26.1.6 shipped the compiled `pty.node` inside the package, the app
still failed at startup with:

```
Error: Failed to load native module: pty.node
checked: build/Release, build/Debug, prebuilds/linux-x64
Cannot find module './prebuilds/linux-x64//pty.node'
```

**Root cause:** the `node-pty` package was packed inside the Electron **asar**
archive, while its native binary (`.node`) lives in the unpacked payload. When
the module resolves paths relative to the asar, it cannot find the unpacked
binary. This is a known Electron + native-module limitation.

## What was fixed

- `node-pty` is now **excluded from the asar** and shipped as a real folder in
  `resources/node_modules/node-pty` (physical path, original layout).
- The main process registers `resources/node_modules` on the module resolver
  before loading `node-pty`, so the native binary is found on disk.
- Loading was made lazy and injectable, keeping tests green.

## How to install

### Linux (AppImage)

```bash
curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-linux.sh | bash
```

Or manually: download `koda.AppImage`, then:

```bash
chmod +x koda.AppImage
./koda.AppImage
```

### macOS (DMG)

```bash
curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-macos.sh | bash
```

Or manually: download `Koda-26.1.7.dmg`, drag to Applications. If Gatekeeper
blocks it: `xattr -cr /Applications/Koda.app`.

### Windows

Usual NSIS installer (`Koda-Setup-26.1.7-x64.exe` / `-ia32.exe`).
