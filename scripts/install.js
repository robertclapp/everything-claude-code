#!/usr/bin/env node
/**
 * install.js — Cross-platform installer for everything-claude-code.
 *
 * This is the npm `bin` entry point (`ecc-install`). It works on Windows,
 * macOS, and Linux without requiring bash, replacing the previous `install.sh`
 * bin target which broke on Windows (no bash interpreter).
 *
 * `install.sh` is kept for users who prefer invoking the shell script directly
 * on POSIX systems; both implement identical behavior.
 *
 * Usage:
 *   ecc-install [--target <claude|cursor>] <language> [<language> ...]
 *
 * Examples:
 *   ecc-install typescript
 *   ecc-install typescript python golang
 *   ecc-install --target cursor typescript
 *
 * Targets:
 *   claude  (default) — Install rules to ~/.claude/rules/
 *   cursor            — Install rules, agents, skills, commands, MCP to ./.cursor/
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// Repo root is the directory that contains this script's parent (scripts/..).
const ROOT_DIR = path.resolve(__dirname, '..');
const RULES_DIR = path.join(ROOT_DIR, 'rules');
const CURSOR_SRC = path.join(ROOT_DIR, '.cursor');

const VALID_LANG = /^[a-zA-Z0-9_-]+$/;

function info(msg) {
  process.stdout.write(`${msg}\n`);
}
function warn(msg) {
  process.stderr.write(`${msg}\n`);
}

function listLanguages() {
  if (!fs.existsSync(RULES_DIR)) return [];
  return fs
    .readdirSync(RULES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'common')
    .map((d) => d.name)
    .sort();
}

function printUsage() {
  info('Usage: ecc-install [--target <claude|cursor>] <language> [<language> ...]');
  info('');
  info('Targets:');
  info('  claude  (default) — Install rules to ~/.claude/rules/');
  info('  cursor            — Install rules, agents, skills, commands, and MCP to ./.cursor/');
  info('');
  info('Available languages:');
  for (const name of listLanguages()) info(`  - ${name}`);
}

/** Recursively copy the *contents* of `src` into `dest` (like `cp -r src/. dest/`). */
function copyContents(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

function installClaude(languages) {
  const destDir = process.env.CLAUDE_RULES_DIR || path.join(os.homedir(), '.claude', 'rules');

  if (fs.existsSync(destDir) && fs.readdirSync(destDir).length > 0) {
    info(`Note: ${destDir}/ already exists. Existing files will be overwritten.`);
    info('      Back up any local customizations before proceeding.');
  }

  info(`Installing common rules -> ${path.join(destDir, 'common')}/`);
  copyContents(path.join(RULES_DIR, 'common'), path.join(destDir, 'common'));

  for (const lang of languages) {
    if (!VALID_LANG.test(lang)) {
      warn(
        `Error: invalid language name '${lang}'. Only alphanumeric, dash, and underscore allowed.`
      );
      continue;
    }
    const langDir = path.join(RULES_DIR, lang);
    if (!fs.existsSync(langDir)) {
      warn(`Warning: rules/${lang}/ does not exist, skipping.`);
      continue;
    }
    info(`Installing ${lang} rules -> ${path.join(destDir, lang)}/`);
    copyContents(langDir, path.join(destDir, lang));
  }

  info(`Done. Rules installed to ${destDir}/`);
}

function installCursor(languages) {
  const destDir = '.cursor';
  info(`Installing Cursor configs to ${destDir}/`);

  const cursorRules = path.join(CURSOR_SRC, 'rules');
  const destRules = path.join(destDir, 'rules');

  // Common rules (flattened names like common-coding-style.md)
  if (fs.existsSync(cursorRules)) {
    info(`Installing common rules -> ${destRules}/`);
    fs.mkdirSync(destRules, { recursive: true });
    for (const f of fs.readdirSync(cursorRules)) {
      if (f.startsWith('common-') && f.endsWith('.md')) {
        fs.copyFileSync(path.join(cursorRules, f), path.join(destRules, f));
      }
    }
  }

  // Language-specific rules
  for (const lang of languages) {
    if (!VALID_LANG.test(lang)) {
      warn(
        `Error: invalid language name '${lang}'. Only alphanumeric, dash, and underscore allowed.`
      );
      continue;
    }
    if (!fs.existsSync(cursorRules)) continue;
    let found = false;
    for (const f of fs.readdirSync(cursorRules)) {
      if (f.startsWith(`${lang}-`) && f.endsWith('.md')) {
        fs.copyFileSync(path.join(cursorRules, f), path.join(destRules, f));
        found = true;
      }
    }
    info(
      found
        ? `Installing ${lang} rules -> ${destRules}/`
        : `Warning: no Cursor rules for '${lang}' found, skipping.`
    );
  }

  // Directory-based configs
  for (const sub of ['agents', 'skills', 'commands', 'hooks']) {
    const srcSub = path.join(CURSOR_SRC, sub);
    if (fs.existsSync(srcSub)) {
      info(`Installing ${sub} -> ${path.join(destDir, sub)}/`);
      copyContents(srcSub, path.join(destDir, sub));
    }
  }

  // Single-file configs
  for (const file of ['hooks.json', 'mcp.json']) {
    const srcFile = path.join(CURSOR_SRC, file);
    if (fs.existsSync(srcFile)) {
      info(`Installing ${file} -> ${path.join(destDir, file)}`);
      fs.mkdirSync(destDir, { recursive: true });
      fs.copyFileSync(srcFile, path.join(destDir, file));
    }
  }

  info(`Done. Cursor configs installed to ${destDir}/`);
}

function main(argv) {
  const args = argv.slice(2);

  let target = 'claude';
  if (args[0] === '--target') {
    if (!args[1]) {
      warn('Error: --target requires a value (claude or cursor)');
      return 1;
    }
    target = args[1];
    args.splice(0, 2);
  }

  if (target !== 'claude' && target !== 'cursor') {
    warn(`Error: unknown target '${target}'. Must be 'claude' or 'cursor'.`);
    return 1;
  }

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    return args[0] === '--help' || args[0] === '-h' ? 0 : 1;
  }

  if (target === 'claude') installClaude(args);
  else installCursor(args);

  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = { main, listLanguages };
