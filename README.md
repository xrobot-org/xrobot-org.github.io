# XRobot 2.0 Documentation

本仓库是 XRobot 文档网站 <https://xrobot.work> 的源码，使用 Docusaurus 构建；中文页面位于 `docs/`，英文页面位于 `i18n/en/`。本地预览和构建需要 Node.js（CI 使用 20.x）。首页显示的版本信息由 `scripts/fetch-commits.js` 写入 `src/data/commitInfo.json`，因此预览前先运行一次该脚本；`npm run start` 启动中文站点的开发服务器，加 `-- --locale en` 预览英文站点。`npm run build` 通过 `prebuild` 自动运行该脚本，再把中英文站点输出到 `build/`，与 CI 的构建相同。

This repository is the source of the XRobot documentation website <https://xrobot.work>, built with Docusaurus; Chinese pages live in `docs/`, English pages in `i18n/en/`. Previewing and building need Node.js (CI uses 20.x). The version information on the home page is written to `src/data/commitInfo.json` by `scripts/fetch-commits.js`, so the script runs once before a preview; `npm run start` starts the development server of the Chinese site, and `-- --locale en` previews the English site. `npm run build` runs the script through `prebuild`, then writes the Chinese and English sites to `build/`, the same build as CI.

```bash
npm ci
node scripts/fetch-commits.js
npm run start                  # 中文 / Chinese
npm run start -- --locale en   # English
npm run build
```
