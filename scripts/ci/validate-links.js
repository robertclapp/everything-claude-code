#!/usr/bin/env node
/**
 * Validate internal markdown links across the repository.
 *
 * Walks the primary documentation/content trees, extracts relative links and
 * image references, and verifies each target file exists. This is the project's
 * first automated guard against broken internal links across 500+ markdown
 * files (including translations), which previously went undetected.
 *
 * External URLs (http/https/mailto/etc.) and pure in-page anchors (#section) are
 * skipped by default — link rot on the open web is out of scope for CI.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Directories never worth scanning for internal correctness.
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.cursor',
  '.codex',
  '.opencode',
  '.agents',
  'assets',
]);

/** Recursively collect markdown files under `dir`. */
function collectMarkdown(dir, acc) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      collectMarkdown(path.join(dir, entry.name), acc);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

/** Strip fenced and inline code so code samples don't produce false positives. */
function stripCode(content) {
  return content.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '');
}

const LINK_RE = /!?\[[^\]]*\]\(([^)]+)\)/g;

function isExternalOrAnchor(target) {
  return (
    target.startsWith('#') ||
    target.startsWith('mailto:') ||
    target.startsWith('tel:') ||
    /^[a-z][a-z0-9+.-]*:\/\//i.test(target) ||
    target.startsWith('//')
  );
}

/** Looks like a template placeholder rather than a real path. */
function isPlaceholder(target) {
  return /[<>${}]/.test(target) || target.includes('...');
}

function checkFile(file, errors) {
  const content = stripCode(fs.readFileSync(file, 'utf-8'));
  // LINK_RE is a module-level /g regex; reset state so a prior scan can't leak
  // its lastIndex into this file (defensive against future early-exits).
  LINK_RE.lastIndex = 0;
  let match;
  while ((match = LINK_RE.exec(content)) !== null) {
    let target = match[1].trim();

    // Markdown allows: [text](url "title") — drop the optional title.
    target = target.replace(/\s+["'].*$/, '');
    if (!target || isExternalOrAnchor(target) || isPlaceholder(target)) continue;

    // Drop in-page anchor and query string.
    const cleaned = target.split('#')[0].split('?')[0];
    if (!cleaned) continue;

    let decoded;
    try {
      decoded = decodeURIComponent(cleaned);
    } catch {
      decoded = cleaned;
    }

    const base = decoded.startsWith('/') ? ROOT : path.dirname(file);
    const resolved = path.resolve(base, decoded.replace(/^\//, ''));

    if (!fs.existsSync(resolved)) {
      errors.push(
        `${path.relative(ROOT, file)} -> ${target} (missing ${path.relative(ROOT, resolved)})`
      );
    }
  }
}

function validateLinks() {
  const files = collectMarkdown(ROOT, []);
  const errors = [];

  for (const file of files) {
    try {
      checkFile(file, errors);
    } catch (err) {
      errors.push(`${path.relative(ROOT, file)} - ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`ERROR: ${errors.length} broken internal link(s):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }

  console.log(`Checked internal links in ${files.length} markdown files — all valid`);
}

validateLinks();
