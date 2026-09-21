import type { Config } from '@docusaurus/types';

const repository = process.env.GITHUB_REPOSITORY ?? 'trendmicro/agent-hook-unity';
const [organizationName, projectName] = repository.split('/');
const repositoryUrl = `https://github.com/${repository}`;

const config: Config = {
  title: 'Agent Hook Unity',
  tagline: 'A portable lifecycle-hook protocol for AI agents and tooling',
  favicon: 'img/favicon.svg',
  url: `https://${organizationName}.github.io`,
  baseUrl: `/${projectName}/`,
  organizationName,
  projectName,
  trailingSlash: false,
  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'throw'
    }
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en']
  },
  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',
          editUrl: `${repositoryUrl}/edit/main/website/`
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css'
        }
      }
    ]
  ],
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'specification',
        path: '../spec',
        exclude: ['README.md'],
        routeBasePath: 'specification',
        sidebarPath: './sidebars.specification.ts',
        editUrl: `${repositoryUrl}/edit/main/spec/`
      }
    ]
  ],
  themeConfig: {
    image: 'img/social-card.svg',
    navbar: {
      title: 'Agent Hook Unity',
      items: [
        { to: '/', label: 'Overview', position: 'left' },
        { to: '/participate', label: 'Participate', position: 'left' },
        { to: '/governance', label: 'Governance', position: 'left' },
        { to: '/specification', label: 'Specification', position: 'left' },
        { to: '/conformance', label: 'Conformance', position: 'left' },
        { href: `${repositoryUrl}/discussions`, label: 'Discussions', position: 'right' },
        { href: repositoryUrl, label: 'GitHub', position: 'right' }
      ]
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Community',
          items: [
            { label: 'GitHub Discussions', href: `${repositoryUrl}/discussions` },
            { label: 'Contributing', to: '/participate' }
          ]
        },
        {
          title: 'Project',
          items: [
            { label: 'Governance', to: '/governance' },
            { label: 'Specification', to: '/specification' },
            { label: 'Repository', href: repositoryUrl }
          ]
        }
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Agent Hook Unity contributors. Documentation is CC BY 4.0; code is MIT.`
    },
    prism: {
      theme: { plain: { color: '#f8fafc', backgroundColor: '#0f172a' }, styles: [] },
      darkTheme: { plain: { color: '#f8fafc', backgroundColor: '#0f172a' }, styles: [] }
    }
  }
};

export default config;
