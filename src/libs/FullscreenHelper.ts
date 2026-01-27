import type { Plugin } from "siyuan";
import type { FullscreenConfig } from "../types";

export type { FullscreenConfig as FullscreenHelperConfig };

type ChartType = 'mermaid' | 'echarts' | 'sheetmusic' | 'graphviz' | 'flowchart' | 'iframe';

interface RestoreInfo {
    element: HTMLElement;
    parent: HTMLElement;
    nextSibling: Node | null;
    placeholder: HTMLElement;
    originalStyles: {
        width: string;
        height: string;
        maxWidth: string;
        maxHeight: string;
        transform: string;
        transformOrigin: string;
    };
    originalAttributes?: {
        scrolling?: string | null;
    };
}

interface PanZoomState {
    scale: number;
    translateX: number;
    translateY: number;
    isDragging: boolean;
    startX: number;
    startY: number;
}

export class FullscreenHelper {
    private plugin: Plugin;
    private mutationObserver: MutationObserver | null = null;
    private fullscreenContainer: HTMLElement | null = null;
    private config: FullscreenConfig;
    private elementCleanups = new Map<HTMLElement, () => void>();
    private debounceTimer: number | null = null;
    private restoreInfo: RestoreInfo | null = null;
    private panZoomState: PanZoomState = {
        scale: 1,
        translateX: 0,
        translateY: 0,
        isDragging: false,
        startX: 0,
        startY: 0
    };

