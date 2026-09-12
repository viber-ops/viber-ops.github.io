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
  const routes = [
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
  ];
  for (const locale of ['', 'en']) {
    for (const route of routes) {
      assert.ok(existsSync(join(root, locale, route, 'index.html')), `Missing ${locale}/${route}`);
    }
  }
  assert.ok(existsSync(join(root, '404.html')));
  assert.ok(existsSync(join(root, 'sitemap.xml')));
});

test('public guides use the current server and SDK release', () => {
  for (const page of pages) {
    const html = readFileSync(page, 'utf8');
    assert.doesNotMatch(html, /github\.com\/viber-ops\/configra(?:-go)?\/(?:blob|tree|releases\/(?:tag|download))\/v0\.1\.0-rc\.1(?:[\/"#<]|$)/);
    if (page.includes('/docs/configra/')) assert.match(html, /v0\.1\.0-rc\.2/);
  }
});

const sourceRoot = resolve(root, '..');
function exampleBlocks(source) {
  return [...source.matchAll(/^```(\w*)\n([\s\S]*?)^```/gm)].map((match) => ({
    language: match[1],
    code: match[2].split('\n')
      .map((line) => line.replace(/(?:^\s*|\s+)(?:#|\/\/).*$/, '').trimEnd())
      .filter((line) => line.trim()).join('\n'),
  }));
}

test('Chinese and English guides keep executable examples in sync', () => {
  const names = readdirSync(join(sourceRoot, 'src/pages/docs/configra')).filter((name) => name.endsWith('.md'));
  for (const name of names) {
    const chinese = readFileSync(join(sourceRoot, 'src/pages/docs/configra', name), 'utf8');
    const english = readFileSync(join(sourceRoot, 'src/pages/en/docs/configra', name), 'utf8');
    assert.deepEqual(exampleBlocks(chinese), exampleBlocks(english), name);
  }
});

test('overview examples keep the same keys and match their environment values', () => {
  for (const locale of ['', 'en/']) {
    const source = readFileSync(join(sourceRoot, `src/pages/${locale}docs/configra/index.md`), 'utf8');
    const blocks = exampleBlocks(source);
    const yaml = blocks.filter((block) => block.language === 'yaml');
    const json = blocks.filter((block) => block.language === 'json').map((block) => JSON.parse(block.code));
    assert.equal(yaml.length, 4, 'One YAML source and three resolved examples');
    assert.equal(json.length, 2, 'JSON source and production result');
    const rows = source.split('\n').map((line) => line.split('|').slice(1, -1)
      .map((cell) => cell.trim().replaceAll('`', '')))
      .filter((cells) => ['development', 'testing', 'production'].includes(cells[0]));
    assert.deepEqual(rows.map((row) => row[0]), ['development', 'testing', 'production']);
    const fields = ['host', 'password', 'port', 'username'];
    assert.deepEqual(Object.keys(json[0]), ['database']);
    assert.deepEqual(Object.keys(json[0].database).sort(), fields);
    assert.equal(json[0].database.port, 3306);
    for (const field of ['host', 'username', 'password']) {
      const reference = `{vault.platform.database.${field}}`;
      assert.equal(json[0].database[field], reference);
      assert.ok(yaml[0].code.includes(reference));
    }
    // These documented YAML examples intentionally contain one flat database map.
    // The production resolver is checked separately against the same snippets.
    rows.forEach(([environment, host, username, password], index) => {
      const code = yaml[index + 1].code;
      assert.equal(code.split('\n')[0], 'database:');
      assert.deepEqual([...code.matchAll(/^  (\w+):/gm)].map((match) => match[1]).sort(), fields);
      for (const [key, value] of Object.entries({ host, username, password })) {
        assert.ok(code.includes(`  ${key}: '${value}'`), `${locale}${environment}.${key}`);
      }
      assert.ok(code.includes('  port: 3306'));
      assert.doesNotMatch(code, /\{vault\./);
      if (environment === 'production') {
        assert.deepEqual(json[1], { database: { host, username, password, port: 3306 } });
      }
    });
    assert.ok(blocks.some((block) => block.language === 'go' &&
      block.code.includes('ReadResolvedConfig(ctx, "testing", "payment", "")')));
  }
});

test('walkthrough separates API startup, demo shutdown and database restore', () => {
  for (const locale of ['', 'en/']) {
    const quickstart = readFileSync(join(sourceRoot, `src/pages/${locale}docs/configra/quickstart.md`), 'utf8');
    assert.match(quickstart, /listen: localhost:18089/);
    assert.match(quickstart, /CONFIGRA_URL=https:\/\/localhost:18089/);
    assert.match(quickstart, /--project-name configra-local/);
    assert.match(quickstart, /-f deploy\/compose\.test\.yaml -f deploy\/compose\.local\.yaml stop/);
    const operations = readFileSync(join(sourceRoot, `src/pages/${locale}docs/configra/operations.md`), 'utf8');
    const blocks = exampleBlocks(operations);
    const backup = blocks.find((block) => block.code.includes('sh mysql-backup.sh'));
    const restore = blocks.find((block) => block.code.includes('sh mysql-restore.sh'));
    assert.ok(backup && restore);
    assert.notEqual(backup, restore, 'Copying backup commands must not also run a restore');
    assert.match(restore.code, /configra_restore_trial/);
  }
});

for (const page of pages) {
  const relative = page.slice(root.length).replace(/index\.html$/, '');
  const html = readFileSync(page, 'utf8');
  test(`${relative}: metadata, landmarks, links, anchors and assets`, () => {
    assert.equal((html.match(/<h1(?:\s|>)/g) ?? []).length, 1, 'Exactly one page heading');
    const english = relative.startsWith('/en/');
    assert.match(html, new RegExp(`<html[^>]*lang="${english ? 'en' : 'zh-CN'}"`));
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
    const switchLink = html.match(/<a\b[^>]*class="language-link"[^>]*href="([^"]+)"[^>]*>/);
    assert.ok(switchLink, 'Language switch is present without JavaScript');
    const translatedPath = english
      ? relative === '/en/404/'
        ? '/404.html'
        : relative.slice(3)
      : relative === '/404.html'
        ? '/en/404/'
        : `/en${relative}`;
    assert.equal(switchLink[1], translatedPath, 'Language switch keeps the current page');
    assert.match(html, /hreflang="zh-CN"/);
    assert.match(html, /hreflang="en"/);
    if (english) {
      const content = html
        .replace(/<a\b[^>]*class="language-link"[^>]*>[\s\S]*?<\/a>/g, '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '')
        .replace(/<[^>]*>/g, '');
      assert.doesNotMatch(
        content,
        /[\u3400-\u9fff]/,
        'English pages must not contain untranslated visible copy',
      );
      for (const match of html.matchAll(/<a\b[^>]*>/g)) {
        if (match[0].includes('language-link')) continue;
        const href = match[0].match(/href="([^"]+)"/)?.[1];
        if (href?.startsWith('/') && !href.startsWith('/assets/') && href !== '/license.txt') {
          assert.ok(href.startsWith('/en/'), `English navigation crossed locale: ${href}`);
        }
      }
    }
  });
}

test('homepages omit the removed slogan section', () => {
  for (const page of ['index.html', 'en/index.html']) {
    const html = readFileSync(join(root, page), 'utf8');
    assert.doesNotMatch(html, /class="principles|OWN YOUR RUNTIME|KNOW THE BOUNDARIES|GET TO WORK/);
  }
});

test('public assets contain no credential exports or key material', () => {
  for (const path of walk(root)) {
    assert.doesNotMatch(path, /\.(?:pem|key|p12|pfx|zip)$/i);
  }
});

test('the published site includes its license and notice', () => {
  assert.match(readFileSync(join(root, 'license.txt'), 'utf8'), /Version 2.0, January 2004/);
  assert.match(readFileSync(join(root, 'notice.txt'), 'utf8'), /Viber Ops Authors/);
});
