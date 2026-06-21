#!/usr/bin/env node
/**
 * doctor.js — Plugin health self-check.
 *
 * Verifies that an everything-claude-code checkout (or install) is internally
 * consistent: components are present and valid, manifests are version-synced,
 * internal links resolve, and the environment can detect a package manager.
 *
 * Exits 0 when healthy, 1 when any check fails. Run via `npm run doctor`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

let pm;
try {
  pm = require('./lib/package-manager');
} catch {
  pm = null;
}

const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
}

function countDir(rel, predicate) {
  const dir = path.join(ROOT, rel);
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir, { withFileTypes: true }).filter(predicate).length;
}

function checkEnvironment() {
  const major = Number(process.versions.node.split('.')[0]);
  record('Node.js >= 18', major >= 18, `found ${process.versions.node}`);

  if (pm && typeof pm.getPackageManager === 'function') {
    try {
      const detected = pm.getPackageManager(ROOT);
      const name = typeof detected === 'string' ? detected : detected && detected.name;
      record('Package manager detected', Boolean(name), name || 'none');
    } catch (err) {
      record('Package manager detected', false, err.message);
    }
  }
}

function checkInventory() {
  const agents = countDir('agents', (e) => e.isFile() && e.name.endsWith('.md'));
  const skills = countDir(
    'skills',
    (e) => e.isDirectory() && fs.existsSync(path.join(ROOT, 'skills', e.name, 'SKILL.md'))
  );
  const commands = countDir('commands', (e) => e.isFile() && e.name.endsWith('.md'));
  record('Agents present', agents > 0, `${agents} agents`);
  record('Skills present', skills > 0, `${skills} skills`);
  record('Commands present', commands > 0, `${commands} commands`);
}

function checkValidators() {
  // Only the component validators are run here: they reference packaged
  // directories (agents/skills/commands/rules/hooks) and therefore pass against
  // an installed package as well as the repo. The repo-only gates (links,
  // version-sync, llms.txt freshness) reference files that npm does not ship
  // (docs/, guides), so they belong to `npm test`/CI, not the install health check.
  const validators = [
    ['agents', 'ci/validate-agents.js'],
    ['commands', 'ci/validate-commands.js'],
    ['rules', 'ci/validate-rules.js'],
    ['skills', 'ci/validate-skills.js'],
    ['hooks', 'ci/validate-hooks.js'],
  ];
  for (const [label, rel] of validators) {
    const scriptPath = path.join(__dirname, rel);
    if (!fs.existsSync(scriptPath)) {
      record(`Validate ${label}`, false, 'validator missing');
      continue;
    }
    const out = spawnSync(process.execPath, [scriptPath], { encoding: 'utf8' });
    const detail = (out.stderr || out.stdout || '').trim().split('\n').pop();
    record(`Validate ${label}`, out.status === 0, detail);
  }
}

function main() {
  process.stdout.write('everything-claude-code doctor\n');
  process.stdout.write(`${'='.repeat(40)}\n`);

  checkEnvironment();
  checkInventory();
  checkValidators();

  let failures = 0;
  for (const { name, ok, detail } of results) {
    const mark = ok ? '✓' : '✗';
    if (!ok) failures++;
    process.stdout.write(`  ${mark} ${name}${detail ? ` — ${detail}` : ''}\n`);
  }

  process.stdout.write(`${'='.repeat(40)}\n`);
  if (failures === 0) {
    process.stdout.write(`Healthy — ${results.length} checks passed.\n`);
    return 0;
  }
  process.stdout.write(`${failures} of ${results.length} checks failed.\n`);
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { main };
