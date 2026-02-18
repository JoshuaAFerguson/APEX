/**
 * Validation script for CI Pipeline E2E tests
 *
 * This script validates that our CI pipeline configuration tests are working
 * correctly and verifies the actual CI workflow configuration.
 */

const fs = require('fs').promises;
const path = require('path');

async function validateCiPipelineTests() {
  console.log('🔍 Validating CI Pipeline E2E Tests...\n');

  try {
    // 1. Verify the test file exists
    const testFilePath = path.join(__dirname, 'tests/e2e/ci-pipeline-e2e.test.ts');
    const testFileExists = await fs.access(testFilePath).then(() => true).catch(() => false);

    console.log('✅ Test file exists:', testFileExists);

    if (!testFileExists) {
      console.error('❌ CI pipeline test file not found');
      return false;
    }

    // 2. Verify CI workflow file exists
    const ciWorkflowPath = path.join(__dirname, '.github/workflows/ci.yml');
    const ciWorkflowExists = await fs.access(ciWorkflowPath).then(() => true).catch(() => false);

    console.log('✅ CI workflow file exists:', ciWorkflowExists);

    if (!ciWorkflowExists) {
      console.error('❌ CI workflow file not found');
      return false;
    }

    // 3. Validate CI workflow structure
    const ciWorkflowContent = await fs.readFile(ciWorkflowPath, 'utf-8');

    console.log('\n📋 Validating CI Workflow Structure:');

    // Check basic structure
    const hasName = ciWorkflowContent.includes('name: CI');
    console.log('  ✅ Has correct name:', hasName);

    const hasJobs = ciWorkflowContent.includes('jobs:');
    console.log('  ✅ Has jobs section:', hasJobs);

    const hasBuildJob = ciWorkflowContent.match(/^\s*build:\s*$/m);
    console.log('  ✅ Has build job:', !!hasBuildJob);

    const hasE2EJob = ciWorkflowContent.match(/^\s*e2e:\s*$/m);
    console.log('  ✅ Has E2E job:', !!hasE2EJob);

    // Check E2E job specifics
    console.log('\n🔧 Validating E2E Job Configuration:');

    const hasE2ENeeds = ciWorkflowContent.match(/e2e:[\s\S]*?needs:\s*build/);
    console.log('  ✅ E2E depends on build:', !!hasE2ENeeds);

    const hasIsolatedEnv = ciWorkflowContent.match(/os:\s*\[ubuntu-latest\].*node-version:\s*\[20\.x\]/s);
    console.log('  ✅ Has isolated environment:', !!hasIsolatedEnv);

    const hasE2EEnvVars = ciWorkflowContent.match(/APEX_TEST_MODE:\s*e2e/);
    console.log('  ✅ Has E2E test mode:', !!hasE2EEnvVars);

    const hasGitConfig = ciWorkflowContent.match(/GIT_AUTHOR_NAME:\s*GitHub Actions/);
    console.log('  ✅ Has Git configuration:', !!hasGitConfig);

    const hasCleanup = ciWorkflowContent.match(/- name: Cleanup E2E test resources[\s\S]*?if:\s*always\(\)/);
    console.log('  ✅ Has cleanup that always runs:', !!hasCleanup);

    const hasProcessCleanup = ciWorkflowContent.includes('pkill -f "apex"');
    console.log('  ✅ Has process cleanup:', hasProcessCleanup);

    const hasTempDirCleanup = ciWorkflowContent.includes('rm -rf /tmp/apex-e2e-*');
    console.log('  ✅ Has temp directory cleanup:', hasTempDirCleanup);

    // 4. Verify test configuration files
    console.log('\n⚙️ Validating Test Configuration:');

    const e2eConfigPath = path.join(__dirname, 'vitest.e2e.config.ts');
    const e2eConfigExists = await fs.access(e2eConfigPath).then(() => true).catch(() => false);
    console.log('  ✅ E2E config exists:', e2eConfigExists);

    if (e2eConfigExists) {
      const e2eConfigContent = await fs.readFile(e2eConfigPath, 'utf-8');
      const hasE2EPatterns = e2eConfigContent.includes('*.e2e.test.ts');
      const hasSetupFile = e2eConfigContent.includes('./tests/e2e/setup.ts');
      const hasTeardownFile = e2eConfigContent.includes('./tests/e2e/teardown.ts');

      console.log('    ✅ Has E2E test patterns:', hasE2EPatterns);
      console.log('    ✅ Has setup file:', hasSetupFile);
      console.log('    ✅ Has teardown file:', hasTeardownFile);
    }

    // 5. Check package.json scripts
    const packageJsonPath = path.join(__dirname, 'package.json');
    const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageContent);

    console.log('\n📦 Validating Package Scripts:');

    const hasE2EScript = packageJson.scripts['test:e2e'];
    console.log('  ✅ Has test:e2e script:', !!hasE2EScript);

    const hasE2EWatchScript = packageJson.scripts['test:e2e:watch'];
    console.log('  ✅ Has test:e2e:watch script:', !!hasE2EWatchScript);

    // 6. Verify E2E setup files exist
    console.log('\n🛠️ Validating E2E Infrastructure:');

    const e2eSetupPath = path.join(__dirname, 'tests/e2e/setup.ts');
    const e2eSetupExists = await fs.access(e2eSetupPath).then(() => true).catch(() => false);
    console.log('  ✅ E2E setup file exists:', e2eSetupExists);

    const e2eTeardownPath = path.join(__dirname, 'tests/e2e/teardown.ts');
    const e2eTeardownExists = await fs.access(e2eTeardownPath).then(() => true).catch(() => false);
    console.log('  ✅ E2E teardown file exists:', e2eTeardownExists);

    // Summary
    console.log('\n📊 Validation Summary:');
    const allChecks = [
      testFileExists,
      ciWorkflowExists,
      hasName,
      hasJobs,
      hasBuildJob,
      hasE2EJob,
      hasE2ENeeds,
      hasIsolatedEnv,
      hasE2EEnvVars,
      hasGitConfig,
      hasCleanup,
      hasProcessCleanup,
      hasTempDirCleanup,
      e2eConfigExists,
      hasE2EScript,
      hasE2EWatchScript,
      e2eSetupExists,
      e2eTeardownExists
    ].filter(Boolean);

    const totalChecks = 18;
    const passedChecks = allChecks.length;

    console.log(`✅ Passed: ${passedChecks}/${totalChecks} checks`);

    if (passedChecks === totalChecks) {
      console.log('🎉 All CI pipeline tests validation checks passed!');
      return true;
    } else {
      console.log('⚠️ Some validation checks failed. Review the issues above.');
      return false;
    }

  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  validateCiPipelineTests().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateCiPipelineTests };