# Changelog - Koda Electron v26.x

## [Unreleased] - 2026-05-06

### ✨ Added

#### IDE Mode Enhancements
- **Browser Tab Integration** 🌐
  - Browser now opens as a tab in the editor panel
  - Globe icon in tab bar for easy identification
  - Seamless switching between file tabs and browser tab
  - Full browser preview with navigation controls

- **Terminal Split View** ⌨️
  - Terminal opens below editor (VS Code style)
  - Resizable split with smooth drag handle
  - Height adjustable from 10% to 70%
  - Works with both file tabs and browser tab
  - Visual feedback during resize

- **Unified Tab System**
  - Support for multiple tab types: file, browser, terminal
  - VS Code Icons integration for file types
  - Active tab highlighting with indigo border
  - Unsaved changes indicator (white dot)
  - Close button on hover
  - Keyboard shortcuts (Ctrl+W, Ctrl+S)

### 🎨 Improved

#### UI/UX Enhancements
- **Thinner Tab Bar**
  - Reduced tab height by 21% (38px → 30px)
  - Smaller icons (16px → 14px)
  - Smaller text (11px → 10px)
  - More compact close button (12px → 10px)
  - Better space utilization

- **Consistent Background Colors**
  - Updated Terminal Panel background to `#1a1a1a`
  - Updated Context Panel background to `#1a1a1a`
  - Updated Chat History background to `#1a1a1a`
  - Updated Settings UI background to `#1a1a1a`
  - Unified dark theme across all panels

### 🐛 Fixed

#### Terminal Visibility Issue
- **Problem**: Terminal only appeared with file tabs, not browser tab
- **Solution**: Moved terminal rendering outside tab type conditionals
- **Result**: Terminal now works with all tab types

### 🔧 Technical Changes

#### Component Architecture
- Refactored `IDELayout.tsx` with new tab system
- Added Tab interface and TabType enum
- Implemented browser tab auto-creation logic
- Added terminal split view with resize handle
- Updated `ModernUI.tsx` to pass browser/terminal props

#### State Management
- Added `tabs` array for tab management
- Added `activeTabId` for active tab tracking
- Added `terminalHeight` for split view height
- Added `isLoadingFile` for loading states

### 📁 Files Changed

```
src/renderer/components/
├── IDELayout.tsx              (342 insertions, 131 deletions)
├── modern/
│   ├── ModernUI.tsx          (minor updates)
│   └── ChatHistory.tsx       (background color)
├── context/
│   └── ContextPanel.tsx      (background color)
├── settings/
│   └── SettingsUI.tsx        (background color)
└── TerminalPanel.tsx         (background color)
```

### 📊 Statistics

- **Total Files Changed**: 6
- **Lines Added**: 342
- **Lines Removed**: 131
- **Net Change**: +211 lines

### 🎯 Usage

#### Enable IDE Mode
```
Settings → Enable "Explorer Panel" + "Editor Panel"
```

#### Open Browser Tab
```
Click 🌐 button → Browser tab appears in editor
```

#### Open Terminal Split
```
Click ⌨️ button → Terminal opens below editor
```

#### Resize Terminal
```
Drag the resize handle between editor and terminal
```

### 🔗 Commit Information

- **Commit**: `4076199`
- **Branch**: `main`
- **Message**: "feat: Integrate Browser and Terminal into IDE Mode"
- **Date**: May 6, 2026

### 📚 Documentation

- `TASK_11_COMPLETE.md` - Implementation details
- `IDE_MODE_ARCHITECTURE.md` - Technical architecture
- `UPDATE_SUMMARY.md` - Update summary
- `CHANGELOG_v26.md` - This file

---

## Previous Versions

### [v26.1.5] - Previous Release

#### Features
- Questions Tool for LLM
- Explorer Panel and File Tree
- 32-bit Windows Support
- Chat History Panel
- Modern UI as Default
- Updated Koda Icon
- File Explorer with Inline Editor
- Full IDE Mode with Monaco Editor
- VS Code Icons Integration
- Background Color Improvements

---

## Roadmap

### Planned Features

#### Short Term
- [ ] Persist terminal height to localStorage
- [ ] Multiple terminal instances
- [ ] Terminal as optional tab
- [ ] Tab context menu (right-click)

#### Medium Term
- [ ] Drag and drop tab reordering
- [ ] Split editor (side-by-side)
- [ ] Tab groups
- [ ] Tab preview on hover

#### Long Term
- [ ] Custom tab colors
- [ ] Tab pinning
- [ ] Tab history navigation
- [ ] Workspace-specific tab layouts

---

## Breaking Changes

None in this release.

---

## Migration Guide

No migration needed. All changes are backward compatible.

---

## Known Issues

None reported.

---

## Contributors

- Implementation: AI Assistant (Kiro)
- Testing: User Community
- Project Lead: Koda Team

---

## License

MIT License - See LICENSE file for details

---

**Last Updated**: May 6, 2026  
**Version**: v26.x (Unreleased)  
**Status**: ✅ Ready for Release
