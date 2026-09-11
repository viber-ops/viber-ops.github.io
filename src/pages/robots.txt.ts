export function GET() {
  return new Response(
    'User-agent: *\nAllow: /\nSitemap: https://viber-ops.github.io/sitemap.xml\n',
    {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    },
  );
}
