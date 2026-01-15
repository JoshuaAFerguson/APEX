#!/usr/bin/env npx tsx

import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';
import { WorkflowDefinitionSchema } from './packages/core/src/types';

/**
 * Validates the TDD workflow template against the WorkflowDefinitionSchema
 * This script ensures the TDD workflow meets all structural requirements
 */
function validateTddWorkflow(): void {
  console.log('🔍 Validating TDD workflow template...');

  const tddWorkflowPath = path.join(__dirname, 'packages/core/templates/workflows/tdd.yaml');

  if (!fs.existsSync(tddWorkflowPath)) {
    console.error('❌ TDD workflow template not found at:', tddWorkflowPath);
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(tddWorkflowPath, 'utf8');
    const workflow = parse(content);

    // Validate against Zod schema
    const result = WorkflowDefinitionSchema.safeParse(workflow);

    if (!result.success) {
      console.error('❌ Schema validation failed:');
      console.error(result.error.errors);
      process.exit(1);
    }

    const validWorkflow = result.data;

    // Verify specific TDD requirements
    console.log('✅ Schema validation passed');

    // Check required stages
    const requiredStages = ['write-test', 'run-test', 'implement', 'verify', 'regression-check'];
    const actualStages = validWorkflow.stages.map(s => s.name);

    const missingStages = requiredStages.filter(stage => !actualStages.includes(stage));
    if (missingStages.length > 0) {
      console.error('❌ Missing required stages:', missingStages);
      process.exit(1);
    }

    // Check stage order (dependencies)
    const stageMap = new Map(validWorkflow.stages.map(s => [s.name, s]));

    // Verify dependencies
    const runTestStage = stageMap.get('run-test');
    const implementStage = stageMap.get('implement');
    const verifyStage = stageMap.get('verify');
    const regressionStage = stageMap.get('regression-check');

    if (!runTestStage?.dependsOn?.includes('write-test')) {
      console.error('❌ run-test stage must depend on write-test');
      process.exit(1);
    }

    if (!implementStage?.dependsOn?.includes('run-test')) {
      console.error('❌ implement stage must depend on run-test');
      process.exit(1);
    }

    if (!verifyStage?.dependsOn?.includes('implement')) {
      console.error('❌ verify stage must depend on implement');
      process.exit(1);
    }

    if (!regressionStage?.dependsOn?.includes('verify')) {
      console.error('❌ regression-check stage must depend on verify');
      process.exit(1);
    }

    // Check implement stage has required outputs
    if (!implementStage?.outputs?.includes('code_changes')) {
      console.error('❌ implement stage must output code_changes');
      process.exit(1);
    }

    if (!implementStage?.outputs?.includes('branch_name')) {
      console.error('❌ implement stage must output branch_name');
      process.exit(1);
    }

    // Check agent assignments
    const writeTestStage = stageMap.get('write-test');
    if (writeTestStage?.agent !== 'tdd-tester') {
      console.error('❌ write-test stage must be assigned to tdd-tester agent');
      process.exit(1);
    }

    if (implementStage?.agent !== 'tdd-developer') {
      console.error('❌ implement stage must be assigned to tdd-developer agent');
      process.exit(1);
    }

    console.log('✅ All TDD workflow requirements validated');
    console.log('✅ Workflow name:', validWorkflow.name);
    console.log('✅ Description:', validWorkflow.description);
    console.log('✅ Stages:', validWorkflow.stages.length);

    validWorkflow.stages.forEach((stage, index) => {
      console.log(`  ${index + 1}. ${stage.name} (${stage.agent}) - ${stage.description}`);
    });

    console.log('✅ TDD workflow validation complete!');

  } catch (error) {
    console.error('❌ Validation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateTddWorkflow();
}

export { validateTddWorkflow };