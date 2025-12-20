#!/usr/bin/env node

/**
 * CLI Guide Validation Script
 *
 * Quickly validates that the CLI guide documentation matches
 * the actual implementation by checking key features.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function validateCliGuide() {
  console.log('🔍 Validating CLI Guide Documentation...\n');

  try {
    // Read the CLI guide
    const guidePath = path.join(__dirname, 'cli-guide.md');
    const guideContent = await fs.readFile(guidePath, 'utf-8');

    // Read the actual CLI implementation
    const cliPath = path.join(__dirname, '../packages/cli/src/index.ts');
    const cliContent = await fs.readFile(cliPath, 'utf-8');

    let passed = 0;
    let total = 0;

    // Helper function to check if content exists
    function check(description, content, pattern, isRegex = false) {
      total++;
      const found = isRegex ? pattern.test(content) : content.includes(pattern);

      if (found) {
        console.log(`✅ ${description}`);
        passed++;
      } else {
        console.log(`❌ ${description}`);
        console.log(`   Expected: ${isRegex ? pattern.toString() : pattern}`);
      }
    }

    // Validate core commands
    console.log('📋 Checking Core Commands...');
    check('Help command documented', guideContent, '/help');
    check('Init command documented', guideContent, '/init');
    check('Status command documented', guideContent, '/status');
    check('Agents command documented', guideContent, '/agents');
    check('Workflows command documented', guideContent, '/workflows');
    check('Config command documented', guideContent, '/config');
    check('Run command documented', guideContent, '/run');

    // Check that commands in docs exist in implementation
    check('Help command implemented', cliContent, "name: 'help'");
    check('Init command implemented', cliContent, "name: 'init'");
    check('Status command implemented', cliContent, "name: 'status'");
    check('Agents command implemented', cliContent, "name: 'agents'");

    console.log('\n⌨️  Checking Keyboard Shortcuts...');
    check('Global shortcuts section', guideContent, 'Global Shortcuts');
    check('Input shortcuts section', guideContent, 'Input Shortcuts');
    check('Ctrl+C documented', guideContent, 'Ctrl+C');
    check('Ctrl+D documented', guideContent, 'Ctrl+D');
    check('Tab completion documented', guideContent, 'Tab');

    console.log('\n💾 Checking Session Management...');
    check('Session commands section', guideContent, 'Session Management');
    check('Session list documented', guideContent, '/session list');
    check('Session save documented', guideContent, '/session save');
    check('Session export documented', guideContent, '/session export');
    check('Export formats documented', guideContent, 'md|json|html', true);

    console.log('\n🎨 Checking Display Modes...');
    check('Display modes section', guideContent, 'Display Modes');
    check('Compact mode documented', guideContent, '/compact');
    check('Verbose mode documented', guideContent, '/verbose');
    check('Thoughts mode documented', guideContent, '/thoughts');
    check('Normal mode documented', guideContent, 'normal');

    console.log('\n🔧 Checking Configuration...');
    check('Configuration section', guideContent, 'Configuration');
    check('Config file structure', guideContent, '.apex/config.yaml');
    check('Autonomy levels documented', guideContent, 'review-before-merge');
    check('Model settings documented', guideContent, 'models:');
    check('Limits documented', guideContent, 'maxCostPerTask');

    console.log('\n📝 Checking Task Examples...');
    check('Natural language tasks section', guideContent, 'Natural Language Tasks');
    check('Add endpoint example', guideContent, 'Add a health check endpoint');
    check('Fix bug example', guideContent, 'Fix the bug where');
    check('Refactor example', guideContent, 'Refactor the authentication');
    check('Test example', guideContent, 'Add unit tests');

    console.log('\n🏷️  Checking Task States...');
    check('Task lifecycle documented', guideContent, 'Task Lifecycle');
    check('Pending state', guideContent, 'pending');
    check('In-progress state', guideContent, 'in-progress');
    check('Completed state', guideContent, 'completed');
    check('Failed state', guideContent, 'failed');
    check('Task icons documented', guideContent, '✅');

    console.log('\n🌐 Checking Server Management...');
    check('Server management section', guideContent, 'Server Management');
    check('Serve command documented', guideContent, '/serve');
    check('Web command documented', guideContent, '/web');
    check('Stop command documented', guideContent, '/stop');
    check('Auto-start configuration', guideContent, 'autoStart');

    console.log('\n💡 Checking Tips and Best Practices...');
    check('Tips section', guideContent, 'Tips and Best Practices');
    check('Descriptive tasks tip', guideContent, 'Use Descriptive Task Descriptions');
    check('Autonomy levels tip', guideContent, 'Leverage Autonomy Levels');
    check('Cost monitoring tip', guideContent, 'Monitor Costs');
    check('Good vs bad examples', guideContent, '# Good');

    console.log('\n📚 Checking Help Resources...');
    check('Help section', guideContent, 'Getting Help');
    check('GitHub repository link', guideContent, 'github.com');
    check('In-app help reference', guideContent, '/help');

    // Final validation summary
    console.log('\n' + '='.repeat(50));
    console.log(`🎯 Validation Results: ${passed}/${total} checks passed`);

    if (passed === total) {
      console.log('🎉 All validations passed! CLI guide is accurate and complete.');
      process.exit(0);
    } else {
      const failed = total - passed;
      console.log(`⚠️  ${failed} validation(s) failed. Please review the documentation.`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error validating CLI guide:', error.message);
    process.exit(1);
  }
}

// Run validation if this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateCliGuide();
}

export { validateCliGuide };