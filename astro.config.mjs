import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://hrdkbhatnagar.github.io',
  output: 'static',
  build: {
    assets: '_astro'
  }
});
