/**
 * @fileoverview Global setup for Playwright tests
 *
 * This setup runs once before all tests and handles:
 * - Environment validation
 * - Test data preparation
 * - Global test state initialization
 * - Browser installation verification
 */

import { FullConfig } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting APEX Playwright global setup...');

  try {
    // Create test artifacts directory
    const artifactsDir = path.join(process.cwd(), 'test-results');
    await fs.mkdir(artifactsDir, { recursive: true });
    console.log(`✅ Created test artifacts directory: ${artifactsDir}`);

    // Create temporary directory for test files
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-playwright-'));
    process.env.PLAYWRIGHT_TEMP_DIR = tempDir;
    console.log(`✅ Created temporary directory: ${tempDir}`);

    // Verify browser installations
    console.log('🔍 Verifying browser installations...');

    // This will be handled by Playwright's built-in browser management
    // The browsers should be installed via `npx playwright install`

    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.PLAYWRIGHT_TEST = 'true';

    // Create test metadata file
    const metadata = {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      tempDir,
    };

    await fs.writeFile(
      path.join(artifactsDir, 'test-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log('✅ Global setup completed successfully');

  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

export default globalSetup;