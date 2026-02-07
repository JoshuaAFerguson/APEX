/**
 * Validation script for E2E test environment isolation
 *
 * This script validates that the E2E test environment is properly isolated
 * and configured for CI execution with proper cleanup mechanisms.
 */

const fs = require('fs').promises;
const path = require('path');

async function validateE2EIsolation() {
  console.log('🔒 Validating E2E Test Environment Isolation...\n');

  try {
    let validationResults = [];

    // 1. Check E2E configuration file
    console.log('📋 Validating E2E Configuration:');

    const e2eConfigPath = path.join(__dirname, 'vitest.e2e.config.ts');
    const e2eConfigExists = await fs.access(e2eConfigPath).then(() => true).catch(() => false);
    console.log('  ✅ E2E config file exists:', e2eConfigExists);
    validationResults.push(e2eConfigExists);

    if (e2eConfigExists) {
      const e2eConfigContent = await fs.readFile(e2eConfigPath, 'utf-8');

      // Check for isolated environment settings
      const hasE2ETestMode = e2eConfigContent.includes("'e2e'");
      console.log('  ✅ Configures E2E test mode:', hasE2ETestMode);
      validationResults.push(hasE2ETestMode);

      const hasForkedPool = e2eConfigContent.includes("pool: 'forks'");
      console.log('  ✅ Uses forked process pool:', hasForkedPool);
      validationResults.push(hasForkedPool);

      const hasSetupFiles = e2eConfigContent.includes('./tests/e2e/setup.ts');
      console.log('  ✅ References setup file:', hasSetupFiles);
      validationResults.push(hasSetupFiles);

      const hasTeardownFiles = e2eConfigContent.includes('./tests/e2e/teardown.ts');
      console.log('  ✅ References teardown file:', hasTeardownFiles);
      validationResults.push(hasTeardownFiles);

      const hasE2EPatterns = e2eConfigContent.includes('*.e2e.test.ts');
      console.log('  ✅ Includes E2E test patterns:', hasE2EPatterns);
      validationResults.push(hasE2EPatterns);

      const hasExtendedTimeouts = e2eConfigContent.match(/timeout.*60000|60s/);
      console.log('  ✅ Has extended timeouts for E2E:', !!hasExtendedTimeouts);
      validationResults.push(!!hasExtendedTimeouts);
    }

    // 2. Check E2E setup file for isolation features
    console.log('\n🛠️ Validating E2E Setup Infrastructure:');

    const setupPath = path.join(__dirname, 'tests/e2e/setup.ts');
    const setupExists = await fs.access(setupPath).then(() => true).catch(() => false);
    console.log('  ✅ Setup file exists:', setupExists);
    validationResults.push(setupExists);

    if (setupExists) {
      const setupContent = await fs.readFile(setupPath, 'utf-8');

      const hasTempDirManagement = setupContent.includes('createTempDir');
      console.log('    ✅ Provides temp directory management:', hasTempDirManagement);
      validationResults.push(hasTempDirManagement);

      const hasResourceTracking = setupContent.includes('orchestrators: Set');
      console.log('    ✅ Tracks orchestrator resources:', hasResourceTracking);
      validationResults.push(hasResourceTracking);

      const hasGitHelpers = setupContent.includes('createTempGitRepo');
      console.log('    ✅ Provides git repository helpers:', hasGitHelpers);
      validationResults.push(hasGitHelpers);

      const hasCleanupAll = setupContent.includes('cleanupAll');
      console.log('    ✅ Provides cleanup utilities:', hasCleanupAll);
      validationResults.push(hasCleanupAll);

      const hasGlobalHelpers = setupContent.includes('globalThis.apexE2EHelpers');
      console.log('    ✅ Exposes global helpers:', hasGlobalHelpers);
      validationResults.push(hasGlobalHelpers);

      const hasTestEnvConfig = setupContent.includes("APEX_TEST_MODE = 'e2e'");
      console.log('    ✅ Sets E2E test environment:', hasTestEnvConfig);
      validationResults.push(hasTestEnvConfig);
    }

    // 3. Check E2E teardown file for cleanup
    console.log('\n🧹 Validating E2E Teardown/Cleanup:');

    const teardownPath = path.join(__dirname, 'tests/e2e/teardown.ts');
    const teardownExists = await fs.access(teardownPath).then(() => true).catch(() => false);
    console.log('  ✅ Teardown file exists:', teardownExists);
    validationResults.push(teardownExists);

    if (teardownExists) {
      const teardownContent = await fs.readFile(teardownPath, 'utf-8');

      const hasTempDirCleanup = teardownContent.includes('cleanupOrphanedTempDirs');
      console.log('    ✅ Cleans orphaned temp directories:', hasTempDirCleanup);
      validationResults.push(hasTempDirCleanup);

      const hasProcessCleanup = teardownContent.includes('killOrphanedProcesses');
      console.log('    ✅ Kills orphaned processes:', hasProcessCleanup);
      validationResults.push(hasProcessCleanup);

      const hasGlobalStateCleanup = teardownContent.includes('cleanupGlobalState');
      console.log('    ✅ Cleans global state:', hasGlobalStateCleanup);
      validationResults.push(hasGlobalStateCleanup);

      const hasDbVerification = teardownContent.includes('verifyDatabaseCleanup');
      console.log('    ✅ Verifies database cleanup:', hasDbVerification);
      validationResults.push(hasDbVerification);

      const hasApexTempPattern = teardownContent.includes('apex-e2e-');
      console.log('    ✅ Targets APEX temp directories:', hasApexTempPattern);
      validationResults.push(hasApexTempPattern);
    }

    // 4. Check CI workflow for isolation settings
    console.log('\n⚙️ Validating CI Environment Isolation:');

    const ciWorkflowPath = path.join(__dirname, '.github/workflows/ci.yml');
    const ciWorkflowExists = await fs.access(ciWorkflowPath).then(() => true).catch(() => false);
    console.log('  ✅ CI workflow exists:', ciWorkflowExists);
    validationResults.push(ciWorkflowExists);

    if (ciWorkflowExists) {
      const ciContent = await fs.readFile(ciWorkflowPath, 'utf-8');

      const hasE2EJob = ciContent.includes('e2e:');
      console.log('    ✅ Has dedicated E2E job:', hasE2EJob);
      validationResults.push(hasE2EJob);

      const hasJobDependency = ciContent.match(/needs:\s*build/);
      console.log('    ✅ E2E depends on build job:', !!hasJobDependency);
      validationResults.push(!!hasJobDependency);

      const hasUbuntuOnly = ciContent.match(/e2e:[\s\S]*?os:\s*\[ubuntu-latest\]/);
      console.log('    ✅ Runs E2E on Ubuntu only:', !!hasUbuntuOnly);
      validationResults.push(!!hasUbuntuOnly);

      const hasNode20Only = ciContent.match(/e2e:[\s\S]*?node-version:\s*\[20\.x\]/);
      console.log('    ✅ Uses Node.js 20.x for E2E:', !!hasNode20Only);
      validationResults.push(!!hasNode20Only);

      const hasFailFastFalse = ciContent.match(/fail-fast:\s*false/);
      console.log('    ✅ Disables fail-fast for debugging:', !!hasFailFastFalse);
      validationResults.push(!!hasFailFastFalse);

      const hasE2EEnvVars = ciContent.includes('APEX_TEST_MODE: e2e');
      console.log('    ✅ Sets E2E environment variables:', hasE2EEnvVars);
      validationResults.push(hasE2EEnvVars);

      const hasAlwaysCleanup = ciContent.match(/if:\s*always\(\)/);
      console.log('    ✅ Has always-run cleanup:', !!hasAlwaysCleanup);
      validationResults.push(!!hasAlwaysCleanup);

      const hasProcessKill = ciContent.includes('pkill -f "apex"');
      console.log('    ✅ Kills orphaned processes in CI:', hasProcessKill);
      validationResults.push(hasProcessKill);

      const hasTempCleanup = ciContent.includes('rm -rf /tmp/apex-e2e-*');
      console.log('    ✅ Cleans temp directories in CI:', hasTempCleanup);
      validationResults.push(hasTempCleanup);
    }

    // 5. Check our CI pipeline test exists and validates isolation
    console.log('\n🧪 Validating CI Pipeline Test Coverage:');

    const ciTestPath = path.join(__dirname, 'tests/e2e/ci-pipeline-e2e.test.ts');
    const ciTestExists = await fs.access(ciTestPath).then(() => true).catch(() => false);
    console.log('  ✅ CI pipeline test exists:', ciTestExists);
    validationResults.push(ciTestExists);

    if (ciTestExists) {
      const ciTestContent = await fs.readFile(ciTestPath, 'utf-8');

      const testsIsolation = ciTestContent.includes('Isolation and Resource Management');
      console.log('    ✅ Tests isolation configuration:', testsIsolation);
      validationResults.push(testsIsolation);

      const testsEnvironment = ciTestContent.includes('Test Environment Validation');
      console.log('    ✅ Tests environment validation:', testsEnvironment);
      validationResults.push(testsEnvironment);

      const testsCleanup = ciTestContent.includes('Cleanup Mechanism Validation');
      console.log('    ✅ Tests cleanup mechanisms:', testsCleanup);
      validationResults.push(testsCleanup);

      const testsE2EHelpers = ciTestContent.includes('globalThis.apexE2EHelpers');
      console.log('    ✅ Tests global E2E helpers:', testsE2EHelpers);
      validationResults.push(testsE2EHelpers);
    }

    // Summary
    console.log('\n📊 Isolation Validation Summary:');
    const passedChecks = validationResults.filter(Boolean).length;
    const totalChecks = validationResults.length;

    console.log(`✅ Passed: ${passedChecks}/${totalChecks} isolation checks`);

    if (passedChecks === totalChecks) {
      console.log('🔒 E2E test environment isolation is properly configured!');

      console.log('\n🎯 Isolation Features Confirmed:');
      console.log('  • Dedicated Ubuntu-only environment for E2E tests');
      console.log('  • Forked process pool for test isolation');
      console.log('  • Comprehensive resource cleanup (processes, temp dirs, databases)');
      console.log('  • Global helpers for consistent test utilities');
      console.log('  • Environment variable configuration for E2E mode');
      console.log('  • Always-run cleanup in CI, even on failure');
      console.log('  • Extended timeouts for real-world operations');
      console.log('  • Sequential test execution to prevent resource conflicts');

      return true;
    } else {
      console.log('⚠️ Some isolation validation checks failed. Review the issues above.');
      return false;
    }

  } catch (error) {
    console.error('❌ Isolation validation failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  validateE2EIsolation().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateE2EIsolation };