import { defineConfig } from 'vitest/config';

// 独立的 vitest 配置，避免加载 vite.config.ts 中的 svelte / zip 插件（与单测无关）。
// 仅用于 `npm run test`（vitest run），不影响 `npm run build`（vite build 使用 vite.config.ts）。
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/__tests__/**/*.spec.ts'],
    clearMocks: true,
  },
});
