import { Plugin } from "siyuan";
import FloatingToc from "./FloatingToc.svelte";

export default class FloatingTocPlugin extends Plugin {
    private tocInstances: Map<HTMLElement, FloatingToc> = new Map();
    private observer: MutationObserver | undefined;

    async onload() {
        console.log("Floating TOC loaded");
        
        // Add top bar icon
        this.addTopBar({
            icon: "iconAlignLeft",
            title: this.i18n.displayName || "Floating TOC",
            position: "right",
            callback: () => {
                this.toggleToc();
            }
        });
    }

    onLayoutReady() {
        this.monitorProtyles();
        
        // Listen to active document changes
        this.eventBus.on("switch-protyle", this.onSwitchProtyle.bind(this));
        
        // Initial scan
        this.checkProtyles();
    }

    onunload() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.tocInstances.forEach((toc) => {
            toc.$destroy();
        });
        this.tocInstances.clear();
    }

    private monitorProtyles() {
        // Watch for DOM changes to detect new/removed protyle instances
        const targetNode = document.querySelector(".layout__center") || document.body;
        
        this.observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    // Optimized: only check if .protyle elements are involved
                    // But simpler to just run checkProtyles throttled
                    shouldCheck = true;
                    break;
                }
            }
            if (shouldCheck) {
                this.checkProtyles();
            }
        });
        
        this.observer.observe(targetNode, {
            childList: true,
            subtree: true
        });
    }

    private checkProtyles() {
        const protyles = Array.from(document.querySelectorAll(".protyle"));
        
        // 1. Add new instances
        protyles.forEach((p: HTMLElement) => {
            if (!this.tocInstances.has(p)) {
                // Ensure it's a valid protyle editor (has content)
                const content = p.querySelector(".protyle-content");
                if (!content) return;
                
                // Get doc ID
                const docId = content.getAttribute("data-node-id");
                if (!docId) return;

                this.createToc(p, docId);
            }
        });

        // 2. Remove instances that are no longer in DOM
        for (const [p, toc] of this.tocInstances.entries()) {
            if (!document.contains(p)) {
                toc.$destroy();
                this.tocInstances.delete(p);
            }
        }
    }

    private createToc(protyleElement: HTMLElement, docId: string) {
        // Create container inside protyle
        // Use a wrapper or append directly?
        // Let's create a container div to keep things clean
        const container = document.createElement("div");
        container.className = "syplugin-floating-toc-container";
        // Append to protyle element so it's tied to the tab's lifecycle and visibility
        protyleElement.appendChild(container);

        const toc = new FloatingToc({
            target: container,
            props: {
                plugin: this,
                targetElement: protyleElement
            }
        });

        // Initialize data
        // We need to construct a mock 'protyle' object or pass what's needed
        // FloatingToc.svelte uses `updateHeadings(docId, protyle)`
        // `protyle` arg is mainly used for `protyle.element` access in original code.
        // Since we passed `targetElement`, we might just need to pass a simple object or update the method.
        // Let's call updateHeadings
        
        toc.updateHeadings(docId, { element: protyleElement });
        
        this.tocInstances.set(protyleElement, toc);
    }

    private toggleToc() {
        const activeProtyle = document.querySelector(".layout__wnd--active .protyle") as HTMLElement;
        if (activeProtyle && this.tocInstances.has(activeProtyle)) {
            const toc = this.tocInstances.get(activeProtyle);
            if (toc) {
                (toc as any).toggle();
            }
        }
    }

    private onSwitchProtyle(event: CustomEvent<any>) {
        const protyle = event.detail.protyle;
        if (protyle && protyle.element) {
            // Check if we have an instance for this element
            let toc = this.tocInstances.get(protyle.element);
            
            if (!toc) {
                // Might be a new window/tab we haven't caught yet
                if (protyle.block && protyle.block.rootID) {
                    this.createToc(protyle.element, protyle.block.rootID);
                    toc = this.tocInstances.get(protyle.element);
                }
            }
            
            // Refresh data just in case
            if (toc && protyle.block && protyle.block.rootID) {
                toc.updateHeadings(protyle.block.rootID, protyle);
            }
        }
    }
}
