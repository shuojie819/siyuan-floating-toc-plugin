// @vitest-environment jsdom
/**
 * Issue #44 验收：EventHandlers 订阅/注销 `destroy-protyle`（宿主 protyle 销毁即清理 TOC）。
 * -----------------------------------------------------------------------------
 * 修复点：register() 新增 eventBus.on("destroy-protyle", ...)，把「收起右侧文档」
 * 等导致的 protyle 销毁事件，立即转交 ProtyleManager.destroyTocForProtyle 处理，
 * 消除「已销毁宿主的 TOC 仍短暂停留于文档中」的残留窗口。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventHandlers } from "../modules/eventHandlers";

describe("EventHandlers - destroy-protyle 订阅与清理分发（Issue #44）", () => {
    let handlers: Record<string, Array<(e: any) => void>>;
    let plugin: any;
    let destroySpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        document.body.replaceChildren();
        handlers = {};
        destroySpy = vi.fn();
        plugin = {
            data: {},
            tocInstances: new Map(),
            tocDocIds: new Map(),
            protyleManager: { destroyTocForProtyle: destroySpy },
            eventBus: {
                on: (ev: string, fn: (e: any) => void) => {
                    (handlers[ev] = handlers[ev] || []).push(fn);
                },
                off: (ev: string, fn: (e: any) => void) => {
                    handlers[ev] = (handlers[ev] || []).filter((h) => h !== fn);
                }
            }
        };
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it("1. register() 订阅 destroy-protyle（恰好 1 个处理器）", () => {
        const eh = new EventHandlers(plugin);
        eh.register();
        expect(handlers["destroy-protyle"]?.length).toBe(1);
    });

    it("2. 事件到达时调用 protyleManager.destroyTocForProtyle(protyle)", () => {
        const eh = new EventHandlers(plugin);
        eh.register();

        const host = document.createElement("div");
        host.className = "protyle";
        const protyle = { element: host };
        handlers["destroy-protyle"][0]({ detail: { protyle } });

        expect(destroySpy).toHaveBeenCalledTimes(1);
        expect(destroySpy).toHaveBeenCalledWith(protyle);
    });

    it("3. 无 protyle.element 的事件被安全忽略（不抛出、不误调用）", () => {
        const eh = new EventHandlers(plugin);
        eh.register();
        expect(() => handlers["destroy-protyle"][0]({ detail: {} })).not.toThrow();
        expect(destroySpy).not.toHaveBeenCalled();
    });

    it("4. unregister() 注销 destroy-protyle 监听", () => {
        const eh = new EventHandlers(plugin);
        eh.register();
        eh.unregister();
        expect(handlers["destroy-protyle"]?.length ?? 0).toBe(0);
    });
});
