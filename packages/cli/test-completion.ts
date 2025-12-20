#!/usr/bin/env tsx

// Quick test script to verify CompletionEngine constructor changes
import { CompletionEngine, CompletionContext } from './src/services/CompletionEngine.js';

async function testCompletionEngine() {
  console.log('Testing CompletionEngine constructor...');

  // Test 1: No config (original behavior)
  try {
    const engine1 = new CompletionEngine();
    console.log('✓ Constructor with no config works');
  } catch (error) {
    console.error('✗ Constructor with no config failed:', error);
  }

  // Test 2: With config object (test requirement)
  try {
    const engine2 = new CompletionEngine({
      commands: [
        { name: 'run', description: 'Execute a task' },
        { name: 'status', description: 'Show task status' },
        { name: 'help', description: 'Show help' },
      ],
      history: ['create component', 'fix bug', 'run tests'],
    });
    console.log('✓ Constructor with config object works');

    // Test basic completion
    const testContext: CompletionContext = {
      projectPath: '/test',
      agents: [],
      workflows: [],
      recentTasks: [],
      inputHistory: [],
    };

    const completions = await engine2.getCompletions('/h', 2, testContext);
    console.log('✓ getCompletions method works, found', completions.length, 'completions');
  } catch (error) {
    console.error('✗ Constructor with config failed:', error);
  }
}

testCompletionEngine().catch(console.error);