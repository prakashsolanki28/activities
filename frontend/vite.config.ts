import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const api = process.env.API_ORIGIN ?? 'http://127.0.0.1:3000';

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  optimizeDeps: {
    // Pre-bundle up front: a mid-session re-optimisation reloads the page and can load React twice.
    include: [
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities',
      '@tanstack/react-form',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'class-variance-authority',
      'clsx',
      'lucide-react',
      'qrcode.react',
      'radix-ui',
      'react-markdown',
      'react-zoom-pan-pinch',
      'remark-breaks',
      'sonner',
      'tailwind-merge',
      'zod',
    ],
  },
  server: {
    // Same origin in development as behind nginx: cookies and uploads just work.
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
});
