# Changelog

All notable changes to this project will be documented in this file.

## [0.1.20] - 2026-02-25

### Fixed
- **Backlink Area Exclusion**: Fixed an issue where the TOC button would incorrectly appear in backlink areas (Issue #11).
  - Added filtering to exclude official backlink panels (`.sy__backlink`, `.backlinkList`, `.backlinkMList`).
  - Added filtering to exclude third-party plugin backlink areas (elements with `data-defid` or `data-ismention` attributes).
  - Added filtering to exclude custom backlink panels (`.backlink-panel`).
  - Improved MutationObserver to skip processing changes in backlink areas for better performance.
- **Mobile Settings UI**: Fixed an issue where the settings panel displayed incorrectly on Android mobile devices (Issue #10).
  - Settings tabs now display horizontally on mobile screens for better accessibility.
  - Setting items now stack vertically on mobile to prevent text truncation.
  - Added responsive layout with media queries for screens under 768px width.
  - Fixed tab text not displaying by overriding SiYuan's default `.b3-list-item__text` styles.
  - Improved tab bar flex layout to ensure equal width distribution and proper text centering.
- **API Error Handling**: Fixed console error "invalid ID argument" when calling API with invalid block IDs.
  - Added `isValidBlockId()` function to validate block ID format before making API calls.
  - Block IDs must match SiYuan's standard format (14-digit date + 7-char alphanumeric, e.g., `20231201-abcdefg`).
  - Invalid IDs are now silently skipped instead of triggering API errors.

## [0.1.19] - 2026-01-29

### Fixed
- **Heading Navigation Fix**: Fixed an issue where clicking on headings in the TOC would fail to navigate correctly.
  - Fixed `checkBlockFold` API response parsing to correctly extract the `isFolded` field from the response object.
  - Added filtering to exclude breadcrumb elements (`.protyle-breadcrumb`) from DOM search, preventing incorrect element selection.
  - Added filtering to exclude TOC's own elements (`.floating-toc`, `.siyuan-floating-toc-plugin-container`) from DOM search, preventing self-referential navigation failures.

## [0.1.18] - 2026-01-28

### Changed
- **Publishing Configuration**: Changed `disabledInPublish` to `false` to allow plugin usage in published documents.
- **Package Configuration**: Added `main` entry point and `repository` field to package.json.

## [0.1.17] - 2026-01-27

### Added
- **Right-Click to Exit Fullscreen**: Added a new feature allowing users to exit fullscreen mode by right-clicking anywhere on the screen. This can be toggled in settings under "Fullscreen Helper" (enabled by default).

### Refactored
- **Modular Architecture**: Completely refactored the codebase into a modular architecture for better maintainability:
  - `modules/eventHandlers.ts` - Event handling logic
  - `modules/protyleManager.ts` - Protyle instance management
  - `modules/docIdResolver.ts` - Document ID resolution
  - `utils/domUtils.ts` - DOM utility functions
- **Main Entry Point**: Reduced `index.ts` from ~1150 lines to ~160 lines by extracting logic into dedicated modules.
- **Pre-bound Event Handlers**: Adopted pre-bound event handler pattern to prevent memory leaks from repeated `.bind()` calls.
- **Centralized Constants**: Added timing constants and MutationObserver configuration to `types.ts` for better consistency.

## [0.1.16] - 2026-01-26

### Fixed
- **Adaptive Width Compatibility**: Completely refactored the layout detection logic to correctly handle SiYuan's "Full Width" vs "Adaptive Width" modes.
  - **Full Width Mode**: When enabled (either globally or via document menu), the TOC now correctly adds padding to push the document content, preventing overlap.
  - **Adaptive Width Mode**: When enabled (Narrow Mode), the TOC floats in the margin without adding unnecessary padding.
  - **Real-time Detection**: Added a `MutationObserver` to instantly detect and react to layout mode changes toggled via the document menu.

### Changed
- **Default Settings**: "Adaptive Height" is now enabled by default for a better out-of-the-box experience.

## [0.1.15] - 2026-01-26
### Added
- **Fullscreen Helper**: Integrated the "Fullscreen Helper" plugin functionality directly into Floating TOC.
  - Added a new "Fullscreen Helper" tab in settings.
  - Supports immersive fullscreen viewing for Mermaid, ECharts, Flowchart, Graphviz, Sheet Music (abcjs), and IFrames.
  - Added pan and zoom capabilities for static charts (Mermaid, Graphviz, etc.) in fullscreen mode.
  - Supports double-click to enter fullscreen (configurable).
  - Added support for adaptive background colors in fullscreen mode.
  - Added a **Master Switch** for Fullscreen Helper in settings, allowing users to enable/disable the entire module with one click.

### Fixed
- **IFrame Scrolling**: Fixed an issue where some embedded IFrame pages (e.g., Bilibili) were forced to disable scrolling. The plugin now automatically restores scrolling capability in both normal and fullscreen modes.
- **Full Width Compatibility**: Fixed an issue where the TOC would squeeze the document content when SiYuan's "Full Width" mode (Adaptive Disabled) was active. Now, in Full Width mode, the TOC will float over the content without adding extra padding, preserving the user's layout preference.

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
