#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Koda — macOS Installer (DMG)
# Downloads the latest release from GitHub and installs it to /Applications
# Usage:  curl -fsSL https://raw.githubusercontent.com/antojunimaia-ui/Koda/main/scripts/install/install-macos.sh | bash
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
REPO="antojunimaia-ui/Koda"
APP_NAME="Koda"
INSTALL_DIR="/Applications"
APP_BUNDLE="${APP_NAME}.app"
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
    for cmd in curl hdiutil; do
        command -v "$cmd" &>/dev/null || missing+=("$cmd")
    done
    if (( ${#missing[@]} > 0 )); then
        err "Missing required commands: ${missing[*]}"
        exit 1
    fi
}

# ── Detect architecture ──────────────────────────────────────────────────────
get_arch() {
    local arch
    arch="$(uname -m)"
    case "$arch" in
        arm64|aarch64) echo "arm64" ;;
        x86_64|amd64)  echo "x64" ;;
        *)             echo "$arch" ;;
    esac
}

# ── Detect latest release DMG URL ────────────────────────────────────────────
get_download_url() {
    local arch
    arch=$(get_arch)

    local api_response
    api_response=$(curl -fsSL \
        -H "Accept: application/vnd.github+json" \
        "$API_URL" 2>/dev/null) || {
        err "Failed to fetch release info from GitHub."
        err "Check your internet connection or try again later."
        exit 1
    }

    # Extract the DMG asset URL — prefer architecture-specific, fallback to generic
    local url=""
    if [[ "$arch" == "arm64" ]]; then
        # Try arm64-specific DMG first
        url=$(echo "$api_response" | grep -oP '"browser_download_url":\s*"\K[^"]*\.dmg' | grep -i 'arm\|aarch' | head -1)
    fi

    # Fallback to any DMG
    if [[ -z "$url" ]]; then
        url=$(echo "$api_response" | grep -oP '"browser_download_url":\s*"\K[^"]*\.dmg' | head -1)
    fi

    if [[ -z "$url" ]]; then
        err "No DMG found in the latest release."
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

    local arch
    arch=$(get_arch)

    echo ""
    echo -e "${BOLD}  ╔═══════════════════════════════════════╗${RESET}"
    echo -e "${BOLD}  ║      ${CYAN}Koda macOS Installer${RESET}${BOLD}            ║${RESET}"
    echo -e "${BOLD}  ╚═══════════════════════════════════════╝${RESET}"
    echo ""
    info "Architecture: ${BOLD}$arch${RESET}"
    echo ""

    # Check if already installed
    if [[ -d "$INSTALL_DIR/$APP_BUNDLE" ]]; then
        warn "Koda is already installed at $INSTALL_DIR/$APP_BUNDLE"
        read -rp "Reinstall/update? [y/N] " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            info "Installation cancelled."
            exit 0
        fi
        info "Removing old version..."
        rm -rf "$INSTALL_DIR/$APP_BUNDLE"
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

    # Download DMG
    local tmp_dmg
    tmp_dmg=$(mktemp /tmp/koda-XXXXXX.dmg)
    info "Downloading Koda $version for macOS ($arch)..."
    info "(this may take a moment depending on your connection)"

    if ! curl -# -L -o "$tmp_dmg" "$download_url"; then
        err "Download failed."
        rm -f "$tmp_dmg"
        exit 1
    fi

    echo ""

    # Verify it's a valid DMG (check magic bytes: EPUB = 0x45505542)
    local magic
    magic=$(head -c 4 "$tmp_dmg" | xxd -p 2>/dev/null || echo "")
    if [[ "$magic" != "45505542" ]]; then
        warn "Downloaded file may not be a valid DMG (magic: $magic)."
        warn "Continuing anyway — the file might still work."
    fi

    # Mount DMG
    info "Mounting DMG..."
    local mount_output
    mount_output=$(hdiutil attach "$tmp_dmg" -nobrowse -quiet 2>&1) || {
        err "Failed to mount DMG."
        err "$mount_output"
        rm -f "$tmp_dmg"
        exit 1
    }

    # Find the mount point
    local mount_point
    mount_point=$(echo "$mount_output" | grep -o '/Volumes/[^[:space:]]*' | head -1)

    if [[ -z "$mount_point" || ! -d "$mount_point" ]]; then
        # Fallback: look for any Koda volume
        mount_point=$(ls -d /Volumes/Koda* 2>/dev/null | head -1)
    fi

    if [[ -z "$mount_point" || ! -d "$mount_point" ]]; then
        err "Could not locate mounted DMG volume."
        hdiutil detach "$tmp_dmg" -quiet 2>/dev/null || true
        rm -f "$tmp_dmg"
        exit 1
    fi

    info "Mounted at: $mount_point"

    # Find the .app bundle inside the DMG
    local app_source
    app_source=$(find "$mount_point" -maxdepth 2 -name "${APP_BUNDLE}" -type d | head -1)

    if [[ -z "$app_source" || ! -d "$app_source" ]]; then
        err "Could not find ${APP_BUNDLE} inside the DMG."
        hdiutil detach "$mount_point" -quiet 2>/dev/null || true
        rm -f "$tmp_dmg"
        exit 1
    fi

    # Copy app to /Applications
    info "Installing to $INSTALL_DIR..."
    cp -R "$app_source" "$INSTALL_DIR/"

    # Remove quarantine attribute (Gatekeeper)
    info "Removing quarantine attribute..."
    xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_BUNDLE" 2>/dev/null || true

    # Unmount DMG
    info "Unmounting DMG..."
    hdiutil detach "$mount_point" -quiet 2>/dev/null || true
    rm -f "$tmp_dmg"

    # Create symlink in /usr/local/bin (optional, for terminal usage)
    local bin_dir="/usr/local/bin"
    local symlink="$bin_dir/koda"
    if [[ -d "$bin_dir" ]] && [[ ! -e "$symlink" ]]; then
        local app_exec
        app_exec=$(find "$INSTALL_DIR/$APP_BUNDLE/Contents/MacOS" -maxdepth 1 -type f -perm +111 | head -1)
        if [[ -n "$app_exec" ]]; then
            info "Creating symlink at $symlink..."
            ln -sf "$app_exec" "$symlink" 2>/dev/null || \
                warn "Could not create symlink (try: sudo ln -sf '$app_exec' '$symlink')"
        fi
    fi

    echo ""
    echo -e "${GREEN}${BOLD}  ✓ Koda $version installed successfully!${RESET}"
    echo ""
    echo -e "  ${BOLD}Location:${RESET}  $INSTALL_DIR/$APP_BUNDLE"
    echo ""
    echo -e "  ${BOLD}Run Koda:${RESET}"
    echo -e "    ${CYAN}open -a Koda${RESET}"
    echo -e "    or find ${BOLD}Koda${RESET} in your Applications folder"
    echo ""
    echo -e "  ${BOLD}Note:${RESET} If macOS shows ${RED}\"app is corrupted\"${RESET}:"
    echo -e "    ${CYAN}xattr -cr /Applications/Koda.app${RESET}"
    echo ""
    echo -e "  ${BOLD}Uninstall:${RESET}"
    echo -e "    ${CYAN}bash <(curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/install/install-macos.sh) --uninstall${RESET}"
    echo ""
}

