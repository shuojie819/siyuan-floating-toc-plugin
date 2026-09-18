# Changelog

All notable changes to this project will be documented in this file.

## [0.1.34] - 2026-09-19

### Fixed
- **悬浮大纲不再出现在第三方插件面板里（#50）**：*鲸鱼快速批注*（`HaoCeans/siyuan-comment`）的批注弹层会渲染一个真实的 Protyle 编辑器（实测其产物中存在 `<div class="protyle siyuan-comment-popover__protyle">`，并以 `new Protyle(...)` 实例化），因此被本插件的宿主识别命中，导致批注弹层里被挂上了悬浮大纲。
  - 新增**通用「浮层」闸门** `isFloatingPopoverPanel`，双保险接入 `getTocHostElement()`（返回 `null`）与 `shouldShowToc()`（返回 `false`），匹配：
    - `.block__popover` —— 思源原生的块引用 / Hover 悬浮预览浮层（**实测类名**；思源中并不存在 `.b3-popover`）
    - `[class*="popover"]` —— 面向"以 popover 命名的容器"的通用兜底
    - `[class*="siyuan-comment-"]` —— 鲸鱼快速批注插件的所有浮层前缀
  - 顺带收敛：思源原生块引用悬浮预览（`.block__popover`，其内同样含 `.protyle`）此前也缺少闸门，现一并排除。
- 此前的排除闸门都是「**已知内置容器白名单**」（闪卡 / 数据库 / 智能体 / 图谱等），对第三方插件的界面从未覆盖；这是第一道**通用型**闸门。

### Tests
- 新增 `src/__tests__/popoverPanel.spec.ts`（15 例）：使用对方产物的**真实类名串**、分类覆盖、**6 条反向防误伤用例**（覆盖我们确实支持的界面：主编辑器 / 搜索预览 / 搜索文档 / 文件历史 / 历史预览 / 集市 README），以及一个 mock 端到端用例（驱动 `checkProtyles`）。
- 变异校验：移任一处接线 → 5~6 条变红；移除通用 `[class*="popover"]` 分支 → 恰好 1 条变红（即钉住该分支的那条）。

### Notes
- **测试：215 passed / 22 files**（上一版 200）。上一版的 21 个 spec 文件**逐字节未改动**。
- 构建干净、无 Sass 弃用警告；`tsc` 仍为同样 15 条既有错误，且均不在本次改动文件中。
- `package.zip` 内含 `plugin.json` 版本 = **0.1.34**。

## [0.1.33] - 2026-09-16

### Fixed
- **集市里的悬浮大纲无法上下滚动、看不到下方标题** —— 这是 v0.1.31 引入、v0.1.32 未覆盖的第三个问题。
  - 根因：`computeBazaarInlineStyle` 在 **自适应高度（默认开启）** 下只产出 `height: auto`，**没有高度上界**。集市内联态的容器是 `position: absolute; top/bottom` 撑开的（高度确定），而大纲本体也是绝对定位；只给 `height: auto` → 大纲高度 = 内容高度（无界）→ 内部 `.toc-panel` / `.toc-content` **永不产生溢出** → 列表不会滚、超出面板的部分被裁掉。
  - 修法：沿用文档场景早已验证的写法（`max-height: ${maxHeight}px; height: auto;`），给自适应分支补上界 `max-height: 100%` —— 内容少时仍贴合内容（保留自适应语义），内容多时被容器高度截住，**列表内部即可滚动**。
  - **影响面**：`adaptiveHeight` 默认值就是 `true`，所以**所有集市用户**都会遇到，不是个别配置问题。

### Notes
- **测试：200 passed / 21 files**（v0.1.32 发版时 195 → +5）。v0.1.32 的 21 个 spec 中 **20 个逐字节未动**，唯一改动的是 `bazaarInlineStyle.spec.ts`（契约变更导致的合理更新，经 QA 逐行核验未放松任何断言）。
- 变异校验（工程师 + QA 各一轮，共 3 项）：删掉上界 → 6 条变红；上界值写错（如 `1000px`）→ 5 条变红；自适应语义退化 → 5 条变红。恢复均以 md5 锚定代码本身核对。
- 构建干净、无 Sass 弃用警告；`tsc` 的 15 条错误全部为既有错误、与本次文件无关。
- ⚠️ **残留风险（需真机确认第 1 项）**：`max-height: 100%` 依赖集市面板 `.config__view` 布局后具有确定高度。若真机上容器 `clientHeight` 为 0，大纲会被压成不可见 —— 届时改用 JS 计算的 px 上界即可（已备方案）。

