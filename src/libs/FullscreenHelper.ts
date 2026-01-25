import type { Plugin } from "siyuan";

export interface FullscreenHelperConfig {
    enableFullscreenHelper: boolean;
    enableMermaid: boolean;
    enableECharts: boolean;
    enableSheetMusic: boolean;
    enableGraphviz: boolean;
    enableFlowchart: boolean;
    enableIFrame: boolean;
    enableDoubleClick: boolean;
    buttonPosition: "top-right" | "top-left";
}

export class FullscreenHelper {
    private plugin: Plugin;
    private mutationObserver: MutationObserver | null = null;
    private fullscreenContainer: HTMLElement | null = null;
    private config: FullscreenHelperConfig;
    // Map to store cleanup functions for each processed element to prevent memory leaks
    private elementCleanups = new Map<HTMLElement, () => void>();
    private debounceTimer: number | null = null;

    constructor(plugin: Plugin, config?: Partial<FullscreenHelperConfig>) {
        this.plugin = plugin;
        this.config = {
            enableFullscreenHelper: true,
            enableMermaid: true,
            enableECharts: true,
            enableSheetMusic: true,
            enableGraphviz: true,
            enableFlowchart: true,
            enableIFrame: true,
            enableDoubleClick: true,
            buttonPosition: "top-left",
            ...config
        };
    }

    public updateConfig(config: Partial<FullscreenHelperConfig>) {
        this.config = { ...this.config, ...config };
        
        // If disabled globally, clean up everything
        if (!this.config.enableFullscreenHelper) {
            this.cleanupAll();
            return;
        }

        // Re-scan to apply changes (e.g. if enabled status changed)
        // For disabled types, we might want to remove existing buttons, but that's complex.
        // For now, just scanning again will add buttons if they are missing and enabled.
        this.scanAllChartElements();
    }

