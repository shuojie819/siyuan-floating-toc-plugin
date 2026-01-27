/**
 * 通用工具函数模块
 */

/**
 * 防抖函数
 * @param fn 要执行的函数
 * @param delay 延迟时间（毫秒）
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: number | undefined;
    return function (this: any, ...args: Parameters<T>) {
        if (timer) {
            clearTimeout(timer);
        }
        timer = window.setTimeout(() => {
            fn.apply(this, args);
            timer = undefined;
        }, delay);
    };
}

/**
 * 节流函数
 * @param fn 要执行的函数
 * @param limit 限制时间（毫秒）
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    return function (this: any, ...args: Parameters<T>) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}

/**
 * 解析 HTML 获取纯文本
 * @param html HTML 字符串
 * @param decoder 可复用的解码器元素
 */
export function getPlainText(html: string, decoder?: HTMLElement): string {
    if (!html) return "";
    const el = decoder || document.createElement("div");
    el.innerHTML = html;
    return el.textContent || el.innerText || "";
}

/**
 * 安全获取元素属性
 */
export function safeGetAttribute(
    element: Element | null,
    ...attrs: string[]
): string | null {
    if (!element) return null;
    for (const attr of attrs) {
        const value = element.getAttribute(attr);
        if (value) return value;
    }
    return null;
}

/**
 * 检查元素是否在视口内
 */
export function isElementInViewport(el: Element): boolean {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}

/**
 * 等待元素出现
 * @param selector CSS 选择器
 * @param timeout 超时时间（毫秒）
 * @param parent 父元素
 */
export function waitForElement(
    selector: string,
    timeout: number = 5000,
    parent: ParentNode = document
): Promise<Element | null> {
    return new Promise((resolve) => {
        const element = parent.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver((mutations, obs) => {
            const el = parent.querySelector(selector);
            if (el) {
                obs.disconnect();
                resolve(el);
            }
        });

        observer.observe(parent, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

/**
 * 创建唯一 ID
 */
export function createUniqueId(prefix: string = "toc"): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 深度克隆对象
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item)) as any;
    }
    const cloned: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            cloned[key] = deepClone((obj as any)[key]);
        }
    }
    return cloned;
}

/**
 * 合并对象（深度合并）
 */
export function deepMerge<T extends Record<string, any>>(
    target: T,
    ...sources: Partial<T>[]
): T {
    for (const source of sources) {
        if (!source) continue;
        for (const key in source) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const targetValue = target[key];
                const sourceValue = source[key];
                if (
                    sourceValue &&
                    typeof sourceValue === "object" &&
                    !Array.isArray(sourceValue) &&
                    targetValue &&
                    typeof targetValue === "object" &&
                    !Array.isArray(targetValue)
                ) {
                    target[key] = deepMerge({ ...targetValue }, sourceValue);
                } else if (sourceValue !== undefined) {
                    target[key] = sourceValue as any;
                }
            }
        }
    }
    return target;
}
