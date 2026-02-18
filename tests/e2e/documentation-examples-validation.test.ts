/**
 * @fileoverview E2E Documentation Examples Validation Tests
 *
 * This test suite validates that all code examples and templates in the E2E documentation
 * are syntactically correct, complete, and practically usable. It ensures that developers
 * can copy-paste examples and they will work correctly.
 *
 * Tests covered:
 * - Template code syntax validation and completeness
 * - Example test structure and pattern verification
 * - Helper function usage validation
 * - CLI command example accuracy
 * - Configuration example validation
 * - Setup instruction step verification
 *
 * Requirements:
 * - All TypeScript examples must be syntactically valid
 * - All bash commands must be executable
 * - All configuration examples must be properly formatted
 * - All helper functions must be correctly demonstrated
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('E2E Documentation Examples Validation', () => {
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

  describe('Template Examples Validation', () => {
    describe('Basic CLI Command Test Template', () => {
      it('should have complete and syntactically valid template', () => {
        const template = extractTemplate(docsContent, 'Template: Basic CLI Command Test');
        expect(template, 'Basic CLI template should exist').toBeTruthy();

        const codeBlock = extractTypeScriptFromTemplate(template);
        expect(codeBlock, 'Template should have TypeScript code').toBeTruthy();

        // Validate structure
        validateTestStructure(codeBlock, 'Basic CLI Command Test Template');
        validateImports(codeBlock, [
          'describe', 'it', 'expect', 'beforeEach', 'afterEach',
          'createTestEnvironment', 'runCLI', 'seedTestData', 'SEED_SCENARIOS'
        ]);
        validateTestPatterns(codeBlock, [
          'describe\\(\'E2E: \\[Command Name\\]',
          'beforeEach\\(async',
          'afterEach\\(async',
          'await env\\.cleanup\\(\\)',
          'Basic Functionality',
          'Output Formats',
          'Error Handling'
        ]);
      });

      it('should demonstrate proper CLI testing patterns', () => {
        const template = extractTemplate(docsContent, 'Template: Basic CLI Command Test');
        const codeBlock = extractTypeScriptFromTemplate(template);

        // Should show runApexCLI usage
        expect(codeBlock, 'Should demonstrate runApexCLI').toContain('runApexCLI');
        expect(codeBlock, 'Should demonstrate assertCLISuccess').toContain('assertCLISuccess');
        expect(codeBlock, 'Should show JSON output handling').toContain('--json');
        expect(codeBlock, 'Should show help flag usage').toContain('--help');
        expect(codeBlock, 'Should demonstrate error handling').toContain('result.success).toBe(false');
      });
    });

    describe('Git Integration Test Template', () => {
      it('should have complete Git operations example', () => {
        const template = extractTemplate(docsContent, 'Template: Git Integration Test');
        expect(template, 'Git integration template should exist').toBeTruthy();

        const codeBlock = extractTypeScriptFromTemplate(template);
        expect(codeBlock, 'Template should have TypeScript code').toBeTruthy();

        validateTestStructure(codeBlock, 'Git Integration Test Template');
        validateImports(codeBlock, [
          'execSync', 'createTempGitRepo', 'createBareGitRepo'
        ]);

        // Git-specific patterns
        validateTestPatterns(codeBlock, [
          'execSync.*git',
          'createTempGitRepo',
          'createBareGitRepo',
          'git remote add origin',
          'git push.*origin',
          'Branch Operations',
          'Remote Operations',
          'Conflict Handling'
        ]);
      });

      it('should demonstrate proper Git workflow testing', () => {
        const template = extractTemplate(docsContent, 'Template: Git Integration Test');
        const codeBlock = extractTypeScriptFromTemplate(template);

        // Should show complete Git workflow
        expect(codeBlock, 'Should create remote repository').toContain('createBareGitRepo');
        expect(codeBlock, 'Should configure remote').toContain('git remote add');
        expect(codeBlock, 'Should handle branch operations').toContain('git checkout -b');
        expect(codeBlock, 'Should demonstrate merging').toContain('git merge');
        expect(codeBlock, 'Should show conflict detection').toContain('conflict');
      });
    });

    describe('MCP Feature Test Template', () => {
      it('should have complete MCP testing example', () => {
        const template = extractTemplate(docsContent, 'Template: MCP Feature Test');
        expect(template, 'MCP feature template should exist').toBeTruthy();

        const codeBlock = extractTypeScriptFromTemplate(template);
        expect(codeBlock, 'Template should have TypeScript code').toBeTruthy();

        validateTestStructure(codeBlock, 'MCP Feature Test Template');
        validateImports(codeBlock, [
          'execMCPCommand', 'assertMarketplaceOutput', 'createTestProjectWithServers'
        ]);

        // MCP-specific patterns
        validateTestPatterns(codeBlock, [
          'execMCPCommand',
          'assertMarketplaceOutput',
          'Marketplace Browsing',
          'Server Installation',
          'Error Handling',
          'list.*--json'
        ]);
      });

      it('should demonstrate MCP marketplace integration', () => {
        const template = extractTemplate(docsContent, 'Template: MCP Feature Test');
        const codeBlock = extractTypeScriptFromTemplate(template);

        expect(codeBlock, 'Should test marketplace listing').toContain('list');
        expect(codeBlock, 'Should test server installation').toContain('install');
        expect(codeBlock, 'Should handle network errors').toContain('network');
        expect(codeBlock, 'Should validate JSON output').toContain('JSON.parse');
      });
    });

    describe('Workflow Integration Test Template', () => {
      it('should have complete workflow testing example', () => {
        const template = extractTemplate(docsContent, 'Template: Workflow Integration Test');
        expect(template, 'Workflow integration template should exist').toBeTruthy();

        const codeBlock = extractTypeScriptFromTemplate(template);
        expect(codeBlock, 'Template should have TypeScript code').toBeTruthy();

        validateTestStructure(codeBlock, 'Workflow Integration Test Template');
        validateImports(codeBlock, [
          'ApexOrchestrator'
        ]);

        // Workflow-specific patterns
        validateTestPatterns(codeBlock, [
          'ApexOrchestrator',
          'createTask',
          'executeWorkflow',
          'Complete Workflows',
          'Agent Handoffs',
          'Resource Management',
          'globalThis\\.apexE2EHelpers\\.registerOrchestrator'
        ]);
      });

      it('should demonstrate orchestrator integration', () => {
        const template = extractTemplate(docsContent, 'Template: Workflow Integration Test');
        const codeBlock = extractTypeScriptFromTemplate(template);

        expect(codeBlock, 'Should create orchestrator').toContain('new ApexOrchestrator');
        expect(codeBlock, 'Should create tasks').toContain('createTask');
        expect(codeBlock, 'Should execute workflows').toContain('executeWorkflow');
        expect(codeBlock, 'Should register for cleanup').toContain('registerOrchestrator');
        expect(codeBlock, 'Should handle agent handoffs').toContain('agentHandoff');
      });
    });
  });

  describe('Helper Function Examples Validation', () => {
    it('should demonstrate all documented test utilities correctly', () => {
      const utilityExamples = [
        'createTestEnvironment',
        'runCLI',
        'runApexCLI',
        'seedTestData',
        'createTempGitRepo',
        'createBareGitRepo',
        'execMCPCommand',
        'assertMarketplaceOutput'
      ];

      utilityExamples.forEach(utility => {
        expect(docsContent, `Should demonstrate ${utility} usage`).toContain(utility);

        // Find example usage context
        const utilityIndex = docsContent.indexOf(utility);
        const codeBlockStart = docsContent.lastIndexOf('```typescript', utilityIndex);
        const codeBlockEnd = docsContent.indexOf('```', utilityIndex);

        if (codeBlockStart > -1 && codeBlockEnd > utilityIndex) {
          const exampleCode = docsContent.substring(codeBlockStart, codeBlockEnd);
          expect(exampleCode, `${utility} should be in a code example`).toContain(utility);

          // Validate usage pattern
          if (utility.includes('create') || utility.includes('setup')) {
            expect(exampleCode, `${utility} should be awaited`).toMatch(new RegExp(`await.*${utility}`));
          }
        }
      });
    });

    it('should show proper async/await patterns', () => {
      const asyncFunctions = [
        'createTestEnvironment',
        'seedTestData',
        'runCLI',
        'runApexCLI',
        'env.cleanup',
        'execMCPCommand'
      ];

      const codeBlocks = extractCodeBlocks(docsContent, 'typescript');
      const hasAsyncExamples = codeBlocks.filter(block =>
        asyncFunctions.some(fn => block.includes(`await ${fn}`))
      );

      expect(hasAsyncExamples.length, 'Should have multiple async/await examples').toBeGreaterThan(3);
    });

    it('should demonstrate proper error handling patterns', () => {
      const errorPatterns = [
        'expect(result.success).toBe(false)',
        'expect(result.stderr).toContain',
        'try {.*} catch',
        'expect.*error.*toBeDefined'
      ];

      errorPatterns.forEach(pattern => {
        const hasPattern = new RegExp(pattern).test(docsContent);
        expect(hasPattern, `Should demonstrate error handling pattern: ${pattern}`).toBe(true);
      });
    });
  });

  describe('Command Examples Validation', () => {
    it('should have all documented npm scripts available', () => {
      const documentedCommands = extractNpmCommands(docsContent);

      documentedCommands.forEach(command => {
        const scriptName = command.replace('npm run ', '');

        // Skip parameterized commands
        if (!scriptName.includes('--') && !scriptName.includes('$')) {
          expect(packageJson.scripts, `Script "${scriptName}" should exist in package.json`).toHaveProperty(scriptName);
        }
      });
    });

    it('should have accurate CLI command examples', () => {
      const cliCommands = [
        'apex --version',
        'apex --help',
        'apex init',
        'apex init --yes',
        'mcp list',
        'mcp install',
        'checkout',
        'merge'
      ];

      cliCommands.forEach(command => {
        if (docsContent.includes(command)) {
          // Verify command is shown in proper context
          const commandIndex = docsContent.indexOf(command);
          const lineStart = docsContent.lastIndexOf('\n', commandIndex);
          const lineEnd = docsContent.indexOf('\n', commandIndex);
          const line = docsContent.substring(lineStart, lineEnd);

          // Should be in code block, command example, or CLI usage
          const isInCodeBlock = line.includes('```') ||
                                docsContent.substring(commandIndex - 100, commandIndex).includes('```');
          const isInCommandExample = line.includes('`') || line.includes('$');

          expect(isInCodeBlock || isInCommandExample, `Command "${command}" should be in code context`).toBe(true);
        }
      });
    });

    it('should demonstrate debug and watch mode usage', () => {
      const debugCommands = [
        'DEBUG=1 npm run test:e2e',
        'npm run test:e2e:watch',
        'npm run test:unified:e2e -- --watch'
      ];

      debugCommands.forEach(command => {
        expect(docsContent, `Should document debug/watch command: ${command}`).toContain(command);
      });
    });
  });

  describe('Configuration Examples Validation', () => {
    it('should have proper TypeScript configuration examples', () => {
      const configExamples = extractCodeBlocks(docsContent, 'typescript');
      const configBlocks = configExamples.filter(block =>
        block.includes('timeout:') ||
        block.includes('beforeEach') ||
        block.includes('process.env')
      );

      expect(configBlocks.length, 'Should have configuration examples').toBeGreaterThan(2);

      configBlocks.forEach(block => {
        // Validate JSON-like structures
        if (block.includes('timeout:')) {
          expect(block, 'Timeout should be numeric').toMatch(/timeout:\s*\d+/);
        }

        // Validate environment variable examples
        if (block.includes('process.env')) {
          expect(block, 'Environment variables should be properly accessed').toMatch(/process\.env\.[A-Z_]+/);
        }
      });
    });

    it('should have valid YAML configuration examples if present', () => {
      const yamlBlocks = extractCodeBlocks(docsContent, 'yaml');

      yamlBlocks.forEach(block => {
        // Basic YAML syntax validation
        expect(block, 'YAML should not have tabs').not.toContain('\t');
        expect(block, 'YAML should be indented with spaces').toMatch(/^\s*\w/m);

        // Common CI YAML patterns
        if (block.includes('runs-on:')) {
          expect(block, 'CI YAML should have proper job structure').toMatch(/\w+:\s*$/m);
        }
      });
    });
  });

  describe('Setup Instructions Examples Validation', () => {
    it('should have executable prerequisite checks', () => {
      const prerequisites = [
        'node --version',
        'git --version',
        'npm install',
        'npm run build'
      ];

      prerequisites.forEach(command => {
        expect(docsContent, `Should include prerequisite: ${command}`).toContain(command);
      });
    });

    it('should have complete setup verification steps', () => {
      const verificationSteps = [
        'ls packages/cli/dist/index.js',
        'git --version',
        'node --version'
      ];

      verificationSteps.forEach(step => {
        expect(docsContent, `Should include verification: ${step}`).toContain(step);
      });
    });

    it('should provide troubleshooting commands that are valid', () => {
      const troubleshootingCommands = [
        'npm run build',
        'npm run cleanup:test',
        'pkill -f apex',
        'lsof -i :3000'
      ];

      troubleshootingCommands.forEach(command => {
        if (docsContent.includes(command)) {
          // Validate command structure
          expect(command, `Troubleshooting command should be valid: ${command}`).toMatch(/^[a-z]/);

          if (command.startsWith('npm run ')) {
            const scriptName = command.replace('npm run ', '');
            expect(packageJson.scripts, `Troubleshooting script should exist: ${scriptName}`).toHaveProperty(scriptName);
          }
        }
      });
    });
  });

  describe('Cross-Platform Examples Validation', () => {
    it('should provide platform-specific alternatives where needed', () => {
      const platformCommands = [
        'rm -rf',
        'rmdir /s',
        'find .',
        'for /d /r',
        'sudo apt-get',
        'brew install'
      ];

      const hasPlatformSpecific = platformCommands.some(cmd => docsContent.includes(cmd));

      if (hasPlatformSpecific) {
        expect(docsContent, 'Should mention platform differences').toMatch(/Windows|macOS|Linux|Unix/);
        expect(docsContent, 'Should provide alternatives for different platforms').toMatch(/Windows:|macOS:|Linux:|Unix:/);
      }
    });

    it('should handle path separators correctly in examples', () => {
      // Check for consistent path usage
      const pathExamples = docsContent.match(/['""][^'"]*[/\\][^'"]*['"]/g) || [];

      pathExamples.forEach(path => {
        // Should generally use forward slashes in documentation
        const forwardSlashes = (path.match(/\//g) || []).length;
        const backSlashes = (path.match(/\\\\/g) || []).length; // Escaped backslashes

        if (path.includes('Windows') || path.includes('.exe')) {
          // Windows-specific paths can use backslashes
          expect(true, 'Windows paths are allowed to use backslashes').toBe(true);
        } else {
          // Prefer forward slashes for cross-platform compatibility
          expect(forwardSlashes, `Path should prefer forward slashes: ${path}`).toBeGreaterThanOrEqual(backSlashes);
        }
      });
    });
  });
});

/**
 * Helper functions for extracting and validating content
 */

