#!/usr/bin/env node
/**
 * Validate that the version string is identical across every manifest that
 * declares one. Drift between these files produces broken installs and release
 * mismatches; CI only enforced tag-vs-plugin.json before this check existed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// [label, file path, function returning the version from parsed JSON]
const SOURCES = [
  ['package.json', 'package.json', (j) => j.version],
  ['.claude-plugin/plugin.json', '.claude-plugin/plugin.json', (j) => j.version],
  [
    '.claude-plugin/marketplace.json',
    '.claude-plugin/marketplace.json',
    (j) => j.plugins && j.plugins[0] && j.plugins[0].version,
  ],
  ['.opencode/package.json', '.opencode/package.json', (j) => j.version],
];

function validateVersionSync() {
  const found = [];
  let hasErrors = false;

  for (const [label, rel, pick] of SOURCES) {
    const filePath = path.join(ROOT, rel);
    if (!fs.existsSync(filePath)) {
      // Optional manifests are skipped rather than failing.
      continue;
    }
    try {
      const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      const version = pick(json);
      if (!version) {
        console.error(`ERROR: ${label} - no version field found`);
        hasErrors = true;
        continue;
      }
      found.push([label, version]);
    } catch (err) {
      console.error(`ERROR: ${label} - ${err.message}`);
      hasErrors = true;
    }
  }

  if (found.length > 0) {
    const reference = found[0][1];
    for (const [label, version] of found) {
      if (version !== reference) {
        console.error(
          `ERROR: version mismatch — ${label} is ${version}, expected ${reference} (from ${found[0][0]})`
        );
        hasErrors = true;
      }
    }
  }

  if (hasErrors) {
    console.error('\nFix: set the same version in all manifests (or run ./scripts/release.sh).');
    process.exit(1);
  }

  console.log(
    `Version in sync (${found[0] ? found[0][1] : 'n/a'}) across ${found.length} manifests`
  );
}

validateVersionSync();
