# Mayday Command

**Open-source help desk software for teams that run their own stack.**

A customer sends a Mayday. Your team picks it up, sees the full conversation, and knows who’s handling it. When the customer replies, the conversation continues on the same ticket.

Built by Carbon Digital.

> **Project status:** Early development. The features, repository layout, and deployment workflow below are planned. Installation instructions will be added with the first runnable release.

## Why Mayday Command?

Support teams need an inbox they can work out of, a clear owner for every request, and a history they can pick up where someone else left off. Self-hosters need readable source, documented configuration, and upgrades they can review before applying.

Mayday Command is built around that everyday workflow. Your team can run it on its own infrastructure under the MIT license.

## First release roadmap

- [ ] **Shared inbox** — See new and open requests in one place.
- [ ] **Email to ticket** — Turn incoming support email into tickets automatically and attach replies to the right conversation. Microsoft 365 is the first planned mail integration.
- [ ] **Web intake** — Give customers a public form to submit a request.
- [ ] **Replies and internal notes** — Keep customer correspondence and private team notes on the same ticket.
- [ ] **Assignment and status** — See who owns a request and what still needs attention.
- [ ] **Customer portal** — Let customers view and follow up on their requests.
- [ ] **Email connection checks** — Verify authentication, Inbox access, outbound delivery, and new-mail notifications separately so operators can see where setup failed.

## Architecture

Mayday Command is planned as a TypeScript monorepo managed with [Turborepo](https://turbo.build/). The web app and API share a repository and can share TypeScript contracts. Each app has its own build, runtime configuration, and deployment.

| App | Stack | Role |
| --- | --- | --- |
| `apps/api` | [NestJS](https://nestjs.com/) | Ticket data, permissions, email processing, and provider webhooks |
| `apps/web` | [Next.js](https://nextjs.org/) | Agent workspace, public intake form, and customer portal |

PostgreSQL is the planned database. Shared contracts and workspace tooling will live under `packages/`.

## Self-hosting

The planned setup starts from a tagged source checkout. Deploy the API and web app separately, with their own ports and environment files. The API connects to PostgreSQL and holds the mail provider credentials. The web app is configured with the API URL. Native Node.js deployment is a first-class path, with Docker optional.

## Upgrades

The planned upgrade CLI will use Git release tags and record the exact commit installed. Before applying an upgrade, it will compare the installed files with that release and report any local changes, whether they were committed or left in the working tree.

If someone has edited, added, or removed files in the application source, the updater will list the affected paths and stop before replacing the release or running database migrations. Operators can then review their changes and decide how to carry them forward. Instance configuration, ticket data, and attachments will live outside the replaceable source checkout.

## Contributing

If you’re proposing a feature or a substantial change, start with a [GitHub issue](https://github.com/carbondigitalus/mayday-command/issues). Describe the workflow, who it affects, and where it breaks down today.

## Inspiration

[Frappe Helpdesk](https://github.com/frappe/helpdesk) and Intercom are reference points for the agent and customer experience.

## License

[MIT](LICENSE)