## [0.1.32] - 2026-09-16

### Fixed
- **修复 v0.1.31 引入的一个回归（集市页面被搞坏）**：滚动集市 README 时，会把外层的面板/弹窗一起拖动 —— 内容下方露出大片空白，而绝对定位的悬浮大纲（连它的按钮）被一起带出可视区。
  - 根因：`scrollIntoView` 会滚动**目标的所有可滚动祖先**。v0.1.31 把大纲容器搬进了集市详情面板内部，祖先链里因此多出了面板/弹窗的滚动容器；于是「把激活标题滚进可视区」这个同步动作把外层也一起滚了。
  - 修法：组件内**不再使用 `scrollIntoView`**。大纲只滚动**自己的列表容器**（`.toc-content` / `.collapsed-strip`）；点击标题只滚动**已解析出的内容滚动容器**。任何路径都不再触碰祖先容器。
- **集市里有用的工具栏按钮重新可见**：这些按钮从「当年在集市点了没反应」的时代起就被 CSS `display:none` 隐藏了；但 v0.1.31 之后 ↑/↓ 与固定在集市已经真正生效，隐藏就成了纯负担。现在集市中可见：**置顶 / 置底 / 刷新 / 固定 / 折叠全部 / 展开全部**；仅「切换侧栏」保持隐藏（大纲锚定在面板内部后该操作无意义）。

### Added
- 加固：计算跳转偏移量时，会先校验目标确实位于该滚动容器内；不在其中则**不滚动**（而不是滚到一个错误位置）。

### Notes
- **测试：195 passed / 21 files**（v0.1.31 发版时是 156 → +39）。上一版的 19 个 spec 文件**逐字节未改动**，没有任何既有断言被削弱。
- **变异校验（工程师 + 独立 QA 各做一轮）**：去掉「不滚祖先」的 root 边界、恢复 `scrollIntoView`、去掉钳制、去掉包含性校验 —— 每一项都至少让一条用例变红；恢复均以 md5 锚定代码本身核对。
- 构建：`vite build` 干净、无 Sass 弃用警告；`dist/index.js` 中 `scrollIntoView` 计数为 **0**。
- ⚠️ **仍需真机确认**：点击标题后的落点是否精确顶边对齐（有两个依赖思源宿主 CSS 的点：滚动容器是否有 `border-top-width`、思源是否给 `.protyle-content` 设了 `scroll-padding-top`），以及集市本身的表现。

## [0.1.31] - 2026-09-15

### Added
- **Independent pin state for the bazaar outline**: pinning the outline in a document no longer force-expands it in the SiYuan bazaar (and vice versa). The bazaar's pin state is **session-scoped** — it is intentionally *not* written to the global config, consistent with the existing session-only behaviour of "switch side".
- **Scroll-to-top / scroll-to-bottom now work in the bazaar**: the toolbar's ↑/↓ buttons (and ⟳, which in the bazaar now means "refresh the outline") previously targeted document-only elements (`.protyle-scroll__up/down`, `.protyle-wysiwyg`, `.protyle-content`), so they did nothing on a bazaar README page. They now resolve the README's actual scroll container at runtime and respect the *smooth scroll* setting.

### Changed
- **The bazaar outline is anchored inside the package-detail panel instead of floating next to the dialog**: the TOC container is now appended into `#configBazaarReadme` (a sliding `.config__view` panel) and positioned with `position: absolute`, so it moves with the panel, stays vertically aligned with the README, and no longer drifts out to the window edge when the dialog is narrow. `updateBazaarPosition()`'s manual `.b3-dialog__container` math is skipped in this mode; the previous `body + position: fixed + z-index: 999` path is kept as an **automatic fallback** for older SiYuan structures. Width still follows `tocWidth` / `miniTocWidth` and dragging.
- Document / search-preview / file-history scenes are untouched — every new branch is gated behind the bazaar checks.

### Notes
- Tests: **156 passed / 19 files** (previous release: 128 → +28). The 16 pre-existing spec files are byte-identical to the previous release.
- **Two source-level defects were caught by independent verification and fixed before release**: (1) the bazaar TOC width had stopped following `tocWidth` / `miniTocWidth`; (2) the scroll-container resolver searched *upwards only*, while the README's scroll container `.item__main` is a **descendant** of the host — which made scroll-to-top/bottom a silent no-op and regressed the scroll-spy. Both now have regression tests.
- ⚠️ **Needs real-machine confirmation** (not verifiable in CI): the bazaar ↑/↓ actually scrolling the README; scroll-spy highlighting following the README; the anchored outline moving with the sliding panel; and the independent pin behaviour.

