# @mayday-command/web

The Mayday Command public website, built with [Next.js](https://nextjs.org/).

Part of the `mayday-command` Turborepo. See the [root README](../../readme.md) for monorepo-wide setup.

## Development

From the repo root:

```sh
npx turbo run start:dev --filter=@mayday-command/web
```

Or from this directory directly:

```sh
npm run start:dev
```

The dev server runs on port 3060.

## Build

From the repo root:

```sh
npm run build:web
```

This also runs `next-sitemap` as a `postbuild` step, generating `public/robots.txt` and `public/sitemap*.xml` for the URL in `NEXT_PUBLIC_SITE_URL`.
