import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

import fs from 'node:fs';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function syncElectronDevMeta() {
  if (process.platform === 'darwin') {
    try {
      const electronPlist = path.resolve(__dirname, 'node_modules/electron/dist/Electron.app/Contents/Info.plist');
      const iconSrc = path.resolve(__dirname, 'build/icon.icns');
      const iconDst = path.resolve(__dirname, 'node_modules/electron/dist/Electron.app/Contents/Resources/electron.icns');
      if (fs.existsSync(electronPlist)) {
        execSync(`plutil -replace CFBundleName -string "Salmer KVM Studio" "${electronPlist}"`, { stdio: 'ignore' });
        execSync(`plutil -replace CFBundleDisplayName -string "Salmer KVM Studio" "${electronPlist}"`, { stdio: 'ignore' });
      }
      if (fs.existsSync(iconSrc) && fs.existsSync(path.dirname(iconDst))) {
        fs.copyFileSync(iconSrc, iconDst);
      }
    } catch {
      // Ignora se o arquivo não estiver disponível
    }
  }
}

function buildPreload() {
  esbuild.buildSync({
    entryPoints: [path.resolve(__dirname, 'src/main/preload.ts')],
    outfile: path.resolve(__dirname, 'dist-electron/preload.cjs'),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    external: ['electron'],
  });
}

// Build preload and sync metadata immediately
buildPreload();
syncElectronDevMeta();

function preloadPlugin(): Plugin {
  return {
    name: 'preload-builder',
    buildStart() {
      buildPreload();
    },
    handleHotUpdate({ file, server }) {
      if (file.includes('src/main/preload.ts')) {
        buildPreload();
        server.ws.send({ type: 'full-reload' });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    preloadPlugin(),
    electron([
      {
        // Main process entry
        entry: 'src/main/main.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
