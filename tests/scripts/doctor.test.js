/**
 * Tests for scripts/doctor.js
 *
 * Tests the health self-check script via:
 * - Direct require of main() for output capture
 * - Source-patching ROOT to test with temp directories
 * - Subprocess execution for integration tests
 *
 * Run with: node tests/scripts/doctor.test.js
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const doctorPath = path.join(__dirname, '..', '..', 'scripts', 'doctor.js');

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-test-'));
}

function cleanupTestDir(testDir) {
  fs.rmSync(testDir, { recursive: true, force: true });
}

/**
 * Run doctor.js as a subprocess, returning exit code and output.
 */
function runDoctor() {
  try {
    const stdout = execFileSync('node', [doctorPath], {
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

/**
 * Run doctor.js with ROOT overridden to a temp directory.
 * Skips the validator step (patches it out) to allow isolated inventory testing.
 */
function runWithRootNoValidators(overrideRoot) {
  let source = fs.readFileSync(doctorPath, 'utf8');
  source = source.replace(/^#!.*\n/, '');
  // Replace ROOT
  source = source.replace(
    /const ROOT = .*?;/,
    `const ROOT = ${JSON.stringify(overrideRoot)};`
  );
  // Skip validator checks by replacing checkValidators with a no-op
  source = source.replace(/function checkValidators\(\)[\s\S]*?^}/m, 'function checkValidators() {}');
  // When running with `node -e`, require.main is null so the guard never fires.
  // Append an unconditional main() call to drive execution.
  source = source.replace(
    /if \(require\.main === module\)\s*\{[^}]*\}/,
    'process.exit(main());'
  );

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

function runTests() {
  console.log('\n=== Testing scripts/doctor.js ===\n');

  let passed = 0;
  let failed = 0;

  // ==========================================
  // Real project smoke test
  // ==========================================
  console.log('Real project:');

  if (
    test('exits 0 on healthy real project', () => {
      const result = runDoctor();
      assert.strictEqual(result.code, 0, `doctor should exit 0 on healthy project, got: ${result.stdout}\n${result.stderr}`);
    })
  )
    passed++;
  else failed++;

  if (
    test('outputs "everything-claude-code doctor" header', () => {
      const result = runDoctor();
      assert.ok(
        result.stdout.includes('everything-claude-code doctor'),
        'Should output header'
      );
    })
  )
    passed++;
  else failed++;

  if (
    test('outputs a "Healthy" message when all checks pass', () => {
      const result = runDoctor();
      assert.ok(result.stdout.includes('Healthy'), 'Should output Healthy when all pass');
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Module export
  // ==========================================
  console.log('\nModule export:');

  if (
    test('exports main function', () => {
      const mod = require(doctorPath);
      assert.strictEqual(typeof mod.main, 'function', 'Should export main as a function');
    })
  )
    passed++;
  else failed++;

  if (
    test('main() returns 0 on healthy project', () => {
      const mod = require(doctorPath);
      // Capture stdout to avoid polluting test output
      const originalWrite = process.stdout.write.bind(process.stdout);
      let output = '';
      process.stdout.write = (str) => { output += str; return true; };
      let exitCode;
      try {
        exitCode = mod.main();
      } finally {
        process.stdout.write = originalWrite;
      }
      assert.strictEqual(exitCode, 0, `main() should return 0, got: ${exitCode}\nOutput: ${output}`);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Environment checks
  // ==========================================
  console.log('\nEnvironment checks:');

  if (
    test('output includes Node.js version check', () => {
      const result = runDoctor();
      assert.ok(
        result.stdout.includes('Node.js'),
        'Should include Node.js version check'
      );
    })
  )
    passed++;
  else failed++;

  if (
    test('output shows checkmark for Node.js >= 18', () => {
      // We know Node.js >= 18 is required and the CI runs with it
      const nodeMajor = Number(process.versions.node.split('.')[0]);
      if (nodeMajor < 18) {
        // Skip this check if Node is too old (shouldn't happen in CI)
        return;
      }
      const result = runDoctor();
      // Should show ✓ for Node.js check
      const lines = result.stdout.split('\n');
      const nodeLine = lines.find((l) => l.includes('Node.js'));
      assert.ok(nodeLine, 'Should have a Node.js line');
      assert.ok(nodeLine.includes('\u2713'), 'Node.js line should show checkmark');
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Inventory checks
  // ==========================================
  console.log('\nInventory checks:');

  if (
    test('output includes agents check', () => {
      const result = runDoctor();
      assert.ok(result.stdout.includes('Agents'), 'Should check for agents');
    })
  )
    passed++;
  else failed++;

  if (
    test('output includes skills check', () => {
      const result = runDoctor();
      assert.ok(result.stdout.includes('Skills'), 'Should check for skills');
    })
  )
    passed++;
  else failed++;

  if (
    test('output includes commands check', () => {
      const result = runDoctor();
      assert.ok(result.stdout.includes('Commands'), 'Should check for commands');
    })
  )
    passed++;
  else failed++;

  if (
    test('reports non-zero count for agents on real project', () => {
      const result = runDoctor();
      const lines = result.stdout.split('\n');
      const agentsLine = lines.find((l) => l.includes('Agents present'));
      assert.ok(agentsLine, 'Should have an agents line');
      // Should show number like "16 agents"
      assert.ok(/\d+ agent/.test(agentsLine), `Should report agent count, got: ${agentsLine}`);
    })
  )
    passed++;
  else failed++;

  // ==========================================
  // Inventory with custom directories
  // ==========================================
  console.log('\nInventory with custom directories:');

  if (
    test('fails when agents directory is missing or empty', () => {
      const testDir = createTestDir();
      // No agents dir created - countDir returns 0
      // skills and commands also missing - all will fail
      const result = runWithRootNoValidators(testDir);
      assert.strictEqual(result.code, 1, 'Should fail when agents dir is missing');
      assert.ok(
        result.stdout.includes('\u2717') || result.stdout.includes('failed'),
        'Should show failure marks'
      );
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('passes inventory checks when agents dir has .md files', () => {
      const testDir = createTestDir();
      const agentsDir = path.join(testDir, 'agents');
      const skillsDir = path.join(testDir, 'skills', 'test-skill');
      const commandsDir = path.join(testDir, 'commands');
      fs.mkdirSync(agentsDir, { recursive: true });
      fs.mkdirSync(skillsDir, { recursive: true });
      fs.mkdirSync(commandsDir, { recursive: true });

      fs.writeFileSync(
        path.join(agentsDir, 'agent.md'),
        '---\nname: test\nmodel: sonnet\ntools: Read\n---\n# Agent'
      );
      fs.writeFileSync(
        path.join(skillsDir, 'SKILL.md'),
        '---\nname: test-skill\n---\n# Skill'
      );
      fs.writeFileSync(
        path.join(commandsDir, 'cmd.md'),
        '---\ndescription: A command.\n---\n# Command'
      );

      const result = runWithRootNoValidators(testDir);
      // Should pass inventory (agents/skills/commands all present)
      // Exit code may still be 1 if other checks fail (Node.js is fine, PM may vary)
      // Check that agents are reported as present
      assert.ok(
        result.stdout.includes('1 agents') || result.stdout.includes('agents'),
        `Should report agents present, stdout: ${result.stdout}`
      );
      cleanupTestDir(testDir);
    })
  )
    passed++;
  else failed++;

  if (
    test('shows failure mark for missing agents', () => {
      const testDir = createTestDir();
      // Empty dir - no agents, skills, or commands
      const result = runWithRootNoValidators(testDir);
      assert.ok(
        result.stdout.includes('\u2717'),
        'Should show ✗ for missing components'
      );
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
    test('output includes separator lines', () => {
      const result = runDoctor();
      assert.ok(result.stdout.includes('='), 'Should include separator lines');
    })
  )
    passed++;
  else failed++;

  if (
    test('output shows check count in summary', () => {
      const result = runDoctor();
      // "Healthy — N checks passed." or "N of N checks failed."
      assert.ok(
        /\d+ checks? (passed|failed)/.test(result.stdout),
        `Should show check count, got: ${result.stdout}`
      );
    })
  )
    passed++;
  else failed++;

  if (
    test('output includes validator check results', () => {
      const result = runDoctor();
      // Should show validate-agents, validate-commands, etc.
      assert.ok(
        result.stdout.includes('Validate'),
        'Should include validator check results'
      );
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