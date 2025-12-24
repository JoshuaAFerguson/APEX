#!/usr/bin/env node

/**
 * Test Verification Script
 * Checks if the handoff animation tests are properly structured
 */

import fs from 'fs/promises';
import path from 'path';

const CLI_DIR = './packages/cli';

async function verifyTestFiles() {
  console.log('🔍 Verifying Agent Handoff Animation Test Coverage...\n');

  const testFiles = [
    'src/ui/components/agents/__tests__/AgentPanel.test.tsx',
    'src/ui/components/agents/__tests__/HandoffIndicator.test.tsx',
    'src/ui/components/agents/__tests__/HandoffIndicator.edge-cases.test.tsx',
    'src/ui/hooks/__tests__/useAgentHandoff.test.ts',
    'src/ui/hooks/__tests__/useAgentHandoff.performance.test.ts',
    'src/ui/__tests__/agent-handoff-e2e.test.tsx',
    'src/ui/__tests__/agent-handoff-integration.test.tsx'
  ];

  let totalTests = 0;
  let totalLines = 0;

  for (const testFile of testFiles) {
    const fullPath = path.join(CLI_DIR, testFile);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n').length;
      const testCount = (content.match(/\s+it\(/g) || []).length;
      const describeCount = (content.match(/\s+describe\(/g) || []).length;

      console.log(`✅ ${testFile}`);
      console.log(`   📊 ${lines} lines, ${testCount} tests, ${describeCount} test suites`);

      totalTests += testCount;
      totalLines += lines;

    } catch (error) {
      console.log(`❌ ${testFile} - File not found or readable`);
    }
  }

  console.log(`\n📈 SUMMARY:`);
  console.log(`   Total test files: ${testFiles.length}`);
  console.log(`   Total test cases: ${totalTests}`);
  console.log(`   Total test code lines: ${totalLines}`);

  // Check for implementation files
  const implFiles = [
    'src/ui/components/agents/AgentPanel.tsx',
    'src/ui/components/agents/HandoffIndicator.tsx',
    'src/ui/hooks/useAgentHandoff.ts'
  ];

  console.log(`\n🔧 Implementation Files:`);
  for (const implFile of implFiles) {
    const fullPath = path.join(CLI_DIR, implFile);
    try {
      await fs.access(fullPath);
      console.log(`✅ ${implFile}`);
    } catch {
      console.log(`❌ ${implFile} - File not found`);
    }
  }
}

// Run verification
verifyTestFiles().catch(console.error);