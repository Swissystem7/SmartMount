# Copilot instructions for SmartMount

## Stack
Primary language: JavaScript. Top-level files: .github, .gitignore, .nojekyll, 404.html, LICENSE, MONETIZATION.md, README.md, RESEARCH.md, alts, assets, case, config, dashboard, docs, firmware, fsm, geometry, hil, index.html, lab, package.json, power, protocol, runtime, scripts. Dependencies: .

## Build / test / lint
- Install: `npm ci` (or `npm install`)
- `npm run test` -> node --test
- `npm run sync-params` -> node scripts/sync-control-params.js
Always run the relevant checks above before opening a PR and report results in the PR body.

## Conventions
- Keep changes small and focused: one issue = one Draft PR.
- Branch prefix: `copilot/`. Never push to `master` and never merge.
- Follow existing code style and folder structure; don't add new dependencies without explaining why.
- Never commit secrets, tokens, or .env files.
- Write or update tests when changing logic; update README when behavior changes.