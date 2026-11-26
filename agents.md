# Agent Instructions

Instructions for AI coding agents working in the Mayday Command repository. `claude.md` imports this file.

## Project

Mayday Command is open-source help desk software, built by Carbon Digital and licensed under MIT. It's a Turborepo monorepo using npm workspaces.

- `apps/api`: NestJS API. Ticket data, permissions, email processing, and provider webhooks.
- `apps/portal`: Next.js app. Login and registration, the agent workspace, the public intake form, and the customer portal.
- `apps/web`: Next.js app. The public website at `maydaycommand.com`. It doesn't use the API.
- `packages/*`: shared ESLint, Jest, Prettier, and TypeScript configs, plus shared utilities.

The apps were copied from another project and are being converted one at a time. Expect leftover code, URLs, and env vars. Remove or replace them only in the area you've been asked to work on.

## Scope

- Work only in the app, package, or folder the user names. Don't read, search, or edit anything outside it unless the user asks.
- Run searches from inside the scoped folder, not from the repository root.
- If something outside the scope looks relevant, say so in one line and ask before looking.
- When the user asks a question, answer it. Don't start an investigation to answer it.
- On a numbered list of tasks, finish one item and wait for the go-ahead before starting the next.

## Accuracy

- Check before you claim anything, including what you have or haven't done in this session.
- At the end of each step, list every file you read, created, edited, or deleted. Flag anything outside the scope.
- Report check results as they are. If a check fails or was skipped, say so.

## Don't, without being asked

- Commit, push, or open pull requests.
- Install, add, or remove dependencies, or run `npm install`.
- Edit `.env*` files. They're gitignored and hold real values; tell the user which variables to set instead.
- Connect to a database, even to read. Give the user the SQL to run.
- Add GitHub Actions or other CI workflows.
- Suppress lint errors with `eslint-disable` comments. Fix the underlying issue.

## Conventions

- **File names:** lowercase, including `readme.md`, `license.md`, `agents.md`, and `claude.md`. Don't rename files to uppercase.
- **YAML:** use the `.yaml` extension.
- **Formatting:** Prettier, from `packages/prettier-config`: 4-space indentation, single quotes (also in JSX), 120-character lines, semicolons, and no trailing commas.
- **Acronyms in identifiers:** all caps, such as `SEOConfig`, `HTTPClientService`, `nextJSConfig`, and `userID`.
- **Import groups:** label them with comments: `// NPM Modules` for packages, then `// Custom Modules` for files in the same app or package. Root config files use `// Shared Modules` for workspace packages.
- **Comments:** apart from the import group labels, all comments are TSDoc (`/** ... */`). Don't use other `//` line comments or `/* ... */` block comments.
- **Object keys:** keep keys in config objects in alphabetical order, matching the existing configs.
- **JSX:** put `id` before `className`.
- **Commit messages:** short and lowercase, such as `setup web app root files`.
- **Branches:** `feature-short-description` or `bug-short-description`.

## Environment Variables

- Type each app's variables in `packages/typescript-config/src/<app>.d.ts` (`api.d.ts`, `portal.d.ts`, `web.d.ts`). The app's `tsconfig.json` includes that file and `global.d.ts`.
- Turborepo runs in strict env mode. A variable a build needs must be listed in that task's `env` array in `turbo.json`, or it's undefined during the build.

## Checks

These checks are mandatory. Run all five after every change, from the repository root, in this exact order:

1. `npm run format`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run test:unit`
5. `npm run test:e2e`

Rules:

- **Every change means every change.** That includes one-line fixes, config edits, and documentation. There are no exceptions for small or "safe" changes.
- **Use these exact commands.** Don't add `--filter`, don't run them from an app or package folder, and don't replace them with app-level scripts, `npx tsc`, `npx eslint`, `npx prettier --check`, or any other partial check. Partial checks can be extra, but never a substitute.
- **Run them in order.** Each check runs only after the one before it passes.
- **Stop at the first failure.** Fix the cause, then start again from step 1, not from the failed step.
- **A check that can't run is a failure.** For example, a missing script, a missing dependency, or a missing env variable. Report it; don't skip it or call it passed.
- **Report every result.** For each check, give the command, whether it passed or failed, and the relevant output for any failure. If `format` changed any files, list them.
- **The work isn't done until all five pass.** Don't describe a change as finished, working, or verified until they do. If you stop before all five pass, say which check failed and why.
