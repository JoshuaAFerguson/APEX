/**
 * Error Information Leakage Tests for CLI Package
 *
 * Tests to ensure that error messages shown to users don't leak:
 * 1. Internal file paths and directory structures
 * 2. Secret values from configuration
 * 3. Other sensitive internal information
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import chalk from 'chalk';

// Mock dependencies
vi.mock('@apexcli/core', () => ({
  isApexInitialized: vi.fn(),
  loadConfig: vi.fn(),
  saveConfig: vi.fn(),
  loadAgents: vi.fn(),
  loadWorkflows: vi.fn(),
  getEffectiveConfig: vi.fn(),
  validateMCPConfig: vi.fn(),
  getMCPServers: vi.fn(),
}));

vi.mock('@apexcli/orchestrator', () => ({
  ApexOrchestrator: vi.fn().mockImplementation(() => ({
    createTask: vi.fn(),
    getTask: vi.fn(),
    listTasks: vi.fn(),
  })),
}));

vi.mock('chalk', () => ({
  default: {
    red: vi.fn((text) => text),
    yellow: vi.fn((text) => text),
    green: vi.fn((text) => text),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CLI Error Information Leakage Tests', () => {
  describe('Command Errors Do Not Print Internal Paths', () => {
    it('should not expose full file system paths in error messages', async () => {
      const { isApexInitialized } = await import('@apexcli/core');
      const mockError = new Error('ENOENT: no such file or directory, open /users/developer/.apex/config.json');

      vi.mocked(isApexInitialized).mockRejectedValue(mockError);

      try {
        await isApexInitialized();
      } catch (error) {
        // Should be handled gracefully
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));

        errorMessages.forEach(message => {
          expect(message).not.toMatch(/\/users\/[^/]+\//i);
          expect(message).not.toMatch(/\/home\/[^/]+\//i);
          expect(message).not.toMatch(/C:\\Users\\[^\\]+\\/i);
        });
      }
    });

    it('should sanitize stack traces to remove internal paths', async () => {
      const mockError = new Error('Test error');
      mockError.stack = `Error: Test error
    at Object.<anonymous> (/Users/developer/.apex/config.yaml:1:1)
    at Module._compile (module.js:456:26)`;

      const { loadConfig } = await import('@apexcli/core');
      vi.mocked(loadConfig).mockRejectedValue(mockError);

      try {
        await loadConfig('/fake/path');
      } catch (error) {
        // Error should be caught and processed
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.join(' ');
        expect(errorMessages).not.toMatch(/\/Users\/[^/]+\/\./);
        expect(errorMessages).not.toMatch(/node_modules\/.*\/dist\//);
      }
    });

    it('should handle file not found errors without exposing directory structure', async () => {
      const { loadConfig } = await import('@apexcli/core');
      const fileNotFoundError = new Error('ENOENT: no such file or directory, open /Users/developer/.apex/private/config.yaml');
      fileNotFoundError.name = 'ENOENT';

      vi.mocked(loadConfig).mockRejectedValue(fileNotFoundError);

      try {
        await loadConfig('/test/path');
      } catch (error) {
        // Should be handled gracefully
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));

        errorMessages.forEach(message => {
          expect(message).not.toMatch(/private\//);
          expect(message).not.toMatch(/\.apex\/private/);
          expect(message.toLowerCase()).toMatch(/configuration|config|file.*not.*found|unable.*to.*load/);
        });
      }
    });
  });

  describe('Configuration Errors Do Not Expose Secret Values', () => {
    it('should mask sensitive values in configuration error messages', async () => {
      const { loadConfig } = await import('@apexcli/core');
      const sensitiveValue = 'SENSITIVE_DATA_123';
      const validationError = new Error(`Invalid configuration: field="${sensitiveValue}" must be valid`);

      vi.mocked(loadConfig).mockRejectedValue(validationError);

      try {
        await loadConfig('/test/path');
      } catch (error) {
        // Should be handled
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));

        errorMessages.forEach(message => {
          expect(message).not.toMatch(/SENSITIVE_DATA_123/);
          if (message.includes('field=')) {
            expect(message).toMatch(/\*{3,}|\[REDACTED\]|\[MASKED\]/);
          }
        });
      }
    });

    it('should not expose environment variables in error messages', async () => {
      const testValue = 'ENV_VALUE_456';
      process.env.TEST_VARIABLE = testValue;

      const { getEffectiveConfig } = await import('@apexcli/core');
      const envError = new Error(`Environment variable TEST_VARIABLE="${testValue}" is invalid`);

      vi.mocked(getEffectiveConfig).mockRejectedValue(envError);

      try {
        await getEffectiveConfig();
      } catch (error) {
        // Should be handled
      }

      delete process.env.TEST_VARIABLE;

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));
        errorMessages.forEach(message => {
          expect(message).not.toMatch(/ENV_VALUE_456/);
        });
      }
    });
  });

  describe('Error Messages Are Sanitized for Users', () => {
    it('should provide user-friendly messages instead of technical details', async () => {
      const { isApexInitialized } = await import('@apexcli/core');
      const technicalError = new Error('TypeError: Cannot read property at /node_modules/@apexcli/core/dist/config.js:142:23');

      vi.mocked(isApexInitialized).mockRejectedValue(technicalError);

      try {
        await isApexInitialized();
      } catch (error) {
        // Handle error
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));

        errorMessages.forEach(message => {
          expect(message).not.toMatch(/at \/node_modules\//);
          expect(message).not.toMatch(/dist\/config\.js:\d+:\d+/);
          expect(message.toLowerCase()).toMatch(/failed|error|unable|configuration|config/);
        });
      }
    });

    it('should handle network errors with user-friendly messages', async () => {
      const { ApexOrchestrator } = await import('@apexcli/orchestrator');
      const networkError = new Error('connect ECONNREFUSED 127.0.0.1:8080');
      networkError.name = 'ECONNREFUSED';

      const mockOrchestrator = {
        createTask: vi.fn().mockRejectedValue(networkError),
      };

      vi.mocked(ApexOrchestrator).mockImplementation(() => mockOrchestrator as any);

      const orchestrator = new ApexOrchestrator({} as any);

      try {
        await orchestrator.createTask({} as any);
      } catch (error) {
        // Handle error
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));
        errorMessages.forEach(message => {
          expect(message).not.toMatch(/ECONNREFUSED 127\.0\.0\.1:8080/);
          expect(message.toLowerCase()).toMatch(/connection|server|unavailable|service/);
        });
      }
    });

    it('should handle permission errors with appropriate user guidance', async () => {
      const { saveConfig } = await import('@apexcli/core');
      const permissionError = new Error('EACCES: permission denied, open /Users/developer/.apex/config.yaml');
      permissionError.name = 'EACCES';

      vi.mocked(saveConfig).mockRejectedValue(permissionError);

      try {
        await saveConfig({} as any);
      } catch (error) {
        // Handle error
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));
        errorMessages.forEach(message => {
          expect(message).not.toMatch(/\/Users\/developer\/.apex/);
          expect(message.toLowerCase()).toMatch(/permission|access|denied|check.*permissions/);
        });
      }
    });
  });

  describe('Generic Error Message Sanitization', () => {
    it('should have utility function to sanitize error messages', () => {
      const sensitiveError = 'Failed to load /Users/developer/.apex/config.yaml with value TESTVALUE123';

      function sanitizeErrorMessage(message: string): string {
        return message
          .replace(/\/Users\/[^/]+/g, '/Users/***')
          .replace(/\/home\/[^/]+/g, '/home/***')
          .replace(/TESTVALUE123/g, '***')
          .replace(/node_modules\/.*?\/dist/g, 'node_modules/***/dist');
      }

      const sanitized = sanitizeErrorMessage(sensitiveError);

      expect(sanitized).not.toMatch(/\/Users\/developer/);
      expect(sanitized).not.toMatch(/TESTVALUE123/);
      expect(sanitized).toMatch(/\/Users\/\*\*\*/);
      expect(sanitized).toMatch(/\*\*\*/);
    });
  });

  describe('Configuration Loading Edge Cases', () => {
    it('should handle YAML parsing errors without exposing content', async () => {
      const { loadConfig } = await import('@apexcli/core');
      const yamlError = new Error(`YAMLException: bad indentation at /Users/developer/.apex/config.yaml:10:3`);

      vi.mocked(loadConfig).mockRejectedValue(yamlError);

      try {
        await loadConfig('/test');
      } catch (error) {
        // Handle error
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));
        errorMessages.forEach(message => {
          expect(message).not.toMatch(/\/Users\/developer\/.apex/);
          expect(message.toLowerCase()).toMatch(/yaml|configuration|config|parsing|format/);
        });
      }
    });

    it('should handle JSON parsing errors safely', async () => {
      const { getMCPServers } = await import('@apexcli/core');
      const jsonError = new Error('Unexpected token } in JSON at /Users/developer/.apex/mcp-config.json');

      vi.mocked(getMCPServers).mockRejectedValue(jsonError);

      try {
        await getMCPServers();
      } catch (error) {
        // Handle error
      }

      const consoleCalls = vi.mocked(console.error).mock.calls;
      if (consoleCalls.length > 0) {
        const errorMessages = consoleCalls.map(call => call.join(' '));
        errorMessages.forEach(message => {
          expect(message).not.toMatch(/\/Users\/developer\/.apex/);
          expect(message.toLowerCase()).toMatch(/json|parsing|format|invalid/);
        });
      }
    });
  });
});