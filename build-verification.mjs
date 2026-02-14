#!/usr/bin/env node

/**
 * Build Verification Script
 *
 * This script checks the build status of all packages and identifies
 * any compilation issues that might prevent tests from running.
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const packages = [
  'packages/core',
  'packages/orchestrator',
  'packages/cli',
  'packages/api',
  'packages/browser'
];

async function checkPackage(packagePath) {
  console.log(`\n📦 Checking ${packagePath}...`);

  try {
    // Check if package.json exists
    const packageJsonPath = path.join(packagePath, 'package.json');
    await fs.access(packageJsonPath);
    console.log(`  ✅ package.json found`);

    // Read package.json to get build script
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    if (packageJson.scripts && packageJson.scripts.build) {
      console.log(`  ✅ build script available: ${packageJson.scripts.build}`);

      // Check if src directory exists
      const srcPath = path.join(packagePath, 'src');
      try {
        await fs.access(srcPath);
        console.log(`  ✅ src directory found`);
      } catch {
        console.log(`  ❌ src directory missing`);
        return { success: false, reason: 'Missing src directory' };
      }

      // Try to build the package
      try {
        console.log(`  🏗️  Building ${packagePath}...`);
        const buildResult = execSync('npm run build', {
          cwd: packagePath,
          encoding: 'utf8',
          stdio: 'pipe'
        });
        console.log(`  ✅ Build successful`);

        // Check if dist directory was created
        const distPath = path.join(packagePath, 'dist');
        try {
          await fs.access(distPath);
          console.log(`  ✅ dist directory created`);
          return { success: true };
        } catch {
          console.log(`  ⚠️  Build succeeded but no dist directory found`);
          return { success: true, warning: 'No dist directory' };
        }

      } catch (buildError) {
        console.log(`  ❌ Build failed`);
        console.log(`     Error: ${buildError.message}`);
        if (buildError.stdout) {
          console.log(`     Stdout: ${buildError.stdout.slice(0, 500)}...`);
        }
        if (buildError.stderr) {
          console.log(`     Stderr: ${buildError.stderr.slice(0, 500)}...`);
        }
        return {
          success: false,
          reason: 'Build failed',
          error: buildError.message,
          stdout: buildError.stdout,
          stderr: buildError.stderr
        };
      }

    } else {
      console.log(`  ⚠️  No build script found`);
      return { success: true, warning: 'No build script' };
    }

  } catch (error) {
    console.log(`  ❌ Package check failed: ${error.message}`);
    return {
      success: false,
      reason: 'Package check failed',
      error: error.message
    };
  }
}

async function runGlobalTypeCheck() {
  console.log('\n🏗️  Running Global TypeScript Check...');
  try {
    const result = execSync('npx tsc --noEmit', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log('✅ Global TypeScript check passed');
    return { success: true };
  } catch (error) {
    console.log('❌ Global TypeScript check failed');

    // Extract useful error information
    const errorOutput = error.stdout || error.stderr || error.message;
    const lines = errorOutput.split('\n').filter(line => line.trim());

    console.log('Top errors:');
    lines.slice(0, 10).forEach(line => {
      console.log(`  ${line}`);
    });

    if (lines.length > 10) {
      console.log(`  ... and ${lines.length - 10} more errors`);
    }

    return {
      success: false,
      error: errorOutput
    };
  }
}

async function runGlobalBuild() {
  console.log('\n🏗️  Running Global Build (turbo)...');
  try {
    const result = execSync('npm run build', {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 120000 // 2 minute timeout
    });
    console.log('✅ Global build successful');
    return { success: true, output: result };
  } catch (error) {
    console.log('❌ Global build failed');
    console.log('Error output:');
    const errorOutput = error.stdout || error.stderr || error.message;
    const lines = errorOutput.split('\n').filter(line => line.trim());

    lines.slice(0, 20).forEach(line => {
      console.log(`  ${line}`);
    });

    if (lines.length > 20) {
      console.log(`  ... and ${lines.length - 20} more lines`);
    }

    return {
      success: false,
      error: errorOutput,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

async function main() {
  console.log('🏗️  APEX Build Verification');
  console.log('===========================');

  const results = {
    timestamp: new Date().toISOString(),
    packages: {},
    globalTypeCheck: null,
    globalBuild: null
  };

  try {
    // Check each package individually
    for (const packagePath of packages) {
      try {
        await fs.access(packagePath);
        const result = await checkPackage(packagePath);
        results.packages[packagePath] = result;
      } catch {
        console.log(`\n⏭️  Skipping ${packagePath} (not found)`);
        results.packages[packagePath] = { success: false, reason: 'Package not found' };
      }
    }

    // Run global TypeScript check
    results.globalTypeCheck = await runGlobalTypeCheck();

    // Run global build if TypeScript check passed
    if (results.globalTypeCheck.success) {
      results.globalBuild = await runGlobalBuild();
    } else {
      console.log('\n⏭️  Skipping global build due to TypeScript errors');
    }

    // Summary
    console.log('\n📊 Build Verification Summary');
    console.log('==============================');

    const packageResults = Object.entries(results.packages);
    const successfulPackages = packageResults.filter(([_, result]) => result.success).length;
    const totalPackages = packageResults.length;

    console.log(`\n📦 Packages: ${successfulPackages}/${totalPackages} built successfully`);

    packageResults.forEach(([pkg, result]) => {
      console.log(`  ${result.success ? '✅' : '❌'} ${pkg} ${result.reason ? `(${result.reason})` : ''}`);
    });

    console.log(`\n🏗️  Global TypeScript: ${results.globalTypeCheck?.success ? '✅' : '❌'}`);
    console.log(`🏗️  Global Build: ${results.globalBuild ? (results.globalBuild.success ? '✅' : '❌') : '⏭️ Skipped'}`);

    // Overall assessment
    const overallSuccess =
      results.globalTypeCheck?.success &&
      results.globalBuild?.success &&
      successfulPackages === totalPackages;

    if (overallSuccess) {
      console.log('\n🎉 All builds successful! Tests should be able to run.');
    } else {
      console.log('\n⚠️  Build issues detected. This may prevent tests from running correctly.');
    }

    // Save detailed results
    await fs.writeFile('build-verification-results.json', JSON.stringify(results, null, 2));
    console.log('\n📝 Detailed results saved to: build-verification-results.json');

    return overallSuccess;

  } catch (error) {
    console.error('\n💥 Build verification failed:', error.message);
    results.error = error.message;
    await fs.writeFile('build-verification-results.json', JSON.stringify(results, null, 2));
    process.exit(1);
  }
}

main();