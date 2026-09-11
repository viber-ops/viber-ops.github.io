import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://viber-ops.github.io',
  output: 'static',
  trailingSlash: 'always',
  markdown: { shikiConfig: { theme: 'github-dark' } },
  devToolbar: { enabled: false },
});
