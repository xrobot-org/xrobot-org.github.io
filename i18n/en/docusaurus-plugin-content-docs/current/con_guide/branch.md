---
id: con-guide-branch
title: Repository and Branch Conventions
sidebar_position: 3
---

# Repository and Branch Conventions

Contributions should start from the current main development branch. Do not work directly on the main branch. One branch should only carry one topic.

## dev and master

The official repositories of xrobot-org and QDU-Robomaster, including this documentation website, use two long-lived branches: `dev` receives pull requests, and `master` only merges from `dev` for releases. Work branches start from `dev`, and pull requests target `dev`. For this website, an update of `master` deploys to xrobot.work; `dev` and pull requests are only built.

## Branches

- Branch names should reflect the change topic directly.
- Docs, drivers, refactors, and fixes can each use their own topic branch.
- Do not keep long-lived “temporary” branches with unrelated work stacked together.

## Commits

- One commit should carry one class of change.
- Do not mix feature work, doc rewrites, and unrelated cleanup into the same commit.
- Commit titles should state the actual change, not a vague summary.

Current repository history looks roughly like this:

- `docs(hpm): fix static image paths for Docusaurus`
- `docs: refresh site content and targeted docs updates`
- `fix(uart): handle late BLOCK completion after timeout`

## Syncing Mainline

Before submitting, keep the branch close to the current main development branch. If mainline has moved significantly, sync first and then continue resolving conflicts.

Avoid these patterns:

- one branch carrying feature work, doc rewrites, and unrelated cleanup together
- using a “temporary branch” as a long-lived official branch
- piling up fixup commits until the history is no longer reviewable
