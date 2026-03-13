#!/usr/bin/env node

/**
 * v0.4.0 Feature Implementation Verification Script
 *
 * This script verifies that all three v0.4.0 features are implemented:
 * 1. Idle Task Auto-Generation
 * 2. Thought Capture Mode (apex think command)
 * 3. Workspace Isolation (Docker/worktree)
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 v0.4.0 Feature Implementation Verification\n');

// Feature verification results
const results = {
  idleTaskGeneration: false,
  thoughtCapture: false,
  workspaceIsolation: false
};

// Check for Idle Task Generation
console.log('1. Idle Task Auto-Generation');
try {
  const idleProcessorPath = path.join(__dirname, 'packages/orchestrator/src/idle-processor.ts');
  const idleTaskGeneratorPath = path.join(__dirname, 'packages/orchestrator/src/idle-task-generator.ts');

  if (fs.existsSync(idleProcessorPath) && fs.existsSync(idleTaskGeneratorPath)) {
    const idleProcessorContent = fs.readFileSync(idleProcessorPath, 'utf8');
    const generatorContent = fs.readFileSync(idleTaskGeneratorPath, 'utf8');

    if (idleProcessorContent.includes('class IdleProcessor') &&
        generatorContent.includes('class IdleTaskGenerator')) {
      console.log('   ✅ IdleProcessor and IdleTaskGenerator classes found');
      results.idleTaskGeneration = true;
    }
  }
} catch (error) {
  console.log(`   ❌ Error checking idle task generation: ${error.message}`);
}

// Check for Thought Capture Mode
console.log('\n2. Thought Capture Mode (apex think command)');
try {
  const thoughtCapturePath = path.join(__dirname, 'packages/orchestrator/src/thought-capture.ts');
  const cliIndexPath = path.join(__dirname, 'packages/cli/src/index.ts');

  if (fs.existsSync(thoughtCapturePath) && fs.existsSync(cliIndexPath)) {
    const thoughtContent = fs.readFileSync(thoughtCapturePath, 'utf8');
    const cliContent = fs.readFileSync(cliIndexPath, 'utf8');

    if (thoughtContent.includes('class ThoughtCaptureManager') &&
        cliContent.includes("name: 'think'")) {
      console.log('   ✅ ThoughtCaptureManager class and /think CLI command found');
      results.thoughtCapture = true;
    }
  }
} catch (error) {
  console.log(`   ❌ Error checking thought capture: ${error.message}`);
}

// Check for Workspace Isolation
console.log('\n3. Workspace Isolation (Docker/worktree)');
try {
  const worktreeManagerPath = path.join(__dirname, 'packages/orchestrator/src/worktree-manager.ts');
  const workspaceManagerPath = path.join(__dirname, 'packages/orchestrator/src/workspace-manager.ts');
  const containerProxyPath = path.join(__dirname, 'packages/orchestrator/src/container-execution-proxy.ts');

  let isolationFeatures = 0;

  if (fs.existsSync(worktreeManagerPath)) {
    const worktreeContent = fs.readFileSync(worktreeManagerPath, 'utf8');
    if (worktreeContent.includes('class WorktreeManager')) {
      console.log('   ✅ WorktreeManager class found (git worktree isolation)');
      isolationFeatures++;
    }
  }

  if (fs.existsSync(workspaceManagerPath)) {
    const workspaceContent = fs.readFileSync(workspaceManagerPath, 'utf8');
    if (workspaceContent.includes('class WorkspaceManager')) {
      console.log('   ✅ WorkspaceManager class found (workspace management)');
      isolationFeatures++;
    }
  }

  if (fs.existsSync(containerProxyPath)) {
    const containerContent = fs.readFileSync(containerProxyPath, 'utf8');
    if (containerContent.includes('ContainerExecutionProxy')) {
      console.log('   ✅ ContainerExecutionProxy class found (Docker isolation)');
      isolationFeatures++;
    }
  }

  if (isolationFeatures >= 2) {
    results.workspaceIsolation = true;
  }
} catch (error) {
  console.log(`   ❌ Error checking workspace isolation: ${error.message}`);
}

// Check package.json for TypeScript types integration
console.log('\n4. Core Types Integration');
try {
  const coreTypesPath = path.join(__dirname, 'packages/core/src/types.ts');

  if (fs.existsSync(coreTypesPath)) {
    const typesContent = fs.readFileSync(coreTypesPath, 'utf8');

    const hasThoughtTypes = typesContent.includes('interface ThoughtCapture') ||
                           typesContent.includes('type ThoughtCapture');
    const hasIdleTaskTypes = typesContent.includes('interface IdleTask') ||
                            typesContent.includes('type IdleTask');
    const hasWorkspaceTypes = typesContent.includes('interface WorkspaceConfig') ||
                             typesContent.includes('type WorkspaceConfig');

    if (hasThoughtTypes) console.log('   ✅ ThoughtCapture types found');
    if (hasIdleTaskTypes) console.log('   ✅ IdleTask types found');
    if (hasWorkspaceTypes) console.log('   ✅ WorkspaceConfig types found');
  }
} catch (error) {
  console.log(`   ❌ Error checking core types: ${error.message}`);
}

// Summary
console.log('\n📊 Implementation Summary');
console.log('=' + '='.repeat(50));

const totalFeatures = Object.keys(results).length;
const implementedFeatures = Object.values(results).filter(Boolean).length;

console.log(`✅ Idle Task Auto-Generation: ${results.idleTaskGeneration ? 'IMPLEMENTED' : 'MISSING'}`);
console.log(`✅ Thought Capture Mode: ${results.thoughtCapture ? 'IMPLEMENTED' : 'MISSING'}`);
console.log(`✅ Workspace Isolation: ${results.workspaceIsolation ? 'IMPLEMENTED' : 'MISSING'}`);

console.log(`\n🎯 Overall Status: ${implementedFeatures}/${totalFeatures} features implemented`);

if (implementedFeatures === totalFeatures) {
  console.log('\n🚀 SUCCESS: All v0.4.0 features are implemented!');
  process.exit(0);
} else {
  console.log('\n⚠️  WARNING: Some v0.4.0 features are missing');
  process.exit(1);
}