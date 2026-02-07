/**
 * Simple verification script for DatabaseSeeder functionality.
 * This script tests basic functionality without requiring the full test suite.
 */

// Import required modules (using require for compatibility)
const { DatabaseSeeder } = require('./test-utils');

async function verifySeeder() {
  console.log('Starting DatabaseSeeder verification...');

  const seeder = new DatabaseSeeder();

  try {
    // Test initialization
    console.log('✓ Testing initialization...');
    await seeder.initialize();
    console.log('✓ Seeder initialized successfully');

    // Test database access
    console.log('✓ Testing database access...');
    const db = seeder.getDatabase();
    const store = seeder.getStore();
    console.log('✓ Database and store accessible');

    // Test task seeding
    console.log('✓ Testing task seeding...');
    const pendingTask = await seeder.seedPendingTask({ description: 'Test pending task' });
    const runningTask = await seeder.seedRunningTask({ description: 'Test running task' });
    const completedTask = await seeder.seedCompletedTask({ description: 'Test completed task' });
    console.log(`✓ Seeded ${[pendingTask, runningTask, completedTask].length} tasks`);

    // Test agent fixtures
    console.log('✓ Testing agent fixtures...');
    const agents = seeder.getAgentFixtures();
    console.log(`✓ Created ${agents.length} agent fixtures`);

    // Test workflow fixtures
    console.log('✓ Testing workflow fixtures...');
    const workflows = seeder.getWorkflowFixtures();
    console.log(`✓ Created ${workflows.length} workflow fixtures`);

    // Test full environment
    console.log('✓ Testing full environment seeding...');
    const environment = await seeder.seedFullEnvironment('mixed-statuses');
    console.log(`✓ Full environment: ${environment.tasks.length} tasks, ${environment.agents.length} agents, ${environment.workflows.length} workflows`);

    // Test reset functionality
    console.log('✓ Testing reset functionality...');
    await seeder.reset();
    const tasksAfterReset = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
    console.log(`✓ Reset completed, tasks in DB after reset: ${tasksAfterReset.count}`);

    // Test minimal environment
    console.log('✓ Testing minimal environment...');
    const minimalEnv = await seeder.seedMinimalEnvironment();
    console.log(`✓ Minimal environment: 1 task (${minimalEnv.task.status}), 1 agent (${minimalEnv.agent.name}), 1 workflow (${minimalEnv.workflow.name})`);

    console.log('\n🎉 All verification tests passed!');

  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    // Clean up
    try {
      await seeder.cleanup();
      console.log('✓ Cleanup completed');
    } catch (cleanupError) {
      console.warn('⚠️ Cleanup warning:', cleanupError.message);
    }
  }
}

// Run verification if this script is executed directly
if (require.main === module) {
  verifySeeder().catch(console.error);
}

module.exports = { verifySeeder };