# ── Uninstall ────────────────────────────────────────────────────────────────
uninstall_koda() {
    echo ""
    echo -e "${BOLD}  ╔═══════════════════════════════════════╗${RESET}"
    echo -e "${BOLD}  ║    ${RED}Koda macOS Uninstaller${RESET}${BOLD}            ║${RESET}"
    echo -e "${BOLD}  ╚═══════════════════════════════════════╝${RESET}"
    echo ""

    local removed=0

    # Remove app bundle
    if [[ -d "$INSTALL_DIR/$APP_BUNDLE" ]]; then
        rm -rf "$INSTALL_DIR/$APP_BUNDLE"
        info "Removed: $INSTALL_DIR/$APP_BUNDLE"
        ((removed++))
    fi

    # Remove symlink
    local symlink="/usr/local/bin/koda"
    if [[ -L "$symlink" ]]; then
        rm -f "$symlink"
        info "Removed: $symlink"
        ((removed++))
    fi

    # Remove user data (optional)
    local koda_dir="$HOME/.koda"
    if [[ -d "$koda_dir" ]]; then
        read -rp "Remove Koda data directory ($koda_dir)? This includes settings and skills. [y/N] " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            rm -rf "$koda_dir"
            info "Removed: $koda_dir"
            ((removed++))
        fi
    fi

    if (( removed > 0 )); then
        echo ""
        ok "Koda has been uninstalled. ($removed item(s) removed)"
    else
        warn "Koda does not appear to be installed."
    fi
    echo ""
}

# ── Status ───────────────────────────────────────────────────────────────────
status_koda() {
    echo ""
    if [[ -d "$INSTALL_DIR/$APP_BUNDLE" ]]; then
        ok "Koda is installed at: $INSTALL_DIR/$APP_BUNDLE"
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
            echo "Koda macOS Installer"
            echo ""
            echo "Usage:"
            echo "  bash install-macos.sh              Install Koda"
            echo "  bash install-macos.sh --uninstall   Uninstall Koda"
            echo "  bash install-macos.sh --status      Check installation status"
            echo "  bash install-macos.sh --help        Show this help"
            echo ""
            echo "Or install directly:"
            echo "  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/scripts/install/install-macos.sh | bash"
            echo ""
            ;;
        *)
            install_koda
            ;;
    esac
}

main "$@"
