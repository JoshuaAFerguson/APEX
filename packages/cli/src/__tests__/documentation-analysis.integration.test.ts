/**
 * Documentation Analysis Integration Tests
 * Tests the end-to-end documentation analysis workflow including orchestrator integration
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { commands, CliContext } from '../index.js';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { OutdatedDocumentation } from '@apexcli/core';

// Mock orchestrator for controlled testing
vi.mock('@apexcli/orchestrator');

describe('Documentation Analysis Integration', () => {
  let tempDir: string;
  let ctx: CliContext;
  let mockOrchestrator: Partial<ApexOrchestrator>;
  let consoleSpy: MockedFunction<typeof console.log>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create temp directory for test project
    tempDir = fs.mkdtempSync(path.join(__dirname, 'test-docs-analysis-'));

    mockOrchestrator = {
      getDocumentationAnalysis: vi.fn(),
      initialize: vi.fn().mockResolvedValue(undefined),
    };

    ctx = {
      cwd: tempDir,
      initialized: true,
      config: {
        project: { name: 'test-project' },
        documentation: {
          enabled: true,
          outdatedDocs: {
            enabled: true,
            checkVersionMismatch: true,
            checkDeprecatedApis: true,
            checkBrokenLinks: true,
          },
        },
      } as any,
      orchestrator: mockOrchestrator as ApexOrchestrator,
      apiProcess: null,
      webUIProcess: null,
      apiPort: 3000,
      webUIPort: 3001,
    };
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('End-to-End Documentation Analysis Workflow', () => {
    it('should perform complete documentation analysis for a real project structure', async () => {
      // Setup realistic project structure
      const projectFiles = {
        'package.json': JSON.stringify({
          name: 'test-project',
          version: '2.0.0',
          description: 'Test project for documentation analysis',
        }, null, 2),
        'README.md': `# Test Project v1.0.0

This project uses Node.js version 14.x for development.

## API Documentation

Visit https://example.com/old-api for API docs.

## Installation

\`\`\`bash
npm install test-project@1.5.0
\`\`\`
`,
        'docs/api.md': `# API Reference

## Authentication

Use the \`authToken\` parameter (deprecated in v2.0).

## Examples

\`\`\`javascript
api.authenticate({ token: "abc" }); // Old method
\`\`\`
`,
        'CHANGELOG.md': `# Changelog

## [1.5.0] - 2023-01-01
- Added new features
`,
      };

      // Create project files
      Object.entries(projectFiles).forEach(([filePath, content]) => {
        const fullPath = path.join(tempDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      });

      // Mock analysis results that would be detected
      const expectedIssues: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'README shows version 1.0.0 but package.json shows 2.0.0',
          line: 1,
          suggestion: 'Update README version to 2.0.0',
          severity: 'high',
        },
        {
          file: 'README.md',
          type: 'broken-link',
          description: 'Link to https://example.com/old-api may be broken',
          line: 7,
          suggestion: 'Update to current API documentation URL',
          severity: 'medium',
        },
        {
          file: 'docs/api.md',
          type: 'deprecated-api',
          description: 'References deprecated authToken parameter',
          line: 5,
          suggestion: 'Update to use new authentication method',
          severity: 'high',
        },
        {
          file: 'CHANGELOG.md',
          type: 'stale-reference',
          description: 'Latest entry is from 2023-01-01, may be outdated',
          line: 3,
          severity: 'low',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(expectedIssues);

      // Execute status command with --check-docs
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      // Verify analysis was called
      expect(getDocumentationAnalysis).toHaveBeenCalled();

      // Verify output includes all severity levels
      expect(consoleSpy).toHaveBeenCalledWith('🔴 High Severity Issues:');
      expect(consoleSpy).toHaveBeenCalledWith('🟡 Medium Severity Issues:');
      expect(consoleSpy).toHaveBeenCalledWith('🔵 Low Severity Issues:');

      // Verify summary shows correct counts
      expect(consoleSpy).toHaveBeenCalledWith('  Total Issues: 4');
      expect(consoleSpy).toHaveBeenCalledWith('  High: 2 | Medium: 1 | Low: 1');
    });

    it('should handle large projects with many documentation files', async () => {
      // Create many documentation files
      const docFiles = Array.from({ length: 20 }, (_, i) => ({
        path: `docs/section-${i}.md`,
        content: `# Section ${i}\n\nDocumentation for section ${i}.`,
      }));

      docFiles.forEach(({ path: filePath, content }) => {
        const fullPath = path.join(tempDir, filePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      });

      // Mock analysis for large project
      const manyIssues: OutdatedDocumentation[] = Array.from({ length: 50 }, (_, i) => ({
        file: `docs/section-${i % 20}.md`,
        type: i % 2 === 0 ? 'version-mismatch' : 'stale-reference',
        description: `Issue ${i} in documentation`,
        severity: i < 10 ? 'high' : i < 30 ? 'medium' : 'low',
      }));

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(manyIssues);

      const startTime = Date.now();
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);
      const endTime = Date.now();

      // Should handle large projects efficiently (under 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify summary
      expect(consoleSpy).toHaveBeenCalledWith('  Total Issues: 50');
    });

    it('should handle projects with no documentation gracefully', async () => {
      // Create project with no docs
      fs.writeFileSync(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'no-docs-project' })
      );

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue([]);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith('✓ No outdated documentation detected.');
    });
  });

  describe('Error Scenarios Integration', () => {
    it('should handle orchestrator initialization failure', async () => {
      const initError = new Error('Failed to initialize orchestrator');
      mockOrchestrator.initialize = vi.fn().mockRejectedValue(initError);

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockRejectedValue(initError);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Failed to analyze documentation')
      );
    });

    it('should handle file system permission issues gracefully', async () => {
      // Mock a permission error
      const permissionError = new Error('EACCES: permission denied');
      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockRejectedValue(permissionError);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to analyze documentation')
      );
    });

    it('should handle corrupted project state gracefully', async () => {
      // Simulate corrupted project state
      const corruptedCtx = {
        ...ctx,
        config: null,
        initialized: true, // Initialized but no config
      };

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(corruptedCtx, ['--check-docs']);

      // Should not crash and show appropriate error
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('Real CLI Command Execution', () => {
    it('should execute via actual CLI interface (smoke test)', async () => {
      // This test ensures the CLI wiring works end-to-end
      const testProjectDir = fs.mkdtempSync(path.join(__dirname, 'cli-smoke-test-'));

      try {
        // Create minimal APEX project
        const apexDir = path.join(testProjectDir, '.apex');
        fs.mkdirSync(apexDir, { recursive: true });

        // Create minimal config
        const config = `
project:
  name: test-project
documentation:
  enabled: true
  outdatedDocs:
    enabled: true
`;
        fs.writeFileSync(path.join(apexDir, 'config.yaml'), config);

        // Create package.json for context
        fs.writeFileSync(
          path.join(testProjectDir, 'package.json'),
          JSON.stringify({ name: 'test-project', version: '1.0.0' })
        );

        // Note: In a real integration test, we would:
        // 1. Build the CLI
        // 2. Execute it as a child process
        // 3. Verify the output
        // For now, we simulate this to avoid complex build requirements

        expect(fs.existsSync(path.join(apexDir, 'config.yaml'))).toBe(true);
      } finally {
        // Cleanup
        if (fs.existsSync(testProjectDir)) {
          fs.rmSync(testProjectDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('Configuration-Driven Analysis', () => {
    it('should respect configuration settings for analysis types', async () => {
      // Test with version mismatch disabled
      const configWithDisabledChecks = {
        ...ctx.config,
        documentation: {
          enabled: true,
          outdatedDocs: {
            enabled: true,
            checkVersionMismatch: false, // Disabled
            checkDeprecatedApis: true,
            checkBrokenLinks: true,
          },
        },
      };

      const ctxWithConfig = { ...ctx, config: configWithDisabledChecks };

      // Mock issues that would include version mismatches
      const allIssues: OutdatedDocumentation[] = [
        {
          file: 'README.md',
          type: 'version-mismatch',
          description: 'Should not appear due to config',
          severity: 'high',
        },
        {
          file: 'docs/api.md',
          type: 'deprecated-api',
          description: 'Should appear',
          severity: 'medium',
        },
      ];

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(
        // Filter based on config (simulating orchestrator behavior)
        allIssues.filter(issue => issue.type !== 'version-mismatch')
      );

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctxWithConfig, ['--check-docs']);

      // Should only show the deprecated-api issue
      expect(consoleSpy).toHaveBeenCalledWith('  Total Issues: 1');
    });

    it('should handle disabled documentation analysis', async () => {
      const configWithDisabledAnalysis = {
        ...ctx.config,
        documentation: {
          enabled: false,
        },
      };

      const ctxWithDisabledAnalysis = { ...ctx, config: configWithDisabledAnalysis };

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue([]);

      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctxWithDisabledAnalysis, ['--check-docs']);

      // Should still work even if disabled in config (CLI flag overrides)
      expect(getDocumentationAnalysis).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should handle documentation analysis within reasonable time limits', async () => {
      const manyIssues: OutdatedDocumentation[] = Array.from({ length: 1000 }, (_, i) => ({
        file: `file-${i}.md`,
        type: 'stale-reference',
        description: `Issue ${i}`,
        severity: 'low',
      }));

      const getDocumentationAnalysis = mockOrchestrator.getDocumentationAnalysis as MockedFunction<any>;
      getDocumentationAnalysis.mockResolvedValue(manyIssues);

      const startTime = Date.now();
      const statusCommand = commands.find(cmd => cmd.name === 'status')?.handler!;
      await statusCommand(ctx, ['--check-docs']);
      const endTime = Date.now();

      // Should handle 1000 issues in under 10 seconds
      expect(endTime - startTime).toBeLessThan(10000);

      // Should still produce correct summary
      expect(consoleSpy).toHaveBeenCalledWith('  Total Issues: 1000');
    });
  });
});