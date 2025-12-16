#!/usr/bin/env node

/**
 * Simple verification script to check if integration tests are properly structured
 */

const fs = require('fs');
const path = require('path');

// Check if test files exist
const testFiles = [
  'AgentPanel.integration.test.tsx',
  'AgentPanel.workflow-integration.test.tsx',
  'test-utils/MockOrchestrator.ts'
];

const testDir = __dirname;

console.log('🔍 Verifying integration test files...\n');

testFiles.forEach(file => {
  const filePath = path.join(testDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`✅ ${file} - ${stats.size} bytes`);
  } else {
    console.log(`❌ ${file} - MISSING`);
  }
});

console.log('\n🔍 Checking for required test patterns...\n');

// Check integration test file
const integrationTestPath = path.join(testDir, 'AgentPanel.integration.test.tsx');
if (fs.existsSync(integrationTestPath)) {
  const content = fs.readFileSync(integrationTestPath, 'utf8');

  const checks = [
    { pattern: /MockOrchestrator/, description: 'MockOrchestrator usage' },
    { pattern: /useOrchestratorEvents/, description: 'useOrchestratorEvents hook usage' },
    { pattern: /simulateAgentTransition/, description: 'Agent transition simulation' },
    { pattern: /simulateParallelStart/, description: 'Parallel execution simulation' },
    { pattern: /stage:parallel-started/, description: 'Parallel event testing' },
    { pattern: /handoff animations/, description: 'Handoff animation testing' },
    { pattern: /Agent Transition Events/, description: 'Agent transition test suite' },
    { pattern: /Parallel Execution Events/, description: 'Parallel execution test suite' }
  ];

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.description}`);
    } else {
      console.log(`❌ ${check.description}`);
    }
  });
}

// Check MockOrchestrator utility
const mockOrchestratorPath = path.join(testDir, 'test-utils/MockOrchestrator.ts');
if (fs.existsSync(mockOrchestratorPath)) {
  const content = fs.readFileSync(mockOrchestratorPath, 'utf8');

  const checks = [
    { pattern: /extends EventEmitter/, description: 'EventEmitter inheritance' },
    { pattern: /simulateStageChange/, description: 'Stage change simulation' },
    { pattern: /simulateAgentTransition/, description: 'Agent transition simulation' },
    { pattern: /simulateParallelStart/, description: 'Parallel start simulation' },
    { pattern: /simulateParallelComplete/, description: 'Parallel complete simulation' },
    { pattern: /cleanup/, description: 'Cleanup method' }
  ];

  console.log('\n🔍 Checking MockOrchestrator implementation...\n');

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.description}`);
    } else {
      console.log(`❌ ${check.description}`);
    }
  });
}

// Check hook implementation
const hookPath = path.join(__dirname, '../../../hooks/useOrchestratorEvents.ts');
if (fs.existsSync(hookPath)) {
  const content = fs.readFileSync(hookPath, 'utf8');

  const checks = [
    { pattern: /useOrchestratorEvents/, description: 'Hook definition' },
    { pattern: /OrchestratorEventState/, description: 'State type definition' },
    { pattern: /agent:transition/, description: 'Agent transition event handling' },
    { pattern: /stage:parallel-started/, description: 'Parallel start event handling' },
    { pattern: /stage:parallel-completed/, description: 'Parallel complete event handling' },
    { pattern: /useState/, description: 'React state management' },
    { pattern: /useEffect/, description: 'React effect handling' }
  ];

  console.log('\n🔍 Checking useOrchestratorEvents hook...\n');

  checks.forEach(check => {
    if (check.pattern.test(content)) {
      console.log(`✅ ${check.description}`);
    } else {
      console.log(`❌ ${check.description}`);
    }
  });
}

console.log('\n🎉 Verification complete!');