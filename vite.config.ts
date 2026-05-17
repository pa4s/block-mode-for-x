import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'fs';

/**
 * Custom plugin to handle Chrome Extension build:
 * - Copy manifest.json, icons, popup.html to dist
 * - Inline CSS into content.js (since Vite code-splits CSS)
 */
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',
    closeBundle() {
      const distDir = resolve(__dirname, 'dist');

      // Copy manifest.json
      copyFileSync(
        resolve(__dirname, 'manifest.json'),
        resolve(distDir, 'manifest.json')
      );

      // Copy icons
      const iconsDir = resolve(distDir, 'icons');
      if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });
      const srcIcons = resolve(__dirname, 'icons');
      if (existsSync(srcIcons)) {
        for (const f of readdirSync(srcIcons)) {
          if (f.endsWith('.png')) {
            copyFileSync(resolve(srcIcons, f), resolve(iconsDir, f));
          }
        }
      }

      // Copy Chrome i18n locale files
      const localesSrc = resolve(__dirname, '_locales');
      if (existsSync(localesSrc)) {
        cpSync(localesSrc, resolve(distDir, '_locales'), { recursive: true });
      }

      // Copy popup.html
      const popupSrc = resolve(__dirname, 'src/popup/popup.html');
      if (existsSync(popupSrc)) {
        copyFileSync(popupSrc, resolve(distDir, 'popup.html'));
      }

      console.log('[chrome-extension] Assets copied to dist/');
    },
  };
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: '[name][extname]',
        // Prevent code splitting for content script
        manualChunks: undefined,
        inlineDynamicImports: false,
      },
    },
    cssCodeSplit: false,
    minify: false,
    sourcemap: false,
  },
  plugins: [chromeExtensionPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
