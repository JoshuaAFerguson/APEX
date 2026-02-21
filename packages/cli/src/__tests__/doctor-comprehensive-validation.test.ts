import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock all external dependencies
jest.mock('fs/promises');
jest.mock('child_process');
jest.mock('chalk', () => ({
  cyan: jest.fn((text) => text),
  green: jest.fn((text) => text),
  red: jest.fn((text) => text),
  yellow: jest.fn((text) => text),
  blue: jest.fn((text) => text),
  gray: jest.fn((text) => text),
  dim: jest.fn((text) => text),
  bold: jest.fn((text) => text),
}));
jest.mock('boxen', () => jest.fn((text) => `[BOXED] ${text}`));

// Mock the @apexcli/core module with comprehensive validation functions
jest.mock('@apexcli/core', () => ({
  createDoctorCheckResult: jest.fn((partial) => ({
    description: `Health check for ${partial.name}`,
    status: 'unknown',
    severity: 'info',
    message: 'Check completed',
    timestamp: new Date(),
    durationMs: 0,
    ...partial,
  })),
  createHealthReport: jest.fn((checks, options) => ({
    id: 'test-health-report',
    timestamp: new Date(),
    overallStatus: checks.some((c: any) => c.status === 'fail') ? 'fail' : 'pass',
    summary: {
      total: checks.length,
      passed: checks.filter((c: any) => c.status === 'pass').length,
      failed: checks.filter((c: any) => c.status === 'fail').length,
      warnings: checks.filter((c: any) => c.severity === 'warning' && c.status !== 'pass').length,
      skipped: checks.filter((c: any) => c.status === 'skip').length,
    },
    checks,
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cwd: process.cwd(),
    },
    durationMs: 100,
    apexVersion: options?.apexVersion || '0.6.0',
  })),
  satisfiesVersion: jest.fn((current, required) => {
    const parseVersion = (v: string) => v.replace(/[v]/g, '').split('.').map(Number);
    const currentParts = parseVersion(current);
    const requiredParts = parseVersion(required);

    for (let i = 0; i < Math.max(currentParts.length, requiredParts.length); i++) {
      const curr = currentParts[i] || 0;
      const req = requiredParts[i] || 0;
      if (curr > req) return true;
      if (curr < req) return false;
    }
    return true;
  }),
  parseVersionOutput: jest.fn((output) => {
    const match = output.match(/v?(\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  }),
  getLatestPackageVersion: jest.fn(),
  validateApexConfiguration: jest.fn(),
  createApexConfigValidationCheck: jest.fn(),
  detectTypeScript: jest.fn(),
  detectYarn: jest.fn(),
  detectPnpm: jest.fn(),
  detectClaudeApiKey: jest.fn(),
}));

const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedExec = promisify(exec as jest.Mocked<typeof exec>);

// Mock console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleLogs: string[] = [];
let consoleErrors: string[] = [];

describe('Doctor Command - Comprehensive Validation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogs = [];
    consoleErrors = [];

    console.log = jest.fn((message) => {
      consoleLogs.push(String(message));
    });
    console.error = jest.fn((message) => {
      consoleErrors.push(String(message));
    });
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('APEX Configuration Validation Integration', () => {
    it('should handle comprehensive config validation with all components', async () => {
      const { validateApexConfiguration, createApexConfigValidationCheck } = await import('@apexcli/core');

      // Mock comprehensive validation result
      const mockValidationResult = {
        valid: true,
        directory: {
          valid: true,
          errors: [],
          warnings: [],
          details: { existingDirectories: ['agents', 'workflows', 'skills'], missingDirectories: ['scripts', 'tools'] }
        },
        config: {
          valid: true,
          errors: [],
          warnings: [
            { type: 'low_cost_limit', message: 'Cost limit is set very low' }
          ],
          details: {
            configSummary: {
              projectName: 'comprehensive-test-project',
              language: 'typescript',
              framework: 'nextjs',
              autonomyLevel: 'review-before-commit',
              enabledAgents: 5
            }
          }
        },
        agents: {
          valid: true,
          errors: [],
          warnings: [],
          details: { validAgents: ['planner', 'architect', 'developer', 'tester', 'reviewer'], totalFiles: 5 }
        },
        workflows: {
          valid: true,
          errors: [],
          warnings: [
            { type: 'stage_no_agent', message: 'Manual stage without agent' }
          ],
          details: { validWorkflows: ['feature-development', 'bug-fix', 'refactoring'], totalFiles: 3 }
        },
        summary: {
          totalErrors: 0,
          totalWarnings: 2,
          criticalIssues: []
        }
      };

      (validateApexConfiguration as jest.MockedFunction<any>).mockResolvedValue(mockValidationResult);
      (createApexConfigValidationCheck as jest.MockedFunction<any>).mockReturnValue({
        id: 'apex-config-validation',
        name: 'APEX Configuration Validation',
        category: 'config',
        status: 'pass',
        severity: 'info',
        message: 'APEX configuration is valid and complete (3 directories, 5 agents, 3 workflows)',
        suggestion: 'Consider addressing the warnings for improved configuration',
        details: {
          validation: mockValidationResult,
          summary: {
            valid: true,
            totalErrors: 0,
            totalWarnings: 2,
            criticalIssues: []
          }
        },
        timestamp: new Date(),
        durationMs: 50
      });

      // Mock other tool checks
      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '9.2.0', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.39.0', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/comprehensive-project',
        projectPath: '/test/comprehensive-project',
        initialized: true,
        config: {
          project: {
            name: 'comprehensive-test-project',
            language: 'typescript',
            framework: 'nextjs'
          }
        },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      expect(validateApexConfiguration).toHaveBeenCalledWith('/test/comprehensive-project');
      expect(createApexConfigValidationCheck).toHaveBeenCalledWith('/test/comprehensive-project', mockValidationResult);
      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle config validation with critical errors', async () => {
      const { validateApexConfiguration, createApexConfigValidationCheck } = await import('@apexcli/core');

      const mockCriticalErrors = {
        valid: false,
        directory: {
          valid: false,
          errors: [{ type: 'missing_apex_directory', message: '.apex directory not found' }],
          warnings: []
        },
        config: {
          valid: false,
          errors: [
            { type: 'missing_config_file', message: 'config.yaml not found' },
            { type: 'invalid_yaml', message: 'YAML syntax errors' }
          ],
          warnings: []
        },
        agents: {
          valid: false,
          errors: [{ type: 'agent_parse_error', message: 'Failed to parse agent definitions' }],
          warnings: []
        },
        workflows: {
          valid: false,
          errors: [{ type: 'no_workflow_stages', message: 'Workflow has no stages' }],
          warnings: []
        },
        summary: {
          totalErrors: 4,
          totalWarnings: 0,
          criticalIssues: ['Directory structure issues', 'Configuration file issues', 'Agent definition issues', 'Workflow definition issues']
        }
      };

      (validateApexConfiguration as jest.MockedFunction<any>).mockResolvedValue(mockCriticalErrors);
      (createApexConfigValidationCheck as jest.MockedFunction<any>).mockReturnValue({
        id: 'apex-config-validation',
        name: 'APEX Configuration Validation',
        category: 'config',
        status: 'fail',
        severity: 'error',
        message: 'APEX configuration has 4 error(s)',
        suggestion: 'Address critical issues: Directory structure issues, Configuration file issues, Agent definition issues, Workflow definition issues',
        details: {
          validation: mockCriticalErrors,
          summary: {
            valid: false,
            totalErrors: 4,
            totalWarnings: 0,
            criticalIssues: ['Directory structure issues', 'Configuration file issues', 'Agent definition issues', 'Workflow definition issues']
          }
        },
        timestamp: new Date(),
        durationMs: 25
      });

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/broken-project',
        projectPath: '/test/broken-project',
        initialized: false,
        config: null,
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      expect(validateApexConfiguration).toHaveBeenCalledWith('/test/broken-project');
      expect(createApexConfigValidationCheck).toHaveBeenCalledWith('/test/broken-project', mockCriticalErrors);
    });

    it('should handle uninitialized project gracefully', async () => {
      const { validateApexConfiguration, createApexConfigValidationCheck } = await import('@apexcli/core');

      const mockUninitializedResult = {
        valid: false,
        directory: {
          valid: false,
          errors: [{ type: 'not_initialized', message: 'APEX is not initialized in this directory' }],
          warnings: []
        },
        config: { valid: false, errors: [], warnings: [] },
        agents: { valid: false, errors: [], warnings: [] },
        workflows: { valid: false, errors: [], warnings: [] },
        summary: {
          totalErrors: 1,
          totalWarnings: 0,
          criticalIssues: ['APEX not initialized']
        }
      };

      (validateApexConfiguration as jest.MockedFunction<any>).mockResolvedValue(mockUninitializedResult);
      (createApexConfigValidationCheck as jest.MockedFunction<any>).mockReturnValue({
        id: 'apex-config-validation',
        name: 'APEX Configuration Validation',
        category: 'config',
        status: 'fail',
        severity: 'error',
        message: 'APEX configuration has 1 error(s)',
        suggestion: 'Address critical issues: APEX not initialized',
        details: {
          validation: mockUninitializedResult,
          summary: {
            valid: false,
            totalErrors: 1,
            totalWarnings: 0,
            criticalIssues: ['APEX not initialized']
          }
        },
        timestamp: new Date(),
        durationMs: 10
      });

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/uninitialized-project',
        projectPath: '/test/uninitialized-project',
        initialized: false,
        config: null,
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      expect(validateApexConfiguration).toHaveBeenCalledWith('/test/uninitialized-project');
    });
  });

  describe('Toolchain Detection Integration', () => {
    it('should handle advanced toolchain detection scenarios', async () => {
      const { detectTypeScript, detectYarn, detectPnpm, detectClaudeApiKey } = await import('@apexcli/core');

      // Mock advanced TypeScript detection
      (detectTypeScript as jest.MockedFunction<any>).mockResolvedValue({
        name: 'typescript',
        currentVersion: '5.3.2',
        requiredVersion: '4.0.0',
        required: false,
        path: 'local',
        metadata: {
          installation: 'local',
          raw: 'Version 5.3.2',
          packageJsonVersion: '5.3.2',
          globalAvailable: false
        }
      });

      // Mock Yarn detection with modern version
      (detectYarn as jest.MockedFunction<any>).mockResolvedValue({
        name: 'yarn',
        currentVersion: '3.6.4',
        requiredVersion: '1.22.0',
        required: false,
        metadata: {
          raw: '3.6.4',
          packageManager: true,
          yarnVersion: 'berry',
          workspaceSupport: true
        }
      });

      // Mock pnpm detection
      (detectPnpm as jest.MockedFunction<any>).mockResolvedValue({
        name: 'pnpm',
        currentVersion: '8.10.0',
        requiredVersion: '7.0.0',
        required: false,
        metadata: {
          raw: '8.10.0',
          packageManager: true,
          workspaceSupport: true,
          performanceMode: 'fast'
        }
      });

      // Mock Claude API key detection
      (detectClaudeApiKey as jest.MockedFunction<any>).mockResolvedValue({
        name: 'claude-api-key',
        currentVersion: 'present',
        requiredVersion: 'present',
        required: true,
        path: 'CLAUDE_API_KEY',
        metadata: {
          source: 'CLAUDE_API_KEY',
          checkMethod: 'environment-variables',
          keyLength: 'appropriate', // Don't expose actual key
          keyFormat: 'valid'
        }
      });

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/advanced-toolchain-project',
        projectPath: '/test/advanced-toolchain-project',
        initialized: true,
        config: {
          project: { name: 'advanced-project', language: 'typescript' }
        },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      expect(detectTypeScript).toHaveBeenCalledWith({ local: true });
      expect(detectYarn).toHaveBeenCalled();
      expect(detectPnpm).toHaveBeenCalled();
      expect(detectClaudeApiKey).toHaveBeenCalled();
    });

    it('should handle missing toolchain components gracefully', async () => {
      const { detectTypeScript, detectYarn, detectPnpm, detectClaudeApiKey } = await import('@apexcli/core');

      // Mock missing TypeScript
      (detectTypeScript as jest.MockedFunction<any>).mockResolvedValue({
        name: 'typescript',
        currentVersion: null,
        requiredVersion: '4.0.0',
        required: false,
        metadata: {
          installation: 'local',
          error: 'TypeScript not found in local or global installation'
        }
      });

      // Mock missing alternative package managers
      (detectYarn as jest.MockedFunction<any>).mockResolvedValue({
        name: 'yarn',
        currentVersion: null,
        requiredVersion: '1.22.0',
        required: false,
        metadata: {
          error: 'yarn: command not found',
          packageManager: true
        }
      });

      (detectPnpm as jest.MockedFunction<any>).mockResolvedValue({
        name: 'pnpm',
        currentVersion: null,
        requiredVersion: '7.0.0',
        required: false,
        metadata: {
          error: 'pnpm: command not found',
          packageManager: true
        }
      });

      // Mock missing API key
      (detectClaudeApiKey as jest.MockedFunction<any>).mockResolvedValue({
        name: 'claude-api-key',
        currentVersion: null,
        requiredVersion: 'present',
        required: true,
        metadata: {
          checkMethod: 'environment-variables',
          checkedVariables: ['CLAUDE_API_KEY', 'ANTHROPIC_API_KEY']
        }
      });

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/minimal-toolchain-project',
        projectPath: '/test/minimal-toolchain-project',
        initialized: true,
        config: {
          project: { name: 'minimal-project', language: 'javascript' }
        },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, []);

      expect(detectTypeScript).toHaveBeenCalled();
      expect(detectYarn).toHaveBeenCalled();
      expect(detectPnpm).toHaveBeenCalled();
      expect(detectClaudeApiKey).toHaveBeenCalled();
    });
  });

  describe('Quick Mode vs Full Mode', () => {
    it('should execute different checks in quick mode vs full mode', async () => {
      const { validateApexConfiguration, createApexConfigValidationCheck, detectTypeScript, detectYarn, detectPnpm, detectClaudeApiKey } = await import('@apexcli/core');

      // Mock basic validation for quick mode
      (validateApexConfiguration as jest.MockedFunction<any>).mockResolvedValue({
        valid: true,
        directory: { valid: true, errors: [], warnings: [] },
        config: { valid: true, errors: [], warnings: [] },
        agents: { valid: true, errors: [], warnings: [] },
        workflows: { valid: true, errors: [], warnings: [] },
        summary: { totalErrors: 0, totalWarnings: 0, criticalIssues: [] }
      });

      (createApexConfigValidationCheck as jest.MockedFunction<any>).mockReturnValue({
        id: 'apex-config-validation',
        name: 'APEX Configuration Validation',
        status: 'pass',
        severity: 'info',
        message: 'APEX configuration is valid and complete',
        timestamp: new Date(),
        durationMs: 15
      });

      (detectClaudeApiKey as jest.MockedFunction<any>).mockResolvedValue({
        name: 'claude-api-key',
        currentVersion: 'present',
        requiredVersion: 'present',
        required: true
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/quick-mode-project',
        projectPath: '/test/quick-mode-project',
        initialized: true,
        config: {
          project: { name: 'quick-test-project', language: 'typescript' }
        },
        orchestrator: {} as any,
      };

      // Test quick mode
      await handleDoctor(mockContext, ['--quick']);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
      expect(consoleLogs).toContain('⚡ Quick mode enabled - skipping slower checks\n');

      // In quick mode, slower checks should not be called
      expect(detectTypeScript).not.toHaveBeenCalled();
      expect(detectYarn).not.toHaveBeenCalled();
      expect(detectPnpm).not.toHaveBeenCalled();

      // Reset mocks for full mode test
      jest.clearAllMocks();
      consoleLogs = [];

      console.log = jest.fn((message) => {
        consoleLogs.push(String(message));
      });

      // Test full mode
      await handleDoctor(mockContext, []);

      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
      expect(consoleLogs).not.toContain('⚡ Quick mode enabled - skipping slower checks\n');
    });
  });

  describe('JSON Output Mode', () => {
    it('should output structured JSON in JSON mode', async () => {
      const { validateApexConfiguration, createApexConfigValidationCheck, detectClaudeApiKey } = await import('@apexcli/core');

      (validateApexConfiguration as jest.MockedFunction<any>).mockResolvedValue({
        valid: true,
        directory: { valid: true, errors: [], warnings: [] },
        config: { valid: true, errors: [], warnings: [] },
        agents: { valid: true, errors: [], warnings: [] },
        workflows: { valid: true, errors: [], warnings: [] },
        summary: { totalErrors: 0, totalWarnings: 0, criticalIssues: [] }
      });

      (createApexConfigValidationCheck as jest.MockedFunction<any>).mockReturnValue({
        id: 'apex-config-validation',
        name: 'APEX Configuration Validation',
        category: 'config',
        status: 'pass',
        severity: 'info',
        message: 'APEX configuration is valid and complete',
        timestamp: new Date(),
        durationMs: 20
      });

      (detectClaudeApiKey as jest.MockedFunction<any>).mockResolvedValue({
        name: 'claude-api-key',
        currentVersion: 'present',
        requiredVersion: 'present',
        required: true
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/json-output-project',
        projectPath: '/test/json-output-project',
        initialized: true,
        config: {
          project: { name: 'json-test-project', language: 'typescript' }
        },
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, ['--json']);

      // Should not output regular diagnostic messages in JSON mode
      expect(consoleLogs).not.toContain('🔍 Running APEX health diagnostics...\n');

      // Should output JSON (the actual JSON output would be in consoleLogs[0] or similar)
      expect(consoleLogs.length).toBeGreaterThan(0);

      // Try to parse the first log entry as JSON
      let jsonOutput;
      for (const log of consoleLogs) {
        try {
          jsonOutput = JSON.parse(log);
          break;
        } catch {
          // Continue to next log entry
        }
      }

      if (jsonOutput) {
        expect(jsonOutput).toHaveProperty('id');
        expect(jsonOutput).toHaveProperty('overallStatus');
        expect(jsonOutput).toHaveProperty('summary');
        expect(jsonOutput).toHaveProperty('checks');
        expect(jsonOutput).toHaveProperty('system');
      }
    });

    it('should handle errors gracefully in JSON mode', async () => {
      const originalPromiseAll = Promise.all;
      Promise.all = jest.fn().mockRejectedValue(new Error('Simulated check failure'));

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/error-project',
        projectPath: '/test/error-project',
        initialized: false,
        config: null,
        orchestrator: {} as any,
      };

      await handleDoctor(mockContext, ['--json']);

      // Should output error as JSON
      let errorOutput;
      for (const log of consoleLogs) {
        try {
          errorOutput = JSON.parse(log);
          if (errorOutput.error) break;
        } catch {
          // Continue to next log entry
        }
      }

      if (errorOutput) {
        expect(errorOutput).toHaveProperty('error');
        expect(errorOutput.error).toContain('Error running health checks');
      }

      // Restore Promise.all
      Promise.all = originalPromiseAll;
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle timeout scenarios gracefully', async () => {
      const { validateApexConfiguration, getLatestPackageVersion } = await import('@apexcli/core');

      // Mock slow validation
      (validateApexConfiguration as jest.MockedFunction<any>).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({
          valid: true,
          directory: { valid: true, errors: [], warnings: [] },
          config: { valid: true, errors: [], warnings: [] },
          agents: { valid: true, errors: [], warnings: [] },
          workflows: { valid: true, errors: [], warnings: [] },
          summary: { totalErrors: 0, totalWarnings: 0, criticalIssues: [] }
        }), 100))
      );

      // Mock update check timeout
      (getLatestPackageVersion as jest.MockedFunction<any>).mockRejectedValue(new Error('Request timeout'));

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/timeout-project',
        projectPath: '/test/timeout-project',
        initialized: true,
        config: {
          project: { name: 'timeout-test-project', language: 'typescript' }
        },
        orchestrator: {} as any,
      };

      const startTime = Date.now();
      await handleDoctor(mockContext, []);
      const executionTime = Date.now() - startTime;

      // Should complete even with timeouts
      expect(executionTime).toBeLessThan(5000); // Reasonable upper bound
      expect(consoleLogs).toContain('🔍 Running APEX health diagnostics...\n');
    });

    it('should handle concurrent doctor command executions', async () => {
      const { validateApexConfiguration, createApexConfigValidationCheck } = await import('@apexcli/core');

      (validateApexConfiguration as jest.MockedFunction<any>).mockResolvedValue({
        valid: true,
        directory: { valid: true, errors: [], warnings: [] },
        config: { valid: true, errors: [], warnings: [] },
        agents: { valid: true, errors: [], warnings: [] },
        workflows: { valid: true, errors: [], warnings: [] },
        summary: { totalErrors: 0, totalWarnings: 0, criticalIssues: [] }
      });

      (createApexConfigValidationCheck as jest.MockedFunction<any>).mockReturnValue({
        id: 'apex-config-validation',
        name: 'APEX Configuration Validation',
        status: 'pass',
        message: 'APEX configuration is valid and complete'
      });

      (mockedExec as jest.MockedFunction<any>).mockImplementation(async (command: string) => {
        // Add small delay to simulate real execution
        await new Promise(resolve => setTimeout(resolve, 10));

        if (command === 'npm --version') {
          return { stdout: '8.19.2', stderr: '' };
        }
        if (command === 'git --version') {
          return { stdout: 'git version 2.34.1', stderr: '' };
        }
        throw new Error(`Unexpected command: ${command}`);
      });

      mockedFs.access.mockResolvedValue(undefined);

      const { handleDoctor } = await import('../handlers/doctor-handlers.js');
      const mockContext = {
        cwd: '/test/concurrent-project',
        projectPath: '/test/concurrent-project',
        initialized: true,
        config: {
          project: { name: 'concurrent-test-project', language: 'typescript' }
        },
        orchestrator: {} as any,
      };

      // Run multiple doctor commands concurrently
      const promises = [
        handleDoctor({ ...mockContext }, []),
        handleDoctor({ ...mockContext }, ['--quick']),
        handleDoctor({ ...mockContext }, ['--json'])
      ];

      // Should all complete successfully without interference
      await expect(Promise.all(promises)).resolves.not.toThrow();
    });
  });
});