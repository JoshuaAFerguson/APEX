#!/usr/bin/env node

// Quick test to verify that the new getters work
const path = require('path');
const fs = require('fs');

// Mock test to verify the getters are accessible
console.log('Testing ApexOrchestrator getters...');

// Check if the TypeScript file has the expected getters
const orchestratorPath = path.join(__dirname, 'packages/orchestrator/src/index.ts');
const content = fs.readFileSync(orchestratorPath, 'utf8');

const expectedGetters = [
  'get permissionManager()',
  'get permissionStore()',
  'get presetManager()',
  'get customToolsServer()'
];

let allGettersFound = true;

for (const getter of expectedGetters) {
  if (content.includes(getter)) {
    console.log(`✅ Found getter: ${getter}`);
  } else {
    console.log(`❌ Missing getter: ${getter}`);
    allGettersFound = false;
  }
}

if (allGettersFound) {
  console.log('\n🎉 All required getters have been implemented!');
  process.exit(0);
} else {
  console.log('\n❌ Some getters are missing!');
  process.exit(1);
}