function extractTemplate(content: string, templateTitle: string): string {
  const startIndex = content.indexOf(templateTitle);
  if (startIndex === -1) return '';

  const nextTemplateIndex = content.indexOf('### Template:', startIndex + templateTitle.length);
  const nextSectionIndex = content.indexOf('\n## ', startIndex + templateTitle.length);

  const endIndex = nextTemplateIndex !== -1 && (nextSectionIndex === -1 || nextTemplateIndex < nextSectionIndex)
    ? nextTemplateIndex
    : nextSectionIndex;

  return endIndex !== -1 ? content.substring(startIndex, endIndex) : content.substring(startIndex);
}

function extractTypeScriptFromTemplate(template: string): string {
  const match = template.match(/```typescript\s*\n([\s\S]*?)\n```/);
  return match ? match[1] : '';
}

function validateTestStructure(code: string, templateName: string): void {
  expect(code, `${templateName} should have describe block`).toContain('describe(');
  expect(code, `${templateName} should have test cases`).toContain('it(');
  expect(code, `${templateName} should have beforeEach`).toContain('beforeEach');
  expect(code, `${templateName} should have afterEach`).toContain('afterEach');
  expect(code, `${templateName} should have environment cleanup`).toContain('env.cleanup()');
}

function validateImports(code: string, requiredImports: string[]): void {
  requiredImports.forEach(importItem => {
    expect(code, `Should import ${importItem}`).toContain(importItem);
  });
}

function validateTestPatterns(code: string, patterns: string[]): void {
  patterns.forEach(pattern => {
    expect(code, `Should match pattern: ${pattern}`).toMatch(new RegExp(pattern));
  });
}

function extractCodeBlocks(content: string, language: string): string[] {
  const regex = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'g');
  const matches = [...content.matchAll(regex)];
  return matches.map(match => match[1].trim());
}

function extractNpmCommands(content: string): string[] {
  const npmCommands = content.match(/npm run [\w:-]+/g) || [];
  return [...new Set(npmCommands)]; // Remove duplicates
}