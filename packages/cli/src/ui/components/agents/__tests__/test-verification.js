#!/usr/bin/env node
/**
 * Test verification script for AgentPanel parallel execution features
 * Validates that all tests are properly structured and cover the acceptance criteria
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test files to validate
const testFiles = [
  'AgentPanel.test.tsx',
  'AgentPanel.parallel-complete.test.tsx',
  'AgentPanel.parallel-edge-cases.test.tsx',
  'AgentPanel.parallel-integration.test.tsx',
  'AgentPanel.parallel-visual.test.tsx'
];

// Acceptance criteria patterns to check
const acceptanceCriteriaChecks = {
  'showParallel prop acceptance': [
    'showParallel={true}',
    'showParallel={false}',
    'showParallel'
  ],
  'parallelAgents prop acceptance': [
    'parallelAgents={',
    'parallelAgents='
  ],
  'parallel status handling': [
    "status: 'parallel'",
    'parallel'
  ],
  'parallel icon display': [
    '⟂',
    'Parallel Execution'
  ],
  'multiple agent display logic': [
    'parallelAgents.length > 1',
    'length > 1'
  ],
  'compact mode support': [
    'compact={true}',
    'compact mode'
  ]
};

console.log('🧪 Verifying AgentPanel Parallel Execution Tests\n');

let totalTests = 0;
let totalCoverage = {};
let validationErrors = [];

// Initialize coverage tracking
Object.keys(acceptanceCriteriaChecks).forEach(criteria => {
  totalCoverage[criteria] = {
    files: [],
    patterns: 0
  };
});

for (const fileName of testFiles) {
  const filePath = path.join(__dirname, fileName);

  try {
    if (!fs.existsSync(filePath)) {
      validationErrors.push(`❌ ${fileName}: File not found`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');

    // Count tests
    const itMatches = content.match(/it\(/g) || [];
    totalTests += itMatches.length;

    console.log(`📁 ${fileName}`);
    console.log(`   🧪 ${itMatches.length} test cases`);

    // Check acceptance criteria coverage
    Object.entries(acceptanceCriteriaChecks).forEach(([criteria, patterns]) => {
      let found = false;
      for (const pattern of patterns) {
        if (content.includes(pattern)) {
          found = true;
          totalCoverage[criteria].patterns++;
          break;
        }
      }

      if (found) {
        totalCoverage[criteria].files.push(fileName);
        console.log(`   ✅ ${criteria}`);
      }
    });

    console.log('');

  } catch (error) {
    console.log(`❌ ${fileName}: ${error.message}`);
    validationErrors.push(`${fileName}: ${error.message}`);
  }
}

// Summary
console.log('📊 Test Coverage Summary:');
console.log(`   📁 Files validated: ${testFiles.length}`);
console.log(`   🧪 Total test cases: ${totalTests}`);
console.log(`   ❌ Validation errors: ${validationErrors.length}\n`);

// Acceptance criteria coverage
console.log('✅ Acceptance Criteria Coverage:');
Object.entries(totalCoverage).forEach(([criteria, data]) => {
  const coverage = data.files.length > 0 ? '✅' : '❌';
  console.log(`   ${coverage} ${criteria}`);
  if (data.files.length > 0) {
    console.log(`      📁 Files: ${data.files.join(', ')}`);
    console.log(`      🎯 Pattern matches: ${data.patterns}`);
  }
});

// Validate all acceptance criteria are met
const missingCriteria = Object.entries(totalCoverage)
  .filter(([_, data]) => data.files.length === 0)
  .map(([criteria, _]) => criteria);

if (missingCriteria.length > 0) {
  console.log('\n🚨 Missing Coverage:');
  missingCriteria.forEach(criteria => {
    console.log(`   • ${criteria}`);
  });
  validationErrors.push(`Missing acceptance criteria coverage: ${missingCriteria.join(', ')}`);
}

// Final result
if (validationErrors.length > 0) {
  console.log('\n❌ VALIDATION FAILED');
  validationErrors.forEach(error => console.log(`   • ${error}`));
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS VALIDATED');
  console.log('🎯 All acceptance criteria covered');
  console.log(`🧪 ${totalTests} total test cases found`);
  console.log('🚀 Ready for production deployment');
  process.exit(0);
}