#!/usr/bin/env node

/**
 * Simple validation script to check dry-run implementation
 * This validates the CLI implementation without full test framework overhead
 */

const chalk = require('chalk');
const path = require('path');

async function validateDryRunImplementation() {
  console.log(chalk.cyan('🔍 Validating Dry-Run Implementation\n'));

  // Check 1: Verify CLI index file exists and has dry-run support
  try {
    const cliIndexPath = path.join(__dirname, 'packages/cli/src/index.ts');
    const fs = require('fs');
    const indexContent = fs.readFileSync(cliIndexPath, 'utf8');

    const checks = [
      { name: 'CLI has --dry-run flag', check: indexContent.includes('--dry-run') },
      { name: 'CLI has -d shorthand', check: indexContent.includes('-d') },
      { name: 'CLI has dryRun variable', check: indexContent.includes('dryRun') },
      { name: 'CLI has dry-run mode indicator', check: indexContent.includes('DRY RUN MODE') },
      { name: 'CLI has [DRY-RUN] prefix', check: indexContent.includes('[DRY-RUN]') },
      { name: 'CLI has simulation messages', check: indexContent.includes('(simulated)') },
      { name: 'CLI has completion summary', check: indexContent.includes('DRY RUN COMPLETED') },
    ];

    let passed = 0;
    console.log(chalk.yellow('CLI Implementation Checks:'));
    for (const check of checks) {
      if (check.check) {
        console.log(chalk.green(`  ✓ ${check.name}`));
        passed++;
      } else {
        console.log(chalk.red(`  ✗ ${check.name}`));
      }
    }
    console.log(`\nCLI Implementation: ${passed}/${checks.length} checks passed\n`);

  } catch (error) {
    console.error(chalk.red('Error reading CLI index file:'), error.message);
  }

  // Check 2: Verify test files exist
  try {
    const testDir = path.join(__dirname, 'packages/cli/src/__tests__');
    const fs = require('fs');
    const files = fs.readdirSync(testDir);

    const expectedTestFiles = [
      'dry-run-output-formatting.test.ts',
      'dry-run-cli-command.test.ts',
      'dry-run-cli-integration.test.ts',
      'dry-run-acceptance-validation.test.ts'
    ];

    console.log(chalk.yellow('Test Files Validation:'));
    let testsPassed = 0;
    for (const expectedFile of expectedTestFiles) {
      const exists = files.includes(expectedFile);
      if (exists) {
        console.log(chalk.green(`  ✓ ${expectedFile} exists`));
        testsPassed++;

        // Check file content
        const testPath = path.join(testDir, expectedFile);
        const content = fs.readFileSync(testPath, 'utf8');
        const hasAcceptanceCriteria = content.includes('AC1:') && content.includes('AC2:') && content.includes('AC3:') && content.includes('AC4:');
        if (hasAcceptanceCriteria) {
          console.log(chalk.green(`    ✓ Contains acceptance criteria tests`));
        } else {
          console.log(chalk.yellow(`    ! Missing some acceptance criteria tests`));
        }
      } else {
        console.log(chalk.red(`  ✗ ${expectedFile} missing`));
      }
    }
    console.log(`\nTest Files: ${testsPassed}/${expectedTestFiles.length} files exist\n`);

  } catch (error) {
    console.error(chalk.red('Error reading test directory:'), error.message);
  }

  // Check 3: Verify core types support dry-run
  try {
    const typesPath = path.join(__dirname, 'packages/core/src/types.ts');
    const fs = require('fs');
    const typesContent = fs.readFileSync(typesPath, 'utf8');

    const hasDryRunField = typesContent.includes('dryRun?:') || typesContent.includes('dryRun:');
    const hasTaskInterface = typesContent.includes('interface Task');

    console.log(chalk.yellow('Core Types Validation:'));
    console.log(hasDryRunField ? chalk.green('  ✓ Task interface has dryRun field') : chalk.red('  ✗ Task interface missing dryRun field'));
    console.log(hasTaskInterface ? chalk.green('  ✓ Task interface exists') : chalk.red('  ✗ Task interface missing'));
    console.log('');

  } catch (error) {
    console.error(chalk.red('Error reading types file:'), error.message);
  }

  console.log(chalk.cyan('✅ Validation Complete\n'));
  console.log(chalk.gray('To run full tests: npm run test'));
  console.log(chalk.gray('To build project: npm run build'));
}

// Run validation
validateDryRunImplementation().catch(console.error);