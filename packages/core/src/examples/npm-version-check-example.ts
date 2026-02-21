/**
 * Example Usage of NPM Registry Version Checker Utility
 *
 * This example demonstrates how to use the npm registry version checker
 * for checking @apexcli/cli versions with caching and error handling.
 */

import { checkApexCliVersion, checkPackageVersion, getCacheStats, clearVersionCache } from '../npm-registry-utils';

async function basicUsageExample() {
  console.log('=== Basic Usage Example ===');

  // Check @apexcli/cli version
  const result = await checkApexCliVersion('0.5.0');

  if (result) {
    if (result.error) {
      console.log(`Error checking version: ${result.error}`);
    } else {
      console.log(`Current version: ${result.currentVersion}`);
      console.log(`Latest version: ${result.latestVersion}`);
      console.log(`Is latest: ${result.isLatest}`);
      console.log(`Update available: ${result.hasUpdate}`);

      if (result.hasUpdate) {
        console.log(`🎉 Update available: ${result.currentVersion} → ${result.latestVersion}`);
      } else if (result.isLatest) {
        console.log('✅ You are running the latest version!');
      }
    }
  } else {
    console.log('Failed to check version');
  }
}

async function advancedUsageExample() {
  console.log('\n=== Advanced Usage Example ===');

  // Check with custom options
  const result = await checkApexCliVersion('0.6.0', {
    cacheTtl: 12 * 60 * 60 * 1000, // 12 hours cache
    timeout: 10000, // 10 second timeout
    forceRefresh: false, // Use cache if available
  });

  if (result && !result.error) {
    console.log('Version check completed with caching');
    console.log(`Cached at: ${new Date(result.cachedAt).toISOString()}`);
    console.log(`Cache expires in: ${Math.round(result.cacheTtl / (1000 * 60 * 60))} hours`);
  }
}

async function genericPackageExample() {
  console.log('\n=== Generic Package Example ===');

  // Check any npm package
  const reactResult = await checkPackageVersion('react', '18.0.0');
  const nodeResult = await checkPackageVersion('@types/node', '18.0.0');

  console.log(`React update available: ${reactResult?.hasUpdate ? 'Yes' : 'No'}`);
  console.log(`@types/node update available: ${nodeResult?.hasUpdate ? 'Yes' : 'No'}`);
}

async function cacheManagementExample() {
  console.log('\n=== Cache Management Example ===');

  // Check cache statistics
  let stats = getCacheStats();
  console.log(`Cache entries: ${stats.totalEntries}`);
  console.log(`Valid entries: ${stats.validEntries}`);
  console.log(`Cached packages: ${stats.packages.join(', ')}`);

  // Clear specific package version
  clearVersionCache('@apexcli/cli', '0.5.0');

  // Clear all versions of a package
  clearVersionCache('@apexcli/cli');

  // Clear entire cache
  clearVersionCache();

  stats = getCacheStats();
  console.log(`Cache entries after clearing: ${stats.totalEntries}`);
}

async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  // Example with invalid package name
  const invalidResult = await checkPackageVersion('this-package-does-not-exist', '1.0.0');

  if (invalidResult?.error) {
    console.log(`Handled error gracefully: ${invalidResult.error}`);
  }

  // Example with very short timeout
  const timeoutResult = await checkApexCliVersion('0.6.0', {
    timeout: 1, // Very short timeout to simulate network issues
  });

  if (timeoutResult?.error) {
    console.log(`Timeout handled gracefully: ${timeoutResult.error}`);
  }
}

// Main execution function
async function runAllExamples() {
  try {
    await basicUsageExample();
    await advancedUsageExample();
    await genericPackageExample();
    await cacheManagementExample();
    await errorHandlingExample();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export for use in tests or other modules
export {
  basicUsageExample,
  advancedUsageExample,
  genericPackageExample,
  cacheManagementExample,
  errorHandlingExample,
  runAllExamples,
};

// Run if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}