---
id: con-guide-branch
title: 仓库与分支约定
sidebar_position: 3
---

# 仓库与分支约定

贡献时默认从当前主开发分支拉出工作分支，不直接在主分支上修改。一个分支只处理一个主题，不在同一分支上长期堆叠多个无关任务。

## dev 与 master

xrobot-org 与 QDU-Robomaster 的官方仓库（包括本文档网站）使用两条长期分支：`dev` 接收 PR，`master` 只从 `dev` 合入，用于发布。工作分支从 `dev` 拉出，PR 提交到 `dev`。本网站的 `master` 更新后自动部署到 xrobot.work，`dev` 和 PR 只做构建检查。

## 分支

- 分支名直接反映改动主题。
- 文档、驱动、重构、修复可以分别命名，不要使用长期悬空的“临时分支”。
- 一个分支上只放一个可审阅主题。

## 提交

- 一个提交只做一类改动。
- 不把功能改动、文档重写、无关清理混进同一个提交。
- 提交标题直接写改动内容，不写空泛描述。

仓库里现有标题大致是这种风格：

- `docs(hpm): fix static image paths for Docusaurus`
- `docs: refresh site content and targeted docs updates`
- `fix(uart): handle late BLOCK completion after timeout`

## 同步主线

提交前保证分支和当前主开发分支没有明显漂移。若主线变化较大，先同步，再继续处理冲突。

不建议的做法包括：在一个分支上同时做功能开发、文档重写和无关清理；用“临时分支”长期承载正式改动；让提交历史只剩下一串无法审阅的修补提交。
