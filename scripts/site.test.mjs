import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const full = join(path, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
assert.ok(existsSync(root), 'Run npm run build before npm test');
const pages = walk(root).filter((path) => path.endsWith('.html'));
const origin = 'https://viber-ops.github.io';

test('all product and documentation routes are generated', () => {
  for (const route of [
    '',
    'configra',
    ...[
      '',
      'quickstart',
      'installation',
      'concepts',
      'configuration',
      'certificates',
      'go-sdk',
      'kubernetes',
      'deployment',
      'operations',
      'security',
    ].map((slug) => `docs/configra/${slug}`),
  ]) {
    assert.ok(existsSync(join(root, route, 'index.html')), `Missing ${route}`);
  }
  assert.ok(existsSync(join(root, '404.html')));
  assert.ok(existsSync(join(root, 'sitemap.xml')));
});

for (const page of pages) {
  const relative = page.slice(root.length).replace(/index\.html$/, '');
  const html = readFileSync(page, 'utf8');
  test(`${relative}: metadata, landmarks, links, anchors and assets`, () => {
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, 'Exactly one page heading');
    assert.match(html, /<html[^>]*lang="zh-CN"/);
    assert.match(html, /<meta\s+name="description"\s+content="[^"<]+"/);
    assert.match(html, /<main[^>]*id="main"/);
    assert.doesNotMatch(
      html,
      /(?:TODO|Lorem ipsum|\/Users\/[^/\s]+\/|gitlab\.[a-z0-9.-]+\/vst\/)/i,
    );
    for (const match of html.matchAll(/<(a|img|link|script)\b[^>]*?\b(href|src)="([^"]*)"/g)) {
      const url = new URL(match[3].replaceAll('&amp;', '&'), origin + relative);
      if (url.origin !== origin || !['https:', 'http:'].includes(url.protocol)) continue;
      const path = decodeURIComponent(url.pathname);
      let target = join(root, path);
      if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
      assert.ok(existsSync(target), `Broken ${match[1]}: ${match[3]}`);
      if (url.hash && target.endsWith('.html')) {
        const id = decodeURIComponent(url.hash.slice(1));
        const targetHTML = readFileSync(target, 'utf8');
        assert.ok(targetHTML.includes(`id="${id}"`), `Missing anchor ${match[3]}`);
      }
    }
    for (const match of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(match[0], /\balt="[^"]+"/, 'Images must have useful alternative text');
    }
  });
}

test('public assets contain no credential exports or key material', () => {
  for (const path of walk(root)) {
    assert.doesNotMatch(path, /\.(?:pem|key|p12|pfx|zip)$/i);
  }
});
