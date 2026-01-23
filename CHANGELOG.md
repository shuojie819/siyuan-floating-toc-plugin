# Changelog

All notable changes to this project will be documented in this file.

## [0.1.7] - 2026-01-23

### Optimized
- Optimized "Scroll to Bottom" logic: Prioritizes direct JS scrolling when the document is fully loaded (checked via `data-eof`) for faster response, falling back to native event simulation (`Ctrl+End`) only for lazy-loaded documents.

### Added
- Added a configuration option "Follow Focus Mode" (default: true).
  - When enabled, the TOC shows only headings within the focused block.
  - When disabled, the TOC shows the full document outline, but highlights the focused area with a visual box.

### Fixed
- Fixed an issue where the TOC would not update when entering or exiting "Focus Mode" (Zoom In) by implementing a robust DOM-based detection mechanism for the breadcrumb bar.
- Fixed an issue where "Scroll to Bottom" and "Scroll to Top" failed in large documents due to lazy loading.


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
