# Contributing to Mayday Command

Thanks for your interest in contributing! This guide covers how to propose changes, set up the repository, and open a pull request.

> **Project status:** Mayday Command is in early development. The repository layout is still changing, and some apps under `apps/` have not been adapted yet.

## Before You Start

- **Bugs:** Open a [Bug Report](https://github.com/carbondigitalus/mayday-command/issues/new/choose).
- **Features and substantial changes:** Open a [Feature Request](https://github.com/carbondigitalus/mayday-command/issues/new/choose) first. Describe the workflow, who it affects (agents, customers, or operators), and where it breaks down today. Agreeing on the approach before writing code saves everyone time.
- **Questions:** Open a [Support Request](https://github.com/carbondigitalus/mayday-command/issues/new/choose).
- **Security vulnerabilities:** Do **not** open a public issue. Follow the [security policy](security.md).

Search existing issues (open and closed) before opening a new one.

## Development Setup

### Prerequisites

- Node.js, at the version in [`.nvmrc`](../.nvmrc) (run `nvm use` if you use nvm)
- npm 11
- PostgreSQL

### Install

Mayday Command is a [Turborepo](https://turbo.build/) monorepo using npm workspaces. Install dependencies once from the repository root:

```sh
git clone https://github.com/carbondigitalus/mayday-command.git
cd mayday-command
npm install
```

Don't run `npm install` inside individual apps or packages.

### Repository Layout

| Path          | Contents                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------- |
| `apps/api`    | NestJS API: ticket data, permissions, email processing, and provider webhooks                 |
| `apps/portal` | Next.js app: login and registration, agent workspace, public intake form, and customer portal |
| `apps/web`    | Next.js app: public website                                                                   |
| `packages/*`  | Shared code and tooling (ESLint, Jest, Prettier, and TypeScript configs; shared utilities)    |

### Run

```sh
npm run start:dev
```

## Making Changes

### Branches

Branch from `main` and name your branch by the type of change:

- `feature/short-description` for new features and enhancements
- `fix/short-description` for bug fixes

### Code Style

Formatting and linting use the shared configs in `packages/prettier-config` and `packages/eslint-config`. Fix lint errors instead of suppressing them.

### Checks

Run all checks from the repository root before opening a pull request:

```sh
npm run format
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
```

Add or update tests for the behavior you change.

## Pull Requests

1. Fill out the pull request template, and link the related issue (for example, `Closes #123`).
2. Keep each pull request focused on one change.
3. Write the release notes for agents, customers, or operators. If operators need to do anything when upgrading (environment variables, database migrations, or mail provider setup), explain what.
4. Add the `breaking change` label if existing installations need manual steps to upgrade.

## License

Mayday Command is licensed under the [MIT License](../license.md). By contributing, you agree that your contributions are licensed under the same terms.