    public init(): void {
        if (!this.config.enableFullscreenHelper) return;

        this.scanAllChartElements();
        
        this.mutationObserver = new MutationObserver((mutations) => {
            if (!this.config.enableFullscreenHelper) return;

            let shouldScan = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    shouldScan = true;
                    break;
                }
                if (mutation.type === 'attributes' && (
                    mutation.attributeName === 'data-subtype' || 
                    mutation.attributeName === 'data-render' ||
                    mutation.attributeName === 'data-type' ||
                    mutation.attributeName === '_echarts_instance_'
                )) {
                    shouldScan = true;
                    break;
                }
            }
            if (shouldScan) {
                this.debouncedScan();
            }
        });

        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-subtype', 'data-render', 'data-type', '_echarts_instance_']
        });
    }

    private debouncedScan() {
        if (this.debounceTimer) {
            window.clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = window.setTimeout(() => {
            this.scanAllChartElements();
            this.debounceTimer = null;
        }, 200);
    }

    public destroy(): void {
        this.mutationObserver?.disconnect();
        this.cleanupAll();
        this.exitFullscreen();
    }

    private cleanupAll() {
        this.elementCleanups.forEach(cleanup => cleanup());
        this.elementCleanups.clear();
        document.querySelectorAll('.fullscreen-helper-btn-container').forEach(el => el.remove());
    }

    private scanAllChartElements(): void {
        if (!this.config.enableFullscreenHelper) return;

        if (this.config.enableMermaid) {
            this.processElements('div[data-subtype="mermaid"]', 'mermaid');
        }
        if (this.config.enableECharts) {
            this.processElements('div[data-subtype="echarts"]', 'echarts');
            // Also scan for echarts instances that might not have data-subtype
            const echartsInstances = document.querySelectorAll('div[_echarts_instance_]');
            echartsInstances.forEach((element) => {
                if (!(element instanceof HTMLElement)) return;
                
                // Find the render-node container
                const container = element.closest('.render-node') as HTMLElement;
                if (!container) return;

                // Check if this is actually a mindmap
                if (container.getAttribute('data-subtype') === 'mindmap') {
                    return; // Skip mindmaps here, they are handled separately
                }

                if (this.elementCleanups.has(container)) return;

                this.addButton(container, 'echarts');
            });
        }
        if (this.config.enableSheetMusic) {
             this.processElements('.abcjs-container', 'sheetmusic');
             this.processElements('div[data-subtype="abc"]', 'sheetmusic'); 
        }
        if (this.config.enableGraphviz) {
             this.processElements('div[data-subtype="graphviz"]', 'graphviz');
        }
        if (this.config.enableFlowchart) {
             this.processElements('div[data-subtype="flowchart"]', 'flowchart');
        }
        if (this.config.enableIFrame) {
             // 1. Scan for div[data-type="NodeIFrame"] (Primary SiYuan IFrame Blocks)
             const nodeIframes = document.querySelectorAll('div[data-type="NodeIFrame"]');
             nodeIframes.forEach(container => {
                 if (!(container instanceof HTMLElement)) return;
                 if (this.elementCleanups.has(container)) return;
                 
                 const iframe = container.querySelector('iframe');
                 if (iframe) {
                     this.addIFrameButton(container, 'iframe');
                 }
             });

             // 2. Scan for other iframes using a combined selector to reduce DOM queries
             const otherIframes = document.querySelectorAll('div.render-node iframe, .protyle-wysiwyg__embed iframe, .protyle-html iframe');
             otherIframes.forEach(iframe => {
                 if (!(iframe instanceof HTMLElement)) return;
                 
                 let container = iframe.closest('.render-node') as HTMLElement;
                 if (!container) container = iframe.closest('.protyle-wysiwyg__embed') as HTMLElement;
                 if (!container) container = iframe.closest('.protyle-html') as HTMLElement;
                 
                 if (container && !this.elementCleanups.has(container)) {
                     this.addIFrameButton(container, 'iframe');
                 }
             });
        }
    }

    private addIFrameButton(container: HTMLElement, type: string) {
        if (this.elementCleanups.has(container)) return;
        
        const extraCleanups: (() => void)[] = [];
        const iframe = container.querySelector('iframe');
        
        // Fix: Force scrolling on IFrame in normal mode if it's disabled
        if (iframe) {
            const originalScrolling = iframe.getAttribute('scrolling');
            if (originalScrolling === 'no') {
                iframe.setAttribute('scrolling', 'auto');
                // Also force style overflow just in case
                const originalOverflow = iframe.style.overflow;
                iframe.style.overflow = 'auto';
                
                extraCleanups.push(() => {
                    if (originalScrolling) {
                        iframe.setAttribute('scrolling', originalScrolling);
                    } else {
                        // If it was null? but we checked === 'no', so it wasn't null.
                        // Wait, getAttribute returns string | null. 'no' is string.
                        iframe.setAttribute('scrolling', 'no');
                    }
                    iframe.style.overflow = originalOverflow;
                });
            }
        }

        this.addButton(container, type, extraCleanups);
    }

    private processElements(selector: string, type: string) {
        const elements = document.querySelectorAll(selector);
        elements.forEach((element) => {
            if (!(element instanceof HTMLElement)) return;
            
            let container: HTMLElement | null = null;
            if (type === 'iframe' && selector.includes('iframe')) {
                 container = element.closest('.render-node') as HTMLElement;
                 if (!container) container = element.closest('.protyle-wysiwyg__embed') as HTMLElement;
                 if (!container) container = element.closest('.protyle-html') as HTMLElement;
                 if (!container) container = element.closest('.iframe-content') as HTMLElement;
                 if (!container) container = element.closest('div.iframe') as HTMLElement;
            } else {
                 container = element.closest('.render-node') as HTMLElement;
            }

            if (!container || this.elementCleanups.has(container)) return;
            
            this.addButton(container, type); 
        });
    }

    private addButton(container: HTMLElement, type: string, extraCleanups: (() => void)[] = []) {
        if (this.elementCleanups.has(container)) return;

        // console.log("FullscreenHelper: Adding button to container", container, type);
        // For NodeIFrame, we use a different approach: Portal Button (Append to body)
        const isNodeIFrame = container.getAttribute('data-type') === 'NodeIFrame';
        
        if (isNodeIFrame) {
             this.setupPortalButton(container, type, extraCleanups);
             return;
        }

        // Standard logic for other elements...
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        const cleanupFns: (() => void)[] = [...extraCleanups];

        // Add Double Click listener
        const dblClickHandler = (e: MouseEvent) => {
            if (this.config.enableDoubleClick) {
                 this.enterFullscreen(container, type);
            }
        };
        container.addEventListener('dblclick', dblClickHandler);
        cleanupFns.push(() => container.removeEventListener('dblclick', dblClickHandler));

        const btnContainer = document.createElement('div');
        btnContainer.className = `fullscreen-helper-btn-container`;
        btnContainer.style.zIndex = '30'; 
        
        if (this.config.buttonPosition === 'top-left') {
            btnContainer.classList.add('left');
        } else {
            btnContainer.classList.add('right');
            // Just-in-Time Positioning: Calculate position on hover
            const mouseEnterHandler = () => {
                const icons = container.querySelector('.protyle-icons');
                if (icons) {
                    const iconsWidth = icons.clientWidth;
                    if (iconsWidth > 0) {
                        btnContainer.style.right = `${iconsWidth + 16}px`;
                    } else {
                        if (type === 'echarts') btnContainer.style.right = '80px';
                        else btnContainer.style.right = '58px';
                    }
                } else {
                     btnContainer.style.right = '48px';
                }
            };
            container.addEventListener('mouseenter', mouseEnterHandler);
            cleanupFns.push(() => container.removeEventListener('mouseenter', mouseEnterHandler));
        }
        
        const btn = document.createElement('div');
        btn.className = 'fullscreen-helper-btn b3-tooltips b3-tooltips__sw';
        btn.setAttribute('aria-label', this.plugin.i18n.fullscreen || 'Fullscreen');
        btn.innerHTML = `<svg><use xlink:href="#iconFullscreen"></use></svg>`;
        
        const clickHandler = (e: MouseEvent) => {
            e.stopPropagation();
            e.preventDefault();
            this.enterFullscreen(container, type);
        };
        btn.addEventListener('click', clickHandler);
        // No need to cleanup btn listener as btn will be removed

        btnContainer.appendChild(btn);
        container.appendChild(btnContainer);

        cleanupFns.push(() => btnContainer.remove());

        this.elementCleanups.set(container, () => {
            cleanupFns.forEach(fn => fn());
        });
    }

    private setupPortalButton(container: HTMLElement, type: string, extraCleanups: (() => void)[] = []) {
        // Create a portal button that is appended to body on hover
        let portalBtn: HTMLElement | null = null;
        const cleanupFns: (() => void)[] = [...extraCleanups];

        const removeButton = () => {
            if (portalBtn) {
                portalBtn.remove();
                portalBtn = null;
            }
        };

        const showButton = () => {
            if (portalBtn) return; // Already showing
            
            portalBtn = document.createElement('div');
            portalBtn.className = 'fullscreen-helper-btn b3-tooltips b3-tooltips__sw';
            portalBtn.setAttribute('aria-label', (this.plugin.i18n.fullscreen || 'Fullscreen') + ' (Shift+Click Block)');
            portalBtn.innerHTML = `<svg><use xlink:href="#iconFullscreen"></use></svg>`;
            
            // Style it to be fixed/absolute on top of the container
            portalBtn.style.position = 'fixed';
            portalBtn.style.zIndex = '1000';
            portalBtn.style.width = '24px';
            portalBtn.style.height = '24px';
            portalBtn.style.cursor = 'pointer';
            portalBtn.style.color = 'var(--b3-theme-on-surface)';
            portalBtn.style.background = 'var(--b3-theme-surface)';
            portalBtn.style.borderRadius = '4px';
            portalBtn.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
            portalBtn.style.display = 'flex';
            portalBtn.style.alignItems = 'center';
            portalBtn.style.justifyContent = 'center';
            
            // Calculate position
            const rect = container.getBoundingClientRect();
            // Position at top-right of the block
            portalBtn.style.top = `${rect.top + 8}px`;
            portalBtn.style.left = `${rect.right - 32}px`; // 32px from right edge

            portalBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.enterFullscreen(container, type);
                removeButton();
            });
            
            // If user scrolls, we should remove.
            window.addEventListener('scroll', removeButton, { once: true, capture: true });

            document.body.appendChild(portalBtn);
        };

        const onMouseEnter = () => showButton();
        const onMouseLeave = (e: MouseEvent) => {
             // Check if moving to the button itself
             if (e.relatedTarget === portalBtn || (portalBtn && portalBtn.contains(e.relatedTarget as Node))) {
                 return;
             }
             removeButton();
        };

        container.addEventListener('mouseenter', onMouseEnter);
        container.addEventListener('mouseleave', onMouseLeave);

        // Shift + Click listener on container
        const onShiftClick = (e: MouseEvent) => {
             if (e.shiftKey) {
                 e.preventDefault();
                 e.stopPropagation();
                 this.enterFullscreen(container, type);
             }
        };
        container.addEventListener('click', onShiftClick, true);

        cleanupFns.push(() => {
            container.removeEventListener('mouseenter', onMouseEnter);
            container.removeEventListener('mouseleave', onMouseLeave);
            container.removeEventListener('click', onShiftClick, true);
            removeButton();
        });

        this.elementCleanups.set(container, () => {
            cleanupFns.forEach(fn => fn());
        });
    }

    private restoreInfo: {
        element: HTMLElement;
        parent: HTMLElement;
        nextSibling: Node | null;
        placeholder: HTMLElement;
        originalStyles: {
            width: string;
            height: string;
            maxWidth: string;
            maxHeight: string;
            transform: string; // Restore transform
            transformOrigin: string; // Restore transformOrigin
        };
        originalAttributes?: {
            scrolling?: string | null;
        };
    } | null = null;

    private panZoomState: {
        scale: number;
        translateX: number;
        translateY: number;
        isDragging: boolean;
        startX: number;
        startY: number;
    } = {
        scale: 1,
        translateX: 0,
        translateY: 0,
        isDragging: false,
        startX: 0,
        startY: 0
    };

    private enterFullscreen(sourceElement: HTMLElement, type: string) {
        this.fullscreenContainer = document.createElement('div');
        this.fullscreenContainer.className = 'fullscreen-helper-overlay';
        this.fullscreenContainer.tabIndex = -1; // Make it focusable
        
        // Adaptive background: Try to get the background color from the source or its parents
        let adaptiveBg = 'var(--b3-theme-background)';
        try {
             // Find a parent with a non-transparent background
             let el: HTMLElement | null = sourceElement;
             while (el && el !== document.body) {
                 const style = window.getComputedStyle(el);
                 const bg = style.backgroundColor;
                 if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                     adaptiveBg = bg;
                     break;
                 }
                 el = el.parentElement;
             }
        } catch (e) {
            console.warn("Failed to get adaptive background", e);
        }
        
        // Set initial background
        this.fullscreenContainer.style.backgroundColor = adaptiveBg;
        this.fullscreenContainer.setAttribute('data-bg', 'adaptive');

        // Toolbar (Auto-hiding Top-Center Pill)
        const toolbar = document.createElement('div');
        toolbar.className = 'fullscreen-helper-toolbar';
        
        // Initial Style: Hidden above top
        toolbar.style.position = 'fixed';
        toolbar.style.top = '-60px'; // Hidden
        toolbar.style.left = '50%';
        toolbar.style.transform = 'translateX(-50%)';
        toolbar.style.zIndex = '10002'; // Very high
        toolbar.style.display = 'flex';
        toolbar.style.alignItems = 'center';
        toolbar.style.gap = '12px';
        toolbar.style.padding = '8px 16px';
        toolbar.style.background = 'rgba(30, 30, 30, 0.85)'; // Dark semi-transparent pill
        toolbar.style.backdropFilter = 'blur(10px)';
        toolbar.style.borderRadius = '24px'; // Pill shape
        toolbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
        toolbar.style.transition = 'top 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
        toolbar.style.pointerEvents = 'auto';

        // Auto-hide Logic
        let isHoveringToolbar = false;
        toolbar.addEventListener('mouseenter', () => isHoveringToolbar = true);
        toolbar.addEventListener('mouseleave', () => isHoveringToolbar = false);

        this.fullscreenContainer.addEventListener('mousemove', (e) => {
            if (e.clientY < 60 || isHoveringToolbar) {
                toolbar.style.top = '20px'; // Show
            } else {
                toolbar.style.top = '-60px'; // Hide
            }
        });

        // Zoom Controls (Only for SVG content)
        if (type !== 'echarts' && type !== 'iframe') {
            const zoomControls = document.createElement('div');
            zoomControls.className = 'fullscreen-helper-zoom-controls';
            zoomControls.style.display = 'flex';
            zoomControls.style.gap = '8px';
            
            const createZoomBtn = (icon: string, action: () => void, title: string) => {
                const btn = document.createElement('div');
                btn.className = 'fullscreen-helper-btn';
                btn.style.width = '32px'; // Standard size
                btn.style.height = '32px';
                btn.style.cursor = 'pointer';
                btn.style.color = '#eee';
                btn.title = title;
                btn.innerHTML = `<svg style="width:16px;height:16px;"><use xlink:href="#${icon}"></use></svg>`;
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.borderRadius = '50%';
                btn.style.transition = 'background 0.2s';
                
                btn.onmouseenter = () => btn.style.background = 'rgba(255,255,255,0.1)';
                btn.onmouseleave = () => btn.style.background = 'transparent';
                btn.onclick = action;
                return btn;
            };

            zoomControls.appendChild(createZoomBtn('iconAdd', () => this.handleZoom(0.1), 'Zoom In'));
            zoomControls.appendChild(createZoomBtn('iconMin', () => this.handleZoom(-0.1), 'Zoom Out'));
            zoomControls.appendChild(createZoomBtn('iconRefresh', () => this.resetZoom(), 'Reset Zoom'));
            
            // Separator
            const sep = document.createElement('div');
            sep.style.width = '1px';
            sep.style.height = '20px';
            sep.style.background = 'rgba(255,255,255,0.2)';
            sep.style.margin = '0 4px';
            zoomControls.appendChild(sep);

            toolbar.appendChild(zoomControls);
        }

        // Close button
        const closeBtn = document.createElement('div');
        closeBtn.className = 'fullscreen-helper-close';
        closeBtn.title = "Close (Esc)";
        closeBtn.innerHTML = '<svg style="width:18px;height:18px;"><use xlink:href="#iconCloseRound"></use></svg>';
        
        // Style as standard button inside pill
        closeBtn.style.width = '32px';
        closeBtn.style.height = '32px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.color = '#fff';
        closeBtn.style.display = 'flex';
        closeBtn.style.alignItems = 'center';
        closeBtn.style.justifyContent = 'center';
        closeBtn.style.borderRadius = '50%';
        closeBtn.style.transition = 'background 0.2s, transform 0.2s';
        
        closeBtn.onmouseenter = () => {
            closeBtn.style.background = 'rgba(255, 59, 48, 0.8)'; // Red hover for close
            closeBtn.style.transform = 'scale(1.1)';
        };
        closeBtn.onmouseleave = () => {
            closeBtn.style.background = 'transparent';
            closeBtn.style.transform = 'scale(1)';
        };

        closeBtn.onclick = () => this.exitFullscreen();
        toolbar.appendChild(closeBtn);

        this.fullscreenContainer.appendChild(toolbar);

        // Content
        const contentContainer = document.createElement('div');
        contentContainer.className = 'fullscreen-helper-content';
        // Ensure content container fills screen absolutely to avoid flex gaps
        contentContainer.style.position = 'absolute';
        // Leave a small gap at the top (5px) to allow mouseover events to trigger the toolbar
        // This is crucial because IFrames swallow mouse events, making it impossible to trigger the toolbar if top is 0.
        contentContainer.style.top = '5px'; 
        contentContainer.style.left = '0';
        contentContainer.style.width = '100vw';
        contentContainer.style.height = 'calc(100vh - 5px)'; // Adjust height to fit
        contentContainer.style.margin = '0';
        contentContainer.style.padding = '0';
        contentContainer.style.zIndex = '0'; // Behind toolbar
        
        // Wrap content in protyle-wysiwyg and b3-typography to preserve styles
        const styleWrapper = document.createElement('div');
        styleWrapper.className = 'protyle-wysiwyg b3-typography';
        styleWrapper.style.width = '100%';
        styleWrapper.style.height = '100%';
        styleWrapper.style.display = 'flex';
        styleWrapper.style.alignItems = 'center';
        styleWrapper.style.justifyContent = 'center';
        styleWrapper.style.overflow = 'hidden'; // Ensure zoomed content doesn't overflow container but is clipped
        // Force zero padding to prevent gaps from protyle styles
        styleWrapper.style.setProperty('padding', '0', 'important');
        styleWrapper.style.setProperty('margin', '0', 'important');
        
        // Find the actual interactive element to move
        let elementToMove: HTMLElement | null = null;
        
        if (type === 'mermaid') {
             // For Mermaid, we usually want the SVG, but moving just SVG might break if scripts depend on container
             // However, moving the whole render-node content might be too much.
             // Mermaid usually renders an SVG with an ID.
             const svgs = Array.from(sourceElement.querySelectorAll('svg'));
             elementToMove = svgs.find(svg => svg.id && svg.id.startsWith('mermaid')) as HTMLElement;
             if (!elementToMove) {
                 // Fallback search
                 elementToMove = svgs.find(svg => {
                    const parent = svg.parentElement;
                    if (parent?.classList.contains('protyle-icon') || 
                        parent?.classList.contains('b3-tooltips') ||
                        parent?.classList.contains('fullscreen-helper-btn')) {
                        return false;
                    }
                    return true;
                }) as HTMLElement || null;
             }
        } else if (type === 'echarts') {
            // ECharts needs its container (the div with _echarts_instance_)
            elementToMove = sourceElement.querySelector('div[_echarts_instance_]') as HTMLElement;
        } else if (type === 'graphviz' || type === 'flowchart') {
            // These types usually render as SVG or sometimes IMG (PlantUML)
            const svgs = Array.from(sourceElement.querySelectorAll('svg'));
            elementToMove = svgs.find(svg => {
                const parent = svg.parentElement;
                if (parent?.classList.contains('protyle-icon') || 
                    parent?.classList.contains('b3-tooltips') ||
                    parent?.classList.contains('fullscreen-helper-btn')) {
                    return false;
                }
                return true;
            }) as HTMLElement || null;

            if (!elementToMove) {
                // Try to find an image if SVG not found (common for PlantUML sometimes)
                elementToMove = sourceElement.querySelector('img');
            }
        } else if (type === 'iframe') {
             elementToMove = sourceElement.querySelector('iframe') as HTMLElement;
        } else {
            // Sheet music
             const svgs = Array.from(sourceElement.querySelectorAll('svg'));
             elementToMove = svgs.find(svg => {
                    const parent = svg.parentElement;
                    if (parent?.classList.contains('protyle-icon') || 
                        parent?.classList.contains('b3-tooltips') ||
                        parent?.classList.contains('fullscreen-helper-btn')) {
                        return false;
                    }
                    return true;
                }) as HTMLElement || null;
             
             // If abcjs uses a container, try to find it
             if (!elementToMove) {
                 elementToMove = sourceElement.querySelector('.abcjs-container') as HTMLElement;
             }
        }

        if (elementToMove && elementToMove.parentElement) {
            // Create placeholder
            const placeholder = document.createElement('div');
            placeholder.style.width = elementToMove.style.width || elementToMove.clientWidth + 'px';
            placeholder.style.height = elementToMove.style.height || elementToMove.clientHeight + 'px';
            placeholder.style.display = getComputedStyle(elementToMove).display;
            
            // Save restore info
            this.restoreInfo = {
                element: elementToMove,
                parent: elementToMove.parentElement,
                nextSibling: elementToMove.nextSibling,
                placeholder: placeholder,
                originalStyles: {
                    width: elementToMove.style.width,
                    height: elementToMove.style.height,
                    maxWidth: elementToMove.style.maxWidth,
                    maxHeight: elementToMove.style.maxHeight,
                    transform: elementToMove.style.transform,
                    transformOrigin: elementToMove.style.transformOrigin
                }
            };

            // Insert placeholder
            this.restoreInfo.parent.insertBefore(placeholder, elementToMove);
            
            // Move element
            styleWrapper.appendChild(elementToMove);
            
            // Apply fullscreen styles to element
            if (type === 'iframe') {
                elementToMove.style.width = '100%';
                elementToMove.style.height = '100%';
                elementToMove.style.maxWidth = '100%';
                elementToMove.style.maxHeight = '100%';
                elementToMove.style.border = 'none';
                
                // Fix: Force scrolling on IFrame in fullscreen mode
                const originalScrolling = elementToMove.getAttribute('scrolling');
                if (!this.restoreInfo.originalAttributes) {
                    this.restoreInfo.originalAttributes = {};
                }
                this.restoreInfo.originalAttributes.scrolling = originalScrolling;
                elementToMove.setAttribute('scrolling', 'auto');
                elementToMove.style.overflow = 'auto'; // Ensure CSS overflow allows scrolling
            } else {
                elementToMove.style.width = 'auto';
                elementToMove.style.height = 'auto';
                elementToMove.style.maxWidth = '100%';
                elementToMove.style.maxHeight = '100%';
            }
            
            // If ECharts, we might need to trigger resize
            if (type === 'echarts') {
                 // Give it a moment to render in new container then resize
                 setTimeout(() => {
                     // ECharts instance is attached to the dom element usually.
                     // But we can just dispatch a window resize event which ECharts usually listens to
                     window.dispatchEvent(new Event('resize'));
                 }, 50);
            } else if (type === 'iframe') {
                // IFrame usually just needs width/height 100% which is set by styles
                // No special resize needed usually
            } else {
                // Initialize Pan/Zoom for non-ECharts
                this.resetZoomState();
                this.setupPanZoom(elementToMove, styleWrapper);
            }

            contentContainer.appendChild(styleWrapper);
        } else {
            contentContainer.innerText = "Content not found or not supported for interactive fullscreen.";
            contentContainer.style.color = "var(--b3-theme-on-surface)";
        }

        this.fullscreenContainer.appendChild(contentContainer);
        document.body.appendChild(this.fullscreenContainer);
        
        // Set focus to container to catch ESC key immediately
        this.fullscreenContainer.focus();

        // Close on Esc
        document.addEventListener('keydown', this.handleEsc);
    }

    private exitFullscreen() {
        if (this.fullscreenContainer) {
            // Restore element if we moved it
            if (this.restoreInfo) {
                const { element, parent, nextSibling, placeholder, originalStyles } = this.restoreInfo;
                
                // Restore styles
                element.style.width = originalStyles.width;
                element.style.height = originalStyles.height;
                element.style.maxWidth = originalStyles.maxWidth;
                element.style.maxHeight = originalStyles.maxHeight;
                element.style.transform = originalStyles.transform;
                element.style.transformOrigin = originalStyles.transformOrigin;
                element.style.cursor = ''; // Reset cursor
                
                // Restore attributes
                if (this.restoreInfo.originalAttributes) {
                    if (this.restoreInfo.originalAttributes.scrolling !== undefined) {
                        if (this.restoreInfo.originalAttributes.scrolling === null) {
                            element.removeAttribute('scrolling');
                        } else {
                            element.setAttribute('scrolling', this.restoreInfo.originalAttributes.scrolling);
                        }
                    }
                }

                // Move back
                if (nextSibling) {
                    parent.insertBefore(element, nextSibling);
                } else {
                    parent.appendChild(element);
                }
                
                // Remove placeholder
                placeholder.remove();
                
                // Cleanup PanZoom listeners if they exist
                if ((element as any)._panZoomCleanup) {
                    (element as any)._panZoomCleanup();
                    delete (element as any)._panZoomCleanup;
                }
                
                // Trigger resize again for ECharts
                // Check if it has _echarts_instance_ attribute
                if (element.hasAttribute('_echarts_instance_')) {
                     setTimeout(() => {
                         window.dispatchEvent(new Event('resize'));
                     }, 50);
                }

                this.restoreInfo = null;
            }

            this.fullscreenContainer.remove();
            this.fullscreenContainer = null;
            document.removeEventListener('keydown', this.handleEsc);
        }
    }

    private handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            this.exitFullscreen();
        }
    }

    private setupPanZoom(element: HTMLElement, container: HTMLElement) {
        element.style.transformOrigin = 'center center';
        element.style.cursor = 'grab';
        
        const updateTransform = () => {
            element.style.transform = `translate(${this.panZoomState.translateX}px, ${this.panZoomState.translateY}px) scale(${this.panZoomState.scale})`;
        };

        // Wheel Zoom
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.handleZoom(delta);
        });

        // Drag Pan
        element.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Prevent text selection
            this.panZoomState.isDragging = true;
            this.panZoomState.startX = e.clientX - this.panZoomState.translateX;
            this.panZoomState.startY = e.clientY - this.panZoomState.translateY;
            element.style.cursor = 'grabbing';
        });

        const onMouseMove = (e: MouseEvent) => {
            if (!this.panZoomState.isDragging) return;
            this.panZoomState.translateX = e.clientX - this.panZoomState.startX;
            this.panZoomState.translateY = e.clientY - this.panZoomState.startY;
            updateTransform();
        };

        const onMouseUp = () => {
            this.panZoomState.isDragging = false;
            element.style.cursor = 'grab';
        };

        // Attach mouse move/up to window to handle dragging outside the element
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        // Cleanup listener references to remove them later
        (element as any)._panZoomCleanup = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }

    private handleZoom(delta: number) {
        if (!this.restoreInfo) return;
        const newScale = this.panZoomState.scale + delta;
        // Limit scale between 0.1 and 5
        if (newScale >= 0.1 && newScale <= 5) {
            this.panZoomState.scale = newScale;
            this.restoreInfo.element.style.transform = `translate(${this.panZoomState.translateX}px, ${this.panZoomState.translateY}px) scale(${this.panZoomState.scale})`;
        }
    }

    private resetZoom() {
        if (!this.restoreInfo) return;
        this.resetZoomState();
        this.restoreInfo.element.style.transform = `translate(0px, 0px) scale(1)`;
    }

    private resetZoomState() {
        this.panZoomState = {
            scale: 1,
            translateX: 0,
            translateY: 0,
            isDragging: false,
            startX: 0,
            startY: 0
        };
    }
}
