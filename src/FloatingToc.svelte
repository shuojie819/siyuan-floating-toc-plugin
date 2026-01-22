<script lang="ts">
  import { onMount, onDestroy, afterUpdate } from "svelte";

  export let plugin: any;
  // This is the DOM element of the protyle instance this TOC belongs to
  export let targetElement: HTMLElement;

  let headings: any[] = [];
  let visible = true;

  export const toggle = () => {
      visible = !visible;
  };

  let currentDocId = "";
  let container: HTMLElement;

  // Docking state
  let isPinned = false;
  let dockSide: 'left' | 'right' = 'right';
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

  const updatePosition = () => {
      if (!targetElement || !document.contains(targetElement)) return;
      
      const content = targetElement.querySelector('.protyle-content') as HTMLElement;
      if (!content) return;
      
      const wysiwyg = targetElement.querySelector('.protyle-wysiwyg');
      const rect = content.getBoundingClientRect();

      // Add vertical spacing
      const verticalMargin = 30;
      let top = rect.top + verticalMargin;
      let height = rect.height - (verticalMargin * 2);
      let left = 0;
      
      const resizeHandleOffset = 6; 
      let paddingNeeded = false;

      if (isExpanded && wysiwyg) {
           const wRect = wysiwyg.getBoundingClientRect();
           const currentPaddingLeft = parseFloat(content.style.paddingLeft) || 0;
           const currentPaddingRight = parseFloat(content.style.paddingRight) || 0;
           
           const gap = 0; 
           
           if (dockSide === 'left') {
               const naturalTextLeft = wRect.left - (currentPaddingLeft / 2);
               const idealLeft = naturalTextLeft - tocWidth - gap;
               const minLeft = rect.left + resizeHandleOffset;
               
               left = Math.max(minLeft, idealLeft);
               
               if (left + tocWidth > naturalTextLeft) {
                   paddingNeeded = true;
               } else {
                   paddingNeeded = false;
               }
               
           } else {
               const naturalTextRight = wRect.right + (currentPaddingRight / 2);
               const idealLeft = naturalTextRight + gap;
               const maxLeft = rect.right - tocWidth - resizeHandleOffset;
               
               left = Math.min(maxLeft, idealLeft);
               
               if (left < naturalTextRight) {
                   paddingNeeded = true;
               } else {
                   paddingNeeded = false;
               }
           }
           
       } else {
           if (dockSide === 'left') {
               left = rect.left + resizeHandleOffset;
           } else {
               left = rect.right - (isExpanded ? tocWidth : 32) - resizeHandleOffset;
           }
           paddingNeeded = false;
       }
      
      const widthStyle = isExpanded ? `width: ${tocWidth}px;` : '';
      
      // Animation optimization: use transform for smoother movement if possible, but here we update left/top.
      // To fix the "right side animation" issue, we need to ensure the transition handles the 'left' property change smoothly.
      // When expanding on the right, 'left' changes from (right_edge - 32) to (right_edge - 250).
      
      pinnedStyle = `top: ${top}px; left: ${left}px; height: ${height}px; ${widthStyle}`;
      
       if (isPinned && paddingNeeded) {
           updateEditorPadding(targetElement, tocWidth);
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
  $: if (targetElement || dockSide || isPinned || isHovering || tocWidth) {
      updatePosition();
      
      if (resizeObserver) resizeObserver.disconnect();
      if (targetElement) {
          resizeObserver = new ResizeObserver(() => {
              updatePosition();
          });
          resizeObserver.observe(targetElement);
      }
  }

  onMount(async () => {
      const savedData = await plugin.loadData("config.json");
      if (savedData) {
          isPinned = savedData.isPinned ?? false;
          dockSide = savedData.dockSide ?? 'right';
          tocWidth = savedData.tocWidth ?? 250;
      }
      
      window.addEventListener('resize', updatePosition);
      onScroll();
      updatePosition();
  });
  
  onDestroy(() => {
      window.removeEventListener('resize', updatePosition);
      removeGlobalCheck();
      if (resizeObserver) resizeObserver.disconnect();
      
      if (targetElement && appliedPadding) {
          const content = targetElement.querySelector('.protyle-content');
          if (content) {
              content.style.paddingLeft = '';
              content.style.paddingRight = '';
          }
      }
      
      if (oldContentElement) {
          oldContentElement.removeEventListener("scroll", onScroll);
      }
  });

  // Display state
  let maxDepth = 6;

  const scrollToTop = () => {
      if (targetElement) {
          const content = targetElement.querySelector(".protyle-content");
          if (content) content.scrollTop = 0;
      }
  };

  const scrollToBottom = () => {
      if (targetElement) {
          const content = targetElement.querySelector(".protyle-content");
          if (content) content.scrollTop = content.scrollHeight;
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
      plugin.saveData("config.json", { isPinned, dockSide, tocWidth });
  };

  const togglePin = () => {
      isPinned = !isPinned;
      saveData();
  };

  const toggleDockSide = () => {
      dockSide = dockSide === 'right' ? 'left' : 'right';
      saveData();
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

  export const updateHeadings = async (docId: string, protyle: any) => {
    if (!docId) return;
    currentDocId = docId;
    const response = await fetch("/api/outline/getDocOutline", {
      method: "POST",
      body: JSON.stringify({ id: docId }),
    });
    const result = await response.json();
    if (result.code === 0) {
      headings = flattenHeadings(result.data || []);
    }
  };

  const flattenHeadings = (data: any[]) => {
    const flat: any[] = [];
    
    const traverse = (items: any[], level: number) => {
        if (!items) return;
        items.forEach(item => {
            let rawContent = item.content || item.name || "Untitled";
            let content = getPlainText(rawContent);
            
            const children = item.children || item.blocks || [];
            let depth = item.depth;
            if (item.subType && item.subType.startsWith('h')) {
                depth = parseInt(item.subType.substring(1));
            } else if (item.subtype && item.subtype.startsWith('h')) {
                 depth = parseInt(item.subtype.substring(1));
            }

            flat.push({
                id: item.id,
                content: content,
                depth: depth || level,
                subType: item.subType || item.subtype
            });
            
            traverse(children, (depth || level) + 1);
        });
    };

    traverse(data, 1);
    return flat;
  };

  const handleClick = (heading: any) => {
    // 修复：光标所在行会导致DOM改变，导致无法定位到正确的标题
    // 需要先把光标清理了再进行定位
    if (window.getSelection()) {
        window.getSelection().removeAllRanges();
    }
    if (document.activeElement && document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }

    if (heading.id === currentDocId) {
         if (targetElement) {
             const title = targetElement.querySelector(".protyle-title");
             if (title) {
                 title.scrollIntoView({ behavior: "smooth", block: "center" });
                 title.classList.add("protyle-wysiwyg--select");
                 setTimeout(() => title.classList.remove("protyle-wysiwyg--select"), 2000);
             } else {
                 const editor = targetElement.querySelector(".protyle-content");
                 if (editor) editor.scrollTop = 0;
             }
         }
         return;
    }

    let target: HTMLElement | null = null;
    
    if (targetElement && document.contains(targetElement)) {
        target = targetElement.querySelector(`[data-node-id="${heading.id}"]`);
    } 
    
    if (target) {
        if (target.classList.contains("protyle-wysiwyg") || target.classList.contains("protyle-content")) {
             return; 
        }

        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("protyle-wysiwyg--select");
        setTimeout(() => {
            target.classList.remove("protyle-wysiwyg--select");
        }, 2000);
    }
  };


  let activeHeadingId = "";
  let scrollTimer: any = null;

  const onScroll = () => {
      if (scrollTimer) return;
      if (headings.length === 0) return; // Optimization: don't query if no headings
      
      scrollTimer = requestAnimationFrame(() => {
          scrollTimer = null;
          if (!targetElement) return;
          
          const contentElement = targetElement.querySelector(".protyle-content");
          if (!contentElement) return;
    
          const headingElements = Array.from(contentElement.querySelectorAll('[data-type="NodeHeading"]'));
          
          let currentActiveId = "";
          const contentRect = contentElement.getBoundingClientRect();
          const topOffset = contentRect.top + 100;
    
          for (const el of headingElements) {
              const rect = (el as HTMLElement).getBoundingClientRect();
              if (rect.top <= topOffset) {
                  currentActiveId = (el as HTMLElement).getAttribute("data-node-id") || "";
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

  $: if (targetElement) {
      const contentElement = targetElement.querySelector(".protyle-content");
      if (contentElement) {
          contentElement.addEventListener("scroll", onScroll, { passive: true });
      }
  }

  let oldContentElement: Element | null = null;
  
  afterUpdate(() => {
      if (targetElement) {
          const newContentElement = targetElement.querySelector(".protyle-content");
          if (newContentElement !== oldContentElement) {
              if (oldContentElement) {
                  oldContentElement.removeEventListener("scroll", onScroll);
              }
              if (newContentElement) {
                  newContentElement.addEventListener("scroll", onScroll, { passive: true });
                  oldContentElement = newContentElement;
              }
          }
      }
  });
</script>

{#if visible && headings.length > 0}
  <div
    class="floating-toc {isPinned ? 'pinned ' + dockSide : (isExpanded ? 'expanded ' + dockSide : 'collapsed ' + dockSide)}"
    style={pinnedStyle}
    bind:this={container}
    on:mouseenter={onMouseEnter}
    on:mouseleave={onMouseLeave}
    role="region"
    aria-label="Floating Table of Contents"
  >
      {#if isExpanded}
      <!-- Resize Handle -->
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
          <button class="scroll-btn" on:click={scrollToTop} title="Scroll to Top" aria-label="Scroll to Top">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M13,20H11V8L5.5,13.5L4.08,12.08L12,4.08L19.92,12.08L18.5,13.5L13,8V20Z" /></svg>
          </button>
          <button class="scroll-btn" on:click={scrollToBottom} title="Scroll to Bottom" aria-label="Scroll to Bottom">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M13,4H11V16L5.5,10.5L4.08,12L12,20L19.92,12L18.5,10.5L13,16V4Z" /></svg>
          </button>
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
            {#each headings as heading}
            {#if heading.depth <= maxDepth}
            <div
                class="toc-item level-{heading.depth}"
                class:active={heading.id === activeHeadingId}
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
        </div>
      </div>
    {:else}
      <!-- Collapsed State: Mini-map with strips -->
       <div class="collapsed-strip" class:right={dockSide==='right'}>
           <div class="strip-content">
               {#each headings as heading}
                   <div 
                       class="strip-item"
                       class:active={heading.id === activeHeadingId}
                       data-id={heading.id}
                       style="width: {100 - (heading.depth - 1) * 10}%;"
                       on:click|stopPropagation={() => handleClick(heading)}
                       on:keydown|stopPropagation={(e) => e.key === 'Enter' && handleClick(heading)}
                       title={heading.content}
                       role="button"
                       tabindex="0"
                   ></div>
               {/each}
           </div>
       </div>
    {/if}
  </div>
{/if}

<style>
  .floating-toc {
    position: fixed;
    z-index: 10; 
    display: flex;
    flex-direction: column;
    font-family: var(--b3-font-family);
    transition: width 0.2s ease, opacity 0.2s ease, left 0.2s ease, right 0.2s ease;
    gap: 4px; /* Gap between scroll toolbar and panel */
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
  }
  
  /* Update pinned styles */
  .floating-toc.pinned .toc-panel {
      border-radius: 8px;
      box-shadow: none;
      border: 1px solid var(--b3-theme-border);
      background: var(--b3-theme-background);
  }
  
  /* Scroll Toolbar Styles */
  .scroll-toolbar {
      display: flex;
      flex-direction: row;
      justify-content: center;
      gap: 8px;
      padding: 2px;
      flex-shrink: 0;
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
      transition: all 0.2s;
  }
  
  .scroll-btn:hover {
      background: var(--b3-theme-surface-light);
      color: var(--b3-theme-on-surface);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }
  
  /* Collapsed state adjustments */
  .floating-toc.collapsed .scroll-toolbar {
      flex-direction: column; /* Stack buttons when collapsed */
      align-items: center;
      gap: 4px;
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

  /* Collapsed State Panel */
  .floating-toc.collapsed .toc-panel {
      background: transparent;
      border: none;
      box-shadow: none;
  }
  
  /* Collapsed State */
  .floating-toc.collapsed {
      width: 32px !important; /* Slightly wider for strips (24 -> 32) */
      opacity: 0.8;
      background: transparent;
      border: none;
      box-shadow: none;
      cursor: pointer;
  }
  
  .floating-toc.collapsed:hover {
      opacity: 1;
  }
  
  .collapsed-strip {
      flex: 1;
      width: 100%;
      overflow-y: auto; /* Allow scrolling in collapsed mode */
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px 0 8px 0; /* Adjusted top padding (80 -> 60) to account for toolbar */
      scrollbar-width: none; /* Hide scrollbar */
  }
  
  .collapsed-strip::-webkit-scrollbar {
      display: none;
  }
  
  .strip-content {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center; /* Center strips */
      gap: 14px; /* Further increased gap (10 -> 14) */
  }
  
  .strip-item {
      height: 4px; /* Slightly thicker */
      background-color: var(--b3-theme-on-surface-light);
      border-radius: 2px;
      opacity: 0.5;
      cursor: pointer;
      transition: all 0.2s;
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
  }

  /* Expanded / Pinned State */
  .floating-toc.expanded, .floating-toc.pinned {
      /* Width handled by inline style */ 
  }
  
  .resize-handle {
       position: absolute;
       top: 0;
       bottom: 0;
       width: 4px; /* Reduced visual width as requested */
       cursor: col-resize;
       z-index: 1000;
       background: transparent;
       transition: background 0.2s;
   }
  
  .resize-handle:hover, .resize-handle:active {
      background: var(--b3-theme-on-surface-light);
      opacity: 0.3;
  }
  
  .resize-handle.left { left: 0; }
  .resize-handle.right { right: 0; }

  .toc-header {
    padding: 8px 12px;
    background: var(--b3-theme-background-light);
    border-bottom: 1px solid var(--b3-theme-border);
    cursor: default;
    display: flex;
    /* justify-content: space-between; Removed to allow centering or flex-start */
    justify-content: center; /* Center the toolbar */
    align-items: center;
    font-weight: bold;
    user-select: none;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
  }
  
  .floating-toc.pinned .toc-header {
      cursor: default;
  }
  
  .header-actions {
      display: flex;
      align-items: center;
      gap: 8px; /* Increased gap for better touch targets */
      width: 100%;
      justify-content: space-between; /* Spread icons evenly */
  }
  
  .action-btn {
      background: transparent;
      border: none;
      cursor: pointer;
      color: var(--b3-theme-on-surface-light);
      padding: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
  }
  
  .action-btn:hover {
      background: var(--b3-theme-surface-light);
      color: var(--b3-theme-on-surface);
  }

  .toc-content {
    overflow-y: auto;
    padding: 8px 0;
    flex: 1;
  }

  .toc-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px 6px 0; /* Left padding handled by level class */
    cursor: pointer;
    font-size: 14px;
    color: var(--b3-theme-on-surface);
    line-height: 1.5;
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
  }

  .toc-item:hover {
    background: var(--b3-theme-background-light);
  }

  .toc-item.active {
    background: var(--b3-theme-background-light);
    color: var(--b3-theme-primary);
    border-left-color: var(--b3-theme-primary);
    font-weight: 500;
  }

  .toc-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 8px;
  }

  .toc-badge {
    font-size: 10px;
    color: var(--b3-theme-on-surface-light);
    background: var(--b3-theme-surface-light);
    padding: 1px 4px;
    border-radius: 4px;
    flex-shrink: 0;
    opacity: 0.6;
  }
  
  .toc-item:hover .toc-badge {
    opacity: 1;
  }

  .level-1 { padding-left: 12px; }
  .level-2 { padding-left: 24px; }
  .level-3 { padding-left: 36px; }
  .level-4 { padding-left: 48px; }
  .level-5 { padding-left: 60px; }
  .level-6 { padding-left: 72px; }
  
  /* Add subtle indentation guides */
  .toc-item {
    position: relative;
  }
  
  /* We can add vertical lines with pseudo-elements if needed, 
     but simple indentation is cleaner for now as per Obsidian style */
</style>