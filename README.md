# Viber Ops website

Product website, Configra usage documentation, and shared screenshots for the
Viber Ops repositories. Published at **https://viber-ops.github.io/**.

## Develop

Requires Node.js 22.12+ (CI uses Node 24).

```sh
npm ci --ignore-scripts
npm run dev
```

Use the local URL printed by Astro. Astro 7 runs development in a managed process;
`npx astro dev stop` stops this project's server.

```sh
npm run build
npm test
```

Astro generates static HTML in `dist/`. No application backend, user tracking,
remote fonts, or browser framework runtime is required.

## Add a product or guide

- Register products and document navigation in `src/data/site.ts`.
- Add a product page under `src/pages/`, reusing `Site.astro` and the shared tokens.
- Configra guides live in `src/pages/docs/configra/*.md`, using `Docs.astro`.
- Keep examples pinned to a published tag and record limitations honestly.
- Screenshots live in `public/assets/configra/`; their public URLs are stable.
  These images use synthetic fixtures, not production credentials.

The visual direction is a midnight-blue operator's field guide: restrained
typography, real product screenshots, clear navigation and a separate reading
layout for documentation. Keep that hierarchy when expanding the product catalog.

## Publish

GitHub Pages uses **GitHub Actions** as its source. Pushes to `main` build, test
internal links/anchors/assets, and deploy. Pull requests run the same checks
without deploying. Actions are pinned to full commit SHAs.

The org-level repository name means the site is served at `/`, with no project
subpath. The setup follows [Astro's GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/).

Release binaries stay in each product's GitHub Releases; do not commit them here.
Do not add credential exports, real application values or private infrastructure
screenshots to this public repository.
