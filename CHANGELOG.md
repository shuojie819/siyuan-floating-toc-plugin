# Changelog

All notable changes to this project will be documented in this file.

## [0.1.14] - 2026-01-25

### Fixed
- **Left Dock Layout Stability**: Fixed an issue where hovering over the mini TOC on the left side would cause the document content to shift abruptly. The document content is now only pushed when the TOC is explicitly pinned.

## [0.1.13] - 2026-01-25

### Added
- **Adaptive Height**: Added a new configuration option "Adaptive Height" (default: false). When enabled, the TOC container height automatically adjusts to fit its content instead of filling the entire available vertical space. This is especially useful for short outlines.

## [0.1.12] - 2026-01-25

### Fixed
- **Settings Persistence**: Fixed a critical issue where toggling the "Pin" state or switching dock sides would accidentally reset other configuration items (such as Custom CSS) to their defaults.
- **Custom CSS Example**: Corrected the example code in the Custom CSS settings description to correctly target the visible panel (`.siyuan-floating-toc-plugin-container .toc-panel`) and use `!important` to ensure styles are applied effectively.

## [0.1.11] - 2026-01-24

### Added
- **Custom CSS Support**: Added a new "Style" tab in the settings panel, allowing users to inject custom CSS to override default plugin styles.

### Optimized
- **Settings UI**: Improved the layout and visual consistency of the settings panel.

## [0.1.10] - 2026-01-24

### Refactored
- **Settings Panel Overhaul**: Completely rebuilt the settings interface using Svelte. It now features a modern, spacious dual-column layout (Sidebar + Content) inside a custom Dialog window (800x700), providing a native and seamless user experience.
- **Settings Architecture**: Moved away from the default restricted settings injection to a full custom Dialog implementation, effectively eliminating previous layout artifacts (such as stray vertical lines and "undefined" labels).

### Added
- **Toolbar Customization**: Users can now individually enable or disable specific buttons in the floating toolbar (Scroll Top/Bottom, Refresh, Pin/Unpin, Switch Side, Collapse/Expand All) via the new "Toolbar Functions" tab in settings.
- **Internationalization (i18n)**: Added complete Chinese and English translations for all Toolbar Action options in the settings panel.

### Optimized
- **UI Polish**: Refined the Settings Panel UI with clear vertical dividers, improved spacing, and correct alignment of controls.

## [0.1.9] - 2025-01-24

### Added
- Added support for Database (Attribute View) Grouping. When focusing on a database with groups, the TOC will now display the groups as navigation items.
- Enhanced "Follow Focus" behavior: When viewing a Database with groups, the TOC will automatically switch to DOM parsing mode to correctly display the groups, regardless of the "Follow Focus Mode" setting.

## [0.1.8] - 2025-01-24

### Added
- Added "Mini TOC Width" setting option, allowing customization of the TOC width in collapsed state (20px-50px).

### Optimized
- Optimized the visual display of the Mini TOC: strip length now varies dynamically based on heading level (stepped effect), and alignment automatically follows the dock side (left-aligned when docked left, right-aligned when docked right).
- Reduced the indentation level of headings in the TOC (from 12px/level to 8px/level) to make the layout more compact and avoid excessive indentation for deep levels (e.g., H6).

### Fixed
- Fixed an issue where a blank space appeared on the right side of the TOC on mobile devices (width <= 768px) due to inconsistency between calculation and rendering width.
- Fixed a visual glitch where expanding the mini TOC on the left side caused the document content to shift abruptly by ensuring consistent padding is maintained.

## [0.1.7] - 2025-01-24

### Optimized
- Optimized "Scroll to Bottom" logic: Prioritizes direct JS scrolling when the document is fully loaded (checked via `data-eof`) for faster response, falling back to native event simulation (`Ctrl+End`) only for lazy-loaded documents.

### Added
- Added a configuration option "Follow Focus Mode" (default: true).
  - When enabled, the TOC shows only headings within the focused block.
  - When disabled, the TOC shows the full document outline, but highlights the focused area with a visual box.

### Fixed
- Fixed an issue where the TOC would not update when entering or exiting "Focus Mode" (Zoom In) by implementing a robust DOM-based detection mechanism for the breadcrumb bar.
- Fixed an issue where "Scroll to Bottom" and "Scroll to Top" failed in large documents due to lazy loading.
- Fixed an issue where the TOC covered the block marker area (gutter) when docked to the left, preventing interaction with block menus. Added an intelligent safety margin (approx. 42px) to ensure block markers remain accessible in both collapsed and pinned modes.


## [0.1.6] - 2026-01-23

### Added
- Added `uninstall` method to automatically clean up configuration files (`config.json`) when the plugin is uninstalled.

## [0.1.5] - 2026-01-23

### Added
- Added support for "Focus Mode" (Zoom In). The TOC now correctly displays only the headings within the focused block.
- Implemented smart navigation fallback: clicking a heading outside the current view (in Focus Mode) automatically exits Focus Mode and jumps to the target block using the `siyuan://` protocol.

### Optimized
- Optimized plugin startup performance by removing redundant configuration file reads.
- Refactored document refresh logic to use native SiYuan API (`Protyle.reload`) for better stability, with a fallback to the previous method.

## [0.1.4] - 2026-01-23

### Added
- Added a configuration option to set the default dock position (Left or Right).

### Changed
- Changing the dock position within a document is now temporary and does not overwrite the global default configuration.

## [0.1.3] - 2026-01-23

### Changed
- Floating TOC is now always visible, even for documents with no headings.
- Excluded LICENSE and CHANGELOG.md from the distribution package.

### Fixed
- Fixed an issue where the TOC would not update when creating, moving, or deleting headings (implemented real-time WebSocket synchronization).

## [0.1.2] - 2026-01-23

### Added
- Added "Refresh Document" button to the bottom toolbar (triggers F5).

## [0.1.1] - 2026-01-23

### Changed
- Improved interaction: Floating TOC no longer expands accidentally when hovering over toolbar buttons in collapsed mode.
- Improved interaction: Only hovering over the main strip triggers expansion in collapsed mode.
- Removed verbose debug logs to keep the console clean.

## [0.1.0] - 2026-01-23

### Added
- Initial release of Floating TOC plugin.
- Support for floating table of contents on the right/left side.
- Support for expanded and collapsed (mini) modes.
- Support for global search and history preview.
- Smooth scrolling and auto-highlighting of current section.
- Support for pinning the TOC to avoid overlapping with content.
