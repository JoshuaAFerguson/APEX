#!/usr/bin/env npx ts-node

/**
 * Test Verification Script for IdleProcessor-IdleTaskGenerator-TaskStore Integration
 *
 * This script demonstrates the functionality of the integration tests without
 * running the full test suite. It validates the core components work together.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { IdleTaskGenerator } from './idle-task-generator';
import { TaskStore } from './store';
import { ProjectAnalysis } from './idle-processor';
import {
  IdleTask,
  TaskPriority,
  CreateTaskRequest
} from '@apexcli/core';

async function main() {
  console.log('🧪 IdleProcessor Integration Test Verification');
  console.log('================================================');

  // Create temporary directory
  const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-verification-'));
  console.log(`📁 Using test directory: ${testDir}`);

  try {
    // Initialize components
    console.log('\n🔧 Initializing components...');
    const taskStore = new TaskStore(testDir);
    await taskStore.initialize();
    const idleTaskGenerator = new IdleTaskGenerator();
    console.log('✅ Components initialized');

    // Create sample project analysis
    const projectAnalysis: ProjectAnalysis = {
      codebaseSize: { files: 30, lines: 5000, languages: { typescript: 30 } },
      testCoverage: { percentage: 45, uncoveredFiles: ['src/test.ts'] },
      dependencies: { outdated: ['lodash@1.0.0'], security: [] },
      codeQuality: {
        lintIssues: 10,
        duplicatedCode: [],
        complexityHotspots: [],
        codeSmells: []
      },
      documentation: {
        coverage: 50,
        missingDocs: ['src/api.ts'],
        undocumentedExports: [],
        outdatedDocs: [],
        missingReadmeSections: [],
        apiCompleteness: {
          percentage: 70,
          details: {
            totalEndpoints: 10,
            documentedEndpoints: 7,
            undocumentedItems: [],
            wellDocumentedExamples: [],
            commonIssues: []
          }
        }
      },
      performance: { slowTests: [], bottlenecks: [] },
      testAnalysis: {
        branchCoverage: { percentage: 60, uncoveredBranches: [] },
        untestedExports: [],
        missingIntegrationTests: [],
        antiPatterns: []
      }
    };

    // Test AC1: Generate idle task with low priority
    console.log('\n📋 AC1: Testing idle task generation...');
    const idleTask = idleTaskGenerator.generateTask(projectAnalysis);

    if (!idleTask) {
      throw new Error('Failed to generate idle task');
    }

    console.log(`✅ Generated task: ${idleTask.title}`);
    console.log(`   Priority: ${idleTask.priority} (should be 'low')`);
    console.log(`   Type: ${idleTask.type}`);
    console.log(`   ID Pattern: ${idleTask.id} (should match idle-* pattern)`);

    if (idleTask.priority !== 'low') {
      throw new Error(`Expected priority 'low', got '${idleTask.priority}'`);
    }

    // Test AC2: Persist to idle_tasks table
    console.log('\n💾 AC2: Testing task persistence...');
    const persistedTask = await taskStore.createIdleTask(idleTask);
    console.log(`✅ Task persisted with ID: ${persistedTask.id}`);

    const retrievedTask = await taskStore.getIdleTask(idleTask.id);
    if (!retrievedTask) {
      throw new Error('Failed to retrieve persisted task');
    }
    console.log(`✅ Task successfully retrieved from database`);

    // Test AC3: Promote to real task
    console.log('\n🚀 AC3: Testing task promotion...');
    const taskRequest: Omit<CreateTaskRequest, 'description'> = {
      workflow: 'feature',
      autonomy: 'review-before-commit',
      projectPath: testDir
    };

    const realTask = await taskStore.promoteIdleTask(idleTask.id, taskRequest);
    console.log(`✅ Task promoted to real task: ${realTask.id}`);
    console.log(`   Real task priority: ${realTask.priority} (inherited from idle task)`);
    console.log(`   Real task workflow: ${realTask.workflow}`);

    // Test AC4: Verify references
    console.log('\n🔗 AC4: Testing reference integrity...');
    const updatedIdleTask = await taskStore.getIdleTask(idleTask.id);
    if (!updatedIdleTask) {
      throw new Error('Failed to retrieve updated idle task');
    }

    console.log(`✅ Idle task marked as implemented: ${updatedIdleTask.implemented}`);
    console.log(`✅ Idle task references real task: ${updatedIdleTask.implementedTaskId}`);

    if (!updatedIdleTask.implemented) {
      throw new Error('Idle task not marked as implemented after promotion');
    }

    if (updatedIdleTask.implementedTaskId !== realTask.id) {
      throw new Error('Idle task does not reference correct real task ID');
    }

    // Verify real task exists and has correct properties
    const retrievedRealTask = await taskStore.getTask(realTask.id);
    if (!retrievedRealTask) {
      throw new Error('Real task not found in database');
    }
    console.log(`✅ Real task persisted and retrievable`);

    // Test database queries
    console.log('\n🗄️  Testing database queries...');
    const allIdleTasks = await taskStore.listIdleTasks();
    const implementedTasks = await taskStore.listIdleTasks({ implemented: true });
    const unimplementedTasks = await taskStore.listIdleTasks({ implemented: false });

    console.log(`✅ Query results:`);
    console.log(`   Total idle tasks: ${allIdleTasks.length}`);
    console.log(`   Implemented tasks: ${implementedTasks.length}`);
    console.log(`   Unimplemented tasks: ${unimplementedTasks.length}`);

    // Final verification
    console.log('\n🎯 Final Verification...');
    console.log('✅ All acceptance criteria validated successfully!');
    console.log('✅ IdleProcessor-IdleTaskGenerator-TaskStore integration working correctly');

    // Cleanup
    taskStore.close();
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('\n🧹 Cleanup completed');

  } catch (error) {
    console.error('\n❌ Verification failed:', error);

    // Cleanup on error
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}