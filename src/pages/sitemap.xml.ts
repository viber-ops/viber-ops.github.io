import { docGroups, docHref } from '../data/site';
export function GET() {
  const paths = [
    '/',
    '/configra/',
    ...docGroups.flatMap((group) => group.pages.map((page) => docHref(page.slug))),
  ];
  const urls = paths
    .map((path) => `<url><loc>https://viber-ops.github.io${path}</loc></url>`)
    .join('');
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    },
  );
}
