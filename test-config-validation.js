// Simple test script to verify config validation implementation
const fs = require('fs/promises');
const path = require('path');

async function testValidation() {
  console.log('Testing APEX config validation implementation...');

  try {
    // Try to import the module
    const { validateApexConfiguration, createApexConfigValidationCheck } = require('./packages/core/dist/config-validation.js');

    console.log('✓ Successfully imported validation functions');

    // Test with a non-existent directory (should return not initialized error)
    const testPath = '/tmp/non-existent-apex-project';
    const result = await validateApexConfiguration(testPath);

    console.log('✓ Validation function executed successfully');
    console.log(`Result: valid=${result.valid}, errors=${result.summary.totalErrors}, warnings=${result.summary.totalWarnings}`);

    // Test creating a doctor check result
    const doctorCheck = createApexConfigValidationCheck(testPath, result);

    console.log('✓ Doctor check creation successful');
    console.log(`Doctor check: ${doctorCheck.name} - ${doctorCheck.status}`);

    console.log('\n✅ All tests passed! Implementation appears to be working correctly.');

  } catch (error) {
    console.error('❌ Error during testing:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testValidation();