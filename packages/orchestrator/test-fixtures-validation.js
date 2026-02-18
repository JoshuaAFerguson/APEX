#!/usr/bin/env node

/**
 * Simple validation script to ensure the fixtures module can be imported
 * and basic functionality works without running the full test suite
 */

async function validateFixtures() {
  try {
    console.log('🧪 Validating TaskStore test fixtures...');

    // Test basic import
    const fixtures = await import('./dist/fixtures.js');
    console.log('✅ Fixtures module imported successfully');

    // Test basic functionality
    const task = fixtures.createTestTask();
    console.log('✅ createTestTask() works:', task.id);

    const agent = fixtures.createTestAgent();
    console.log('✅ createTestAgent() works:', agent.name);

    const workflow = fixtures.createTestWorkflow();
    console.log('✅ createTestWorkflow() works:', workflow.name);

    const tasks = fixtures.createTestTasks(3);
    console.log('✅ createTestTasks() works:', tasks.length, 'tasks created');

    console.log('🎉 All basic fixture validations passed!');
    return true;
  } catch (error) {
    console.error('❌ Fixture validation failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  validateFixtures().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateFixtures };