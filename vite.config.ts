import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isServe = command === 'serve';
  const apiTarget = env.VITE_API_TARGET || 'http://127.0.0.1:8787';
  const devHost = env.VITE_DEV_HOST || '127.0.0.1';
  const devPort = Number(env.VITE_DEV_PORT || 3000);
  const certPath = env.VITE_DEV_HTTPS_CERT_FILE;
  const keyPath = env.VITE_DEV_HTTPS_KEY_FILE;
  const hasHttpsCerts = Boolean(
    isServe &&
      certPath &&
      keyPath &&
      fs.existsSync(path.resolve(certPath)) &&
      fs.existsSync(path.resolve(keyPath)),
  );

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: isServe
      ? {
          host: devHost,
          port: devPort,
          https: hasHttpsCerts
            ? {
                cert: fs.readFileSync(path.resolve(certPath as string)),
                key: fs.readFileSync(path.resolve(keyPath as string)),
              }
            : undefined,
          proxy: {
            '/api': {
              target: apiTarget,
              changeOrigin: true,
              secure: false,
            },
          },
          hmr: env.DISABLE_HMR !== 'true',
          watch: env.DISABLE_HMR === 'true' ? null : {},
        }
      : undefined,
    preview: {
      host: devHost,
      port: devPort,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
