# nuvio-tizen-providers

Daily-built, public bundle of **Nuvio scraper providers transpiled to Chromium 47**,
for Samsung **Tizen** and legacy **webOS** TVs.

## Why this exists

Tizen 3.0 / older webOS ship Chromium ~47. That engine cannot parse modern JavaScript
(`async/await`, `?.`, `??`, object spread, `**`) and cannot run a transpiler on-device.
Provider repos are written in modern JS, so they must be transpiled **ahead of time**,
off-device. This repo does that automatically and publishes a ready-to-run bundle.

## Use it

Fetch the bundle directly (no build, no auth):

```
https://raw.githubusercontent.com/fvaha/nuvio-tizen-providers/main/providers.json
https://raw.githubusercontent.com/fvaha/nuvio-tizen-providers/main/providers.meta.json
```

`providers.json` is an array of:

```jsonc
{
  "repoId": "yoru",
  "repoName": "Yoru's Repo",
  "id": "4khdhub",
  "name": "4KHDHub",
  "types": ["movie", "tv"],
  "needsCheerio": true,
  "code": "/* chrome-47 transpiled CommonJS module exporting getStreams(...) */"
}
```

Each `code` is a CommonJS module that exports
`getStreams(tmdbId, type, season, episode)` and can be executed on-device with
`new Function("module","exports","require", code)` (provide a `cheerio` shim when
`needsCheerio` is true).

`providers.meta.json` holds the build timestamp and per-repo provider counts.

## How it stays fresh

A GitHub Action (`.github/workflows/build.yml`) runs:

- **daily** (04:00 UTC),
- on **manual dispatch**, and
- whenever `plugin-repos.json` or `build.mjs` changes,

then transpiles every provider and commits the updated `providers.json`.

## Add a provider repo

Edit [`plugin-repos.json`](plugin-repos.json):

```jsonc
{ "id": "myrepo", "base": "https://raw.githubusercontent.com/<owner>/<repo>/refs/heads/main/" }
```

The repo must expose `manifest.json` listing its `scrapers`. Commit — the Action
rebuilds the bundle.

## Build locally

```bash
npm install
npm run build   # writes providers.json + providers.meta.json
```

## Credits

Providers are authored and maintained by their respective repo owners (see
`plugin-repos.json`). This repo only transpiles and republishes them for the
Chromium-47 TV runtime.
