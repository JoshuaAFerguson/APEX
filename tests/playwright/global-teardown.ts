/**
 * @fileoverview Global teardown for Playwright tests
 *
 * This teardown runs once after all tests and handles:
 * - Cleanup of temporary files and directories
 * - Resource cleanup
 * - Test report generation
 * - Environment restoration
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting APEX Playwright global teardown...');

  try {
    // Clean up temporary directory
    const tempDir = process.env.PLAYWRIGHT_TEMP_DIR;
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`✅ Cleaned up temporary directory: ${tempDir}`);
      } catch (error) {
        console.warn(`⚠️  Failed to clean up temporary directory: ${error}`);
      }
    }

    // Generate test completion report
    const artifactsDir = path.join(process.cwd(), 'test-results');
    const completionReport = {
      timestamp: new Date().toISOString(),
      testRun: 'completed',
      environment: process.env.NODE_ENV,
      tempDirCleaned: !!tempDir,
    };

    try {
      await fs.writeFile(
        path.join(artifactsDir, 'test-completion.json'),
        JSON.stringify(completionReport, null, 2)
      );
      console.log('✅ Generated test completion report');
    } catch (error) {
      console.warn('⚠️  Failed to generate completion report:', error);
    }

    console.log('✅ Global teardown completed successfully');

  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw error in teardown as it might mask test failures
  }
}

export default globalTeardown;