#!/usr/bin/env node
// Fetch every scraper provider from the repos in plugin-repos.json, transpile each
// to a Chromium-47 target with Babel, and publish:
//   providers.json       — array of { repoId, repoName, id, name, types, needsCheerio, code }
//   providers.meta.json  — build timestamp + per-repo counts (for quick inspection)
//
// The TV runtime (Tizen / legacy webOS) cannot transpile on-device, so this runs
// off-device (GitHub Action, daily) and the app fetches providers.json at runtime.
import { transformSync } from "@babel/core";
import { writeFileSync, readFileSync } from "node:fs";

const here = (name) => new URL(`./${name}`, import.meta.url);
const REPOS = (JSON.parse(readFileSync(here("plugin-repos.json"), "utf8")).repos || [])
  .filter((repo) => repo && repo.id && repo.base);

async function getText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function transpile(code) {
  const src = String(code).replace(/^#![^\n]*\n?/, "");
  return transformSync(src, {
    presets: [["@babel/preset-env", { targets: "chrome 47" }]],
    compact: true,
    comments: false,
    sourceType: "unambiguous",
  }).code;
}

const providers = [];
for (const repo of REPOS) {
  let manifest;
  try {
    manifest = JSON.parse(await getText(repo.base + "manifest.json"));
  } catch (e) {
    console.error(`[skip repo ${repo.id}] ${e.message}`);
    continue;
  }
  for (const sc of manifest.scrapers || []) {
    if (sc.enabled === false) continue;
    const file = sc.filename || `providers/${sc.id}.js`;
    try {
      const raw = await getText(repo.base + file);
      const code = transpile(raw);
      providers.push({
        repoId: repo.id,
        repoName: manifest.name || repo.id,
        id: sc.id,
        name: sc.name || sc.id,
        types: sc.supportedTypes || ["movie", "tv"],
        needsCheerio: /require\(["']cheerio/.test(raw),
        code,
      });
      console.error(`[ok] ${repo.id}/${sc.id} (${raw.length}->${code.length}b)`);
    } catch (e) {
      console.error(`[skip ${repo.id}/${sc.id}] ${e.message}`);
    }
  }
}

// Dedupe by scraper id (first wins).
const seen = new Set();
const deduped = providers.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));

writeFileSync(here("providers.json"), JSON.stringify(deduped));

const meta = {
  builtAt: new Date().toISOString(),
  count: deduped.length,
  repos: REPOS.map((r) => ({
    id: r.id,
    count: deduped.filter((p) => p.repoId === r.id).length,
  })),
};
writeFileSync(here("providers.meta.json"), JSON.stringify(meta, null, 2));

console.error(`\nWROTE ${deduped.length} providers across ${REPOS.length} repos`);
