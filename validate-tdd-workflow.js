const fs = require('fs');
const yaml = require('yaml');
const path = require('path');

// Read the TDD workflow file
const tddWorkflowPath = path.join(__dirname, 'packages/core/templates/workflows/tdd.yaml');
const content = fs.readFileSync(tddWorkflowPath, 'utf8');

try {
  // Parse YAML
  const workflow = yaml.parse(content);
  console.log('✅ YAML parsing successful');

  // Check required fields
  const requiredFields = ['name', 'description', 'stages'];
  const missingFields = requiredFields.filter(field => !workflow[field]);

  if (missingFields.length > 0) {
    console.error('❌ Missing required fields:', missingFields);
    process.exit(1);
  }

  // Check stages structure
  if (!Array.isArray(workflow.stages) || workflow.stages.length === 0) {
    console.error('❌ Stages must be a non-empty array');
    process.exit(1);
  }

  // Validate each stage
  workflow.stages.forEach((stage, index) => {
    const stageRequiredFields = ['name', 'agent'];
    const stageMissingFields = stageRequiredFields.filter(field => !stage[field]);

    if (stageMissingFields.length > 0) {
      console.error(`❌ Stage ${index + 1} missing required fields:`, stageMissingFields);
      process.exit(1);
    }
  });

  console.log('✅ All validation checks passed');
  console.log(`✅ Workflow: ${workflow.name}`);
  console.log(`✅ Description: ${workflow.description}`);
  console.log(`✅ Stages: ${workflow.stages.length}`);
  workflow.stages.forEach((stage, index) => {
    console.log(`  ${index + 1}. ${stage.name} (${stage.agent})`);
  });

} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}