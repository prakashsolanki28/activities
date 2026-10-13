import type { Config } from '@react-router/dev/config';

export default {
  // SPA mode: nginx serves build/client/index.html for every route.
  ssr: false,
} satisfies Config;
