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
npm run check
npm run build
npm test
```

Astro generates static HTML in `dist/`. No application backend, user tracking,
remote fonts, or browser framework runtime is required.

## Add a product or guide

- Register products and document navigation in `src/data/site.ts`.
- Add a product page under `src/pages/`, reusing `Site.astro` and the shared tokens.
- Configra guides live in `src/pages/docs/configra/*.md`, using `Docs.astro`.
- English guides live in `src/pages/en/docs/configra/`; every Chinese route has
  an English counterpart under `/en/`. Language links preserve the current page.
- Shared navigation and interface labels are in `src/data/i18n.ts`. Add both
  translations when adding an interface label or a document route.
- Write product information and instructions, not slogans. Put prerequisites,
  required substitutions and limits next to the command they affect.
- Introduce a feature with a familiar example before its technical name. Say
  what the reader needs, where to run a command and what success looks like.
- Separate the first successful read from optional certificate rotation,
  Kubernetes and production setup. Put data-loss warnings before stop/restore
  commands, and never combine backup and restore in one copyable block.
- Keep examples pinned to a published tag and record limitations honestly.
- Screenshots live in `public/assets/configra/`; their public URLs are stable.
  These images use synthetic fixtures, not production credentials.

Reuse colors and spacing from `src/styles/global.css`. Product pages use real
screenshots with synthetic data; guides use the shared documentation sidebar.

## Publish

GitHub Pages uses **GitHub Actions** as its source. Pushes to `main` type-check,
build, test both languages' routes/links/anchors/assets, and deploy. Pull requests run the same checks
without deploying. Actions are pinned to full commit SHAs.

The org-level repository name means the site is served at `/`, with no project
subpath. The setup follows [Astro's GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/).

Release binaries stay in each product's GitHub Releases; do not commit them here.
Do not add credential exports, real application values or private infrastructure
screenshots to this public repository.

## License

Original website code and documentation are licensed under [Apache-2.0](LICENSE).
Third-party dependencies retain their own licenses and notices.
