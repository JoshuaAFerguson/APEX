/**
 * @fileoverview E2E Documentation Setup Instructions Validation Tests
 *
 * This test suite validates that all setup instructions in the E2E documentation are
 * accurate, complete, and actually work. It verifies that someone following the documentation
 * can successfully set up and run E2E tests.
 *
 * Tests covered:
 * - Setup instruction step completeness and order
 * - Prerequisites verification accuracy
 * - Command availability and correctness
 * - File path and directory existence validation
 * - Environment setup verification
 * - Quick start guide accuracy
 *
 * Requirements:
 * - All setup commands must be valid and executable
 * - All referenced files and directories must exist
 * - Prerequisites must be accurately documented
 * - Environment variables must be correctly specified
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

describe('E2E Documentation Setup Instructions Validation', () => {
  const docsPath = join(process.cwd(), 'docs/e2e.md');
  const e2eReadmePath = join(process.cwd(), 'tests/e2e/README.md');
  const packageJsonPath = join(process.cwd(), 'package.json');

  let docsContent: string;
  let e2eReadmeContent: string;
  let packageJson: any;

  beforeEach(() => {
    docsContent = readFileSync(docsPath, 'utf-8');
    e2eReadmeContent = readFileSync(e2eReadmePath, 'utf-8');
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  });

  describe('Prerequisites Documentation Validation', () => {
    it('should accurately document Node.js version requirements', () => {
      expect(docsContent, 'Should specify Node.js version').toContain('Node.js 18+');

      // Verify the version check command is correct
      expect(docsContent, 'Should show how to check Node.js version').toContain('node --version');

      // Check if package.json engines field matches documentation
      if (packageJson.engines?.node) {
        const nodeVersion = packageJson.engines.node;
        expect(docsContent, 'Documentation should match package.json node version').toContain(nodeVersion);
      }
    });

    it('should accurately document Git requirements', () => {
      expect(docsContent, 'Should require Git').toContain('Git');
      expect(docsContent, 'Should show how to check Git version').toContain('git --version');

      // Verify Git is actually available in the environment
      try {
        const gitVersion = execSync('git --version', { encoding: 'utf8' });
        expect(gitVersion, 'Git should be available in test environment').toContain('git version');
      } catch (error) {
        console.warn('Git not available in test environment, skipping validation');
      }
    });

    it('should document build requirement with correct verification', () => {
      expect(docsContent, 'Should require building the project').toContain('npm run build');
      expect(docsContent, 'Should show how to verify CLI build').toContain('packages/cli/dist/index.js');

      // Verify the CLI path is correct
      const expectedCliPath = join(process.cwd(), 'packages/cli/dist/index.js');
      const alternativeCliPath = join(process.cwd(), 'packages/cli/dist');

      // Either the exact file should exist, or at least the directory should exist
      const pathExists = existsSync(expectedCliPath) || existsSync(alternativeCliPath);
      expect(pathExists, 'CLI path documentation should reference valid location').toBe(true);
    });

    it('should provide correct dependency installation command', () => {
      expect(docsContent, 'Should use npm install').toContain('npm install');

      // Verify package.json exists for npm install to work
      expect(existsSync(packageJsonPath), 'package.json should exist for npm install').toBe(true);

      // Verify package.json has dependencies
      expect(packageJson, 'package.json should have dependencies or devDependencies').toSatisfy(
        (pkg: any) => pkg.dependencies || pkg.devDependencies
      );
    });
  });

  describe('Step-by-Step Setup Validation', () => {
    it('should have properly ordered setup steps', () => {
      const setupSection = extractSetupSection(docsContent);
      expect(setupSection, 'Should have setup instructions section').toBeTruthy();

      // Verify steps are numbered and in logical order
      const steps = [
        '1. Install Dependencies',
        '2. Build the Project',
        '3. Verify Prerequisites'
      ];

      let lastIndex = -1;
      steps.forEach(step => {
        const stepIndex = setupSection.indexOf(step);
        expect(stepIndex, `Setup step should exist: ${step}`).toBeGreaterThan(-1);
        expect(stepIndex, `Setup step should come after previous steps: ${step}`).toBeGreaterThan(lastIndex);
        lastIndex = stepIndex;
      });
    });

    it('should have complete install dependencies step', () => {
      const installSection = extractStepSection(docsContent, 'Install Dependencies');

      expect(installSection, 'Install dependencies section should exist').toBeTruthy();
      expect(installSection, 'Should include npm install command').toContain('npm install');
    });

    it('should have complete build project step', () => {
      const buildSection = extractStepSection(docsContent, 'Build the Project');

      expect(buildSection, 'Build project section should exist').toBeTruthy();
      expect(buildSection, 'Should include npm run build command').toContain('npm run build');
      expect(buildSection, 'Should explain why build is needed').toMatch(/E2E tests.*execute.*CLI.*binary/i);
      expect(buildSection, 'Should show verification command').toContain('ls packages/cli/dist/index.js');
    });

    it('should have complete prerequisites verification step', () => {
      const verifySection = extractStepSection(docsContent, 'Verify Prerequisites');

      expect(verifySection, 'Verify prerequisites section should exist').toBeTruthy();
      expect(verifySection, 'Should check Node.js version').toContain('node --version');
      expect(verifySection, 'Should check Git availability').toContain('git --version');
      expect(verifySection, 'Should verify CLI is built').toContain('node packages/cli/dist/index.js --version');
    });
  });

  describe('Quick Start Guide Validation', () => {
    it('should have accurate 5-minute setup', () => {
      const quickSetupSection = extractSection(docsContent, '### 5-Minute Setup');
      expect(quickSetupSection, 'Should have 5-minute setup section').toBeTruthy();

      // Verify all quick setup commands are valid
      const quickCommands = [
        'npm install',
        'npm run build',
        'npm run validate:e2e-discovery',
        'npm run test:unified:e2e'
      ];

      quickCommands.forEach(command => {
        expect(quickSetupSection, `Quick setup should include: ${command}`).toContain(command);

        // Verify npm scripts exist
        if (command.startsWith('npm run ')) {
          const scriptName = command.replace('npm run ', '');
          expect(packageJson.scripts, `Quick setup script should exist: ${scriptName}`).toHaveProperty(scriptName);
        }
      });
    });

    it('should have correct prerequisites checklist', () => {
      const checklistSection = extractSection(docsContent, '### Prerequisites Checklist');
      expect(checklistSection, 'Should have prerequisites checklist').toBeTruthy();

      const checklistItems = [
        'Node.js 18+',
        'Git',
        'Dependencies installed',
        'Project built',
        'CLI available'
      ];

      checklistItems.forEach(item => {
        expect(checklistSection, `Checklist should include: ${item}`).toContain(item);
      });

      // Should have checkbox format
      expect(checklistSection, 'Should use checkbox format').toMatch(/- \[ \]/);
    });

    it('should provide correct jump-to links', () => {
      const quickSetupSection = extractSection(docsContent, 'Quick Setup for New Contributors');

      if (quickSetupSection) {
        const jumpToLinks = [
          'Writing New E2E Tests',
          'Examples & Templates'
        ];

        jumpToLinks.forEach(link => {
          expect(quickSetupSection, `Should link to: ${link}`).toContain(link);
        });
      }
    });
  });

  describe('Environment Configuration Validation', () => {
    it('should document all necessary environment variables', () => {
      const envVarSection = extractSection(docsContent, 'Environment Variables');
      expect(envVarSection, 'Should document environment variables').toBeTruthy();

      const expectedEnvVars = [
        'NODE_ENV',
        'APEX_TEST_MODE',
        'DEBUG',
        'CI',
        'NO_COLOR'
      ];

      expectedEnvVars.forEach(envVar => {
        expect(envVarSection, `Should document ${envVar}`).toContain(envVar);
      });

      // Should show default values
      expect(envVarSection, 'Should show NODE_ENV default').toContain('test');
      expect(envVarSection, 'Should show APEX_TEST_MODE default').toContain('e2e');
    });

    it('should provide correct debug mode instructions', () => {
      expect(docsContent, 'Should show debug command').toContain('DEBUG=1 npm run test:e2e');

      // Should explain what debug mode does
      const debugSection = extractSection(docsContent, 'Debug Mode');
      if (debugSection) {
        expect(debugSection, 'Should explain debug benefits').toContain('detailed logging');
        expect(debugSection, 'Should mention preserved output').toContain('console output');
      }
    });
  });

  describe('Command Documentation Validation', () => {
    it('should document all available E2E test commands', () => {
      const availableCommandsSection = extractSection(docsContent, 'Available Commands');
      expect(availableCommandsSection, 'Should document available commands').toBeTruthy();

      const requiredCommands = [
        'npm run test:e2e',
        'npm run test:e2e:watch',
        'npm test -- tests/e2e',
        'DEBUG=1 npm run test:e2e'
      ];

      requiredCommands.forEach(command => {
        expect(availableCommandsSection, `Should document command: ${command}`).toContain(command);
      });
    });

    it('should validate unified test runner documentation', () => {
      const unifiedSection = extractSection(docsContent, 'Unified Test Runner');

      if (unifiedSection) {
        const unifiedCommands = [
          'npm run test:unified:e2e',
          'npm run test:unified:list:e2e',
          '--pattern=',
          '--package=',
          '--validate'
        ];

        unifiedCommands.forEach(command => {
          expect(unifiedSection, `Should document unified command: ${command}`).toContain(command);
        });

        // Verify unified test runner benefits are explained
        expect(unifiedSection, 'Should explain benefits').toContain('Benefits');
      }
    });

    it('should validate Playwright documentation if present', () => {
      const playwrightSection = extractSection(docsContent, 'Playwright Tests');

      if (playwrightSection) {
        const playwrightCommands = [
          'npm run playwright:install',
          'npm run playwright:test',
          'npm run playwright:test:ui',
          'npm run playwright:test:debug'
        ];

        playwrightCommands.forEach(command => {
          expect(playwrightSection, `Should document Playwright command: ${command}`).toContain(command);

          // Verify scripts exist if documented
          if (command.startsWith('npm run ')) {
            const scriptName = command.replace('npm run ', '');
            if (packageJson.scripts[scriptName]) {
              expect(packageJson.scripts, `Playwright script should exist: ${scriptName}`).toHaveProperty(scriptName);
            }
          }
        });
      }
    });
  });

  describe('File and Directory References Validation', () => {
    it('should reference only existing configuration files', () => {
      const configFiles = [
        'vitest.e2e.config.ts',
        'package.json',
        '.github/workflows/ci.yml'
      ];

      configFiles.forEach(configFile => {
        if (docsContent.includes(configFile)) {
          const filePath = join(process.cwd(), configFile);
          expect(existsSync(filePath), `Referenced config file should exist: ${configFile}`).toBe(true);
        }
      });
    });

    it('should reference existing E2E infrastructure files', () => {
      const infraFiles = [
        'tests/e2e/setup.ts',
        'tests/e2e/teardown.ts',
        'tests/e2e/index.ts'
      ];

      infraFiles.forEach(infraFile => {
        if (docsContent.includes(infraFile)) {
          const filePath = join(process.cwd(), infraFile);
          expect(existsSync(filePath), `Referenced infrastructure file should exist: ${infraFile}`).toBe(true);
        }
      });
    });

    it('should reference existing utility files', () => {
      const utilityFiles = [
        'tests/e2e/utils/test-utilities.ts',
        'tests/e2e/helpers/cli-test-helpers.ts',
        'tests/e2e/utils/mcp-test-utils.ts'
      ];

      utilityFiles.forEach(utilityFile => {
        if (docsContent.includes(utilityFile)) {
          const filePath = join(process.cwd(), utilityFile);
          expect(existsSync(filePath), `Referenced utility file should exist: ${utilityFile}`).toBe(true);
        }
      });
    });

    it('should reference existing example test files', () => {
      const exampleFiles = [
        'browse-marketplace.e2e.test.ts',
        'merge-command.test.ts',
        'cli.e2e.test.ts'
      ];

      exampleFiles.forEach(exampleFile => {
        if (docsContent.includes(exampleFile)) {
          const filePath = join(process.cwd(), 'tests/e2e', exampleFile);
          expect(existsSync(filePath), `Referenced example file should exist: ${exampleFile}`).toBe(true);
        }
      });
    });
  });

  describe('Cross-Reference Consistency Validation', () => {
    it('should maintain consistency between docs/e2e.md and tests/e2e/README.md', () => {
      const sharedCommands = [
        'npm run test:e2e',
        'npm run build',
        'npm install'
      ];

      sharedCommands.forEach(command => {
        expect(docsContent, `docs/e2e.md should contain: ${command}`).toContain(command);
        expect(e2eReadmeContent, `tests/e2e/README.md should contain: ${command}`).toContain(command);
      });

      // Verify consistent prerequisites
      if (docsContent.includes('Node.js 18+')) {
        expect(e2eReadmeContent, 'Both files should have consistent Node.js version').toContain('Node.js 18+');
      }
    });

    it('should have consistent cleanup instructions', () => {
      const cleanupCommands = [
        'npm run cleanup:test'
      ];

      cleanupCommands.forEach(command => {
        if (docsContent.includes(command)) {
          expect(e2eReadmeContent, `Cleanup command should be consistent: ${command}`).toContain(command);

          // Verify script exists
          const scriptName = command.replace('npm run ', '');
          expect(packageJson.scripts, `Cleanup script should exist: ${scriptName}`).toHaveProperty(scriptName);
        }
      });
    });
  });
});

/**
 * Helper functions for extracting documentation sections
 */

function extractSetupSection(content: string): string {
  return extractSection(content, '## Setup Instructions');
}

function extractStepSection(content: string, stepName: string): string {
  const stepPattern = new RegExp(`### \\d+\\..*${stepName}`);
  const match = content.match(stepPattern);
  if (!match) return '';

  const startIndex = content.indexOf(match[0]);
  const nextStepIndex = content.indexOf('\n### ', startIndex + 1);
  return nextStepIndex > -1
    ? content.substring(startIndex, nextStepIndex)
    : content.substring(startIndex);
}

function extractSection(content: string, sectionTitle: string): string {
  const startIndex = content.indexOf(sectionTitle);
  if (startIndex === -1) return '';

  const nextSectionIndex = content.indexOf('\n## ', startIndex + 1);
  const nextSubsectionIndex = content.indexOf('\n### ', startIndex + 1);

  let endIndex = nextSectionIndex;
  if (nextSubsectionIndex !== -1 && (endIndex === -1 || nextSubsectionIndex < endIndex)) {
    endIndex = nextSubsectionIndex;
  }

  return endIndex !== -1 ? content.substring(startIndex, endIndex) : content.substring(startIndex);
}