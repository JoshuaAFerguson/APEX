import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import boxen from 'boxen';
import {
  DoctorCheckResult,
  HealthReport,
  satisfiesVersion,
  parseVersionOutput,
  createDoctorCheckResult,
  createHealthReport,
  getLatestPackageVersion,
  validateApexConfiguration,
  createApexConfigValidationCheck,
  detectTypeScript,
  detectYarn,
  detectPnpm,
  detectClaudeApiKey,
} from '@apexcli/core';
import type { CliContext } from '../index.js';

const execAsync = promisify(exec);

// ============================================================================
// Individual Health Checks
// ============================================================================

/**
 * Check Node.js version compatibility
 */
async function checkNodeVersion(): Promise<DoctorCheckResult> {
  const start = Date.now();
  const check = createDoctorCheckResult({
    id: 'node-version',
    name: 'Node.js Version',
    category: 'toolchain',
    description: 'Verify Node.js meets minimum version requirements',
  });

  try {
    const nodeVersion = process.version;
    const minVersion = '18.0.0';
    const cleanVersion = parseVersionOutput(nodeVersion);

    if (!cleanVersion) {
      return {
        ...check,
        status: 'fail',
        severity: 'error',
        message: `Could not determine Node.js version from: ${nodeVersion}`,
        suggestion: 'Ensure Node.js is properly installed',
        durationMs: Date.now() - start,
      };
    }

    const isCompatible = satisfiesVersion(cleanVersion, minVersion);

    return {
      ...check,
      status: isCompatible ? 'pass' : 'fail',
      severity: isCompatible ? 'info' : 'error',
      message: isCompatible
        ? `Node.js ${cleanVersion} meets requirement >= ${minVersion}`
        : `Node.js ${cleanVersion} does not meet requirement >= ${minVersion}`,
      suggestion: isCompatible ? undefined : `Please upgrade Node.js to version ${minVersion} or higher`,
      toolchain: {
        name: 'node',
        currentVersion: cleanVersion,
        requiredVersion: minVersion,
        path: process.execPath,
        required: true,
      },
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      severity: 'error',
      message: `Error checking Node.js version: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Ensure Node.js is properly installed',
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check npm version and availability
 */
async function checkNpmVersion(): Promise<DoctorCheckResult> {
  const start = Date.now();
  const check = createDoctorCheckResult({
    id: 'npm-version',
    name: 'npm Package Manager',
    category: 'toolchain',
    description: 'Verify npm is available and meets minimum requirements',
  });

  try {
    const { stdout } = await execAsync('npm --version');
    const npmVersion = parseVersionOutput(stdout.trim());
    const minVersion = '8.0.0';

    if (!npmVersion) {
      return {
        ...check,
        status: 'fail',
        severity: 'error',
        message: `Could not determine npm version from: ${stdout.trim()}`,
        suggestion: 'Ensure npm is properly installed',
        durationMs: Date.now() - start,
      };
    }

    const isCompatible = satisfiesVersion(npmVersion, minVersion);

    return {
      ...check,
      status: isCompatible ? 'pass' : 'fail',
      severity: isCompatible ? 'info' : 'warning',
      message: isCompatible
        ? `npm ${npmVersion} meets recommendation >= ${minVersion}`
        : `npm ${npmVersion} is below recommended version ${minVersion}`,
      suggestion: isCompatible ? undefined : `Consider upgrading npm: npm install -g npm@latest`,
      toolchain: {
        name: 'npm',
        currentVersion: npmVersion,
        requiredVersion: minVersion,
        required: true,
      },
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      ...check,
      status: 'fail',
      severity: 'error',
      message: 'npm is not available',
      suggestion: 'Install npm: npm is typically included with Node.js',
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check Git availability and version
 */
async function checkGitVersion(): Promise<DoctorCheckResult> {
  const start = Date.now();
  const check = createDoctorCheckResult({
    id: 'git-version',
    name: 'Git Version Control',
    category: 'toolchain',
    description: 'Verify Git is available for version control operations',
  });

  try {
    const { stdout } = await execAsync('git --version');
    const gitVersion = parseVersionOutput(stdout.trim());
    const minVersion = '2.0.0';

    if (!gitVersion) {
      return {
        ...check,
        status: 'skip',
        severity: 'warning',
        message: 'Git version could not be determined, but is available',
        suggestion: 'Git is available but version parsing failed - this is usually fine',
        toolchain: {
          name: 'git',
          currentVersion: 'unknown',
          requiredVersion: minVersion,
          required: false,
        },
        durationMs: Date.now() - start,
      };
    }

    const isCompatible = satisfiesVersion(gitVersion, minVersion);

    return {
      ...check,
      status: isCompatible ? 'pass' : 'fail',
      severity: isCompatible ? 'info' : 'warning',
      message: isCompatible
        ? `Git ${gitVersion} is available`
        : `Git ${gitVersion} is quite old (minimum recommended: ${minVersion})`,
      suggestion: isCompatible ? undefined : 'Consider upgrading Git for best compatibility',
      toolchain: {
        name: 'git',
        currentVersion: gitVersion,
        requiredVersion: minVersion,
        required: false,
      },
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      ...check,
      status: 'skip',
      severity: 'info',
      message: 'Git is not available (optional for APEX operation)',
      suggestion: 'Install Git if you plan to use version control features',
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check APEX configuration validity
 */
async function checkApexConfig(ctx: CliContext): Promise<DoctorCheckResult> {
  const start = Date.now();
  const check = createDoctorCheckResult({
    id: 'apex-config',
    name: 'APEX Configuration',
    category: 'config',
    description: 'Verify APEX project configuration is valid',
  });

  try {
    if (!ctx.initialized) {
      return {
        ...check,
        status: 'skip',
        severity: 'info',
        message: 'APEX not initialized in this directory',
        suggestion: 'Run `apex init` to initialize APEX in this project',
        durationMs: Date.now() - start,
      };
    }

    if (!ctx.config) {
      return {
        ...check,
        status: 'fail',
        severity: 'error',
        message: 'APEX configuration could not be loaded',
        suggestion: 'Check .apex/config.yaml for syntax errors',
        durationMs: Date.now() - start,
      };
    }

    // Basic validation - check required fields
    const issues: string[] = [];
    if (!ctx.config.project?.name) {
      issues.push('Project name is missing');
    }
    if (!ctx.config.project?.language) {
      issues.push('Project language is not specified');
    }

    if (issues.length > 0) {
      return {
        ...check,
        status: 'fail',
        severity: 'warning',
        message: `Configuration issues: ${issues.join(', ')}`,
        suggestion: 'Update .apex/config.yaml with missing required fields',
        durationMs: Date.now() - start,
      };
    }

    return {
      ...check,
      status: 'pass',
      severity: 'info',
      message: `APEX configuration valid for project "${ctx.config.project.name}"`,
      durationMs: Date.now() - start,
    };

  } catch (error) {
    return {
      ...check,
      status: 'fail',
      severity: 'error',
      message: `Error checking APEX configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Verify .apex/config.yaml exists and is valid YAML',
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Comprehensive APEX configuration validation including directory structure,
 * config.yaml schema, agent definitions, and workflow definitions
 */
async function checkApexConfigurationComprehensive(ctx: CliContext): Promise<DoctorCheckResult> {
  const start = Date.now();

  try {
    // Use the comprehensive validation from the config-validation module
    const validationResult = await validateApexConfiguration(ctx.cwd);

    // Convert the validation result to a DoctorCheckResult
    return createApexConfigValidationCheck(ctx.cwd, validationResult);

  } catch (error) {
    // Fallback to basic check if comprehensive validation fails
    const check = createDoctorCheckResult({
      id: 'apex-config-validation',
      name: 'APEX Configuration Validation',
      category: 'config',
      description: 'Comprehensive validation of APEX configuration'
    });

    return {
      ...check,
      status: 'fail',
      severity: 'error',
      message: `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      suggestion: 'Check APEX configuration files and directory structure',
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check APEX dependencies and package.json
 */
async function checkApexDependencies(ctx: CliContext): Promise<DoctorCheckResult> {
  const start = Date.now();
  const check = createDoctorCheckResult({
    id: 'apex-dependencies',
    name: 'APEX Dependencies',
    category: 'config',
    description: 'Check project dependencies and package.json setup',
  });

  try {
    const packageJsonPath = path.join(ctx.cwd, 'package.json');

    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check for APEX-related dependencies
      const apexPackages = ['@apexcli/core', '@apexcli/cli', '@apexcli/orchestrator'];
      const foundPackages = apexPackages.filter(pkg =>
        (packageJson.dependencies && packageJson.dependencies[pkg]) ||
        (packageJson.devDependencies && packageJson.devDependencies[pkg])
      );

      if (foundPackages.length > 0) {
        return {
          ...check,
          status: 'pass',
          severity: 'info',
          message: `Found APEX packages: ${foundPackages.join(', ')}`,
          durationMs: Date.now() - start,
        };
      } else {
        return {
          ...check,
          status: 'skip',
          severity: 'info',
          message: 'No APEX packages found in package.json (this is normal for standalone usage)',
          durationMs: Date.now() - start,
        };
      }

    } catch (fileError) {
      return {
        ...check,
        status: 'skip',
        severity: 'info',
        message: 'No package.json found (not required for APEX operation)',
        durationMs: Date.now() - start,
      };
    }

  } catch (error) {
    return {
      ...check,
      status: 'fail',
      severity: 'warning',
      message: `Error checking dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check write permissions in APEX directory
 */
async function checkApexPermissions(ctx: CliContext): Promise<DoctorCheckResult> {
  const start = Date.now();
  const check = createDoctorCheckResult({
    id: 'apex-permissions',
    name: 'File System Permissions',
    category: 'permissions',
    description: 'Verify write permissions for APEX operations',
  });

  try {
    const apexDir = path.join(ctx.cwd, '.apex');

    if (!ctx.initialized) {
      // Check if we can create the directory
      try {
        await fs.access(ctx.cwd, fs.constants.W_OK);
        return {
          ...check,
          status: 'pass',
          severity: 'info',
          message: 'Write permissions available for APEX initialization',
          durationMs: Date.now() - start,
        };
      } catch {
        return {
          ...check,
          status: 'fail',
          severity: 'error',
          message: 'No write permissions in current directory',
          suggestion: 'Ensure you have write permissions to create .apex directory',
          durationMs: Date.now() - start,
        };
      }
    }

    // Check if we can write to the .apex directory
    try {
      await fs.access(apexDir, fs.constants.W_OK);
      return {
        ...check,
        status: 'pass',
        severity: 'info',
        message: 'Write permissions available in .apex directory',
        durationMs: Date.now() - start,
      };
    } catch {
      return {
        ...check,
        status: 'fail',
        severity: 'error',
        message: 'No write permissions in .apex directory',
        suggestion: 'Check file permissions for .apex directory',
        durationMs: Date.now() - start,
      };
    }

  } catch (error) {
    return {
      ...check,
      status: 'fail',
      severity: 'error',
      message: `Error checking permissions: ${error instanceof Error ? error.message : 'Unknown error'}`,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Check TypeScript availability and version
 */
async function checkTypeScriptVersion(): Promise<DoctorCheckResult> {
  const start = Date.now();
  const toolchainResult = await detectTypeScript({ local: true });

  const check = createDoctorCheckResult({
    id: 'typescript-version',
    name: 'TypeScript Language',
    category: 'toolchain',
    description: 'Check TypeScript availability for type-safe development',
  });

  const isAvailable = toolchainResult.currentVersion !== null;
  const versionMeetsRequirement = isAvailable &&
    satisfiesVersion(toolchainResult.currentVersion!, toolchainResult.requiredVersion || '4.0.0');

  return {
    ...check,
    status: isAvailable ? (versionMeetsRequirement ? 'pass' : 'fail') : 'skip',
    severity: isAvailable ? (versionMeetsRequirement ? 'info' : 'warning') : 'info',
    message: isAvailable
      ? `TypeScript ${toolchainResult.currentVersion} ${versionMeetsRequirement ? 'is available' : 'version may be outdated'}`
      : 'TypeScript not found (optional for APEX operation)',
    suggestion: !isAvailable
      ? 'Install TypeScript: npm install -g typescript or npm install --save-dev typescript'
      : !versionMeetsRequirement
      ? 'Consider upgrading TypeScript for better language features'
      : undefined,
    toolchain: toolchainResult,
    durationMs: Date.now() - start,
  };
}

/**
 * Check alternative package managers (Yarn, pnpm)
 */
async function checkAlternativePackageManagers(): Promise<DoctorCheckResult> {
  const start = Date.now();
  const [yarnResult, pnpmResult] = await Promise.all([
    detectYarn(),
    detectPnpm()
  ]);

  const check = createDoctorCheckResult({
    id: 'alt-package-managers',
    name: 'Alternative Package Managers',
    category: 'toolchain',
    description: 'Check availability of Yarn and pnpm package managers',
  });

  const availableManagers = [];
  if (yarnResult.currentVersion) availableManagers.push(`Yarn ${yarnResult.currentVersion}`);
  if (pnpmResult.currentVersion) availableManagers.push(`pnpm ${pnpmResult.currentVersion}`);

  return {
    ...check,
    status: 'pass', // Always pass since these are optional
    severity: 'info',
    message: availableManagers.length > 0
      ? `Alternative package managers available: ${availableManagers.join(', ')}`
      : 'No alternative package managers found (npm is sufficient)',
    toolchain: availableManagers.length > 0 ? yarnResult : undefined,
    details: {
      yarn: yarnResult,
      pnpm: pnpmResult,
      available: availableManagers
    },
    durationMs: Date.now() - start,
  };
}

/**
 * Check Claude API key configuration
 */
async function checkClaudeApiKey(): Promise<DoctorCheckResult> {
  const start = Date.now();
  const toolchainResult = await detectClaudeApiKey();

  const check = createDoctorCheckResult({
    id: 'claude-api-key',
    name: 'Claude API Key',
    category: 'config',
    description: 'Verify Claude API key is configured for AI operations',
  });

  const isConfigured = toolchainResult.currentVersion === 'present';

  return {
    ...check,
    status: isConfigured ? 'pass' : 'fail',
    severity: isConfigured ? 'info' : 'error',
    message: isConfigured
      ? `Claude API key is configured via ${toolchainResult.path}`
      : 'Claude API key not found - required for APEX AI operations',
    suggestion: !isConfigured
      ? 'Set Claude API key: export CLAUDE_API_KEY=your-api-key or create .env file'
      : undefined,
    toolchain: toolchainResult,
    durationMs: Date.now() - start,
  };
}

// ============================================================================
// Health Report Display Functions
// ============================================================================

/**
 * Display a colorized health report to the console
 */
function displayHealthReport(report: HealthReport): void {
  console.log();

  // Header
  const statusColor = report.overallStatus === 'pass' ? 'green' :
                     report.overallStatus === 'fail' ? 'red' : 'yellow';

  const statusIcon = report.overallStatus === 'pass' ? '✅' :
                     report.overallStatus === 'fail' ? '❌' : '⚠️';

  const header = `${statusIcon} APEX Health Report - ${report.overallStatus.toUpperCase()}`;
  console.log(boxen(chalk[statusColor].bold(header), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: statusColor,
  }));

  // Summary
  console.log(chalk.cyan('\n📊 Summary:'));
  console.log(`  Total Checks: ${report.summary.total}`);
  console.log(`  ${chalk.green('✅ Passed:')} ${report.summary.passed}`);
  console.log(`  ${chalk.red('❌ Failed:')} ${report.summary.failed}`);
  console.log(`  ${chalk.yellow('⚠️  Warnings:')} ${report.summary.warnings}`);
  console.log(`  ${chalk.gray('⏭️  Skipped:')} ${report.summary.skipped}`);
  console.log(`  Duration: ${report.durationMs}ms`);

  // System Info
  console.log(chalk.cyan('\n💻 System Information:'));
  console.log(`  Platform: ${report.system.platform} (${report.system.arch})`);
  console.log(`  Node.js: ${report.system.nodeVersion}`);
  console.log(`  APEX Version: ${report.apexVersion}`);
  console.log(`  Working Directory: ${report.system.cwd}`);

  // Detailed Results
  console.log(chalk.cyan('\n🔍 Detailed Results:'));
  for (const check of report.checks) {
    const icon = check.status === 'pass' ? '✅' :
                 check.status === 'fail' ? '❌' :
                 check.status === 'skip' ? '⏭️' : '❓';

    const color = check.status === 'pass' ? 'green' :
                  check.status === 'fail' ? 'red' :
                  check.severity === 'warning' ? 'yellow' : 'gray';

    console.log(`\n  ${icon} ${chalk[color](check.name)}`);
    console.log(`     ${check.message}`);

    if (check.suggestion) {
      console.log(`     ${chalk.dim('💡 Suggestion:')} ${check.suggestion}`);
    }

    if (check.toolchain) {
      console.log(`     ${chalk.dim('🔧 Tool:')} ${check.toolchain.name} v${check.toolchain.currentVersion}`);
    }
  }

  // Footer
  if (report.summary.failed > 0) {
    console.log(chalk.red('\n⚠️  Some checks failed. Please address the issues above.'));
  } else if (report.summary.warnings > 0) {
    console.log(chalk.yellow('\n⚠️  All critical checks passed, but there are warnings to consider.'));
  } else {
    console.log(chalk.green('\n🎉 All checks passed! Your APEX environment is healthy.'));
  }

  console.log();
}

// ============================================================================
// Main Doctor Handler
// ============================================================================

/**
 * Display a health report as JSON output
 */
function displayHealthReportAsJson(report: HealthReport): void {
  // Create a clean JSON representation of the health report
  const jsonReport = {
    id: report.id,
    timestamp: report.timestamp,
    overallStatus: report.overallStatus,
    summary: report.summary,
    system: report.system,
    apexVersion: report.apexVersion,
    durationMs: report.durationMs,
    checks: report.checks.map(check => ({
      id: check.id,
      name: check.name,
      category: check.category,
      description: check.description,
      status: check.status,
      severity: check.severity,
      message: check.message,
      suggestion: check.suggestion,
      toolchain: check.toolchain,
      timestamp: check.timestamp,
      durationMs: check.durationMs,
      details: check.details,
    }))
  };

  console.log(JSON.stringify(jsonReport, null, 2));
}

/**
 * Handle the doctor command - run comprehensive health checks
 */
export async function handleDoctor(ctx: CliContext, args: string[]): Promise<void> {
  // Parse command line flags
  const isQuickMode = args.includes('--quick');
  const isJsonOutput = args.includes('--json');

  if (!isJsonOutput) {
    console.log(chalk.cyan('🔍 Running APEX health diagnostics...\n'));
    if (isQuickMode) {
      console.log(chalk.yellow('⚡ Quick mode enabled - skipping slower checks\n'));
    }
  }

  const startTime = Date.now();
  const checks: DoctorCheckResult[] = [];

  // Define check promises based on mode
  let checkPromises: Promise<DoctorCheckResult>[];

  if (isQuickMode) {
    // Quick mode: skip slower checks like npm/git version checks and dependency scanning
    checkPromises = [
      checkNodeVersion(),        // Fast - uses process.version
      checkClaudeApiKey(),       // Fast - environment variable check
      checkApexConfigurationComprehensive(ctx), // Enhanced - comprehensive config validation
      checkApexPermissions(ctx), // Fast - file system check
    ];
  } else {
    // Full mode: run all health checks
    checkPromises = [
      checkNodeVersion(),
      checkNpmVersion(),         // Slower - executes npm --version
      checkGitVersion(),         // Slower - executes git --version
      checkTypeScriptVersion(),  // Slower - executes tsc --version and reads package.json
      checkAlternativePackageManagers(), // Slower - executes yarn/pnpm --version
      checkClaudeApiKey(),       // Fast - environment variable check
      checkApexConfigurationComprehensive(ctx), // Enhanced - comprehensive config validation
      checkApexDependencies(ctx), // Slower - reads and parses package.json
      checkApexPermissions(ctx),
    ];
  }

  try {
    const results = await Promise.all(checkPromises);
    checks.push(...results);
  } catch (error) {
    if (!isJsonOutput) {
      console.error(chalk.red('Error running health checks:'), error);
    } else {
      // Output error as JSON
      console.log(JSON.stringify({ error: 'Error running health checks', details: error instanceof Error ? error.message : String(error) }, null, 2));
    }
    return;
  }

  // Generate the health report
  const report = createHealthReport(checks, { apexVersion: '0.6.0' });

  // Display report based on output format
  if (isJsonOutput) {
    displayHealthReportAsJson(report);
  } else {
    displayHealthReport(report);

    // Check for available updates (non-blocking) - only in non-JSON mode
    if (!isQuickMode) {
      try {
        const latestVersion = await getLatestPackageVersion('apex-cli', { timeout: 3000 });
        if (latestVersion && latestVersion !== '0.6.0') {
          console.log(boxen(
            `${chalk.blue('💡 Update Available')}\n\n` +
            `A newer version of APEX is available: ${chalk.green(latestVersion)}\n` +
            `Current version: ${chalk.yellow('0.6.0')}\n\n` +
            `Run ${chalk.cyan('npm install -g apex-cli')} to update`,
            {
              padding: 1,
              margin: 1,
              borderStyle: 'round',
              borderColor: 'blue',
            }
          ));
        }
      } catch (error) {
        // Silently fail update check - not critical
      }
    }
  }
}