export type Locale = 'zh-CN' | 'en';

export function localeFromPath(path: string): Locale {
  return path.startsWith('/en/') || path === '/en' ? 'en' : 'zh-CN';
}

export function localizedPath(path: string, locale: Locale): string {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new Error('Expected a site-relative path');
  let base = path.replace(/^\/en(?=\/|$)/, '') || '/';
  if (base === '/404.html' || base === '/404/') return locale === 'en' ? '/en/404/' : '/404.html';
  return locale === 'en' ? `/en${base}` : base;
}

const zh = {
  skip: '跳转到正文',
  home: 'Viber Ops 首页',
  primary: '主导航',
  footer: '页脚导航',
  products: '产品',
  docs: '文档',
  download: '下载',
  footerDescription: '产品介绍与使用文档',
  guide: '使用文档',
  docNav: '文档目录',
  browse: '浏览文档',
  onPage: '本页内容',
  source: '查看源码 ↗',
  repository: '在 GitHub 查看项目 ↗',
  version: '对应版本',
  previous: '← 上一篇',
  next: '下一篇 →',
  pagination: '前后篇文档',
  feedback: '报告问题 ↗',
  copy: '复制',
  copyLabel: '复制代码',
  copied: '已复制',
  copyFailed: '请选中代码手动复制',
};

const en: Record<keyof typeof zh, string> = {
  skip: 'Skip to content',
  home: 'Viber Ops home',
  primary: 'Main navigation',
  footer: 'Footer navigation',
  products: 'Products',
  docs: 'Docs',
  download: 'Downloads',
  footerDescription: 'Products and documentation',
  guide: 'Documentation',
  docNav: 'Documentation navigation',
  browse: 'Browse documentation',
  onPage: 'On this page',
  source: 'View source ↗',
  repository: 'View on GitHub ↗',
  version: 'Version',
  previous: '← Previous',
  next: 'Next →',
  pagination: 'Previous and next guide',
  feedback: 'Report an issue ↗',
  copy: 'Copy',
  copyLabel: 'Copy code',
  copied: 'Copied',
  copyFailed: 'Select and copy the code manually',
};

export const messages = { 'zh-CN': zh, en };
