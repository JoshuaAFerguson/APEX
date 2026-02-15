#!/usr/bin/env node

/**
 * Verification script for v0.5.0 completion status in ROADMAP.md
 * This script validates that the task "Update ROADMAP.md to mark v0.5.0 features as complete"
 * has been completed successfully.
 */

const fs = require('fs');
const path = require('path');

function verifyV050Completion() {
  console.log('🔍 Verifying v0.5.0 completion status in ROADMAP.md...\n');

  // Read ROADMAP.md
  const roadmapPath = path.join(__dirname, '..', 'ROADMAP.md');

  if (!fs.existsSync(roadmapPath)) {
    console.error('❌ ROADMAP.md not found');
    process.exit(1);
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');

  // Check 1: v0.5.0 section exists and is marked as complete
  const v050HeaderMatch = content.match(/## v0\.5\.0.*Complete/i);
  if (!v050HeaderMatch) {
    console.error('❌ v0.5.0 section not marked as complete');
    process.exit(1);
  }
  console.log('✅ v0.5.0 section header marked as complete');

  // Extract v0.5.0 section
  const v050Start = content.indexOf('## v0.5.0');
  const v060Start = content.indexOf('## v0.6.0');

  if (v050Start === -1 || v060Start === -1) {
    console.error('❌ Cannot locate v0.5.0 section boundaries');
    process.exit(1);
  }

  const v050Section = content.substring(v050Start, v060Start);

  // Check 2: Count features and verify all are complete
  const featureLines = v050Section.split('\n').filter(line =>
    line.includes('🟢') || line.includes('🟡') || line.includes('⚪')
  );

  const completeFeatures = featureLines.filter(line => line.includes('🟢'));
  const inProgressFeatures = featureLines.filter(line => line.includes('🟡'));
  const plannedFeatures = featureLines.filter(line => line.includes('⚪'));

  console.log(`📊 Feature Status Breakdown:`);
  console.log(`   - Total features: ${featureLines.length}`);
  console.log(`   - Complete (🟢): ${completeFeatures.length}`);
  console.log(`   - In Progress (🟡): ${inProgressFeatures.length}`);
  console.log(`   - Planned (⚪): ${plannedFeatures.length}`);

  // Check 3: Verify all features are complete
  if (featureLines.length === 0) {
    console.error('❌ No features found in v0.5.0 section');
    process.exit(1);
  }

  if (completeFeatures.length !== featureLines.length) {
    console.error('❌ Not all features are marked as complete');
    console.error(`Expected: ${featureLines.length}, Got: ${completeFeatures.length}`);
    process.exit(1);
  }

  if (inProgressFeatures.length > 0 || plannedFeatures.length > 0) {
    console.error('❌ Found incomplete features in v0.5.0 section');
    process.exit(1);
  }

  console.log('✅ All features marked as complete (🟢)');

  // Check 4: Verify minimum feature count (should be substantial release)
  if (completeFeatures.length < 50) {
    console.error(`❌ Feature count too low for major release: ${completeFeatures.length}`);
    process.exit(1);
  }

  console.log('✅ Sufficient feature count for major release');

  // Check 5: Verify feature categories exist
  const expectedCategories = [
    'Browser Automation',
    'Built-in Tools',
    'Tool Visualization',
    'Permission System',
    'Autonomy Controls',
    'Code Quality Integration',
    'Tool Extensions',
    'MCP Ecosystem',
    'Test-Driven Development'
  ];

  const missingCategories = expectedCategories.filter(category =>
    !v050Section.includes(category)
  );

  if (missingCategories.length > 0) {
    console.error(`❌ Missing expected categories: ${missingCategories.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ All expected feature categories present');

  // Final success message
  console.log(`\n🎉 SUCCESS: v0.5.0 completion verification passed!`);
  console.log(`📋 Task: "Update ROADMAP.md to mark v0.5.0 features as complete"`);
  console.log(`✅ Status: COMPLETED SUCCESSFULLY`);
  console.log(`📊 Features: ${completeFeatures.length} features marked as complete`);
  console.log(`🎯 Acceptance Criteria: All met`);

  return {
    success: true,
    totalFeatures: featureLines.length,
    completeFeatures: completeFeatures.length,
    categories: expectedCategories.length
  };
}

// Run verification if this script is executed directly
if (require.main === module) {
  try {
    verifyV050Completion();
    process.exit(0);
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }
}

module.exports = { verifyV050Completion };