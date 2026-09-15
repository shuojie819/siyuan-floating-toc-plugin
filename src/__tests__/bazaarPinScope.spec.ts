// @vitest-environment jsdom
/**
 * 集市 / 文档「固定状态」分仓语义测试（改动 1A）。
 *
 * 背景：集市详情页的悬浮大纲会沿用文档的固定（pinned）状态，导致「文档固定后集市大纲
 * 也被动固定展开」。修复目标：集市固定状态独立、会话级、不写全局配置，与文档互不影响。
 *
 * 契约：
 *   - 集市（bazaar）：切换固定只写「会话级」状态 bazaarSessionState，绝不写全局配置；
 *   - 文档及其它：切换固定写全局配置（persist 回调）。
 *
 * 说明：applyPinPersistence 抽出 togglePin 的分支决策为纯函数，便于单测与变异校验；
 * bazaarSessionState 为模块级常量，保证同会话内 TOC 实例销毁重建后状态仍保留。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// 隔离内核/编译依赖：protyleManager 会 import 真实 Svelte 组件，此处用最小桩替换。
vi.mock("../FloatingToc.svelte", () => ({ default: class FloatingTocStub {} }));

import { bazaarSessionState, applyPinPersistence } from "../modules/protyleManager";

describe("集市/文档 固定状态分仓（applyPinPersistence）", () => {
    beforeEach(() => {
        bazaarSessionState.pinned = false;
    });

    it("集市：切换固定只写会话态，不触达全局配置", () => {
        const persist = vi.fn();
        applyPinPersistence(true, { isBazaar: true, session: bazaarSessionState, persist });
        expect(bazaarSessionState.pinned).toBe(true);
        expect(persist).not.toHaveBeenCalled();
    });

    it("文档：切换固定写全局配置（persist 被调用一次），且不改动集市会话态", () => {
        const persist = vi.fn();
        applyPinPersistence(true, { isBazaar: false, session: bazaarSessionState, persist });
        expect(persist).toHaveBeenCalledTimes(1);
        expect(bazaarSessionState.pinned).toBe(false);
    });

    it("集市连续切换：会话态随之翻转，且从不写全局配置", () => {
        const persist = vi.fn();
        let pinned = false;
        for (let i = 0; i < 3; i++) {
            pinned = !pinned;
            applyPinPersistence(pinned, { isBazaar: true, session: bazaarSessionState, persist });
        }
        // false → true → false → true
        expect(bazaarSessionState.pinned).toBe(true);
        expect(persist).not.toHaveBeenCalled();
    });

    it("会话态为模块级：模拟 TOC 实例销毁重建后仍保留", () => {
        const persist = vi.fn();
        applyPinPersistence(true, { isBazaar: true, session: bazaarSessionState, persist });
        // 模拟实例重建后 onMount 重新读取会话态
        const reread = bazaarSessionState.pinned;
        expect(reread).toBe(true);
    });

    it("双向隔离：文档切换不影响集市会话态", () => {
        const persist = vi.fn();
        bazaarSessionState.pinned = true;
        applyPinPersistence(false, { isBazaar: false, session: bazaarSessionState, persist });
        expect(persist).toHaveBeenCalledTimes(1);
        expect(bazaarSessionState.pinned).toBe(true);
    });
});
