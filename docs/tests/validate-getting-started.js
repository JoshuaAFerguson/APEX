#!/usr/bin/env node

/**
 * Simple validation script for getting-started.md
 * Checks that all v0.3.0 features are properly documented
 */

const fs = require('fs');
const path = require('path');

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateGettingStarted() {
  const docPath = path.join(__dirname, '../getting-started.md');
  const content = fs.readFileSync(docPath, 'utf-8');

  let passed = 0;
  let failed = 0;

  function check(description, condition) {
    if (condition) {
      log('green', `✓ ${description}`);
      passed++;
    } else {
      log('red', `✗ ${description}`);
      failed++;
    }
  }

  function checkContains(description, text) {
    check(description, content.includes(text));
  }

  function checkPattern(description, pattern) {
    check(description, pattern.test(content));
  }

  log('blue', '\n=== Validating Getting Started Documentation ===\n');

  // V0.3.0 Terminal Interface Features
  log('yellow', 'Terminal Interface (v0.3.0) Features:');
  checkContains('  Documents rich terminal interface', 'Terminal Interface (v0.3.0)');
  checkContains('  Documents real-time updates', 'real-time updates');
  checkContains('  Documents progress indicators', 'Progress Indicators');
  checkContains('  Shows progress bar example', '■■■■■■■░░░');
  checkContains('  Documents interactive controls', 'Interactive Controls');
  checkContains('  Lists keyboard shortcuts', 'Space');
  checkContains('  Documents color-coded output', 'Color-coded Output');
  checkContains('  Shows success indicators', '🟢');
  checkContains('  Shows warning indicators', '🟡');
  checkContains('  Shows error indicators', '🔴');
  checkContains('  Shows info indicators', '🔵');

  // Session Management
  log('yellow', '\nSession Management Basics:');
  checkContains('  Documents session management', 'Session Management Basics');
  checkContains('  Documents sessions command', 'apex sessions');
  checkContains('  Documents resume command', 'apex resume');
  checkContains('  Documents attach command', 'apex attach');
  checkContains('  Documents session persistence', 'Session Persistence');
  checkContains('  Documents background execution', 'Background Execution');
  checkContains('  Documents database storage', '.apex/apex.db');

  // Tab Completion & Keyboard Shortcuts
  log('yellow', '\nTab Completion & Keyboard Shortcuts:');
  checkContains('  Documents tab completion', 'Tab Completion');
  checkContains('  Shows command completion example', 'apex <tab>');
  checkContains('  Lists available commands', 'init, run, status, logs, sessions, serve');
  checkContains('  Documents autonomy completion', '--autonomy <tab>');
  checkContains('  Lists autonomy levels', 'full, review-before-commit, review-before-merge, manual');
  checkContains('  Documents essential shortcuts table', '| Shortcut | Action |');
  checkContains('  Documents Ctrl+C shortcut', 'Ctrl+C');
  checkContains('  Documents tab completion setup', 'completion bash');

  // Onboarding Flow
  log('yellow', '\nImproved Onboarding Flow:');
  checkContains('  Clear API key setup', 'Set Your API Key');
  checkContains('  Project initialization', 'Initialize Your Project');
  checkContains('  Configuration review', 'Review the Configuration');
  checkContains('  First task example', 'Run Your First Task');
  checkContains('  Output explanation', 'Understanding the Output');
  checkContains('  Shows realistic task example', 'Add a health check endpoint');

  // CLI Guide Link
  log('yellow', '\nCLI Guide Reference:');
  checkContains('  Links to CLI guide', 'cli-guide.md');
  checkContains('  Describes CLI guide purpose', 'Complete command reference and advanced features');

  // Installation Options
  log('yellow', '\nInstallation Options:');
  checkContains('  Global installation', 'npm install -g @apexcli/cli');
  checkContains('  NPX usage', 'npx @apexcli/cli');
  checkContains('  Local development', 'npm link');

  // Prerequisites
  log('yellow', '\nPrerequisites:');
  checkContains('  Node.js requirement', 'Node.js 18 or higher');
  checkContains('  API key requirement', 'Anthropic API Key');
  checkContains('  Git requirement', 'Git');

  // Autonomy Levels
  log('yellow', '\nAutonomy Levels:');
  checkContains('  Documents autonomy table', '| Level | Description |');
  checkContains('  Full autonomy level', '| `full` |');
  checkContains('  Review before commit', '| `review-before-commit` |');
  checkContains('  Review before merge', '| `review-before-merge` |');
  checkContains('  Manual level', '| `manual` |');

  // Troubleshooting
  log('yellow', '\nTroubleshooting:');
  checkContains('  APEX not initialized error', 'APEX not initialized');
  checkContains('  API key not set error', 'ANTHROPIC_API_KEY not set');
  checkContains('  Budget exceeded error', 'Task exceeds budget');
  checkContains('  Agent decisions issue', 'Agent makes wrong decisions');

  // Structure and Navigation
  log('yellow', '\nStructure and Navigation:');
  checkContains('  Next steps section', '## Next Steps');
  checkContains('  Links to other docs', '[agents.md]');
  checkContains('  Links to workflows', '[workflows.md]');
  checkContains('  Links to API reference', '[api-reference.md]');
  checkContains('  Links to best practices', '[best-practices.md]');

  // Code Examples
  log('yellow', '\nCode Examples and Formatting:');
  checkPattern('  Has proper code blocks', /```[\s\S]*?```/);
  checkContains('  Shell commands formatted', '```bash');
  checkContains('  YAML examples formatted', '```yaml');
  checkPattern('  Terminal output examples', /```\s*\n🚀/);

  // Summary
  log('blue', '\n=== Validation Summary ===');
  log('green', `✓ Passed: ${passed}`);
  if (failed > 0) {
    log('red', `✗ Failed: ${failed}`);
  }

  const total = passed + failed;
  const percentage = Math.round((passed / total) * 100);

  if (percentage >= 95) {
    log('green', `\n🎉 Excellent! ${percentage}% of documentation requirements met.`);
  } else if (percentage >= 90) {
    log('yellow', `\n⚠️  Good! ${percentage}% of documentation requirements met.`);
  } else {
    log('red', `\n❌ Needs improvement! Only ${percentage}% of documentation requirements met.`);
  }

  return { passed, failed, percentage };
}

// Coverage analysis
function analyzeCoverage() {
  const docPath = path.join(__dirname, '../getting-started.md');
  const content = fs.readFileSync(docPath, 'utf-8');

  log('blue', '\n=== Coverage Analysis ===');

  const sections = content.split(/^##\s/m);
  log('blue', `Total sections: ${sections.length - 1}`); // -1 because first split is before any ##

  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  log('blue', `Code examples: ${codeBlocks.length}`);

  const links = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
  log('blue', `Internal links: ${links.length}`);

  const wordCount = content.split(/\s+/).length;
  log('blue', `Word count: ${wordCount}`);

  // Check for v0.3.0 feature coverage
  const v030Features = [
    'rich terminal',
    'progress indicators',
    'interactive controls',
    'color-coded output',
    'session management',
    'tab completion',
    'keyboard shortcuts',
    'background execution'
  ];

  const featuresDocumented = v030Features.filter(feature =>
    content.toLowerCase().includes(feature.toLowerCase())
  );

  log('blue', `v0.3.0 features documented: ${featuresDocumented.length}/${v030Features.length}`);

  return {
    sections: sections.length - 1,
    codeBlocks: codeBlocks.length,
    links: links.length,
    wordCount,
    featureCoverage: (featuresDocumented.length / v030Features.length) * 100
  };
}

// Main execution
if (require.main === module) {
  const results = validateGettingStarted();
  const coverage = analyzeCoverage();

  // Generate test report
  const reportPath = path.join(__dirname, 'getting-started-validation-report.json');
  const report = {
    timestamp: new Date().toISOString(),
    validation: results,
    coverage: coverage,
    status: results.percentage >= 95 ? 'PASS' : results.percentage >= 90 ? 'WARN' : 'FAIL'
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log('blue', `\n📋 Report saved to: ${reportPath}`);

  process.exit(results.failed > 0 ? 1 : 0);
}

module.exports = { validateGettingStarted, analyzeCoverage };