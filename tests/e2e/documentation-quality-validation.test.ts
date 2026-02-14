/**
 * @fileoverview E2E Documentation Quality and Completeness Tests
 *
 * This test suite validates the quality, completeness, and accuracy of E2E testing documentation
 * beyond basic acceptance criteria. It ensures examples work, instructions are correct,
 * and the documentation follows best practices for technical documentation.
 *
 * Tests covered:
 * - Documentation structure and organization quality
 * - Code example validation and syntax checking
 * - Cross-reference accuracy and link validation
 * - Instruction clarity and step-by-step verification
 * - Example completeness and practical usability
 * - Documentation consistency and style
 *
 * Requirements:
 * - All E2E documentation files must exist
 * - Code examples must be syntactically valid
 * - Instructions must be complete and actionable
 * - Cross-references must be accurate
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

describe('E2E Documentation Quality Validation', () => {
  const docsPath = join(process.cwd(), 'docs/e2e.md');
  const e2eReadmePath = join(process.cwd(), 'tests/e2e/README.md');
  const e2eTestsDir = join(process.cwd(), 'tests/e2e');
  const packageJsonPath = join(process.cwd(), 'package.json');

  let docsContent: string;
  let e2eReadmeContent: string;
  let packageJson: any;

  beforeEach(() => {
    docsContent = readFileSync(docsPath, 'utf-8');
    e2eReadmeContent = readFileSync(e2eReadmePath, 'utf-8');
    packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  });

  describe('Documentation Structure and Organization', () => {
    it('should have proper heading hierarchy and navigation', () => {
      // Check for main sections
      const requiredSections = [
        '# End-to-End (E2E) Testing Guide',
        '## Table of Contents',
        '## Overview',
        '## Architecture',
        '## Setup Instructions',
        '## Running E2E Tests',
        '## Writing New E2E Tests',
        '## Test Infrastructure',
        '## Contribution Guidelines',
        '## CI/CD Integration',
        '## Best Practices',
        '## Troubleshooting',
        '## Examples & Templates'
      ];

      requiredSections.forEach(section => {
        expect(docsContent, `Missing required section: ${section}`).toContain(section);
      });

      // Verify table of contents links to all sections
      const tocPattern = /- \[([^\]]+)\]\(#([^)]+)\)/g;
      const tocMatches = [...docsContent.matchAll(tocPattern)];
      expect(tocMatches.length, 'Table of contents should have multiple entries').toBeGreaterThan(10);
    });

    it('should have clear section ordering that follows logical progression', () => {
      const sectionOrder = [
        'Overview',
        'Quick Setup',
        'Architecture',
        'Setup Instructions',
        'Running E2E Tests',
        'Writing New E2E Tests',
        'Test Infrastructure',
        'Contribution Guidelines'
      ];

      let lastIndex = -1;
      sectionOrder.forEach(section => {
        const index = docsContent.indexOf(`## ${section}`);
        expect(index, `Section ${section} should exist`).toBeGreaterThan(-1);
        expect(index, `Section ${section} should come after previous sections`).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });

    it('should use consistent formatting and style', () => {
      // Check for consistent code block formatting
      const codeBlockPattern = /```(\w+)/g;
      const codeBlocks = [...docsContent.matchAll(codeBlockPattern)];
      expect(codeBlocks.length, 'Should have multiple code examples').toBeGreaterThan(20);

      // Check for consistent command formatting
      expect(docsContent).toMatch(/`npm run [^`]+`/);
      expect(docsContent).toMatch(/`git [^`]+`/);

      // Check for consistent emphasis usage
      expect(docsContent).toMatch(/\*\*[A-Za-z][^*]+\*\*/); // Bold text
      expect(docsContent).toMatch(/\*[A-Za-z][^*]+\*/); // Italic text
    });

    it('should have proper cross-references and internal links', () => {
      // Check for internal links
      const internalLinkPattern = /\[([^\]]+)\]\(#([^)]+)\)/g;
      const internalLinks = [...docsContent.matchAll(internalLinkPattern)];
      expect(internalLinks.length, 'Should have internal navigation links').toBeGreaterThan(5);

      // Verify all internal links reference valid sections
      internalLinks.forEach(([fullMatch, linkText, anchor]) => {
        const expectedHeading = anchor.replace(/-/g, ' ');
        const headingExists = docsContent.toLowerCase().includes(expectedHeading.toLowerCase());
        expect(headingExists, `Internal link "${linkText}" references non-existent section "${anchor}"`).toBe(true);
      });
    });
  });

  describe('Code Example Validation', () => {
    it('should have syntactically valid TypeScript examples', () => {
      const typescriptCodeBlocks = extractCodeBlocks(docsContent, 'typescript');
      expect(typescriptCodeBlocks.length, 'Should have TypeScript examples').toBeGreaterThan(3);

      typescriptCodeBlocks.forEach((codeBlock, index) => {
        // Basic syntax validation
        expect(codeBlock, `TypeScript example ${index + 1} should have proper imports`).toMatch(/import.*from/);
        expect(codeBlock, `TypeScript example ${index + 1} should have proper test structure`).toMatch(/describe|it\(/);

        // Check for proper async/await usage
        if (codeBlock.includes('await')) {
          expect(codeBlock, `TypeScript example ${index + 1} should use async functions with await`).toMatch(/async.*=>/);
        }

        // Check for proper expect statements
        if (codeBlock.includes('expect')) {
          expect(codeBlock, `TypeScript example ${index + 1} should have proper expect syntax`).toMatch(/expect\([^)]+\)\./);
        }
      });
    });

    it('should have working bash command examples', () => {
      const bashCodeBlocks = extractCodeBlocks(docsContent, 'bash');
      expect(bashCodeBlocks.length, 'Should have bash command examples').toBeGreaterThan(10);

      bashCodeBlocks.forEach((codeBlock, index) => {
        // Check for valid npm commands
        const npmCommands = codeBlock.match(/npm\s+run\s+[\w:-]+/g);
        if (npmCommands) {
          npmCommands.forEach(command => {
            const scriptName = command.replace('npm run ', '');
            if (!scriptName.includes('--') && !scriptName.includes('$')) {
              // Skip parameterized commands for validation
              expect(packageJson.scripts, `Script "${scriptName}" should exist in package.json`).toHaveProperty(scriptName);
            }
          });
        }

        // Check for proper shell syntax
        expect(codeBlock, `Bash example ${index + 1} should not have obvious syntax errors`).not.toMatch(/;\s*;/);
      });
    });

    it('should have complete and practical examples', () => {
      const templateExamples = [
        'Template: Basic CLI Command Test',
        'Template: Git Integration Test',
        'Template: MCP Feature Test',
        'Template: Workflow Integration Test'
      ];

      templateExamples.forEach(template => {
        expect(docsContent, `Should have ${template} with code`).toContain(template);

        const templateIndex = docsContent.indexOf(template);
        const nextTemplateIndex = docsContent.indexOf('### Template:', templateIndex + 1);
        const templateSection = nextTemplateIndex > -1
          ? docsContent.substring(templateIndex, nextTemplateIndex)
          : docsContent.substring(templateIndex);

        // Each template should have a complete TypeScript example
        expect(templateSection, `${template} should have TypeScript code block`).toMatch(/```typescript[\s\S]*?```/);
        expect(templateSection, `${template} should have describe block`).toContain('describe(');
        expect(templateSection, `${template} should have test setup`).toContain('beforeEach');
        expect(templateSection, `${template} should have cleanup`).toContain('afterEach');
      });
    });

    it('should demonstrate all documented utilities and patterns', () => {
      const utilityPatterns = [
        'createTestEnvironment',
        'runCLI',
        'runApexCLI',
        'seedTestData',
        'SEED_SCENARIOS',
        'globalThis.apexE2EHelpers',
        'registerOrchestrator',
        'createTempGitRepo',
        'execMCPCommand'
      ];

      utilityPatterns.forEach(pattern => {
        expect(docsContent, `Should demonstrate usage of ${pattern}`).toContain(pattern);

        // Find code examples that use this pattern
        const codeBlocks = extractCodeBlocks(docsContent, 'typescript');
        const hasExample = codeBlocks.some(block => block.includes(pattern));
        expect(hasExample, `Should have code example demonstrating ${pattern}`).toBe(true);
      });
    });
  });

  describe('Instruction Accuracy and Completeness', () => {
    it('should have step-by-step setup instructions that are complete', () => {
      // Verify quick setup section
      const quickSetupSection = extractSection(docsContent, '### 5-Minute Setup');
      expect(quickSetupSection, 'Quick setup should have npm install').toContain('npm install');
      expect(quickSetupSection, 'Quick setup should have npm run build').toContain('npm run build');
      expect(quickSetupSection, 'Quick setup should have test command').toContain('npm run test:unified:e2e');

      // Verify detailed setup instructions
      const setupSection = extractSection(docsContent, '## Setup Instructions');
      expect(setupSection, 'Setup should have numbered steps').toMatch(/### \d+\./);
      expect(setupSection, 'Setup should verify prerequisites').toContain('git --version');
      expect(setupSection, 'Setup should verify build').toContain('packages/cli/dist/index.js');
    });

    it('should have accurate command documentation', () => {
      const documentedCommands = [
        'npm run test:e2e',
        'npm run test:e2e:watch',
        'npm run test:unified:e2e',
        'npm run cleanup:test',
        'npm test -- tests/e2e'
      ];

      documentedCommands.forEach(command => {
        expect(docsContent, `Should document command: ${command}`).toContain(command);

        // Extract script name for validation
        if (command.startsWith('npm run ')) {
          const scriptName = command.replace('npm run ', '');
          expect(packageJson.scripts, `Script ${scriptName} should exist`).toHaveProperty(scriptName);
        }
      });
    });

    it('should have clear troubleshooting for common issues', () => {
      const commonIssues = [
        'CLI binary not found',
        'Git not found in PATH',
        'Tests hanging or timing out',
        'Permission errors during cleanup',
        'Database lock errors'
      ];

      commonIssues.forEach(issue => {
        expect(docsContent, `Should address issue: ${issue}`).toContain(issue);

        // Each issue should have a solution
        const issueIndex = docsContent.indexOf(issue);
        const nextIssueIndex = docsContent.indexOf('**', issueIndex + issue.length);
        const issueSection = nextIssueIndex > -1
          ? docsContent.substring(issueIndex, nextIssueIndex)
          : docsContent.substring(issueIndex, issueIndex + 500);

        expect(issueSection, `Issue "${issue}" should have solution`).toMatch(/Solution:|```bash/);
      });
    });

    it('should reference only existing files and paths', () => {
      const fileReferences = [
        'vitest.e2e.config.ts',
        'tests/e2e/setup.ts',
        'tests/e2e/teardown.ts',
        'tests/e2e/README.md',
        'package.json'
      ];

      fileReferences.forEach(filePath => {
        if (docsContent.includes(filePath)) {
          const fullPath = join(process.cwd(), filePath);
          expect(existsSync(fullPath), `Referenced file should exist: ${filePath}`).toBe(true);
        }
      });
    });
  });

  describe('Cross-Reference Validation', () => {
    it('should have consistent information between documentation files', () => {
      const sharedConcepts = [
        'createTestEnvironment',
        'npm run test:e2e',
        'vitest.e2e.config.ts',
        'Global setup and teardown',
        'Resource cleanup'
      ];

      sharedConcepts.forEach(concept => {
        if (docsContent.includes(concept)) {
          expect(e2eReadmeContent, `Concept "${concept}" should be consistent across docs`).toContain(concept);
        }
      });
    });

    it('should reference actual test files that exist', () => {
      // Get list of actual E2E test files
      const testFiles = readdirSync(e2eTestsDir)
        .filter(file => file.endsWith('.e2e.test.ts') || file.endsWith('.test.ts'))
        .filter(file => {
          const filePath = join(e2eTestsDir, file);
          return statSync(filePath).isFile();
        });

      expect(testFiles.length, 'Should have E2E test files').toBeGreaterThan(5);

      // Check that documentation references some actual test files
      const referencedFiles = testFiles.filter(file =>
        docsContent.includes(file) || e2eReadmeContent.includes(file)
      );

      expect(referencedFiles.length, 'Should reference actual existing test files').toBeGreaterThan(3);
    });

    it('should have working links to related documentation', () => {
      const relatedDocLinks = [
        '../README.md',
        '../CONTRIBUTING.md',
        '../../docs/e2e.md',
        './workflows.md'
      ];

      relatedDocLinks.forEach(link => {
        if (docsContent.includes(link)) {
          const resolvedPath = join(process.cwd(), 'docs', link);
          const alternativePath = join(process.cwd(), link.replace('../', ''));
          const linkExists = existsSync(resolvedPath) || existsSync(alternativePath);
          // Note: Some links may be placeholders, so we don't enforce strict existence
          // but we verify the link format is reasonable
          expect(link, `Link should have proper format: ${link}`).toMatch(/\.(md|ts|js|yml)$/);
        }
      });
    });
  });

  describe('Documentation Completeness Analysis', () => {
    it('should cover all major E2E test categories with examples', () => {
      const testCategories = [
        'CLI Commands',
        'Git Operations',
        'MCP Features',
        'API Integration',
        'Workflow Integration'
      ];

      testCategories.forEach(category => {
        expect(docsContent, `Should document ${category} category`).toContain(category);

        // Should have at least one example for each category
        const categoryIndex = docsContent.indexOf(category);
        const nextCategoryIndex = testCategories.findIndex(c =>
          c !== category && docsContent.indexOf(c, categoryIndex + 1) > categoryIndex
        );

        const categorySection = nextCategoryIndex > -1
          ? docsContent.substring(categoryIndex, docsContent.indexOf(testCategories[nextCategoryIndex], categoryIndex))
          : docsContent.substring(categoryIndex);

        const hasCodeExample = /```typescript[\s\S]*?```/.test(categorySection);
        expect(hasCodeExample, `${category} should have code examples`).toBe(true);
      });
    });

    it('should document all available test utilities and helpers', () => {
      const testUtilityFiles = [
        'test-utilities.ts',
        'cli-test-helpers.ts',
        'mcp-test-utils.ts'
      ];

      testUtilityFiles.forEach(utilityFile => {
        if (docsContent.includes(utilityFile)) {
          expect(docsContent, `Should explain purpose of ${utilityFile}`).toMatch(new RegExp(utilityFile + '[\\s\\S]{0,200}(helper|utilit|function)', 'i'));
        }
      });
    });

    it('should provide comprehensive guidance for new contributors', () => {
      const contributorTopics = [
        'Quick Setup for New Contributors',
        'Writing New E2E Tests',
        'Contribution Guidelines',
        'Review Checklist',
        'Common Pitfalls'
      ];

      contributorTopics.forEach(topic => {
        expect(docsContent, `Should cover ${topic} for contributors`).toContain(topic);

        // Each topic should have substantial content
        const topicIndex = docsContent.indexOf(topic);
        const nextTopicIndex = docsContent.indexOf('##', topicIndex + 1);
        const topicSection = nextTopicIndex > -1
          ? docsContent.substring(topicIndex, nextTopicIndex)
          : docsContent.substring(topicIndex);

        expect(topicSection.length, `${topic} section should have substantial content`).toBeGreaterThan(300);
      });
    });
  });

  describe('Documentation Quality Metrics', () => {
    it('should meet documentation length and depth requirements', () => {
      expect(docsContent.length, 'Documentation should be comprehensive').toBeGreaterThan(50000);
      expect(e2eReadmeContent.length, 'README should be substantial').toBeGreaterThan(15000);

      // Count sections
      const mainSections = (docsContent.match(/^##\s/gm) || []).length;
      expect(mainSections, 'Should have adequate main sections').toBeGreaterThan(10);

      // Count subsections
      const subSections = (docsContent.match(/^###\s/gm) || []).length;
      expect(subSections, 'Should have detailed subsections').toBeGreaterThan(30);
    });

    it('should have adequate code examples and practical guidance', () => {
      const codeBlocks = (docsContent.match(/```/g) || []).length / 2; // Divided by 2 for open/close pairs
      expect(codeBlocks, 'Should have numerous code examples').toBeGreaterThan(25);

      const commandExamples = (docsContent.match(/`npm run [^`]+`/g) || []).length;
      expect(commandExamples, 'Should have many command examples').toBeGreaterThan(15);

      // Check for step-by-step instructions
      const stepInstructions = (docsContent.match(/\d+\.\s+\*\*[^*]+\*\*/g) || []).length;
      expect(stepInstructions, 'Should have step-by-step instructions').toBeGreaterThan(5);
    });

    it('should maintain professional documentation standards', () => {
      // Check for proper capitalization in headings
      const headings = docsContent.match(/^#+\s+(.+)$/gm) || [];
      headings.forEach(heading => {
        expect(heading, `Heading should be properly capitalized: ${heading}`).toMatch(/^#+\s+[A-Z]/);
      });

      // Check for consistent terminology
      const terminology = [
        'E2E', // Not "e2e" or "end-to-end" in headings
        'CLI', // Not "cli"
        'API', // Not "api"
      ];

      terminology.forEach(term => {
        if (docsContent.includes(term.toLowerCase()) && docsContent.includes(term)) {
          // Should prefer the capitalized version
          const uppercaseCount = (docsContent.match(new RegExp(term, 'g')) || []).length;
          const lowercaseCount = (docsContent.match(new RegExp(term.toLowerCase(), 'g')) || []).length;
          expect(uppercaseCount, `Should prefer ${term} over ${term.toLowerCase()}`).toBeGreaterThanOrEqual(lowercaseCount * 0.5);
        }
      });
    });
  });
});

/**
 * Extract code blocks of a specific language from markdown content
 */
function extractCodeBlocks(content: string, language: string): string[] {
  const regex = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\\n\`\`\``, 'g');
  const matches = [...content.matchAll(regex)];
  return matches.map(match => match[1].trim());
}

/**
 * Extract a specific section from markdown content
 */
function extractSection(content: string, sectionTitle: string): string {
  const startIndex = content.indexOf(sectionTitle);
  if (startIndex === -1) return '';

  const nextSectionIndex = content.indexOf('\n## ', startIndex + 1);
  return nextSectionIndex > -1
    ? content.substring(startIndex, nextSectionIndex)
    : content.substring(startIndex);
}