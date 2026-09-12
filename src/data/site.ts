export const release = 'v0.1.0-rc.2';
export const releaseURL = `https://github.com/viber-ops/configra/releases/tag/${release}`;
export const sourceURL = `https://github.com/viber-ops/configra/tree/${release}`;
export const products = [
  {
    name: 'Configra',
    href: '/configra/',
    description: '在网页里管理开发、测试和生产环境的配置、密码与证书，查看每次修改记录。应用通过 Go SDK 或 Kubernetes 读取。',
    descriptionEn:
      'Manage settings, passwords and certificates for development, testing and production in a web interface. Review changes and connect applications through Go or Kubernetes.',
    status: 'Preview',
    statusZh: '预发布',
    category: 'CONFIGURATION & SECRETS',
    categoryZh: '配置管理',
  },
];
export const docGroups = [
  {
    label: '开始使用',
    pages: [
      { slug: '', title: '认识 Configra' },
      { slug: 'quickstart', title: '本地体验' },
      { slug: 'installation', title: '下载与安装' },
      { slug: 'concepts', title: '名词说明' },
    ],
  },
  {
    label: '管理与接入',
    pages: [
      { slug: 'configuration', title: '配置与 Vault' },
      { slug: 'certificates', title: '证书与访问凭据' },
      { slug: 'go-sdk', title: 'Go SDK' },
      { slug: 'kubernetes', title: 'Kubernetes 接入' },
    ],
  },
  {
    label: '部署与维护',
    pages: [
      { slug: 'deployment', title: '部署 Configra 服务' },
      { slug: 'operations', title: '备份、升级与排障' },
      { slug: 'security', title: '使用限制与安全说明' },
    ],
  },
];
export const docHref = (slug: string, locale: Locale = 'zh-CN') =>
  localizedPath(`/docs/configra/${slug ? `${slug}/` : ''}`, locale);

const englishTitles: Record<string, string> = {
  '': 'Overview',
  quickstart: 'Local quickstart',
  installation: 'Download and install',
  concepts: 'Glossary',
  configuration: 'Configs and Vault',
  certificates: 'Certificates and credentials',
  'go-sdk': 'Go SDK',
  kubernetes: 'Kubernetes integration',
  deployment: 'Deploy the service',
  operations: 'Backup, upgrades and troubleshooting',
  security: 'Limitations and security',
};
const englishGroups = ['Getting started', 'Manage and integrate', 'Deploy and operate'];

export function docGroupsFor(locale: Locale) {
  if (locale === 'zh-CN') return docGroups;
  return docGroups.map((group, index) => ({
    label: englishGroups[index],
    pages: group.pages.map((page) => {
      const title = englishTitles[page.slug];
      if (!title) throw new Error(`Missing English navigation for ${page.slug}`);
      return { ...page, title };
    }),
  }));
}
import type { Locale } from './i18n';
import { localizedPath } from './i18n';
