#!/usr/bin/env node
/**
 * Validate skill directories have SKILL.md with required structure
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '../../skills');

/** Read a single-line frontmatter field value, or null. */
function frontmatterField(content, field) {
  const match = content.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const line = match[1].split(/\r?\n/).find((l) => l.trim().startsWith(`${field}:`));
  if (!line) return null;
  return line
    .slice(line.indexOf(':') + 1)
    .trim()
    .replace(/^["']|["']$/g, '');
}

function validateSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log('No skills directory found, skipping validation');
    process.exit(0);
  }

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  let hasErrors = false;
  let validCount = 0;
  const seenNames = new Map();

  for (const dir of dirs) {
    const skillMd = path.join(SKILLS_DIR, dir, 'SKILL.md');
    if (!fs.existsSync(skillMd)) {
      console.error(`ERROR: ${dir}/ - Missing SKILL.md`);
      hasErrors = true;
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(skillMd, 'utf-8');
    } catch (err) {
      console.error(`ERROR: ${dir}/SKILL.md - ${err.message}`);
      hasErrors = true;
      continue;
    }
    if (content.trim().length === 0) {
      console.error(`ERROR: ${dir}/SKILL.md - Empty file`);
      hasErrors = true;
      continue;
    }

    // When a skill declares a frontmatter name, enforce that it matches the
    // directory and is unique. (Name is not strictly required so simpler skills
    // and minimal fixtures remain valid.)
    const name = frontmatterField(content, 'name');
    if (name) {
      if (name !== dir) {
        console.error(`ERROR: ${dir}/SKILL.md - name '${name}' does not match directory '${dir}'`);
        hasErrors = true;
      }
      if (seenNames.has(name)) {
        console.error(
          `ERROR: ${dir}/SKILL.md - duplicate name '${name}' (also in ${seenNames.get(name)})`
        );
        hasErrors = true;
      } else {
        seenNames.set(name, `${dir}/SKILL.md`);
      }
    }

    validCount++;
  }

  if (hasErrors) {
    process.exit(1);
  }

  console.log(`Validated ${validCount} skill directories`);
}

validateSkills();
