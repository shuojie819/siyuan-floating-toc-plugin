// @vitest-environment jsdom
/**
 * 针对 v0.1.22 改动验收：
 *   - isCoveredByDialog 选择器扩展为包含全局搜索(.search__panel/.search__preview)与
 *     文件历史(.history__panel/.history__side/.history__text)面板；
 *   - shouldShowToc 调用 isCoveredByDialog 以在遮挡时隐藏 TOC。
 *
 * jsdom 下 getBoundingClientRect 默认全 0，因此必须用 mock 出非零宽高矩形；
 * 同时 mock window.getComputedStyle 以保证 display/visibility/opacity 判定确定性。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isCoveredByDialog, shouldShowToc } from '../utils/domUtils';

type Rect = { left: number; top: number; width: number; height: number };

/** 用 mock 替换 getBoundingClientRect，返回非零宽高矩形（jsdom 默认全 0）。 */
function setRect(el: HTMLElement, r: Rect): void {
  const right = r.left + r.width;
  const bottom = r.top + r.height;
  el.getBoundingClientRect = () =>
    ({
      x: r.left,
      y: r.top,
      left: r.left,
      top: r.top,
      right,
      bottom,
      width: r.width,
      height: r.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** 在 document.body 下创建一个带 class 的元素。 */
function createEl(cls: string, parent: HTMLElement = document.body): HTMLElement {
  const el = document.createElement('div');
  if (cls) el.className = cls;
  parent.appendChild(el);
  return el;
}

/**
 * 确定性 mock window.getComputedStyle：
 * 仅暴露 isCoveredByDialog 实际读取的 display / visibility / opacity 三个字段，
 * 默认显示态，可被元素 inline style 覆盖。
 */
function mockGetComputedStyle(): void {
  vi.spyOn(window, 'getComputedStyle').mockImplementation(((el: Element) => {
    const inline = (el as HTMLElement).style;
    const display = inline.display || '';
    const visibility = inline.visibility || 'visible';
    const opacity = inline.opacity || '1';
    return { display, visibility, opacity } as unknown as CSSStyleDeclaration;
  }) as typeof window.getComputedStyle);
}

beforeEach(() => {
  mockGetComputedStyle();
});

afterEach(() => {
  // 清理 DOM，避免用例间弹窗/面板残留造成误判
  document.body.replaceChildren();
});

describe('isCoveredByDialog - 本次改动（全局搜索 / 文件历史）', () => {
  it('a. 全局搜索面板 .search__panel 覆盖文档 TOC 元素 → 返回 true', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const panel = createEl('search__panel');
    setRect(panel, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(true);
  });

  it('a2. 全局搜索面板 display:none → 返回 false（不误杀）', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const panel = createEl('search__panel');
    panel.style.display = 'none';
    setRect(panel, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(false);
  });

  it('b. 全局搜索预览 .search__preview 覆盖 → 返回 true', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const panel = createEl('search__preview');
    setRect(panel, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(true);
  });

  it.each(['history__panel', 'history__side', 'history__text'])(
    'c. 文件历史面板 .%s 覆盖 → 返回 true',
    (cls) => {
      const protyle = createEl('protyle');
      setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
      const panel = createEl(cls);
      setRect(panel, { left: 0, top: 0, width: 500, height: 500 });

      expect(isCoveredByDialog(protyle)).toBe(true);
    }
  );
});

describe('isCoveredByDialog - 回归（既有弹窗行为不变）', () => {
  it('d. 普通弹窗 .b3-dialog 覆盖 → 返回 true', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const dlg = createEl('b3-dialog');
    setRect(dlg, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(true);
  });

  it('d2. 弹窗内部元素（dialog.contains(element)）→ 返回 false，TOC 保留', () => {
    const dlg = createEl('b3-dialog');
    setRect(dlg, { left: 0, top: 0, width: 500, height: 500 });
    const inner = createEl('protyle', dlg); // 弹窗内部
    setRect(inner, { left: 50, top: 50, width: 100, height: 100 });

    expect(isCoveredByDialog(inner)).toBe(false);
  });

  it.each([
    ['display:none', { display: 'none' }],
    ['visibility:hidden', { visibility: 'hidden' }],
    ['opacity:0', { opacity: '0' }],
  ])('d3. 弹窗处于 %s → 返回 false', (_name, style) => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const dlg = createEl('b3-dialog');
    Object.assign(dlg.style, style);
    setRect(dlg, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(false);
  });

  it('d4. 带 data-key="dialog-*" 的弹窗覆盖 → 返回 true', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const dlg = createEl('');
    dlg.setAttribute('data-key', 'dialog-setting');
    setRect(dlg, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(true);
  });
});

describe('isCoveredByDialog - 矩形边界与短路边界', () => {
  it('e. 矩形不重叠 → 返回 false', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 600, top: 100, width: 100, height: 100 });
    const dlg = createEl('search__panel');
    setRect(dlg, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(false);
  });

  it('e2. 矩形边缘恰好相接（element.left === dialog.right）→ 不重叠，返回 false', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 500, top: 100, width: 100, height: 100 });
    const dlg = createEl('search__panel');
    setRect(dlg, { left: 0, top: 0, width: 500, height: 500 });

    expect(isCoveredByDialog(protyle)).toBe(false);
  });

  it('e3. 弹窗自身宽高为 0（不可见）→ 跳过该弹窗，返回 false', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const dlg = createEl('search__panel');
    // 不 mock 弹窗矩形 → 默认宽高 0，被跳过
    expect(isCoveredByDialog(protyle)).toBe(false);
  });

  it('f. 被检测元素本身宽高为 0（jsdom 默认）→ 短路返回 false 且不抛错', () => {
    const protyle = createEl('protyle'); // 未 mock 矩形，默认全 0
    const panel = createEl('search__panel');
    setRect(panel, { left: 0, top: 0, width: 500, height: 500 });

    expect(() => isCoveredByDialog(protyle)).not.toThrow();
    expect(isCoveredByDialog(protyle)).toBe(false);
  });
});

describe('shouldShowToc - 集成（遮挡时整体返回 false）', () => {
  it('g. 文档 protyle 被 .search__panel 覆盖 → shouldShowToc 返回 false', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });
    const panel = createEl('search__panel');
    setRect(panel, { left: 0, top: 0, width: 500, height: 500 });

    expect(shouldShowToc(protyle)).toBe(false);
  });

  it('g2. 无遮挡面板 → shouldShowToc 返回 true', () => {
    const protyle = createEl('protyle');
    setRect(protyle, { left: 100, top: 100, width: 200, height: 400 });

    expect(shouldShowToc(protyle)).toBe(true);
  });
});