    constructor(plugin: Plugin, config?: Partial<FullscreenConfig>) {
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
            enableRightClickExit: true,
            buttonPosition: "top-left",
            ...config
        };
    }

    public updateConfig(config: Partial<FullscreenConfig>) {
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
        let portalBtn: HTMLElement | null = null;
        const cleanupFns: (() => void)[] = [...extraCleanups];

        const removeButton = () => {
            if (portalBtn) {
                portalBtn.remove();
                portalBtn = null;
            }
        };

        const showButton = () => {
            if (portalBtn) return;
            
            portalBtn = document.createElement('div');
            portalBtn.className = 'fullscreen-helper-portal-btn b3-tooltips b3-tooltips__sw';
            portalBtn.setAttribute('aria-label', (this.plugin.i18n.fullscreen || 'Fullscreen') + ' (Shift+Click Block)');
            portalBtn.innerHTML = `<svg><use xlink:href="#iconFullscreen"></use></svg>`;
            
            // 只保留位置相关的内联样式（因为需要动态计算）
            const rect = container.getBoundingClientRect();
            portalBtn.style.top = `${rect.top + 8}px`;
            portalBtn.style.left = `${rect.right - 32}px`;

            portalBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                this.enterFullscreen(container, type);
                removeButton();
            });
            
            window.addEventListener('scroll', removeButton, { once: true, capture: true });
            document.body.appendChild(portalBtn);
        };

        const onMouseEnter = () => showButton();
        const onMouseLeave = (e: MouseEvent) => {
            if (e.relatedTarget === portalBtn || (portalBtn && portalBtn.contains(e.relatedTarget as Node))) {
                return;
            }
            removeButton();
        };

        container.addEventListener('mouseenter', onMouseEnter);
        container.addEventListener('mouseleave', onMouseLeave);

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

    private enterFullscreen(sourceElement: HTMLElement, type: string) {
        this.fullscreenContainer = document.createElement('div');
        this.fullscreenContainer.className = 'fullscreen-helper-overlay';
        this.fullscreenContainer.tabIndex = -1;
        
        // 自适应背景色
        const adaptiveBg = this.getAdaptiveBackground(sourceElement);
        this.fullscreenContainer.style.backgroundColor = adaptiveBg;
        this.fullscreenContainer.setAttribute('data-bg', 'adaptive');

        // 创建工具栏
        const toolbar = this.createToolbar(type);
        this.fullscreenContainer.appendChild(toolbar);

        // 创建内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'fullscreen-helper-content';
        
        const styleWrapper = document.createElement('div');
        styleWrapper.className = 'protyle-wysiwyg b3-typography fullscreen-helper-style-wrapper';
        
        // 查找要移动的元素
        const elementToMove = this.findElementToMove(sourceElement, type);

        if (elementToMove && elementToMove.parentElement) {
            this.setupRestoreInfo(elementToMove, type);
            styleWrapper.appendChild(elementToMove);
            this.applyFullscreenStyles(elementToMove, type);
            
            if (type === 'echarts') {
                setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
            } else if (type !== 'iframe') {
                this.resetZoomState();
                this.setupPanZoom(elementToMove, styleWrapper);
            }

            contentContainer.appendChild(styleWrapper);
        } else {
            contentContainer.textContent = "Content not found or not supported for interactive fullscreen.";
            contentContainer.style.color = "var(--b3-theme-on-surface)";
        }

        this.fullscreenContainer.appendChild(contentContainer);
        document.body.appendChild(this.fullscreenContainer);
        this.fullscreenContainer.focus();

        document.addEventListener('keydown', this.handleEsc);
        
        // 添加右键退出监听
        if (this.config.enableRightClickExit) {
            this.fullscreenContainer.addEventListener('contextmenu', this.handleRightClick);
        }
    }
    
    private getAdaptiveBackground(sourceElement: HTMLElement): string {
        try {
            let el: HTMLElement | null = sourceElement;
            while (el && el !== document.body) {
                const style = window.getComputedStyle(el);
                const bg = style.backgroundColor;
                if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                    return bg;
                }
                el = el.parentElement;
            }
        } catch (e) {
            console.warn("Failed to get adaptive background", e);
        }
        return 'var(--b3-theme-background)';
    }
    
    private createToolbar(type: string): HTMLElement {
        const toolbar = document.createElement('div');
        toolbar.className = 'fullscreen-helper-toolbar';
        
        let isHoveringToolbar = false;
        toolbar.addEventListener('mouseenter', () => isHoveringToolbar = true);
        toolbar.addEventListener('mouseleave', () => isHoveringToolbar = false);

        // 工具栏自动隐藏逻辑
        this.fullscreenContainer!.addEventListener('mousemove', (e) => {
            toolbar.classList.toggle('visible', e.clientY < 60 || isHoveringToolbar);
        });

        // 缩放控件（非 ECharts 和 IFrame）
        if (type !== 'echarts' && type !== 'iframe') {
            const zoomControls = this.createZoomControls();
            toolbar.appendChild(zoomControls);
        }

        // 关闭按钮
        const closeBtn = this.createCloseButton();
        toolbar.appendChild(closeBtn);

        return toolbar;
    }
    
    private createZoomControls(): HTMLElement {
        const zoomControls = document.createElement('div');
        zoomControls.className = 'fullscreen-helper-zoom-controls';
        
        const createBtn = (icon: string, action: () => void, title: string) => {
            const btn = document.createElement('div');
            btn.className = 'fullscreen-helper-zoom-btn';
            btn.title = title;
            btn.innerHTML = `<svg><use xlink:href="#${icon}"></use></svg>`;
            btn.onclick = action;
            return btn;
        };

        zoomControls.appendChild(createBtn('iconAdd', () => this.handleZoom(0.1), 'Zoom In'));
        zoomControls.appendChild(createBtn('iconMin', () => this.handleZoom(-0.1), 'Zoom Out'));
        zoomControls.appendChild(createBtn('iconRefresh', () => this.resetZoom(), 'Reset Zoom'));
        
        const sep = document.createElement('div');
        sep.className = 'fullscreen-helper-separator';
        zoomControls.appendChild(sep);

        return zoomControls;
    }
    
    private createCloseButton(): HTMLElement {
        const closeBtn = document.createElement('div');
        closeBtn.className = 'fullscreen-helper-close';
        closeBtn.title = "Close (Esc)";
        closeBtn.innerHTML = '<svg><use xlink:href="#iconCloseRound"></use></svg>';
        closeBtn.onclick = () => this.exitFullscreen();
        return closeBtn;
    }
    
    private findElementToMove(sourceElement: HTMLElement, type: string): HTMLElement | null {
        const findSvg = (filter?: (svg: SVGSVGElement) => boolean) => {
            const svgs = Array.from(sourceElement.querySelectorAll('svg'));
            return svgs.find(svg => {
                const parent = svg.parentElement;
                if (parent?.classList.contains('protyle-icon') || 
                    parent?.classList.contains('b3-tooltips') ||
                    parent?.classList.contains('fullscreen-helper-btn')) {
                    return false;
                }
                return filter ? filter(svg) : true;
            }) as HTMLElement || null;
        };

        switch (type) {
            case 'mermaid':
                const mermaidSvg = Array.from(sourceElement.querySelectorAll('svg'))
                    .find(svg => svg.id?.startsWith('mermaid')) as HTMLElement;
                return mermaidSvg || findSvg();
            
            case 'echarts':
                return sourceElement.querySelector('div[_echarts_instance_]') as HTMLElement;
            
            case 'graphviz':
            case 'flowchart':
                return findSvg() || sourceElement.querySelector('img') as HTMLElement;
            
            case 'iframe':
                return sourceElement.querySelector('iframe') as HTMLElement;
            
            default:
                return findSvg() || sourceElement.querySelector('.abcjs-container') as HTMLElement;
        }
    }
    
    private setupRestoreInfo(element: HTMLElement, type: string) {
        const placeholder = document.createElement('div');
        placeholder.style.width = element.style.width || element.clientWidth + 'px';
        placeholder.style.height = element.style.height || element.clientHeight + 'px';
        placeholder.style.display = getComputedStyle(element).display;
        
        this.restoreInfo = {
            element,
            parent: element.parentElement!,
            nextSibling: element.nextSibling,
            placeholder,
            originalStyles: {
                width: element.style.width,
                height: element.style.height,
                maxWidth: element.style.maxWidth,
                maxHeight: element.style.maxHeight,
                transform: element.style.transform,
                transformOrigin: element.style.transformOrigin
            }
        };

        if (type === 'iframe') {
            this.restoreInfo.originalAttributes = {
                scrolling: element.getAttribute('scrolling')
            };
        }

        this.restoreInfo.parent.insertBefore(placeholder, element);
    }
    
    private applyFullscreenStyles(element: HTMLElement, type: string) {
        if (type === 'iframe') {
            element.style.width = '100%';
            element.style.height = '100%';
            element.style.maxWidth = '100%';
            element.style.maxHeight = '100%';
            element.style.border = 'none';
            element.setAttribute('scrolling', 'auto');
            element.style.overflow = 'auto';
        } else {
            element.style.width = 'auto';
            element.style.height = 'auto';
            element.style.maxWidth = '100%';
            element.style.maxHeight = '100%';
        }
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

    private handleRightClick = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.exitFullscreen();
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
