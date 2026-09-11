export const release = 'v0.1.0-rc.1';
export const releaseURL = `https://github.com/viber-ops/configra/releases/tag/${release}`;
export const sourceURL = `https://github.com/viber-ops/configra/tree/${release}`;
export const products = [
  {
    name: 'Configra',
    href: '/configra/',
    description: '应用配置与敏感值管理服务，提供版本历史、客户端证书和 Kubernetes 集成。',
    status: 'Preview',
    category: 'CONFIGURATION & SECRETS',
  },
];
export const docGroups = [
  {
    label: '开始使用',
    pages: [
      { slug: '', title: '认识 Configra' },
      { slug: 'quickstart', title: '本地体验' },
      { slug: 'installation', title: '下载与安装' },
      { slug: 'concepts', title: '核心概念' },
    ],
  },
  {
    label: '管理与接入',
    pages: [
      { slug: 'configuration', title: '配置与 Vault' },
      { slug: 'certificates', title: 'CA 与客户端证书' },
      { slug: 'go-sdk', title: 'Go SDK' },
      { slug: 'kubernetes', title: 'Kubernetes 接入' },
    ],
  },
  {
    label: '部署与维护',
    pages: [
      { slug: 'deployment', title: '部署 Configra 服务' },
      { slug: 'operations', title: '备份、升级与排障' },
      { slug: 'security', title: '安全边界与发布状态' },
    ],
  },
];
export const docHref = (slug: string) => `/docs/configra/${slug ? `${slug}/` : ''}`;
