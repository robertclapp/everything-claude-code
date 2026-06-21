/**
 * Tests for scripts/ci/validate-llms-txt.js
 *
 * Tests all three code paths: missing file, stale file, and up-to-date file.
 * Uses source-patching to replace the generate-llms-txt import with
 * inline test fixtures, enabling isolated unit testing.
 *
 * Run with: node tests/ci/validate-llms-txt.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const validatorPath = path.join(
  __dirname,
  '..',
  '..',
  'scripts',
  'ci',
  'validate-llms-txt.js'
);

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'validate-llms-txt-test-'));
}

function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

/**
 * Run validate-llms-txt.js with the generate-llms-txt import replaced.
 *
 * @param {string} outputFilePath - path to use as OUTPUT_PATH
 * @param {string} generatedContent - what generate() should return
 */
function runWithMocks(outputFilePath, generatedContent) {
  let source = fs.readFileSync(validatorPath, 'utf8');
  source = source.replace(/^#!.*\n/, '');

  // Replace the require with inline mock definitions
  const requireLine = `const { generate, OUTPUT_PATH } = require('../generate-llms-txt');`;
  const mockCode =
    `const OUTPUT_PATH = ${JSON.stringify(outputFilePath)};\n` +
    `const generate = () => ${JSON.stringify(generatedContent)};`;
  source = source.replace(requireLine, mockCode);

  try {
    const stdout = execFileSync('node', ['-e', source], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 10000,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

/**
 * Run the real validator against the actual project.
 */
function runValidator() {
  try {
    const stdout = execFileSync('node', [validatorPath], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 15000,
    });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      code: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

function runTests() {
  console.log('\n=== Testing validate-llms-txt.js ===\n');

  let passed = 0;
  let failed = 0;

  // ==========================================
  // Real project smoke test
  // ==========================================
  console.log('Real project:');

  if (
    test('passes on real project (llms.txt is up to date)', () => {
      const result = runValidator();
      assert.strictEqual(result.code, 0, `Should pass, got stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('up to date'), 'Should confirm llms.txt is up to date');
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Missing file
  // ==========================================
  console.log('\nMissing llms.txt:');

  if (
    test('fails when OUTPUT_PATH file does not exist', () => {
      const testDir = createTestDir();
      const nonExistentPath = path.join(testDir, 'llms.txt');
      // Do not create the file

      const result = runWithMocks(nonExistentPath, '# Generated Content\n');
      assert.strictEqual(result.code, 1, 'Should fail when llms.txt is missing');
      assert.ok(result.stderr.includes('missing'), 'Should report file is missing');
      assert.ok(
        result.stderr.includes('npm run llms'),
        'Should suggest running npm run llms'
      );
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Stale / outdated file
  // ==========================================
  console.log('\nStale llms.txt:');

  if (
    test('fails when committed llms.txt differs from generated content', () => {
      const testDir = createTestDir();
      const llmsPath = path.join(testDir, 'llms.txt');
      const committedContent = '# Old Content\n- old entry\n';
      const freshContent = '# New Content\n- new entry\n';
      fs.writeFileSync(llmsPath, committedContent, 'utf8');

      const result = runWithMocks(llmsPath, freshContent);
      assert.strictEqual(result.code, 1, 'Should fail when content differs');
      assert.ok(result.stderr.includes('out of date'), 'Should report file is out of date');
      assert.ok(
        result.stderr.includes('npm run llms'),
        'Should suggest running npm run llms'
      );
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('fails when llms.txt has extra whitespace vs generated', () => {
      const testDir = createTestDir();
      const llmsPath = path.join(testDir, 'llms.txt');
      const content = '# Content\n';
      // Add trailing whitespace to make them differ
      fs.writeFileSync(llmsPath, content + '   ', 'utf8');

      const result = runWithMocks(llmsPath, content);
      assert.strictEqual(result.code, 1, 'Should fail on whitespace difference');
      assert.ok(result.stderr.includes('out of date'), 'Should report out of date');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('fails when llms.txt is missing a new agent entry', () => {
      const testDir = createTestDir();
      const llmsPath = path.join(testDir, 'llms.txt');
      const oldContent = '## Agents (15)\n- [agent1](agents/agent1.md)\n';
      const newContent = '## Agents (16)\n- [agent1](agents/agent1.md)\n- [new-agent](agents/new-agent.md)\n';
      fs.writeFileSync(llmsPath, oldContent, 'utf8');

      const result = runWithMocks(llmsPath, newContent);
      assert.strictEqual(result.code, 1, 'Should fail when new agent is not in llms.txt');
      assert.ok(result.stderr.includes('out of date'), 'Should report out of date');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Up-to-date file
  // ==========================================
  console.log('\nUp-to-date llms.txt:');

  if (
    test('passes when committed llms.txt exactly matches generated content', () => {
      const testDir = createTestDir();
      const llmsPath = path.join(testDir, 'llms.txt');
      const content = '# Everything Claude Code\n\n> A test project.\n';
      fs.writeFileSync(llmsPath, content, 'utf8');

      const result = runWithMocks(llmsPath, content);
      assert.strictEqual(result.code, 0, 'Should pass when content matches');
      assert.ok(result.stdout.includes('up to date'), 'Should confirm up to date');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes with empty content when both are empty', () => {
      const testDir = createTestDir();
      const llmsPath = path.join(testDir, 'llms.txt');
      fs.writeFileSync(llmsPath, '', 'utf8');

      const result = runWithMocks(llmsPath, '');
      assert.strictEqual(result.code, 0, 'Should pass when both are empty');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes with multi-line content that matches exactly', () => {
      const testDir = createTestDir();
      const llmsPath = path.join(testDir, 'llms.txt');
      const content = [
        '# Everything Claude Code',
        '',
        '> Description.',
        '',
        '## Agents (1)',
        '- [test-agent](agents/test-agent.md): A test agent.',
        '',
      ].join('\n');
      fs.writeFileSync(llmsPath, content, 'utf8');

      const result = runWithMocks(llmsPath, content);
      assert.strictEqual(result.code, 0, 'Should pass with matching multi-line content');
      cleanupTestDir(testDir);
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