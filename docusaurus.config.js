module.exports = {
  title: 'XRobot Docs',
  tagline: 'Want to be the best embedded framework',
  url: 'https://xrobot.work',
  baseUrl: '/',
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onDuplicateRoutes: 'warn',
  favicon: 'img/XRobot.png',

  organizationName: 'xrobot-org',
  projectName: 'xrobot-org.github.io',

  scripts: [
    {
      // Anti-FOUC appearance init: must run synchronously in <head>.
      src: '/appearance-init.js',
      async: false,
    },
    {
      src: 'https://static.cloudflareinsights.com/beacon.min.js',
      defer: true,
      'data-cf-beacon': '{"token": "8659aca76cfa4141bdd852a2f5652c32"}',
    },
  ],

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
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
        indexBlog: false,
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
          editUrl: 'https://github.com/xrobot-org/xrobot-org.github.io/edit/dev/',
          editLocalizedFiles: true,
        },
        theme: {
          customCss: [
            require.resolve('./src/css/xrstyle-tokens.css'),
            require.resolve('./src/css/xrstyle-appearance.css'),
            require.resolve('./src/css/xrstyle-components.css'),
            require.resolve('./src/css/xrstyle-materials.css'),
            require.resolve('./src/css/custom.css'),
          ],
        },
      },
    ],
  ],

  themeConfig: {
    navbar: {
      logo: {
        alt: 'XRobot',
        src: 'img/xrobot-wordmark.svg',
        srcDark: 'img/xrobot-wordmark-paper.svg',
        width: 77,
        height: 28,
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          label: '文档',
          position: 'left',
        },
        {
          type: 'localeDropdown',
          position: 'right',
        },
        {
          type: 'custom-xr-appearance',
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
              to: '/docs/intro',
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
              label: 'XRobot',
              href: 'https://github.com/xrobot-org/XRobot',
            },
            {
              label: 'LibXR',
              href: 'https://github.com/xrobot-org/libxr',
            },
            {
              label: 'CodeGenerator',
              href: 'https://github.com/xrobot-org/LibXR_CppCodeGenerator',
            },
            {
              label: 'QDU RoboMaster 未来战队',
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
                label: 'QQ群',
                to: '/qq',
              }
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} XRobot`,
    },

    mermaid: {
      theme: { light: 'neutral', dark: 'forest' },
    },

    // XRobot Style colours code through CSS (src/css/custom.css), so both Prism themes are empty.
    prism: {
      theme: { plain: {}, styles: [] },
      darkTheme: { plain: {}, styles: [] },
      additionalLanguages: ['cmake', 'bash'],
    },
  },
};
