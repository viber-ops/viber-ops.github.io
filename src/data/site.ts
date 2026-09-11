export const release = 'v0.1.0-rc.1';
export const releaseURL = `https://github.com/viber-ops/configra/releases/tag/${release}`;
export const sourceURL = `https://github.com/viber-ops/configra/tree/${release}`;
export const products = [
  {
    name: 'Configra',
    href: '/configra/',
    description: '配置、敏感值与机器访问，在一个地方管理。',
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
