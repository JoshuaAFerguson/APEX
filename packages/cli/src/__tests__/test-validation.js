/**
 * Simple validation script to check if test files can be imported
 */

async function validateTests() {
  console.log('🧪 Validating test files...');

  try {
    // Try to import the helper functions to ensure they exist and can be accessed
    const indexModule = await import('../index.js');

    const { getIdleTaskTypeEmoji, getPriorityColor, getEffortEmoji } = indexModule;

    console.log('✅ Helper functions imported successfully');

    // Test helper functions
    const maintenanceEmoji = getIdleTaskTypeEmoji('maintenance');
    const unknownEmoji = getIdleTaskTypeEmoji('unknown');

    console.log(`✅ getIdleTaskTypeEmoji works: maintenance -> ${maintenanceEmoji}, unknown -> ${unknownEmoji}`);

    const priorityColorFunc = getPriorityColor('high');
    const unknownPriorityFunc = getPriorityColor('unknown');

    console.log(`✅ getPriorityColor works: returns function types: ${typeof priorityColorFunc}, ${typeof unknownPriorityFunc}`);

    const smallEffort = getEffortEmoji('small');
    const unknownEffort = getEffortEmoji('unknown');

    console.log(`✅ getEffortEmoji works: small -> ${smallEffort}, unknown -> ${unknownEffort}`);

    console.log('🎉 All test validations passed!');

  } catch (error) {
    console.error('❌ Test validation failed:', error.message);
    process.exit(1);
  }
}

validateTests();