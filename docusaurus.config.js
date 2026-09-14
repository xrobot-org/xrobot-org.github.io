const { themes: prismThemes } = require('prism-react-renderer');

module.exports = {
  title: 'XRobot Docs',
  tagline: 'Want to be the best embedded framework',
  url: 'https://xrobot.work',
  baseUrl: '/',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  onDuplicateRoutes: 'warn',
  favicon: 'img/XRobot.png',

  organizationName: 'xrobot-org',
  projectName: 'xrobot-org.github.io',

  scripts: [
    {
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      defer: true,
      'data-cf-beacon': '{"token": "8659aca76cfa4141bdd852a2f5652c32"}',
    },
  ],

  markdown: {
    mermaid: true,
  },

  i18n: {
    defaultLocale: 'zh',
    locales: ['en', 'zh'],
    localeConfigs: {
      en: { label: 'English' },
      zh: { label: '简体中文' },
    },
  },

  plugins: [
    [
      require.resolve('@cmfcmf/docusaurus-search-local'),
      /** @type {import('@cmfcmf/docusaurus-search-local').PluginOptions} */
      ({
        indexDocs: true,
        indexBlog: true,
        indexPages: false,
        language: ['en', 'zh'],
      }),
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          routeBasePath: '/docs',
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/xrobot-org/xrobot-org.github.io/edit/XRobot2.0/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: 'XRobot Docs',
      logo: {
        alt: 'XRobot Logo',
        src: 'img/XRobot.png',
      },
      items: [
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          href: 'https://github.com/xrobot-org/xrobot-org.github.io',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: '文档',
          items: [
            {
              label: '入门',
              to: '/',
            },
            {
              label: 'LibXR 类文档',
              href: 'https://xrobot.work/libxr/',
            },
            {
              label: 'CodeGenerator命令行工具',
              href: 'https://pypi.org/project/libxr/',
            },
            {
              label: 'XRobot命令行工具',
              href: 'https://pypi.org/project/xrobot/',
            },
          ],
        },
        {
          title: '社区',
          items: [
            {
              label: 'GitHub仓库',
              href: 'https://github.com/xrobot-org',
            },
            {
              label: 'LibXR',
              href: 'https://github.com/Jiu-xiao/libxr',
            },
            {
              label: 'CodeGenerator',
              href: 'https://github.com/Jiu-xiao/LibXR_CppCodeGenerator',
            },
            {
              label: 'QDU Robomaster未来战队',
              href: 'https://github.com/QDU-Robomaster',
            }
          ],
        },
        {
          title: '媒体',
          items: [
            {
              label: 'Bilibili视频教程',
              href: 'https://space.bilibili.com/339766655/lists',
            },
            {
              label: '未来战队B站频道',
              href: 'https://space.bilibili.com/1309383975',
            }
          ],
        },
        {
          title: '联系方式',
          items: [
            {
              label: '邮箱',
              href: 'mailto:Cong.Liu_Xiao@outlook.com',
            },
            {
              label: 'QQ群: 608182228',
              href: 'https://qm.qq.com/q/RPgE71OXmw',
            }
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} XRobot`,
    },

    mermaid: {
      theme: { light: 'neutral', dark: 'forest' },
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['cmake', 'bash'],
    },
  },
};
