/**
 * Tests for scripts/ci/validate-links.js
 *
 * Tests both success paths (against the real project) and error paths
 * (against temporary fixture directories via source-patching).
 *
 * Run with: node tests/ci/validate-links.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const validatorPath = path.join(__dirname, '..', '..', 'scripts', 'ci', 'validate-links.js');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'validate-links-test-'));
}

function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

/**
 * Run validate-links.js with ROOT overridden to a temp directory.
 * Patches the `const ROOT = ...` line in the source to point to testDir.
 */
function runWithRoot(overrideRoot) {
  let source = fs.readFileSync(validatorPath, 'utf8');
  source = source.replace(/^#!.*\n/, '');
  source = source.replace(/const ROOT = .*?;/, `const ROOT = ${JSON.stringify(overrideRoot)};`);
  try {
    const stdout = execFileSync('node', ['-e', source], {
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

/**
 * Run the real validator against the actual project.
 */
function runValidator() {
  try {
    const stdout = execFileSync('node', [validatorPath], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
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
  console.log('\n=== Testing validate-links.js ===\n');

  let passed = 0;
  let failed = 0;

  // ==========================================
  // Real project smoke test
  // ==========================================
  console.log('Real project:');

  if (
    test('passes on real project (all internal links valid)', () => {
      const result = runValidator();
      assert.strictEqual(result.code, 0, `Should pass, got stderr: ${result.stderr}`);
      assert.ok(result.stdout.includes('markdown files'), 'Should report file count');
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Valid links
  // ==========================================
  console.log('\nValid links:');

  if (
    test('passes when relative link target exists', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'target.md'), '# Target');
      fs.writeFileSync(path.join(testDir, 'source.md'), '[link](target.md)');

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, `Expected exit 0, got stderr: ${result.stderr}`);
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes when link target is a directory (exists)', () => {
      const testDir = createTestDir();
      const subDir = path.join(testDir, 'subdir');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(testDir, 'source.md'), '[link](subdir/)');

      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, `Expected exit 0, got stderr: ${result.stderr}`);
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes on empty directory (no markdown files)', () => {
      const testDir = createTestDir();
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should pass with no markdown files');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // External and anchor links (should be skipped)
  // ==========================================
  console.log('\nExternal/anchor links (should be skipped):');

  if (
    test('skips https:// external links', () => {
      const testDir = createTestDir();
      fs.writeFileSync(
        path.join(testDir, 'doc.md'),
        '[External](https://example.com/nonexistent)'
      );
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'External https link should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips http:// external links', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[External](http://example.com/page)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'External http link should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips mailto: links', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[Email](mailto:test@example.com)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'mailto link should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips tel: links', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[Phone](tel:+1234567890)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'tel link should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips pure anchor links (#section)', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[Section](#some-section)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Anchor-only link should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips protocol-relative links (//)', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[CDN](//cdn.example.com/file.js)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Protocol-relative link should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Broken links
  // ==========================================
  console.log('\nBroken links:');

  if (
    test('fails on broken relative link', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'source.md'), '[broken](nonexistent.md)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should fail on broken link');
      assert.ok(
        result.stderr.includes('broken internal link') || result.stderr.includes('nonexistent'),
        `Should report broken link, got: ${result.stderr}`
      );
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('reports the source file location of broken link', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'source.md'), '[missing](missing-target.md)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should exit 1');
      assert.ok(result.stderr.includes('source.md'), 'Should include source filename in error');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('reports count of broken links', () => {
      const testDir = createTestDir();
      fs.writeFileSync(
        path.join(testDir, 'source.md'),
        '[broken1](missing1.md)\n[broken2](missing2.md)'
      );
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should exit 1');
      assert.ok(result.stderr.includes('2'), 'Should report 2 broken links');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Code block stripping
  // ==========================================
  console.log('\nCode block stripping:');

  if (
    test('skips links inside fenced code blocks', () => {
      const testDir = createTestDir();
      const content = '```\n[fake link](nonexistent-in-code.md)\n```';
      fs.writeFileSync(path.join(testDir, 'doc.md'), content);
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Links in fenced code blocks should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips links inside inline code', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), 'Use `[fake](nonexistent-inline.md)` syntax');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Links in inline code should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('still checks links outside code blocks in same file', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'exists.md'), '# Exists');
      const content = '```\n[in code](nonexistent.md)\n```\n\n[real link](exists.md)';
      fs.writeFileSync(path.join(testDir, 'doc.md'), content);
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should pass when only real link is valid');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Placeholder links
  // ==========================================
  console.log('\nPlaceholder links:');

  if (
    test('skips placeholder links with angle brackets', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[link](<path/to/file>)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Placeholder with < > should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips placeholder links with ellipsis', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[link](path/to/...)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Placeholder with ... should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('skips placeholder links with ${}', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '[link](${variable}/path)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Placeholder with ${} should be skipped');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Link with optional title attribute
  // ==========================================
  console.log('\nLink title attributes:');

  if (
    test('strips optional title from link and resolves path', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'target.md'), '# Target');
      fs.writeFileSync(
        path.join(testDir, 'source.md'),
        '[link](target.md "The title of this link")'
      );
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should resolve path without the title');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('detects broken link even with title attribute', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'source.md'), '[link](missing.md "A title")');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should still detect broken link with title');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // In-page anchors on file links
  // ==========================================
  console.log('\nIn-page anchors on file links:');

  if (
    test('strips in-page anchor before resolving file', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'target.md'), '# Target\n## Section');
      fs.writeFileSync(path.join(testDir, 'source.md'), '[link](target.md#section)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should resolve file ignoring the anchor');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Ignored directories
  // ==========================================
  console.log('\nIgnored directories:');

  if (
    test('ignores markdown files inside node_modules', () => {
      const testDir = createTestDir();
      const nmDir = path.join(testDir, 'node_modules', 'some-pkg');
      fs.mkdirSync(nmDir, { recursive: true });
      // This file has a broken link but should be ignored
      fs.writeFileSync(
        path.join(nmDir, 'README.md'),
        '[broken](nonexistent-in-node_modules.md)'
      );
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'node_modules should be ignored');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('ignores markdown files inside .cursor directory', () => {
      const testDir = createTestDir();
      const cursorDir = path.join(testDir, '.cursor');
      fs.mkdirSync(cursorDir);
      fs.writeFileSync(
        path.join(cursorDir, 'config.md'),
        '[broken](nonexistent-in-cursor.md)'
      );
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, '.cursor dir should be ignored');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('ignores markdown files inside .opencode directory', () => {
      const testDir = createTestDir();
      const opencodeDir = path.join(testDir, '.opencode');
      fs.mkdirSync(opencodeDir);
      fs.writeFileSync(
        path.join(opencodeDir, 'docs.md'),
        '[broken](nonexistent-in-opencode.md)'
      );
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, '.opencode dir should be ignored');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // URL-encoded paths
  // ==========================================
  console.log('\nURL-encoded paths:');

  if (
    test('resolves URL-encoded link targets', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'my file.md'), '# My File');
      fs.writeFileSync(path.join(testDir, 'source.md'), '[link](my%20file.md)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'URL-encoded path should be resolved correctly');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Image references
  // ==========================================
  console.log('\nImage references:');

  if (
    test('checks image references (![...](...))', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'doc.md'), '![Alt text](missing-image.png)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should check image references too');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes on existing image reference', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'image.png'), 'fake png');
      fs.writeFileSync(path.join(testDir, 'doc.md'), '![Alt text](image.png)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Should pass when image file exists');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Subdirectory traversal
  // ==========================================
  console.log('\nSubdirectory traversal:');

  if (
    test('recursively checks markdown files in subdirectories', () => {
      const testDir = createTestDir();
      const subDir = path.join(testDir, 'docs');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, 'page.md'), '[broken](nonexistent.md)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 1, 'Should check files in subdirectories');
      assert.ok(result.stderr.includes('page.md'), 'Should report the nested file');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('resolves relative links from subdirectory correctly', () => {
      const testDir = createTestDir();
      const subDir = path.join(testDir, 'docs');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, 'target.md'), '# Target');
      fs.writeFileSync(path.join(subDir, 'source.md'), '[link](target.md)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, 'Relative link from subdirectory should resolve');
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('resolves parent-relative links (../) correctly', () => {
      const testDir = createTestDir();
      fs.writeFileSync(path.join(testDir, 'README.md'), '# Root');
      const subDir = path.join(testDir, 'docs');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(subDir, 'page.md'), '[link](../README.md)');
      const result = runWithRoot(testDir);
      assert.strictEqual(result.code, 0, '../ relative link should resolve correctly');
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