## [0.1.30] - 2026-09-14

### Fixed
- **Intermittent layering bleed after collapsing the right-hand document (Issue #44)**: after repeatedly opening/collapsing the right dock, the floating outline could remain in the DOM and paint **above SiYuan's own left menu**. Three contributing defects were fixed:
  1. **The plugin never subscribed to SiYuan's `destroy-protyle` event** (the event type was declared in `types.ts` but nobody listened). Collapsing the right dock destroys the editor instance, so the `position: fixed` outline lingered until the debounced DOM sweep caught up — matching the reported "happens after repeatedly opening/collapsing" pattern. The outline is now destroyed **immediately** on `destroy-protyle`.
  2. **The outline's stacking order was hard-coded to `z-index: 20`**, which is **above** the level SiYuan assigns to its own menus/docks (the global counter `window.siyuan.zIndex` starts around 16). The outline's level is now derived from that counter so it always sits **below SiYuan's own UI and above the document content**.
  3. Orphaned outline containers (document + bazaar) and leftover fullscreen-helper overlays had **no generic cleanup**. Both are now swept on every check, and stale fullscreen-helper entries are recycled.

### Changed
- **`tocZIndex` semantics refined (follow-up to Issue #36③)**: the default level (20) auto-follows SiYuan so it can never cover SiYuan's own UI; **explicitly raising it above 20 is still honored verbatim** (the user's own risk) — so the "被其它面板遮挡时调大" use case keeps working.

### Tests
- Added 4 spec files (26 cases) covering the z-index computation (including the "default auto-follows / explicit raise is honored" contract), orphan-container sweeping, fullscreen-helper cleanup, and the `destroy-protyle` wiring. Mutation-checked (5 mutations, each reddens at least one case).

## [0.1.29] - 2026-09-13

### Fixed
- **Bazaar indexing was failing: `icon.png` was not actually a PNG** ([siyuan-note/bazaar#2239](https://github.com/siyuan-note/bazaar/issues/2239)). The repo file `icon.png` was really a **JPEG** (`image/jpeg`) with a `.png` name. The community bazaar's validator now cross-checks a declared image's extension against its real byte content, so it rejected the package and **the index stopped updating from v0.1.26 onwards**. `icon.png` is now a genuine PNG (224×224, 52 KB — comfortably under the 64 KB icon limit).
  - Checked the sibling asset too: `preview.png` was already a valid PNG (1029×730, 130 KB, under the 512 KB limit) and is unchanged.

### Notes
- No code changes in this release — packaging/metadata fix only, so that the bazaar can resume indexing.
- Bazaar image rules (from `siyuan-note/bazaar/rules/images.go`): `icon` → falls back to `icon.png`, ≤ 64 KB; `preview` → falls back to `preview.png`, ≤ 512 KB; allowed extensions `.png` / `.jpg` / `.jpeg` / `.webp` / `.avif` (SVG is not supported); the image must sit at the root of `package.zip`; **no dimension requirements**.

## [0.1.28] - 2026-09-13

### Fixed
- **The floating outline no longer disappears inside the SiYuan bazaar** (follow-up to #36): SiYuan 3.8.3+ rewrote the bazaar UI and renamed the "detail view is open" class from `config-bazaar__readme--show` to **`config__view--show`**. The plugin's visibility check only knew the old name, so `isPanelVisible` was permanently `false` and the Svelte component mounted into an **empty container** and never rendered. Verified in DevTools on 3.8.4-alpha.6: the container existed (`position: fixed`, `z-index: 999`) but had no `.floating-toc` child, and the bazaar dialog's z-index was only `16` — so it was **not** a stacking issue. Both class names are now accepted.
- **Returning to a package detail page now restores the outline**: `checkBazaarVisibility()` previously only ever set `visible = false` and never back to `true`. Since `#configBazaarReadme` is a persistent element (only its class toggles), going *detail → list → detail* left the outline permanently hidden. The check now syncs `visible` symmetrically with the panel's state.

### Tests
- Added `src/__tests__/bazaarVisibility.spec.ts` (6 cases): both class names, the not-yet-expanded state (`config__view` without `--show`), a look-alike class, self-only semantics, and real `classList.add/remove` transitions. Mutation-checked — removing the new branch reddens 2 cases.

## [0.1.27] - 2026-09-12

### Added
- **Configurable appearance of the floating outline (Issue #36, part ③)** — three new settings under **Settings → 大纲功能**:
  - **`tocZIndex`** (default **20**, range 1–999) — stacking order. Raise it when other panels or plugins cover the outline; lower it when the outline covers other buttons.
  - **`tocTopOffset`** (default **80**, range 0–400) — minimum distance from the window top. Raise it to keep the outline clear of the document title / cover image and the top toolbar buttons.
  - **`tocEdgeMargin`** (default **14**, range 0–80) — whitespace between the outline and the document / window edge.

  All three defaults reproduce the previously hard-coded values exactly, so nothing changes unless you move a slider.

### Changed
- **Refactor for testability**: `calculateTocPosition()` was lifted out of the `FloatingToc` component closure into `utils/domUtils.ts` as a pure function — its closure dependencies (`isExpanded` / `dockSide` / `isPinned` / `miniTocWidth`) and the `EDGE_MARGIN` / `resizeHandleOffset` constants are now parameters. The logic is a line-by-line move (verified against the removed code), so positioning behaviour is identical; it is now covered by unit tests.

### Tests
- Added `src/__tests__/tocPosition.spec.ts` (7 cases): expanded × left/right, collapsed × left/right, pinned forcing padding, configurable `edgeMargin`, plus a default-value contract (`20 / 80 / 14`). Mutation-checked so each expectation can actually fail.

## [0.1.26] - 2026-09-12

### Fixed
- **Flashcard / card-review scenes (Issue #36)**: The floating TOC no longer appears in SiYuan's flashcard review view, its floating window / fullscreen mode, or the card preview dialog. The review view renders cards inside `.card__main` (via an embedded Protyle) and the preview dialog is `#cardPreview`; the plugin's global `.protyle` scan picked them up and treated them as document hosts. Added an `isFlashcardContext()` exclusion to `shouldShowToc()`. This also resolves the reported *"the outline does not follow when the card is dragged into a floating window"*, because the floating window is the same `.card__main` container.

### Added
- **Configurable gap between the pinned outline and the content (Issue #9)**: New `tocGap` setting (Settings → 大纲功能, slider 0–120 px, default **10**). It replaces the previously hard-coded editor padding. The default reproduces the old behaviour exactly (`width + 42` when pinned-and-squeezing on the left, otherwise `width + 10`), so nothing changes unless the user moves the slider.

### Changed
- **Single source of truth for defaults**: Removed the duplicated `DEFAULT_CONFIG` in `Setting.svelte`. The copy had already drifted (`adaptiveHeight` was `false` there vs `true` in `types.ts`, and the settings copy was effectively dead). `Setting.svelte` now imports `DEFAULT_CONFIG` from `types.ts`, so newly added options can no longer go out of sync.

### Tests
- Added `src/__tests__/domUtils.flashcard.spec.ts` (3 cases) and `src/__tests__/tocPadding.spec.ts` (6 cases). Mutation-checked: removing the flashcard guard reddens 2 cases, changing the `32` constant reddens 1, and changing the default `tocGap` reddens the compatibility case — so the "default == legacy behaviour" contract is now guarded.

## [0.1.25] - 2026-09-12

### Fixed
- **Bottom backlink panel (Issue #35)**: The floating TOC no longer shows up inside SiYuan's new bottom backlink panel. That panel's element only carries the `sy__backlink--bottom` class token (it does **not** include `sy__backlink`), so `isBacklinkArea()` missed it and mounted a TOC onto the referenced document's `.protyle`.
- **Database rich-text cell editor (Issue #37)**: The floating TOC no longer appears while editing a database (attribute view) text column. Since SiYuan v3.8.3 a database text field can hold block/inline elements, so an embedded mini editor is rendered inside the cell; it was picked up by the global `.protyle` scan and treated as a document host. Added `isDatabaseEditorContext()` (`.av__panel` / `.av__cell` / `.av__row` / `.av__body` / `.av__container` / `[data-type="NodeAttributeView"]`) and `isLiteEditorFragment()` (`.protyle-lite-fragment` / `[data-protyle-lite-render]`) exclusions to `shouldShowToc()`.

### Tests
- Added `src/__tests__/domUtils.dbAndBacklink.spec.ts` (9 cases) covering the bottom backlink panel, `.av__cell` / `.av__panel` / `.av[data-type="NodeAttributeView"]` / `protyle-lite` fragment, plus regression cases proving that normal documents which merely *contain* a database block or a lite fragment are **not** affected. Each guard was mutation-checked to be individually covered.

## [0.1.24] - 2026-07-26

### Fixed
- **Dynamic-loaded heading navigation (Issue #34, normal documents)**: Rewrote TOC entry click navigation to use SiYuan's official `siyuan://blocks/{id}` protocol chain (`window.top.openFileByURL` → `openFileById`) with `CB_GET_CONTEXT` action, enabling precise jumps to headings outside the virtual-scroll viewport that are not yet loaded. Removed the `window.open` browser-external-protocol popup.
- **Folded heading expand**: Folded headings now append `?focus=1` to trigger SiYuan's zoomIn expand before locating.
- **Fallback & memo**: Falls back to `plugin.openTab` with `cb-get-context` when `openFileByURL` is unavailable; original `window.open` implementation kept as a comment memo only.

### Changed
- **Search preview is DOM-only (reverted)**: In the global-search preview area (`.search__preview` / `dialog-search`), TOC clicks now only scroll within the already-rendered DOM and do NOT jump to headings outside the virtual-scroll range / folded ancestors. Reason: the preview is an isolated read-only Protyle instance; SiYuan exposes no plugin API to make that protyle load an arbitrary block id on demand (`onGet` is internal, `protyle.reload()` only reloads the current doc), and `openFileByURL` opens the main editor rather than the preview. This is a SiYuan plugin-architecture hard boundary; navigation in the preview area is intentionally limited to DOM-only.

## [0.1.23] - 2026-07-25

### Fixed
- **多层 TOC 叠加**：修复在设置、全局搜索、文件历史等面板间反复切换时，同一文档出现多个悬浮大纲叠加、颜色变深的问题。根因为 Svelte 组件销毁未移除手动创建的外层容器，现已在销毁时统一移除外层容器并保证同一 host 仅对应一个实例。
- **固定搜索无限创建**：修复思源「固定搜索」面板常驻时，文档悬浮大纲被无限创建/叠加的问题。搜索面板容器（`.search__preview` / `.search__doc`）不再被误识别为 TOC 宿主。
- **智能体输入框误挂 (Issue #33)**：修复悬浮大纲（含「回到顶部/回到底部/刷新」按钮）误挂到思源「智能体」对话框输入框的问题。已增强 AI/智能体面板识别，并在候选阶段加入双保险拦截。

## [0.1.22] - 2026-07-24

### Fixed
- **自定义 CSS 持久化 (Issue #29)**：插件加载时重新注入已保存的自定义 CSS，修复重启后丢失的问题。
- **Web/Docker 端协议唤醒 (Issue #19)**：在浏览器/Web 环境下不再使用 `siyuan://` 协议兜底，避免点击大纲唤醒本地客户端。
- **AI/智能体侧栏误显示 (Issue #31)**：排除 AI 对话侧栏内的 protyle，不再误挂悬浮大纲。
- **关系图全屏冲突 (Issue #30)**：关系图视图内不再显示悬浮大纲与全屏辅助按钮。
- **右侧面板贴边 (Issue #20)**：折叠态右侧面板与视口边缘留出更大边距，避开滚动条。
- **折叠/动态加载标题跳转 (Issue #28/#32)**：导航改为「先 DOM 滚动、找不到再 openTab 兜底」，降低对单个 API 的依赖，修复新版客户端点击不跳转。

### Added
- **悬浮模式开关**：可让大纲悬浮在正文之上而不挤压正文宽度（对应 Issue #16）。
- **平滑滚动开关**：可关闭点击大纲的平滑滚动动画（对应 Issue #22）。

## [0.1.21] - 2026-02-26

### Fixed
- **API Error Handling**: Fixed console error "invalid ID argument" when calling API with invalid block IDs.
  - Added `isValidBlockId()` function to validate block ID format before making API calls.
  - Block IDs must match SiYuan's standard format (14-digit date + 7-char alphanumeric, e.g., `20231201-abcdefg`).
  - Invalid IDs are now silently skipped instead of triggering API errors.
- **Page Loading State Check**: Prevented API calls before the page is fully loaded.
  - Added `data-loading` attribute check in `updateHeadings()` function.
  - API calls are now skipped when `data-loading="true"` to avoid errors during page initialization.

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
