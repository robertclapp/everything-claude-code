#!/usr/bin/env node
/**
 * Validate that the committed llms.txt is up to date with the repository.
 * Regenerates the index in memory and diffs it against the committed file so a
 * stale llms.txt (e.g. after adding an agent/skill/command) fails CI.
 */

const fs = require('fs');
const { generate, OUTPUT_PATH } = require('../generate-llms-txt');

function validateLlmsTxt() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error('ERROR: llms.txt is missing. Run `npm run llms` to generate it.');
    process.exit(1);
  }

  const expected = generate();
  const actual = fs.readFileSync(OUTPUT_PATH, 'utf-8');

  if (expected !== actual) {
    console.error('ERROR: llms.txt is out of date. Run `npm run llms` and commit the result.');
    process.exit(1);
  }

  console.log('llms.txt is up to date');
}

validateLlmsTxt();
