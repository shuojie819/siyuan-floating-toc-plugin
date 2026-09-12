/**
 * 集市（bazaar）详情页可见性判定测试
 *
 * 背景：思源 3.8.3+ 重写了集市 UI，把集市详情页的「已展开」类名
 * 从 `config-bazaar__readme--show` 改名为 `config__view--show`。
 * 插件原先只判断旧类名，导致 `isPanelVisible` 恒为 false、悬浮大纲在集市里完全不显示
 * （实测 `#configBazaarReadme` 的 class 为 `config-bazaar__readme config__view--show`）。
 *
 * 本测试锁住「新旧类名都要认」这个兼容契约，防止回归。
 */
import { describe, it, expect } from 'vitest';
import { isBazaarPanelShown } from '../utils/domUtils';

function makeEl(className: string): HTMLElement {
    const el = document.createElement('div');
    el.className = className;
    return el;
}

describe('isBazaarPanelShown（集市详情页可见性判定）', () => {
    it('思源 ≤3.8.2 的旧类名 config-bazaar__readme--show → true（向后兼容）', () => {
        expect(isBazaarPanelShown(makeEl('config-bazaar__readme config-bazaar__readme--show'))).toBe(true);
    });

    it('思源 3.8.3+ 实测类名 config-bazaar__readme config__view--show → true', () => {
        expect(isBazaarPanelShown(makeEl('config-bazaar__readme config__view--show'))).toBe(true);
    });

    it('只有 config__view、未加 --show（详情页未展开）→ false', () => {
        expect(isBazaarPanelShown(makeEl('config-bazaar__readme config__view'))).toBe(false);
    });

    it('仅有形近类名（config__view--notshow）→ false（防误判）', () => {
        expect(isBazaarPanelShown(makeEl('config-bazaar__readme config__view--notshow'))).toBe(false);
    });

    it('语义：只看元素自身（与原始实现一致），祖先带类不算 → false', () => {
        const parent = makeEl('config__view--show');
        const child = makeEl('config-bazaar__readme');
        parent.appendChild(child);
        expect(isBazaarPanelShown(child)).toBe(false);
    });

    it('真实 classList 场景：classList.add/remove 后判定同步变化', () => {
        const el = makeEl('config-bazaar__readme config__view');
        expect(isBazaarPanelShown(el)).toBe(false);
        el.classList.add('config__view--show');
        expect(isBazaarPanelShown(el)).toBe(true);
        el.classList.remove('config__view--show');
        expect(isBazaarPanelShown(el)).toBe(false);
    });
});
