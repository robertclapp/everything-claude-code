/**
 * Tests for scripts/ci/validate-version-sync.js
 *
 * Tests both success paths (against the real project) and error paths
 * (against temporary fixture directories via source-patching).
 *
 * Run with: node tests/ci/validate-version-sync.test.js
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
  'validate-version-sync.js'
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'validate-version-sync-test-'));
}

function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

/**
 * Run validate-version-sync.js with ROOT overridden to a temp directory.
 */
function runWithRoot(overrideRoot) {
  let source = fs.readFileSync(validatorPath, 'utf8');
  source = source.replace(/^#!.*\n/, '');
  source = source.replace(/const ROOT = .*?;/, `const ROOT = ${JSON.stringify(overrideRoot)};`);
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

function runTests() {
  console.log('\n=== Testing validate-version-sync.js ===\n');

  let passed = 0;
  let failed = 0;

  // ==========================================
  // Real project smoke test
  // ==========================================
  console.log('Real project:');

  if (
    test('passes on real project (versions in sync)', () => {
      const result = runValidator();
      assert.strictEqual(result.code, 0, `Should pass, got stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('Version in sync'), 'Should report versions in sync');
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Matching versions
  // ==========================================
  console.log('\nMatching versions:');

  if (
    test('passes when only package.json exists with a version', () => {
      const testDir = createTestDir();
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ version: '1.2.3' })
      );

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, `Expected exit 0, stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('1.2.3'), 'Should report the version');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes when package.json and plugin.json have matching versions', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ version: '2.0.0' })
      );
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({ version: '2.0.0' })
      );

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, `Expected exit 0, stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('2 manifests'), 'Should report 2 manifests');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes when all four manifests have matching versions', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      const opencodeDir = path.join(testDir, '.opencode');
      fs.mkdirSync(pluginDir);
      fs.mkdirSync(opencodeDir);

      const version = '3.1.4';
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ version })
      );
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({ version })
      );
      fs.writeFileSync(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify({ plugins: [{ version }] })
      );
      fs.writeFileSync(
        path.join(opencodeDir, 'package.json'),
        JSON.stringify({ version })
      );

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, `Expected exit 0, stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('4 manifests'), 'Should report 4 manifests');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Mismatched versions
  // ==========================================
  console.log('\nMismatched versions:');

  if (
    test('fails when package.json and plugin.json have different versions', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ version: '1.0.0' })
      );
      fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({ version: '2.0.0' })
      );

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail on version mismatch');
      assert.ok(result.stderr.includes('mismatch'), 'Should report mismatch');
      assert.ok(result.stderr.includes('2.0.0'), 'Should include mismatched version');
      assert.ok(result.stderr.includes('1.0.0'), 'Should include reference version');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('fails when marketplace.json version differs', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ version: '1.5.0' })
      );
      fs.writeFileSync(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify({ plugins: [{ version: '1.4.0' }] })
      );

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail on marketplace version mismatch');
      assert.ok(result.stderr.includes('mismatch'), 'Should report mismatch');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('suggests release.sh fix on mismatch', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ version: '9.9.9' }));

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail');
      assert.ok(
        result.stderr.includes('release') || result.stderr.includes('Fix'),
        'Should suggest a fix'
      );
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Optional manifests
  // ==========================================
  console.log('\nOptional manifests:');

  if (
    test('skips missing optional manifests without failing', () => {
      const testDir = createTestDir();
      // Only package.json exists; all others are optional
      fs.writeFileSync(
        path.join(testDir, 'package.json'),
        JSON.stringify({ version: '1.0.0' })
      );

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should skip non-existent optional manifests');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes when no manifests exist at all', () => {
      const testDir = createTestDir();
      // Empty directory - all manifests are optional so none fail
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should pass gracefully with no manifests');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Missing version fields
  // ==========================================
  console.log('\nMissing version fields:');

  if (
    test('fails when package.json has no version field', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ name: 'test' }));

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail if version field is missing');
      assert.ok(
        result.stderr.includes('no version field') || result.stderr.includes('version'),
        'Should report missing version field'
      );
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('fails when marketplace.json has no plugins array', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.writeFileSync(
        path.join(pluginDir, 'marketplace.json'),
        JSON.stringify({ name: 'no-plugins-array' })
      );

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail if plugins array is missing');
      assert.ok(result.stderr.includes('version'), 'Should report missing version');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Invalid JSON
  // ==========================================
  console.log('\nInvalid JSON:');

  if (
    test('fails on malformed package.json', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'package.json'), '{ not valid json }}}');

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail on malformed JSON');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('fails on malformed plugin.json but not for missing', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '1.0.0' }));
      fs.writeFileSync(path.join(pluginDir, 'plugin.json'), '{ bad json');

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail on malformed plugin.json');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Output format
  // ==========================================
  console.log('\nOutput format:');

  if (
    test('reports version number and manifest count on success', () => {
      const testDir = createTestDir();
      const pluginDir = path.join(testDir, '.claude-plugin');
      fs.mkdirSync(pluginDir);
      fs.writeFileSync(path.join(testDir, 'package.json'), JSON.stringify({ version: '5.0.0' }));
      fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({ version: '5.0.0' }));

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should pass');
      assert.ok(result.stdout.includes('5.0.0'), 'Should include version in output');
      assert.ok(result.stdout.includes('2 manifests'), 'Should report manifest count');
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