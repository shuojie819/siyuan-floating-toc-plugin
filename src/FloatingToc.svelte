<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from "svelte";
  import { getDocOutline, flattenOutline, checkBlockFold } from "./api";
  import type { Heading, IProtyle } from "./types";

  export let plugin: any;
  // This is the DOM element of the protyle instance this TOC belongs to
  export let targetElement: HTMLElement;
  export let dockSide: 'left' | 'right' = 'right';
  export let followFocus: boolean = true;
  export let adaptiveHeight: boolean = false;
  export let miniTocWidth: number = 32;
  export let toolbarConfig: string[] = ["scrollToTop", "scrollToBottom", "refreshDoc"];

  let headings: Heading[] = [];
  let focusedIds: Set<string> = new Set();
  let visible = true;
  let currentProtyle: IProtyle | null = null;

  export const toggle = () => {
      visible = !visible;
  };

  export const setVisible = (value: boolean) => {
      visible = value;
  };

  export const hasHeading = (id: string) => {
      return headings.some(h => h.id === id);
  };

  let currentDocId = "";
  let container: HTMLElement;

  // Docking state
  let isPinned = false;
  // let dockSide is now a prop
  let isHovering = false;
  let pinnedStyle = "";
  let resizeObserver: ResizeObserver | null = null;
  let appliedPadding = false;
  
  // Resizing state
  let tocWidth = 250;
  let isResizing = false;
  let startResizeX = 0;
  let startResizeWidth = 0;

  // Derived state
  $: isExpanded = isPinned || isHovering || isResizing;

  // 展开时立即同步滚动位置到当前活动标题（无动画）
  $: if (isExpanded && activeHeadingId && container) {
      // 使用 tick 确保 DOM 已更新
      requestAnimationFrame(() => {
          const activeTocItem = container?.querySelector(`.toc-item[data-id="${activeHeadingId}"]`);
          if (activeTocItem) {
              // 使用 scrollIntoView 但不带动画，实现即时定位
              activeTocItem.scrollIntoView({ behavior: "instant", block: "center" });
          }
      });
  }

  // 获取有效的 TOC 宽度（考虑移动端适配）
  const getEffectiveTocWidth = () => window.innerWidth <= 768 ? 200 : tocWidth;

  // 检查是否为全宽模式
  const checkFullWidthMode = (wysiwyg: Element | null): boolean => {
      if (!wysiwyg) return false;
      const fullWidthAttr = wysiwyg.getAttribute("custom-sy-fullwidth");
      if (fullWidthAttr) return fullWidthAttr === "true";
      return !!(window as any).siyuan?.config?.editor?.fullWidth;
  };

  // 计算 TOC 位置
  const calculateTocPosition = (
      rect: DOMRect, 
      wRect: DOMRect | null, 
      effectiveTocWidth: number,
      currentPaddingLeft: number,
      currentPaddingRight: number
  ): { left: number; paddingNeeded: boolean } => {
      const resizeHandleOffset = 6;
      
      if (isExpanded && wRect) {
          if (dockSide === 'left') {
              const naturalTextLeft = wRect.left - (currentPaddingLeft / 2);
              const idealLeft = naturalTextLeft - effectiveTocWidth;
              const minLeft = rect.left + resizeHandleOffset;
              const left = Math.max(minLeft, idealLeft);
              const paddingNeeded = isPinned || (left + effectiveTocWidth > naturalTextLeft - 42);
              return { left, paddingNeeded };
          } else {
              const naturalTextRight = wRect.right + (currentPaddingRight / 2);
              const idealLeft = naturalTextRight;
              const maxLeft = rect.right - effectiveTocWidth - resizeHandleOffset;
              const left = Math.min(maxLeft, idealLeft);
              const paddingNeeded = left < naturalTextRight;
              return { left, paddingNeeded };
          }
      } else {
          if (dockSide === 'left') {
              return { left: rect.left + resizeHandleOffset, paddingNeeded: true };
          } else {
              return { 
                  left: rect.right - (isExpanded ? effectiveTocWidth : miniTocWidth) - resizeHandleOffset, 
                  paddingNeeded: false 
              };
          }
      }
  };

  const updatePosition = () => {
      if (!targetElement || !document.contains(targetElement)) return;
      
      const content = targetElement.querySelector('.protyle-content') as HTMLElement;
      if (!content) return;
      
      const wysiwyg = targetElement.querySelector('.protyle-wysiwyg');
      const rect = content.getBoundingClientRect();
      const wRect = wysiwyg?.getBoundingClientRect() || null;

      const top = Math.max(rect.top, 80);
      const maxHeight = Math.min(rect.height, window.innerHeight - top - 20);
      const effectiveTocWidth = getEffectiveTocWidth();
      
      const currentPaddingLeft = parseFloat(content.style.paddingLeft) || 0;
      const currentPaddingRight = parseFloat(content.style.paddingRight) || 0;
      
      const { left, paddingNeeded } = calculateTocPosition(
          rect, wRect, effectiveTocWidth, currentPaddingLeft, currentPaddingRight
      );
      
      const widthStyle = isExpanded ? `width: ${effectiveTocWidth}px;` : `width: ${miniTocWidth}px;`;
      const heightStyle = adaptiveHeight 
          ? `max-height: ${maxHeight}px; height: auto;` 
          : `height: ${maxHeight}px;`;

      pinnedStyle = `top: ${top}px; left: ${left}px; ${heightStyle} ${widthStyle}`;
      
      // 更新编辑器内边距
      const isFullWidth = checkFullWidthMode(wysiwyg);
      
      if (!isFullWidth) {
          updateEditorPadding(targetElement, 0);
      } else if (isExpanded && wysiwyg) {
          if (isPinned && paddingNeeded) {
              const extra = (dockSide === 'left') ? 42 : 0;
              updateEditorPadding(targetElement, effectiveTocWidth + extra);
          } else if (dockSide === 'left') {
              updateEditorPadding(targetElement, (isPinned ? effectiveTocWidth : miniTocWidth) + 10);
          } else {
              updateEditorPadding(targetElement, 0);
          }
      } else if (dockSide === 'left') {
          updateEditorPadding(targetElement, (isPinned ? effectiveTocWidth : miniTocWidth) + 10);
      } else {
          updateEditorPadding(targetElement, 0);
      }
  };
    
   const updateEditorPadding = (protyleElement: HTMLElement, offset: number) => {
       const content = protyleElement.querySelector('.protyle-content') as HTMLElement;
       if (!content) return;
       
       if (offset > 0) {
           if (dockSide === 'left') {
               content.style.paddingLeft = `${offset}px`;
               content.style.paddingRight = '';
           } else {
               content.style.paddingRight = `${offset}px`;
               content.style.paddingLeft = '';
           }
           appliedPadding = true;
       } else if (appliedPadding) {
           content.style.paddingLeft = '';
           content.style.paddingRight = '';
           appliedPadding = false;
       }
   };

  // Observe attribute changes on wysiwyg element for Full Width toggle
  let attrObserver: MutationObserver | null = null;

  const startAttrObserver = () => {
      if (attrObserver) attrObserver.disconnect();
      if (!targetElement) return;
      
      const wysiwyg = targetElement.querySelector('.protyle-wysiwyg');
      if (wysiwyg) {
          attrObserver = new MutationObserver((mutations) => {
              for (const mutation of mutations) {
                  if (mutation.type === 'attributes' && mutation.attributeName === 'custom-sy-fullwidth') {
                      updatePosition();
                  }
              }
          });
          attrObserver.observe(wysiwyg, { attributes: true, attributeFilter: ['custom-sy-fullwidth'] });
      }
  };

  // Resize Handlers
  const onResizeStart = (e: MouseEvent) => {
      isResizing = true;
      startResizeX = e.clientX;
      startResizeWidth = tocWidth;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeEnd);
  };

  const onResizeMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const delta = e.clientX - startResizeX;
      let newWidth = startResizeWidth + (dockSide === 'left' ? delta : -delta);
      
      if (newWidth < 150) newWidth = 150;
      if (newWidth > 600) newWidth = 600;
      
      tocWidth = newWidth;
      updatePosition();
  };

  const onResizeEnd = () => {
      isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onResizeMove);
      window.removeEventListener('mouseup', onResizeEnd);
      saveData();
  };

  // Watch for changes
  $: if (targetElement || dockSide || isPinned || isHovering || tocWidth || visible || adaptiveHeight) {
      if (visible) {
          updatePosition();
      } else {
          // If hidden, force remove padding if it was applied
          if (targetElement) {
              updateEditorPadding(targetElement, 0);
          }
      }
      
      if (resizeObserver) resizeObserver.disconnect();
      if (targetElement && visible) {
          resizeObserver = new ResizeObserver(() => {
              updatePosition();
          });
          resizeObserver.observe(targetElement);
      }
  }

  onMount(async () => {
      const savedData = plugin.data["config.json"];
      if (savedData) {
          isPinned = savedData.isPinned ?? false;
          dockSide = savedData.dockSide ?? 'right';
          tocWidth = savedData.tocWidth ?? 250;
          adaptiveHeight = savedData.adaptiveHeight ?? false;
      }
      
      window.addEventListener('resize', updatePosition);
      onScroll();
      startAttrObserver(); // Start observing wysiwyg attributes
      updatePosition();
  });
  
  onDestroy(() => {
      window.removeEventListener('resize', updatePosition);
      removeGlobalCheck();
      if (resizeObserver) resizeObserver.disconnect();
      if (attrObserver) attrObserver.disconnect();
      
      if (targetElement && appliedPadding) {
          const content = targetElement.querySelector('.protyle-content');
          if (content) {
              content.style.paddingLeft = '';
              content.style.paddingRight = '';
          }
      }
      
      // 清理滚动监听器
      if (currentScrollElement) {
          currentScrollElement.removeEventListener("scroll", onScroll);
          currentScrollElement = null;
      }
      
      // 清理滚动定时器
      if (scrollTimer) {
          cancelAnimationFrame(scrollTimer);
          scrollTimer = null;
      }
  });

  // Display state
  let maxDepth = 6;

  const scrollToTop = () => {
      if (targetElement) {
          // 1. 尝试点击原生滚动条的上箭头
          const scrollUpBtn = targetElement.querySelector('.protyle-scroll__up') as HTMLElement;
          if (scrollUpBtn && scrollUpBtn.offsetParent !== null) {
              scrollUpBtn.click();
              return;
          }

          // 2. 尝试发送 Ctrl+Home 键盘事件
          const wysiwyg = targetElement.querySelector('.protyle-wysiwyg');
          if (wysiwyg) {
              wysiwyg.dispatchEvent(new KeyboardEvent('keydown', {
                  key: 'Home',
                  code: 'Home',
                  keyCode: 36,
                  ctrlKey: true,
                  bubbles: true,
                  cancelable: true,
                  composed: true
              }));
              // 给一点时间让事件处理
              setTimeout(() => {
                  const content = targetElement.querySelector(".protyle-content");
                  if (content && content.scrollTop > 0) {
                      content.scrollTop = 0;
                  }
              }, 100);
          } else {
              const content = targetElement.querySelector(".protyle-content");
              if (content) content.scrollTop = 0;
          }
      }
  };

  const scrollToBottom = () => {
      if (targetElement) {
          // 优化：检查文档是否已完全加载 (data-eof="2" 表示已到底部)
          const content = targetElement.querySelector(".protyle-content");
          if (content && content.getAttribute('data-eof') === '2') {
              content.scrollTop = content.scrollHeight;
              return;
          }

          // 1. 尝试点击原生滚动条的下箭头
          const scrollDownBtn = targetElement.querySelector('.protyle-scroll__down') as HTMLElement;
          if (scrollDownBtn && scrollDownBtn.offsetParent !== null) {
              scrollDownBtn.click();
              return;
          }

          // 2. 尝试发送 Ctrl+End 键盘事件
          const wysiwyg = targetElement.querySelector('.protyle-wysiwyg');
          if (wysiwyg) {
              wysiwyg.dispatchEvent(new KeyboardEvent('keydown', {
                  key: 'End',
                  code: 'End',
                  keyCode: 35,
                  ctrlKey: true,
                  bubbles: true,
                  cancelable: true,
                  composed: true
              }));
          } else {
              // Fallback
              const content = targetElement.querySelector(".protyle-content");
              if (content) content.scrollTop = content.scrollHeight;
          }
      }
  };

  let isRefreshing = false;
  const refreshDoc = () => {
      if (isRefreshing) return;
      isRefreshing = true;

      // 尝试使用原生 API 刷新
      if (currentProtyle) {
          try {
              // IProtyle 接口通常有一个 getInstance 方法返回 Protyle 类实例
              if (typeof currentProtyle.getInstance === 'function') {
                  const instance = currentProtyle.getInstance();
                  if (instance && typeof instance.reload === 'function') {
                      // console.log("Floating TOC: Reloading using native API (Protyle.reload)");
                      instance.reload(false);
                      setTimeout(() => { isRefreshing = false; }, 500);
                      return;
                  }
              } 
              // 也许直接就是 Protyle 实例？
              else if (typeof currentProtyle.reload === 'function') {
                   // console.log("Floating TOC: Reloading using native API (Direct reload)");
                   currentProtyle.reload(false);
                   setTimeout(() => { isRefreshing = false; }, 500);
                   return;
              }
          } catch (e) {
              console.error("Floating TOC: Failed to reload using native API", e);
          }
      }

      const triggerF5 = () => {
          // Trigger F5 key event to refresh the document
          document.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'F5',
              code: 'F5',
              keyCode: 116,
              bubbles: true
          }));
      };

      // 1. 尝试找到当前文档对应的菜单按钮
      let menuBtn: HTMLElement | null = null;
      
      // 通常在 layout__center 下的 header 中
      const center = targetElement?.closest('.layout__center');
      if (center) {
          const header = center.querySelector('.layout__center-header');
          if (header) {
              menuBtn = header.querySelector('[data-type="more"]');
          }
      }
      
      // 如果是在弹出窗口或浮动窗口中
      if (!menuBtn) {
           const wnd = targetElement?.closest('.b3-dialog__container') || targetElement?.closest('.layout__wnd');
           // ... (窗口查找逻辑可能比较复杂，暂时依赖 F5 回退)
      }

      if (menuBtn) {
          // 2. 点击打开菜单
          menuBtn.click();
          
          // 3. 等待菜单出现并查找刷新项
          setTimeout(() => {
              const menu = document.getElementById('commonMenu');
              let foundAndClicked = false;

              if (menu) {
                  const items = menu.querySelectorAll('.b3-menu__item');
                  let refreshBtn: HTMLElement | null = null;
                  
                  for (let i = 0; i < items.length; i++) {
                      const item = items[i] as HTMLElement;
                      const label = item.querySelector('.b3-menu__label')?.textContent?.trim();
                      if (label === "刷新" || label === "Refresh") {
                          refreshBtn = item;
                          break;
                      }
                  }
                  
                  if (refreshBtn) {
                      refreshBtn.click();
                      foundAndClicked = true;
                  } else {
                      // 未找到刷新按钮，关闭菜单
                      menuBtn?.click();
                  }
              }
              
              if (!foundAndClicked) {
                  // 如果未找到菜单或刷新按钮，执行 F5 回退
                  triggerF5();
              }

              setTimeout(() => { isRefreshing = false; }, 500);
          }, 0);
      } else {
          // 如果找不到按钮，回退到 F5 模拟
          triggerF5();
          setTimeout(() => { isRefreshing = false; }, 500);
      }
  };

  const collapseAll = () => {
      if (headings.length > 0) {
          // Find the minimum depth in the current headings, prioritizing valid headers (h1-h6)
          const validHeadings = headings.filter(h => h.subType && /^h[1-6]$/i.test(h.subType));
          const targetHeadings = validHeadings.length > 0 ? validHeadings : headings;
          
          const minDepth = targetHeadings.reduce((min, h) => (h.depth < min ? h.depth : min), 100);
          maxDepth = minDepth;
      } else {
          maxDepth = 1;
      }
  };

  const expandAll = () => {
      maxDepth = 6;
  };

  const saveData = () => {
      // 获取当前的全局配置中的默认位置，而不是使用当前的临时位置
      const currentConfig = plugin.data["config.json"] || {};
      const defaultDockSide = currentConfig.dockSide || 'right';
      
      const newData = { ...currentConfig, isPinned, dockSide: defaultDockSide, tocWidth, adaptiveHeight };
      plugin.data["config.json"] = newData;
      plugin.saveData("config.json", newData);
  };

  const togglePin = () => {
      isPinned = !isPinned;
      saveData();
  };

  const toggleDockSide = () => {
      dockSide = dockSide === 'right' ? 'left' : 'right';
      // 不保存到全局配置，使其仅对当前会话有效
      // saveData(); 
  };
  
  // Handlers for hover expansion
  const onMouseEnter = () => {
      if (!isPinned) {
          isHovering = true;
          addGlobalCheck();
      }
  };
  
  const onMouseLeave = () => {
      if (!isPinned) {
          isHovering = false;
          removeGlobalCheck();
      }
  };

  const addGlobalCheck = () => {
      window.addEventListener('mousemove', onGlobalMouseMove);
  };
  
  const removeGlobalCheck = () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
  };
  
  const onGlobalMouseMove = (e: MouseEvent) => {
      if (isPinned || !isHovering || !container) {
          removeGlobalCheck();
          return;
      }
      
      const rect = container.getBoundingClientRect();
      const buffer = 30;
      
      if (
          e.clientX < rect.left - buffer ||
          e.clientX > rect.right + buffer ||
          e.clientY < rect.top - buffer ||
          e.clientY > rect.bottom + buffer
      ) {
          isHovering = false;
          removeGlobalCheck();
      }
  };

  // Static decoder for performance
  const decoder = document.createElement('div');
  const getPlainText = (html: string) => {
      if (!html) return "";
      decoder.innerHTML = html;
      return decoder.textContent || decoder.innerText || "";
  };

  const isHistoryTarget = () => {
      if (!targetElement) return false;
      if (targetElement.classList.contains("history__text")) return true;
      if (targetElement.closest(".history__text")) return true;
      if (targetElement.closest(".history__panel, .history")) return true;
      if (targetElement.closest(".b3-dialog--open[data-key='dialog-history'], .b3-dialog--open[data-key='dialog-historydoc']")) return true;
      return false;
  };

  // 检测是否为搜索预览模式
  const isSearchTarget = () => {
      if (!targetElement) return false;
      if (targetElement.closest(".search__preview")) return true;
      if (targetElement.closest(".b3-dialog--open[data-key='dialog-search']")) return true;
      return false;
  };

  // 检测是否为特殊模式（历史记录、搜索等），这些模式下不应使用 API 跳转
  const isSpecialMode = () => {
      return isHistoryTarget() || isSearchTarget();
  };

  const parseHeadingDepth = (el: HTMLElement, fallback: number) => {
      const tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (/^h[1-6]$/.test(tag)) {
          return parseInt(tag.slice(1), 10);
      }
      const subtype =
          el.getAttribute("data-subtype") ||
          el.getAttribute("data-subType") ||
          el.getAttribute("data-type") ||
          "";
      const match = subtype.match(/h([1-6])/i);
      if (match) return parseInt(match[1], 10);
      const level =
          el.getAttribute("data-level") ||
          el.getAttribute("aria-level") ||
          "";
      const parsed = parseInt(level, 10);
      return Number.isFinite(parsed) ? parsed : fallback;
  };

  const collectHeadingsFromDom = (root: HTMLElement): Heading[] => {
      const contentRoot =
          (root.querySelector(".protyle-content") as HTMLElement | null) || root;
      
      const list: Heading[] = [];
      let syntheticIndex = 0;

      // 1. Collect standard headings
      const elements = Array.from(
          contentRoot.querySelectorAll('[data-type="NodeHeading"], h1, h2, h3, h4, h5, h6')
      ) as HTMLElement[];
      
      elements.forEach((el) => {
          if (el.tagName && /^h[1-6]$/i.test(el.tagName)) {
              const parentHeading = el.closest('[data-type="NodeHeading"]');
              if (parentHeading && parentHeading !== el) {
                  return;
              }
          }
          const id =
              el.getAttribute("data-node-id") ||
              el.getAttribute("data-id") ||
              el.getAttribute("data-oid") ||
              `__toc_dom_${syntheticIndex++}`;
          const depth = parseHeadingDepth(el, 1);
          const content = getPlainText(el.innerHTML || el.textContent || "");
          list.push({
              id,
              content: content || "Untitled",
              depth: depth || 1,
              subType:
                  el.getAttribute("data-subtype") ||
                  el.getAttribute("data-subType") ||
                  (el.tagName ? el.tagName.toLowerCase() : undefined),
              element: el
          });
      });

      // 2. Collect Database Groups
      const avGroups = Array.from(contentRoot.querySelectorAll('.av__group-title')) as HTMLElement[];
      avGroups.forEach((el) => {
          const icon = el.querySelector('.av__group-icon');
          const name = el.querySelector('.av__group-name');
          const counter = el.querySelector('.av__group-counter');
          // The ID is usually on the icon element for AV groups
          const id = icon?.getAttribute("data-id");
          
          if (id && name) {
              list.push({
                  id,
                  content: (name.textContent || "") + (counter ? ` ${counter.textContent}` : ""),
                  depth: 1, // Groups are top-level
                  subType: "av-group",
                  element: el
              });
          }
      });

      // Sort all items by document position
      list.sort((a, b) => {
          if (!a.element || !b.element) return 0;
          return (a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
      });

      return list;
  };

  export const updateHeadings = async (docId: string, protyle?: IProtyle | any) => {
    if (protyle) {
        currentProtyle = protyle;
    }
    if (docId) {
      currentDocId = docId;
    }
    
    // 清除之前的聚焦 ID
    focusedIds.clear();

    try {
      // 历史记录模式：从 DOM 解析
      if (isHistoryTarget() && targetElement) {
        const domHeadings = collectHeadingsFromDom(targetElement);
        headings = [];
        await new Promise(resolve => setTimeout(resolve, 0));
        headings = domHeadings;
        return;
      }

      // 检测聚焦模式
      let isFocusMode = false;
      let hasDatabaseGroups = false;

      if (targetElement) {
          const exitFocusBtn = targetElement.querySelector('.protyle-breadcrumb__icon[data-type="exit-focus"]');
          isFocusMode = !!(exitFocusBtn && !exitFocusBtn.classList.contains("fn__none"));
          hasDatabaseGroups = targetElement.querySelector('.av__group-title') !== null;
      }

      if (isFocusMode && targetElement) {
          if (followFocus || hasDatabaseGroups) {
              // 跟随聚焦：从 DOM 解析
              const domHeadings = collectHeadingsFromDom(targetElement);
              headings = [];
              await new Promise(resolve => setTimeout(resolve, 0));
              headings = domHeadings;
              return;
          } else {
              // 不跟随聚焦：获取完整大纲，但标记聚焦范围
              const domHeadings = collectHeadingsFromDom(targetElement);
              domHeadings.forEach(h => focusedIds.add(h.id));
              
              // 获取文档根 ID
              let rootId = "";
              if (currentProtyle?.block?.rootID) {
                  rootId = currentProtyle.block.rootID;
              } else {
                  const breadcrumb = targetElement.querySelector(".protyle-breadcrumb");
                  const firstItem = breadcrumb?.querySelector(".protyle-breadcrumb__item");
                  rootId = firstItem?.getAttribute("data-node-id") || "";
              }

              if (rootId) {
                  docId = rootId;
              }
          }
      }

      if (!docId) return;

      // 使用封装的 API 获取大纲
      const outlineData = await getDocOutline(docId);
      
      // 强制触发响应式更新
      headings = [];
      await new Promise(resolve => setTimeout(resolve, 0));
      
      const apiHeadings = flattenOutline(outlineData, decoder);
      
      // API 返回空数组时的 fallback
      if (apiHeadings.length === 0 && targetElement) {
          const domHeadings = collectHeadingsFromDom(targetElement);
          if (domHeadings.length > 0) {
              headings = domHeadings;
              return;
          }
      }
      
      headings = apiHeadings;
    } catch (error) {
      console.error("Failed to update headings:", error);
    }
  };

  /**
   * 使用思源官方 API 跳转到指定块
   * 参考思源本体 Outline.ts 实现
   */
  const navigateToBlock = async (blockId: string) => {
    // 使用 plugin.openTab 进行跳转，这是思源官方插件 API
    // 会自动处理动态加载、聚焦模式等场景
    if (plugin && typeof plugin.addTab === 'function') {
      try {
        await plugin.openTab({
          app: plugin.app,
          doc: {
            id: blockId,
            // 修复聚焦问题：移除 cb-get-focus 和 cb-get-all（会导致聚焦效果）
            // 使用 cb-get-hl（高亮）+ cb-get-context（上下文）替代
            action: ["cb-get-hl", "cb-get-context"],
            zoomIn: false  // 明确禁用缩放/聚焦
          }
        });
        return true;
      } catch (e) {
        console.warn("Floating TOC: openTab failed, falling back to protocol", e);
      }
    }
    
    // 回退方案：使用 siyuan 协议
    window.open(`siyuan://blocks/${blockId}`, "_blank");
    return true;
  };

  /**
   * 在 DOM 中滚动到目标块并高亮
   */
  const scrollToBlockInDom = (targetBlock: Element) => {
    const headingBlock = targetBlock.closest('[data-type="NodeHeading"]') || targetBlock;
    const contentElement = headingBlock.closest('.protyle-content');
    
    if (contentElement) {
      headingBlock.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      // 只对目标标题块应用高亮
      if (headingBlock.hasAttribute('data-node-id')) {
        const isTitleBlock = headingBlock.getAttribute('data-type') === 'NodeHeading';
        if (isTitleBlock) {
          headingBlock.classList.add('protyle-wysiwyg--hl');
          setTimeout(() => {
            headingBlock.classList.remove('protyle-wysiwyg--hl');
          }, 1024);
        }
      }
      return true;
    }
    return false;
  };

  /**
   * 在 DOM 中查找目标块
   */
  const findTargetBlockInDom = (heading: Heading): Element | null => {
    // 首先检查 heading.element 是否仍在 DOM 中
    if (heading.element && document.contains(heading.element)) {
      const el = heading.element as HTMLElement;
      // 确保元素可见
      if (el.offsetParent !== null && el.offsetWidth > 0 && el.offsetHeight > 0) {
        return el;
      }
    }

    const searchRoot: ParentNode = targetElement || document;
    const targetElements = searchRoot.querySelectorAll(
      `[data-node-id="${heading.id}"], [data-id="${heading.id}"]`
    );
    
    for (const element of Array.from(targetElements)) {
      const el = element as HTMLElement;
      
      // 跳过嵌入块、不可见元素
      if (el.closest('.protyle-embed') || 
          el.offsetParent === null || 
          el.offsetWidth === 0 || 
          el.offsetHeight === 0) {
        continue;
      }
      
      // 优先选择标题类型元素
      if (el.getAttribute('data-type') === 'NodeHeading') {
        return el;
      }
      // 其次选择带有 data-node-id 的块元素
      else if (el.hasAttribute('data-node-id')) {
        return el;
      }
      // 支持数据库分组 (AV Groups)
      else if (el.hasAttribute('data-id')) {
        const groupTitle = el.closest('.av__group-title');
        return groupTitle || el;
      }
    }
    
    return null;
  };

  /**
   * 标题跳转逻辑
   * 参考思源本体 Outline.ts，先检查块折叠状态再决定跳转方式
   */
  const handleClick = async (heading: Heading) => {
    // 处理文档标题点击 - 滚动到顶部
    if (heading.id === currentDocId) {
      if (targetElement) {
        const content = targetElement.querySelector(".protyle-content");
        if (content) {
          content.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
      return;
    }

    // 1. 清除高亮和选区
    document.querySelectorAll('.protyle-wysiwyg--hl').forEach(el => {
      el.classList.remove('protyle-wysiwyg--hl');
    });
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      selection.removeAllRanges();
    }

    // 2. 数据库分组（AV Groups）特殊处理 - 直接在 DOM 中查找滚动
    // 数据库分组的 ID 不是思源块 ID，无法使用 checkBlockFold 和 openTab API
    if (heading.subType === "av-group") {
      const targetBlock = findTargetBlockInDom(heading);
      if (targetBlock) {
        scrollToBlockInDom(targetBlock);
      }
      return;
    }

    // 3. 历史记录、搜索预览等特殊模式 - 直接在 DOM 中查找滚动
    // 这些模式下使用 API 会跳转到主文档而非当前预览内容
    if (isSpecialMode()) {
      const targetBlock = findTargetBlockInDom(heading);
      if (targetBlock) {
        scrollToBlockInDom(targetBlock);
      }
      return;
    }

    // 4. 调用 checkBlockFold API 检查块是否处于折叠/不可见状态
    // 在思源中，聚焦模式外的块、动态加载未加载的块都会返回 true
    let isFolded = false;
    try {
      isFolded = await checkBlockFold(heading.id);
    } catch (e) {
      console.warn("Floating TOC: checkBlockFold failed", e);
    }

    // 4. 如果块被折叠/不可见，直接使用官方 API 跳转
    if (isFolded) {
      await navigateToBlock(heading.id);
      return;
    }

    // 5. 块未折叠，尝试在 DOM 中查找并滚动
    // 使用短延迟确保编辑器状态稳定
    setTimeout(async () => {
      const targetBlock = findTargetBlockInDom(heading);
      
      if (targetBlock) {
        // 在 DOM 中找到了可见的目标块，直接滚动
        scrollToBlockInDom(targetBlock);
      } else {
        // DOM 中找不到（可能是动态加载场景，checkBlockFold 返回了错误结果）
        // 使用官方 API 跳转作为回退
        await navigateToBlock(heading.id);
      }
    }, 50);
  };


  let activeHeadingId = "";
  let scrollTimer: any = null;

  // Actions map
  const actionsMap = {
      scrollToTop: {
          icon: '<path fill="currentColor" d="M13,20H11V8L5.5,13.5L4.08,12.08L12,4.08L19.92,12.08L18.5,13.5L13,8V20Z" />',
          handler: () => scrollToTop(),
          title: "Scroll to Top"
      },
      scrollToBottom: {
          icon: '<path fill="currentColor" d="M13,4H11V16L5.5,10.5L4.08,12L12,20L19.92,12L18.5,10.5L13,16V4Z" />',
          handler: () => scrollToBottom(),
          title: "Scroll to Bottom"
      },
      refreshDoc: {
          icon: '<path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>',
          handler: () => refreshDoc(),
          title: "Refresh Document",
          extraClass: (actionId: string) => isRefreshing ? "spinning" : ""
      },
      togglePin: {
          icon: () => isPinned 
            ? '<path fill="currentColor" d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />'
            : '<path fill="currentColor" d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z" />',
          handler: () => togglePin(),
          title: () => isPinned ? "Unpin (Collapse)" : "Pin (Push Content)"
      },
      toggleDockSide: {
          icon: '<path fill="currentColor" d="M6.5,10L2,14.5L6.5,19V16H11V13H6.5V10M17.5,10V13H13V16H17.5V19L22,14.5L17.5,10Z" />',
          handler: () => toggleDockSide(),
          title: "Switch Side"
      },
      collapseAll: {
          icon: '<path fill="currentColor" d="M19,13H5V11H19V13Z" />',
          handler: () => collapseAll(),
          title: "Collapse All"
      },
      expandAll: {
          icon: '<path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />',
          handler: () => expandAll(),
          title: "Expand All"
      }
  };

  const onScroll = () => {
      if (scrollTimer) return;
      if (headings.length === 0) return; // Optimization: don't query if no headings
      
      scrollTimer = requestAnimationFrame(() => {
          scrollTimer = null;
          if (!targetElement) return;
          
          const contentElement = targetElement.querySelector(".protyle-content");
          if (!contentElement) return;
    
          const useDomHeadings = isHistoryTarget();
          const headingElements = useDomHeadings
              ? headings.map(h => h.element).filter((el): el is HTMLElement => !!el)
              : Array.from(contentElement.querySelectorAll('[data-type="NodeHeading"]')) as HTMLElement[];
          
          let currentActiveId = "";
          const contentRect = contentElement.getBoundingClientRect();
          const topOffset = contentRect.top + 100;
    
          for (const el of headingElements) {
              const rect = el.getBoundingClientRect();
              if (rect.top <= topOffset) {
                  if (useDomHeadings) {
                      const match = headings.find(h => h.element === el);
                      currentActiveId = match?.id || "";
                  } else {
                      currentActiveId = el.getAttribute("data-node-id") || "";
                  }
              } else {
                  break;
              }
          }
    
          if (currentActiveId && currentActiveId !== activeHeadingId) {
              activeHeadingId = currentActiveId;
              const activeTocItem = container?.querySelector(`.toc-item[data-id="${activeHeadingId}"]`);
              if (activeTocItem) {
                  activeTocItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
              const activeStripItem = container?.querySelector(`.strip-item[data-id="${activeHeadingId}"]`);
              if (activeStripItem) {
                  activeStripItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
              }
          }
      });
  };

  // 统一管理滚动监听器，避免重复添加和内存泄漏
  let currentScrollElement: Element | null = null;
  
  const attachScrollListener = (element: Element | null) => {
      if (element === currentScrollElement) return;
      
      // 移除旧的监听器
      if (currentScrollElement) {
          currentScrollElement.removeEventListener("scroll", onScroll);
      }
      
      // 添加新的监听器
      if (element) {
          element.addEventListener("scroll", onScroll, { passive: true });
      }
      
      currentScrollElement = element;
  };

  $: if (targetElement) {
      const contentElement = targetElement.querySelector(".protyle-content");
      attachScrollListener(contentElement);
  }
  
  afterUpdate(() => {
      if (targetElement) {
          const contentElement = targetElement.querySelector(".protyle-content");
          attachScrollListener(contentElement);
      }
  });
</script>

{#if visible}
  <div
    class="floating-toc {isPinned ? 'pinned ' + dockSide : (isExpanded ? 'expanded ' + dockSide : 'collapsed ' + dockSide)}"
    style={pinnedStyle}
    bind:this={container}
    on:mouseleave={onMouseLeave}
    role="region"
    aria-label="Floating Table of Contents"
  >
      {#if isExpanded}
      <!-- Resize Handle -->
      <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div 
        class="resize-handle" 
        class:left={dockSide==='right'} 
        class:right={dockSide==='left'} 
        on:mousedown|stopPropagation={onResizeStart}
        role="separator"
        aria-label="Resize TOC"
        tabindex="0"
      ></div>
      {/if}
      
      <!-- Scroll Toolbar (Detached) -->
      <div class="scroll-toolbar">
          {#each toolbarConfig as actionId}
              {#if actionsMap[actionId]}
                  {@const action = actionsMap[actionId]}
                  <button 
                    class="scroll-btn" 
                    on:click={action.handler} 
                    title={typeof action.title === 'function' ? action.title() : action.title} 
                    aria-label={typeof action.title === 'function' ? action.title() : action.title}
                  >
                      <svg viewBox="0 0 24 24" width="16" height="16" class={action.extraClass ? action.extraClass(actionId) : ''}>
                        {@html typeof action.icon === 'function' ? action.icon() : action.icon}
                      </svg>
                  </button>
              {/if}
          {/each}
      </div>

      {#if isExpanded}
      <div class="toc-panel">
        <div class="toc-header">
            <div class="header-actions">
                <button class="action-btn" on:click={togglePin} title={isPinned ? "Unpin (Collapse)" : "Pin (Push Content)"} aria-label="Toggle Pin">
                {#if isPinned}
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" /></svg>
                {:else}
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12M8.8,14L10,12.8V4H14V12.8L15.2,14H8.8Z" /></svg>
                {/if}
                </button>
                <button class="action-btn" on:click={toggleDockSide} title="Switch Side" aria-label="Switch Dock Side">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M6.5,10L2,14.5L6.5,19V16H11V13H6.5V10M17.5,10V13H13V16H17.5V19L22,14.5L17.5,10Z" /></svg>
                </button>
                
                <button class="action-btn" on:click={collapseAll} title="Collapse All" aria-label="Collapse All">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19,13H5V11H19V13Z" /></svg>
                </button>
                <button class="action-btn" on:click={expandAll} title="Expand All" aria-label="Expand All">
                    <svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" /></svg>
                </button>
            </div>
        </div>
        <div class="toc-content">
            {#if headings.length === 0}
                <div class="toc-empty">No headings</div>
            {:else}
                {#each headings as heading}
                {#if heading.depth <= maxDepth}
                <div
                    class="toc-item level-{heading.depth}"
                    class:active={heading.id === activeHeadingId}
                    class:focused-scope={focusedIds.has(heading.id)}
                    data-id={heading.id}
                    on:click|stopPropagation={() => handleClick(heading)}
                    on:keydown|stopPropagation={(e) => e.key === 'Enter' && handleClick(heading)}
                    title={heading.content}
                    role="button"
                    tabindex="0"
                >
                    <div class="toc-text">{heading.content}</div>
                    {#if heading.subType}
                    <div class="toc-badge">{heading.subType.toUpperCase()}</div>
                    {/if}
                </div>
                {/if}
                {/each}
            {/if}
        </div>
      </div>
    {:else}
      <!-- Collapsed State: Mini-map with strips -->
       <!-- svelte-ignore a11y-no-static-element-interactions -->
       <div 
         class="collapsed-strip" 
         class:right-align={dockSide==='right'} 
         class:left-align={dockSide==='left'} 
         on:mouseenter={onMouseEnter} 
         role="region" 
         aria-label="Collapsed TOC"
       >
           <div class="strip-content">
               {#if headings.length === 0}
                   <!-- Show a placeholder dot if no headings -->
                   <div class="strip-placeholder"></div>
               {:else}
                   {#each headings as heading}
                       <div 
                           class="strip-item"
                           class:active={heading.id === activeHeadingId}
                           data-id={heading.id}
                           style="width: {Math.max(20, 100 - (heading.depth - 1) * 15)}%;"
                           on:click|stopPropagation={() => handleClick(heading)}
                           on:keydown|stopPropagation={(e) => e.key === 'Enter' && handleClick(heading)}
                           title={heading.content}
                           role="button"
                           tabindex="0"
                       ></div>
                   {/each}
               {/if}
           </div>
       </div>
    {/if}
  </div>
{/if}

<style lang="scss">
  .floating-toc {
    position: fixed;
    z-index: 10;
    display: flex;
    flex-direction: column;
    font-family: var(--b3-font-family);
    transition: width 0.2s ease, opacity 0.2s ease, left 0.2s ease;
    gap: 4px;
  }
  
  .toc-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-theme-border);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.2s ease;
  }
  
  /* 固定状态样式 */
  .floating-toc.pinned .toc-panel {
    border-radius: 8px;
    box-shadow: none;
    border: 1px solid var(--b3-theme-border);
    background: var(--b3-theme-background);
  }
  
  /* 滚动工具栏样式 */
  .scroll-toolbar {
    display: grid;
    gap: 8px;
    padding: 2px;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }
  
  .scroll-btn {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-theme-border);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--b3-theme-on-surface-light);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: all 0.2s ease;
    outline: none;
  }
  
  .scroll-btn:hover {
    background: var(--b3-theme-surface-light);
    color: var(--b3-theme-on-surface);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }
  
  /* 折叠状态调整 */
  .floating-toc.collapsed .scroll-toolbar {
    grid-template-rows: repeat(4, auto);
    grid-auto-flow: column;
    justify-content: center;
    gap: 4px;
    width: max-content;
  }
  
  .floating-toc.collapsed .scroll-btn {
    width: 20px;
    height: 20px;
    padding: 0;
  }
  
  .floating-toc.collapsed .scroll-btn svg {
    width: 12px;
    height: 12px;
  }

  /* 展开状态调整 */
  .floating-toc.expanded .scroll-toolbar, 
  .floating-toc.pinned .scroll-toolbar {
      grid-template-columns: repeat(4, auto);
      grid-auto-flow: row;
      justify-content: center;
  }


  /* 折叠状态面板 */
  .floating-toc.collapsed .toc-panel {
    background: transparent;
    border: none;
    box-shadow: none;
  }
  
  /* 折叠状态 */
  .floating-toc.collapsed {
    /* width: 32px !important; REMOVED: width is now handled by inline style */
    opacity: 0.8;
    background: transparent;
    border: none;
    box-shadow: none;
    cursor: pointer;
    transition: opacity 0.2s ease;
  }
  
  .floating-toc.collapsed:hover {
    opacity: 1;
  }
  
  /* 折叠条样式 */
  .collapsed-strip {
    flex: 1;
    width: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    padding: 60px 0 8px 0;
    scrollbar-width: none;
  }
  
  .collapsed-strip.right-align {
    align-items: flex-end;
  }

  .collapsed-strip.left-align {
    align-items: flex-start;
  }
  
  .collapsed-strip::-webkit-scrollbar {
    display: none;
  }
  
  .strip-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  
  /* Inherit alignment from parent */
  .collapsed-strip.right-align .strip-content {
    align-items: flex-end;
  }
  
  .collapsed-strip.left-align .strip-content {
    align-items: flex-start;
  }
  
  .strip-item {
    height: 4px;
    background-color: var(--b3-theme-on-surface-light);
    border-radius: 2px;
    opacity: 0.5;
    cursor: pointer;
    transition: all 0.2s ease;
    min-width: 4px;
  }
  
  .strip-item:hover {
    opacity: 1;
    background-color: var(--b3-theme-on-surface);
  }
  
  .strip-item.active {
    background-color: var(--b3-theme-primary);
    opacity: 1;
    height: 4px;
    box-shadow: 0 0 4px var(--b3-theme-primary);
    transition: all 0.3s ease;
  }

  /* 展开/固定状态 */
  .floating-toc.expanded, .floating-toc.pinned {
    /* 宽度由内联样式处理 */
  }
  
  /* 调整大小手柄 */
  .resize-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 1000;
    background: transparent;
    transition: background 0.2s ease;
  }
  
  .resize-handle:hover, .resize-handle:active {
    background: var(--b3-theme-on-surface-light);
    opacity: 0.3;
  }
  
  .resize-handle.left { left: 0; }
  .resize-handle.right { right: 0; }

  /* 标题栏样式 */
  .toc-header {
    padding: 8px 12px;
    background: var(--b3-theme-background-light);
    border-bottom: 1px solid var(--b3-theme-border);
    cursor: default;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: bold;
    user-select: none;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    justify-content: space-between;
  }
  
  .action-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--b3-theme-on-surface-light);
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s ease;
    outline: none;
    width: 28px;
    height: 28px;
  }
  
  .action-btn:hover {
    background: var(--b3-theme-surface-light);
    color: var(--b3-theme-on-surface);
  }

  /* 内容区域 */
  .toc-content {
    overflow-y: auto;
    padding: 8px 0;
    flex: 1;
    scrollbar-width: none; /* Firefox: 完全隐藏滚动条 */
  }
  
  .toc-content::-webkit-scrollbar {
    width: 3px;
    background: transparent;
  }

  .toc-content::-webkit-scrollbar-track {
    background: transparent;
  }

  .toc-content::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 2px;
  }

  .toc-content:hover::-webkit-scrollbar-thumb {
    background: rgba(128, 128, 128, 0.15);
  }

  .toc-content:hover::-webkit-scrollbar-thumb:hover {
    background: rgba(128, 128, 128, 0.25);
  }

  .toc-empty {
    padding: 16px;
    text-align: center;
    color: var(--b3-theme-on-surface-light);
    font-size: 12px;
    font-style: italic;
  }

  .strip-placeholder {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background-color: var(--b3-theme-on-surface-light);
    opacity: 0.5;
  }

  /* 标题项样式 */
  .toc-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px 6px 0;
    cursor: pointer;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    line-height: 1.5;
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
    outline: none;
  }

  .toc-item:hover {
    background: var(--b3-theme-background-light);
  }

  .toc-item.active {
    background: var(--b3-theme-background-light);
    color: var(--b3-theme-primary);
    border-left-color: var(--b3-theme-primary);
    font-weight: 500;
    transition: all 0.3s ease;
  }

  /* 聚焦模式高亮范围 */
  .toc-item.focused-scope {
    background-color: var(--b3-theme-surface-lighter);
    border-right: 3px solid var(--b3-theme-primary-light);
  }
  
  /* 确保选中状态优先 */
  .toc-item.active.focused-scope {
    background: var(--b3-theme-background-light);
    border-left-color: var(--b3-theme-primary);
    border-right-color: var(--b3-theme-primary);
  }

  /* 标题文本样式 */
  .toc-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
  }

  /* 标题类型标签 */
  .toc-badge {
    font-size: 10px;
    color: var(--b3-theme-on-surface-light);
    background: var(--b3-theme-surface-light);
    padding: 1px 4px;
    border-radius: 4px;
    flex-shrink: 0;
    opacity: 0.6;
    transition: opacity 0.2s ease;
  }
  
  .toc-item:hover .toc-badge {
    opacity: 1;
  }

  /* 标题缩进级别 */
  .level-1 { padding-left: 8px; }
  .level-2 { padding-left: 16px; }
  .level-3 { padding-left: 24px; }
  .level-4 { padding-left: 32px; }
  .level-5 { padding-left: 40px; }
  .level-6 { padding-left: 48px; }
  
  /* 无障碍支持 */
  .toc-item:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: -2px;
    border-radius: 4px;
  }

  .scroll-btn:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 1px;
  }

  .action-btn:focus {
    outline: 2px solid var(--b3-theme-primary);
    outline-offset: 1px;
    border-radius: 4px;
  }

  /* 响应式调整 */
  @media (max-width: 768px) {
    .floating-toc {
      /* Width is now handled by inline style via JS logic */
    }
    
    .toc-width {
      min-width: 150px;
      max-width: 300px;
    }
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .spinning {
    animation: spin 1s linear infinite;
    transform-origin: center;
  }
</style>
