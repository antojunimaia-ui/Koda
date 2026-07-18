#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Koda — Linux Installer (AppImage)
# Downloads the latest release from GitHub and installs it to ~/.local/bin
# Usage:  curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-linux.sh | bash
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
REPO="antojunimaia-ui/Koda"
APP_NAME="Koda"
APPIMAGE_NAME="koda.AppImage"
INSTALL_DIR="$HOME/.local/bin"
ICON_DIR="$HOME/.local/share/icons/hicolor/256x256/apps"
DESKTOP_DIR="$HOME/.local/share/applications"
MARKER_DIR="$HOME/.local/share/koda"
MARKER_FILE="$MARKER_DIR/.installed"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"

# ── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()  { echo -e "${CYAN}[Koda]${RESET} $*"; }
ok()    { echo -e "${GREEN}[Koda]${RESET} $*"; }
warn()  { echo -e "${YELLOW}[Koda]${RESET} $*"; }
err()   { echo -e "${RED}[Koda]${RESET} $*" >&2; }

# ── Dependency check ─────────────────────────────────────────────────────────
check_deps() {
    local missing=()
    for cmd in curl chmod mkdir; do
        command -v "$cmd" &>/dev/null || missing+=("$cmd")
    done
    if (( ${#missing[@]} > 0 )); then
        err "Missing required commands: ${missing[*]}"
        exit 1
    fi
}

# ── Detect latest release AppImage URL ───────────────────────────────────────
get_download_url() {
    local arch
    arch="$(uname -m)"

    local api_response
    api_response=$(curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        "$API_URL" 2>/dev/null) || {
        err "Failed to fetch release info from GitHub."
        err "Check your internet connection or try again later."
        exit 1
    }

    # Extract the AppImage asset URL for the correct architecture
    local url
    if [[ "$arch" == "x86_64" || "$arch" == "amd64" ]]; then
        url=$(echo "$api_response" | grep -oP '"browser_download_url":\s*"\K[^"]*\.AppImage' | head -1)
    elif [[ "$arch" == "aarch64" || "$arch" == "arm64" ]]; then
        url=$(echo "$api_response" | grep -oP '"browser_download_url":\s*"\K[^"]*\.AppImage' | grep -i 'arm\|aarch' | head -1)
        # Fallback: if no arm-specific build, use the generic one
        [[ -z "$url" ]] && url=$(echo "$api_response" | grep -oP '"browser_download_url":\s*"\K[^"]*\.AppImage' | head -1)
    else
        url=$(echo "$api_response" | grep -oP '"browser_download_url":\s*"\K[^"]*\.AppImage' | head -1)
    fi

    if [[ -z "$url" ]]; then
        err "No AppImage found in the latest release."
        err "Visit https://github.com/${REPO}/releases manually."
        exit 1
    fi

    echo "$url"
}

# ── Get latest version tag ───────────────────────────────────────────────────
get_latest_version() {
    curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        "$API_URL" 2>/dev/null \
        | grep -oP '"tag_name":\s*"\K[^"]+' || echo "unknown"
}

# ── Install ──────────────────────────────────────────────────────────────────
install_koda() {
    check_deps

    echo ""
    echo -e "${BOLD}  ╔═══════════════════════════════════════╗${RESET}"
    echo -e "${BOLD}  ║       ${CYAN}Koda Linux Installer${RESET}${BOLD}           ║${RESET}"
    echo -e "${BOLD}  ╚═══════════════════════════════════════╝${RESET}"
    echo ""

    # Check if already installed
    if [[ -f "$MARKER_FILE" && -f "$INSTALL_DIR/$APPIMAGE_NAME" ]]; then
        warn "Koda is already installed at $INSTALL_DIR/$APPIMAGE_NAME"
        read -rp "Reinstall/update? [y/N] " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            info "Installation cancelled."
            exit 0
        fi
    fi

    # Get download URL
    info "Resolving latest release..."
    local download_url
    download_url=$(get_download_url)
    local version
    version=$(get_latest_version)

    info "Latest version: ${BOLD}$version${RESET}"
    info "Download URL: $download_url"
    echo ""

    # Create directories
    info "Creating directories..."
    mkdir -p "$INSTALL_DIR" "$ICON_DIR" "$DESKTOP_DIR" "$MARKER_DIR"

    # Download AppImage
    local tmp_file
    tmp_file=$(mktemp /tmp/koda-XXXXXX.AppImage)
    info "Downloading Koda $version..."
    info "(this may take a moment depending on your connection)"

    if ! curl -# -L -o "$tmp_file" "$download_url"; then
        err "Download failed."
        rm -f "$tmp_file"
        exit 1
    fi

    echo ""

    # Verify it's a valid AppImage (check magic bytes: 0x7fELF or ZISO)
    local magic
    magic=$(head -c 4 "$tmp_file" | xxd -p 2>/dev/null || echo "")
    if [[ "$magic" != "7f454c46" && "$magic" != "5a49534f" ]]; then
        warn "Downloaded file may not be a valid AppImage (magic: $magic)."
        warn "Continuing anyway — the file might still work."
    fi

    # Move to install location
    info "Installing to $INSTALL_DIR/$APPIMAGE_NAME..."
    mv -f "$tmp_file" "$INSTALL_DIR/$APPIMAGE_NAME"
    chmod +x "$INSTALL_DIR/$APPIMAGE_NAME"

    # Extract and copy icon
    info "Setting up icon..."
    local appimage_path="$INSTALL_DIR/$APPIMAGE_NAME"
    local icon_dest="$ICON_DIR/koda.png"

    # Try to extract icon from the AppImage
    if [[ -x "$appimage_path" ]]; then
        local temp_mount
        temp_mount=$(mktemp -d)
        if "$appimage_path" --appimage-extract "usr/share/icons/hicolor/256x256/apps/koda.png" --output "$temp_mount" &>/dev/null; then
            if [[ -f "$temp_mount/usr/share/icons/hicolor/256x256/apps/koda.png" ]]; then
                cp "$temp_mount/usr/share/icons/hicolor/256x256/apps/koda.png" "$icon_dest"
            fi
        fi
        rm -rf "$temp_mount"
    fi

    # Fallback: download icon from repo
    if [[ ! -f "$icon_dest" ]]; then
        curl -fsSL -o "$icon_dest" \
            "https://raw.githubusercontent.com/${REPO}/main/public/icon.png" 2>/dev/null || \
            warn "Could not download icon. Desktop entry will work but may lack an icon."
    fi

    # Create .desktop entry
    info "Creating desktop entry..."
    local desktop_file="$DESKTOP_DIR/koda.desktop"
    cat > "$desktop_file" <<EOF
[Desktop Entry]
Name=Koda AI
Comment=Autonomous AI Engineering Agent
Exec=$INSTALL_DIR/$APPIMAGE_NAME --no-sandbox %U
Icon=$icon_dest
Terminal=false
Type=Application
Categories=Development;IDE;
StartupWMClass=koda
MimeType=x-scheme-handler/koda;
EOF
    chmod +x "$desktop_file"

    # Refresh desktop database (best-effort)
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    xdg-icon-resource forceupdate 2>/dev/null || true

    # Add to PATH if not already there
    local shell_rc=""
    if [[ -f "$HOME/.bashrc" ]]; then
        shell_rc="$HOME/.bashrc"
    elif [[ -f "$HOME/.zshrc" ]]; then
        shell_rc="$HOME/.zshrc"
    fi

    if [[ -n "$shell_rc" ]]; then
        if ! grep -q "$INSTALL_DIR" "$shell_rc" 2>/dev/null; then
            info "Adding $INSTALL_DIR to PATH in $shell_rc..."
            echo "" >> "$shell_rc"
            echo "# Koda AI" >> "$shell_rc"
            echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$shell_rc"
            warn "Restart your shell or run: source $shell_rc"
        fi
    fi

    # Write install marker
    date -Iseconds > "$MARKER_FILE"

    echo ""
    echo -e "${GREEN}${BOLD}  ✓ Koda $version installed successfully!${RESET}"
    echo ""
    echo -e "  ${BOLD}Location:${RESET}  $INSTALL_DIR/$APPIMAGE_NAME"
    echo -e "  ${BOLD}Desktop:${RESET}   $DESKTOP_DIR/koda.desktop"
    echo ""
    echo -e "  ${BOLD}Run Koda:${RESET}"
    echo -e "    ${CYAN}$INSTALL_DIR/$APPIMAGE_NAME${RESET}"
    echo -e "    or search for ${BOLD}Koda AI${RESET} in your applications menu"
    echo ""
    echo -e "  ${BOLD}Uninstall:${RESET}"
    echo -e "    ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/install/install-linux.sh) --uninstall${RESET}"
    echo ""
}

# ── Uninstall ────────────────────────────────────────────────────────────────
uninstall_koda() {
    echo ""
    echo -e "${BOLD}  ╔═══════════════════════════════════════╗${RESET}"
    echo -e "${BOLD}  ║     ${RED}Koda Linux Uninstaller${RESET}${BOLD}          ║${RESET}"
    echo -e "${BOLD}  ╚═══════════════════════════════════════╝${RESET}"
    echo ""

    local files_to_remove=(
        "$INSTALL_DIR/$APPIMAGE_NAME"
        "$HOME/.local/share/icons/hicolor/256x256/apps/koda.png"
        "$DESKTOP_DIR/koda.desktop"
        "$MARKER_DIR/.installed"
    )

    local removed=0
    for f in "${files_to_remove[@]}"; do
        if [[ -f "$f" ]]; then
            rm -f "$f"
            info "Removed: $f"
            ((removed++))
        fi
    done

    # Remove marker dir if empty
    rmdir "$MARKER_DIR" 2>/dev/null || true

    # Remove empty icon dir
    rmdir "$HOME/.local/share/icons/hicolor/256x256/apps" 2>/dev/null || true

    # Refresh desktop database
    update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
    xdg-icon-resource forceupdate 2>/dev/null || true

    if (( removed > 0 )); then
        echo ""
        ok "Koda has been uninstalled. ($removed files removed)"
    else
        warn "Koda does not appear to be installed."
    fi
    echo ""
}

# ── Status ───────────────────────────────────────────────────────────────────
status_koda() {
    echo ""
    if [[ -f "$INSTALL_DIR/$APPIMAGE_NAME" ]]; then
        ok "Koda is installed at: $INSTALL_DIR/$APPIMAGE_NAME"
        local version
        version=$(get_latest_version 2>/dev/null || echo "unknown")
        info "Latest release: $version"
    else
        warn "Koda is not installed."
    fi
    echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────
main() {
    case "${1:-}" in
        --uninstall|-u)
            uninstall_koda
            ;;
        --status|-s)
            status_koda
            ;;
        --help|-h)
            echo ""
            echo "Koda Linux Installer"
            echo ""
            echo "Usage:"
            echo "  bash install-linux.sh           Install Koda"
            echo "  bash install-linux.sh --uninstall   Uninstall Koda"
            echo "  bash install-linux.sh --status      Check installation status"
            echo "  bash install-linux.sh --help        Show this help"
            echo ""
            echo "Or install directly:"
            echo "  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/install/install-linux.sh | bash"
            echo ""
            ;;
        *)
            install_koda
            ;;
    esac
}

main "$@"
