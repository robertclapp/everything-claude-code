/**
 * Tests for scripts/generate-llms-txt.js
 *
 * Tests the exported generate() function and OUTPUT_PATH, plus the internal
 * utility functions (readFrontmatterField, firstSentence) by extracting them
 * via source evaluation.
 *
 * Run with: node tests/scripts/generate-llms-txt.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'generate-llms-txt.js');

// Test helpers
function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    return true;
  } catch (err) {
    console.log(`  \u2717 ${name}`);
    console.log(`    Error: ${err.message}`);
    return false;
  }
}

function createTestDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'generate-llms-txt-test-'));
}

function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

/**
 * Run a Node.js snippet that requires generate-llms-txt and evaluates an expression.
 * Patches ROOT_DIR to point to the given directory.
 */
function runWithRootDir(overrideRootDir, snippet) {
  let source = fs.readFileSync(scriptPath, 'utf8');
  source = source.replace(/^#!.*\n/, '');
  // Replace ROOT_DIR constant
  source = source.replace(
    /const ROOT_DIR = .*?;/,
    `const ROOT_DIR = ${JSON.stringify(overrideRootDir)};`
  );
  // Remove the main guard and module.exports, then add the snippet
  source = source.replace(/if \(require\.main === module\)[\s\S]*$/, '');
  source += `\n${snippet}`;

  try {
    const stdout = execFileSync('node', ['-e', source], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    return { code: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
    };
  }
}

/**
 * Run a snippet that only uses the internal utility functions (no filesystem).
 */
function runUtilitySnippet(snippet) {
  let source = fs.readFileSync(scriptPath, 'utf8');
  source = source.replace(/^#!.*\n/, '');
  source = source.replace(/if \(require\.main === module\)[\s\S]*$/, '');
  source += `\n${snippet}`;

  try {
    const stdout = execFileSync('node', ['-e', source], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    });
    return { code: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim(),
    };
  }
}

function runTests() {
  console.log('\n=== Testing scripts/generate-llms-txt.js ===\n');

  let passed = 0;
  let failed = 0;

  // ==========================================
  // Exported API
  // ==========================================
  console.log('Exported API:');

  // Require the module for direct tests
  const mod = require(scriptPath);

  if (
    test('exports generate function', () => {
      assert.strictEqual(typeof mod.generate, 'function', 'generate should be a function');
    })
  )
    passed++;
  else failed++;

  if (
    test('exports OUTPUT_PATH string', () => {
      assert.strictEqual(typeof mod.OUTPUT_PATH, 'string', 'OUTPUT_PATH should be a string');
      assert.ok(mod.OUTPUT_PATH.endsWith('llms.txt'), 'OUTPUT_PATH should end with llms.txt');
    })
  )
    passed++;
  else failed++;

  if (
    test('OUTPUT_PATH points to root of project', () => {
      const projectRoot = path.join(__dirname, '..', '..');
      assert.ok(
        mod.OUTPUT_PATH.startsWith(projectRoot),
        `OUTPUT_PATH should be in project root, got: ${mod.OUTPUT_PATH}`
      );
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // generate() output structure
  // ==========================================
  console.log('\ngenerate() output structure:');

  if (
    test('generate() returns a non-empty string', () => {
      const output = mod.generate();
      assert.strictEqual(typeof output, 'string', 'Should return a string');
      assert.ok(output.length > 0, 'Should not be empty');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() starts with # Everything Claude Code header', () => {
      const output = mod.generate();
      assert.ok(output.startsWith('# Everything Claude Code'), 'Should start with correct header');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() contains blockquote description', () => {
      const output = mod.generate();
      assert.ok(output.includes('> A comprehensive'), 'Should include description blockquote');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() contains auto-generated notice', () => {
      const output = mod.generate();
      assert.ok(
        output.includes('auto-generated'),
        'Should include auto-generated notice'
      );
      assert.ok(output.includes('npm run llms'), 'Should reference npm run llms command');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() contains Documentation section', () => {
      const output = mod.generate();
      assert.ok(output.includes('## Documentation'), 'Should include Documentation section');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() contains Agents section with count', () => {
      const output = mod.generate();
      assert.ok(/## Agents \(\d+\)/.test(output), 'Should include Agents section with count');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() contains Skills section with count', () => {
      const output = mod.generate();
      assert.ok(/## Skills \(\d+\)/.test(output), 'Should include Skills section with count');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() contains Commands section with count', () => {
      const output = mod.generate();
      assert.ok(
        /## Commands \(\d+\)/.test(output),
        'Should include Commands section with count'
      );
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() contains Optional section', () => {
      const output = mod.generate();
      assert.ok(output.includes('## Optional'), 'Should include Optional section');
      assert.ok(output.includes('Rules'), 'Should mention Rules');
      assert.ok(output.includes('Hooks'), 'Should mention Hooks');
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() output matches committed llms.txt', () => {
      const committed = fs.readFileSync(mod.OUTPUT_PATH, 'utf8');
      const generated = mod.generate();
      assert.strictEqual(
        generated,
        committed,
        'generate() output must match the committed llms.txt'
      );
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // generate() with custom root directory
  // ==========================================
  console.log('\ngenerate() with custom directories:');

  if (
    test('generate() with empty agents dir produces Agents (0)', () => {
      const testDir = createTestDir();
      fs.mkdirSync(path.join(testDir, 'agents'));
      fs.mkdirSync(path.join(testDir, 'skills'));
      fs.mkdirSync(path.join(testDir, 'commands'));

      const result = runWithRootDir(
        testDir,
        'process.stdout.write(generate());'
      );
      assert.strictEqual(result.code, 0, `Expected exit 0, stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('## Agents (0)'), 'Should show Agents (0)');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() lists agent from agents directory', () => {
      const testDir = createTestDir();
      fs.mkdirSync(path.join(testDir, 'agents'));
      fs.mkdirSync(path.join(testDir, 'skills'));
      fs.mkdirSync(path.join(testDir, 'commands'));
      fs.writeFileSync(
        path.join(testDir, 'agents', 'my-agent.md'),
        '---\nname: my-agent\ndescription: A test agent for unit testing.\nmodel: sonnet\ntools: Read\n---\n# My Agent'
      );

      const result = runWithRootDir(testDir, 'process.stdout.write(generate());');
      assert.strictEqual(result.code, 0, `Expected exit 0, stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('## Agents (1)'), 'Should show Agents (1)');
      assert.ok(result.stdout.includes('my-agent'), 'Should include agent name');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() uses agent name from frontmatter if present', () => {
      const testDir = createTestDir();
      fs.mkdirSync(path.join(testDir, 'agents'));
      fs.mkdirSync(path.join(testDir, 'skills'));
      fs.mkdirSync(path.join(testDir, 'commands'));
      fs.writeFileSync(
        path.join(testDir, 'agents', 'file-name.md'),
        '---\nname: custom-name\nmodel: sonnet\ntools: Read\n---\n# Custom'
      );

      const result = runWithRootDir(testDir, 'process.stdout.write(generate());');
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.ok(result.stdout.includes('custom-name'), 'Should use frontmatter name');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() lists command with slash prefix', () => {
      const testDir = createTestDir();
      fs.mkdirSync(path.join(testDir, 'agents'));
      fs.mkdirSync(path.join(testDir, 'skills'));
      fs.mkdirSync(path.join(testDir, 'commands'));
      fs.writeFileSync(
        path.join(testDir, 'commands', 'my-cmd.md'),
        '---\ndescription: A useful command.\n---\n# My Command'
      );

      const result = runWithRootDir(testDir, 'process.stdout.write(generate());');
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.ok(result.stdout.includes('/my-cmd'), 'Should prefix command name with /');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() lists skill from skills/name/SKILL.md', () => {
      const testDir = createTestDir();
      fs.mkdirSync(path.join(testDir, 'agents'));
      const skillDir = path.join(testDir, 'skills', 'my-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.mkdirSync(path.join(testDir, 'commands'));
      fs.writeFileSync(
        path.join(skillDir, 'SKILL.md'),
        '---\nname: my-skill\ndescription: A great skill.\n---\n# My Skill'
      );

      const result = runWithRootDir(testDir, 'process.stdout.write(generate());');
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.ok(result.stdout.includes('## Skills (1)'), 'Should show Skills (1)');
      assert.ok(result.stdout.includes('my-skill'), 'Should list the skill');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('generate() ignores skill directory without SKILL.md', () => {
      const testDir = createTestDir();
      fs.mkdirSync(path.join(testDir, 'agents'));
      // Skill directory exists but no SKILL.md
      const skillDir = path.join(testDir, 'skills', 'incomplete-skill');
      fs.mkdirSync(skillDir, { recursive: true });
      fs.writeFileSync(path.join(skillDir, 'README.md'), '# Not a SKILL.md');
      fs.mkdirSync(path.join(testDir, 'commands'));

      const result = runWithRootDir(testDir, 'process.stdout.write(generate());');
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.ok(result.stdout.includes('## Skills (0)'), 'Should show Skills (0) without SKILL.md');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // readFrontmatterField utility
  // ==========================================
  console.log('\nreadFrontmatterField():');

  if (
    test('extracts simple string field from frontmatter', () => {
      const snippet = `
const content = '---\\nname: test-agent\\nmodel: sonnet\\n---\\n# Body';
process.stdout.write(readFrontmatterField(content, 'name') || 'null');
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'test-agent', 'Should extract name field');
    })
  )
    passed++;
  else failed++;

  if (
    test('returns null when field is absent from frontmatter', () => {
      const snippet = `
const content = '---\\nmodel: sonnet\\n---\\n# Body';
const val = readFrontmatterField(content, 'name');
process.stdout.write(val === null ? 'null' : String(val));
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'null', 'Should return null for missing field');
    })
  )
    passed++;
  else failed++;

  if (
    test('returns null when there is no frontmatter', () => {
      const snippet = `
const content = '# No frontmatter here\\nJust content.';
const val = readFrontmatterField(content, 'name');
process.stdout.write(val === null ? 'null' : String(val));
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'null', 'Should return null without frontmatter');
    })
  )
    passed++;
  else failed++;

  if (
    test('strips surrounding quotes from field value', () => {
      const snippet = `
const content = '---\\nname: "quoted-name"\\n---';
process.stdout.write(readFrontmatterField(content, 'name') || 'null');
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'quoted-name', 'Should strip surrounding quotes');
    })
  )
    passed++;
  else failed++;

  if (
    test('handles BOM and CRLF in frontmatter', () => {
      const snippet = `
const content = '\\uFEFF---\\r\\nname: bom-agent\\r\\nmodel: sonnet\\r\\n---\\r\\n# Body';
process.stdout.write(readFrontmatterField(content, 'name') || 'null');
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'bom-agent', 'Should handle BOM and CRLF');
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // firstSentence utility
  // ==========================================
  console.log('\nfirstSentence():');

  if (
    test('extracts first sentence ending with period followed by space', () => {
      const snippet = `
const result = firstSentence('Hello world. This is the second sentence.');
process.stdout.write(result);
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'Hello world.', 'Should extract first sentence');
    })
  )
    passed++;
  else failed++;

  if (
    test('returns whole text if no sentence break found', () => {
      const snippet = `
const result = firstSentence('No sentence break here');
process.stdout.write(result);
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'No sentence break here', 'Should return full text');
    })
  )
    passed++;
  else failed++;

  if (
    test('truncates text exceeding max length', () => {
      const snippet = `
const longText = 'A'.repeat(200);
const result = firstSentence(longText, 50);
process.stdout.write(String(result.length));
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      const len = parseInt(result.stdout, 10);
      assert.ok(len <= 50, `Should not exceed max length (got ${len})`);
    })
  )
    passed++;
  else failed++;

  if (
    test('truncates with ellipsis when text exceeds max', () => {
      const snippet = `
const longText = 'A'.repeat(200);
const result = firstSentence(longText, 50);
process.stdout.write(result.endsWith('\\u2026') ? 'yes' : 'no');
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, 'yes', 'Should end with ellipsis when truncated');
    })
  )
    passed++;
  else failed++;

  if (
    test('returns empty string for empty input', () => {
      const snippet = `
const result = firstSentence('');
process.stdout.write(JSON.stringify(result));
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      assert.strictEqual(result.stdout, '""', 'Should return empty string for empty input');
    })
  )
    passed++;
  else failed++;

  if (
    test('normalizes internal whitespace', () => {
      const snippet = `
const result = firstSentence('Hello   world.  More text.');
process.stdout.write(result);
`;
      const result = runUtilitySnippet(snippet);
      assert.strictEqual(result.code, 0, `Expected exit 0`);
      // The first sentence should be found — whitespace is normalized
      assert.ok(result.stdout.includes('Hello'), 'Should include the content');
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Summary
  // ==========================================
  console.log(`\nPassed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed > 0) process.exit(1);
}

runTests();
