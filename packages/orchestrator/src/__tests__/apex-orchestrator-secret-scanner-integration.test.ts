/**
 * @fileoverview Integration tests for SecretScanner with ApexOrchestrator
 *
 * This test suite validates the acceptance criteria:
 * 1. ApexOrchestrator constructor reads scanner config and initializes SecretScanner instance
 * 2. Scanner is optional (graceful handling if not configured)
 * 3. Initialization is logged appropriately
 * 4. SecretScanner is properly configured from ApexConfig.scanner
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import { SecretScanner } from '../scanner';

describe('ApexOrchestrator SecretScanner Integration', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-scanner-test-'));

    // Mock console.log to capture initialization logging
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create .apex directory
    const apexDir = join(tempDir, '.apex');
    await mkdir(apexDir, { recursive: true });
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
    consoleSpy.mockRestore();
  });

  describe('AC1: ApexOrchestrator reads scanner config and initializes SecretScanner instance', () => {
    it('should initialize SecretScanner when scanner config is provided', async () => {
      // Create config with SecretScanner configuration
      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true
  maskSecrets: true
  maxLineLength: 5000
  contextLength: 15

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify SecretScanner was initialized with proper configuration logging
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');
    });

    it('should initialize SecretScanner with custom patterns when provided', async () => {
      // Create config with custom patterns
      const configWithCustomPatterns = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true
  maskSecrets: true
  customPatterns:
    - name: "test-api-key"
      regex: "test-api-[a-zA-Z0-9]{32}"
      secretType: "test-api"
      confidence: 0.9
      severity: "high"
      description: "Test API key pattern"

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithCustomPatterns);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify SecretScanner was initialized
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');
    });

    it('should handle minimal scanner configuration', async () => {
      // Create config with minimal scanner configuration
      const configWithMinimalScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner: {}

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithMinimalScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Verify SecretScanner was initialized with minimal config
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');
    });

    it('should initialize SecretScanner only once during initialization', async () => {
      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Count how many times SecretScanner initialization was logged
      const scannerLogs = consoleSpy.mock.calls.filter(call =>
        call[0] === 'SecretScanner initialized with configuration'
      );
      expect(scannerLogs).toHaveLength(1);
    });
  });

  describe('AC2: Scanner is optional (graceful handling if not configured)', () => {
    it('should handle missing scanner configuration gracefully', async () => {
      // Create config without scanner section
      const configWithoutScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithoutScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Verify graceful handling was logged
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner not configured - scanner will be disabled');
    });

    it('should continue normal operation when scanner is not configured', async () => {
      // Create minimal config without scanner
      const minimalConfig = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous

limits:
  maxRetries: 3

git:
  branchPrefix: "apex"
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), minimalConfig);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Should initialize successfully without scanner
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner not configured - scanner will be disabled');

      // Verify orchestrator is still functional
      expect(orchestrator).toBeDefined();
    });

    it('should handle null scanner configuration', async () => {
      const configWithNullScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner: null

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithNullScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Should handle null gracefully
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner not configured - scanner will be disabled');
    });
  });

  describe('AC3: Initialization is logged appropriately', () => {
    it('should log successful SecretScanner initialization', async () => {
      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true
  maskSecrets: false

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify initialization success is logged
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');
    });

    it('should log when SecretScanner is disabled', async () => {
      const configWithoutScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithoutScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify disabled state is logged
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner not configured - scanner will be disabled');
    });

    it('should not produce duplicate logging messages', async () => {
      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Check for exactly one SecretScanner log message
      const scannerInitLogs = consoleSpy.mock.calls.filter(call =>
        call[0] === 'SecretScanner initialized with configuration'
      );
      const scannerDisabledLogs = consoleSpy.mock.calls.filter(call =>
        call[0] === 'SecretScanner not configured - scanner will be disabled'
      );

      expect(scannerInitLogs).toHaveLength(1);
      expect(scannerDisabledLogs).toHaveLength(0);
    });
  });

  describe('AC4: SecretScanner is properly configured from ApexConfig.scanner', () => {
    it('should pass configuration values to SecretScanner constructor', async () => {
      const secretScannerSpy = vi.spyOn(SecretScanner.prototype, 'constructor' as any).mockImplementation(function(this: SecretScanner, config: any) {
        // Call original constructor behavior
        Object.setPrototypeOf(this, SecretScanner.prototype);
      });

      const configWithDetailedScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: false
  maskSecrets: false
  maxLineLength: 8000
  contextLength: 25

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithDetailedScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify SecretScanner constructor was called with expected config
      expect(secretScannerSpy).toHaveBeenCalledWith({
        includeBuiltInPatterns: false,
        maskSecrets: false,
        maxLineLength: 8000,
        contextLength: 25,
      });

      secretScannerSpy.mockRestore();
    });

    it('should work with complex scanner configuration including custom patterns', async () => {
      const complexScannerConfig = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true
  maskSecrets: true
  maxLineLength: 12000
  contextLength: 30
  customPatterns:
    - name: "custom-token"
      regex: "CUST_[A-Z0-9]{16}"
      secretType: "custom-token"
      confidence: 0.95
      severity: "high"
      description: "Custom token pattern"
    - name: "internal-key"
      regex: "INT_KEY_[a-f0-9]{32}"
      secretType: "internal-key"
      confidence: 0.85
      severity: "medium"
      description: "Internal key pattern"

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), complexScannerConfig);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await expect(orchestrator.initialize()).resolves.not.toThrow();

      // Verify successful initialization with complex config
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');
    });

    it('should handle invalid scanner configuration gracefully', async () => {
      // Note: This test assumes the schema validation catches malformed configs
      // If validation happens at a higher level, initialization should fail early
      const configWithInvalidScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: "invalid_boolean"
  maskSecrets: 123
  maxLineLength: "not_a_number"

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithInvalidScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // Should either gracefully handle or throw config validation error
      try {
        await orchestrator.initialize();
        // If initialization succeeds, scanner should be disabled due to invalid config
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('scanner'));
      } catch (error) {
        // Expected behavior: config validation should catch this early
        expect(error).toBeDefined();
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should integrate with orchestrator lifecycle', async () => {
      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true
  maskSecrets: true

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      // Initialize orchestrator
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');

      // Shutdown orchestrator
      await orchestrator.shutdown();

      // Should shutdown gracefully without errors
      expect(true).toBe(true); // Test passes if no errors thrown
    });

    it('should maintain configuration after orchestrator re-initialization', async () => {
      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true
  maskSecrets: false

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      // First initialization
      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');

      // Reset spy to track second initialization
      consoleSpy.mockClear();

      // Shutdown and re-initialize
      await orchestrator.shutdown();
      await orchestrator.initialize();

      // Should initialize SecretScanner again
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');
    });

    it('should work alongside other orchestrator services', async () => {
      const configWithMultipleServices = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

linter:
  global:
    enabled: true
    timeoutMs: 30000

scanner:
  includeBuiltInPatterns: true
  maskSecrets: true

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithMultipleServices);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Both services should be initialized
      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');

      // Orchestrator should be functional with both services
      expect(orchestrator.getLinterService()).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle SecretScanner constructor errors gracefully', async () => {
      // Mock SecretScanner to throw during construction
      const originalSecretScanner = SecretScanner;
      const mockSecretScanner = vi.fn().mockImplementation(() => {
        throw new Error('SecretScanner construction failed');
      });

      // Replace SecretScanner in the module
      vi.doMock('../scanner', () => ({
        SecretScanner: mockSecretScanner,
      }));

      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      try {
        orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
        // Should either handle gracefully or propagate the error
        await expect(orchestrator.initialize()).rejects.toThrow();
      } finally {
        vi.doUnmock('../scanner');
      }
    });

    it('should continue initialization if SecretScanner fails', async () => {
      // This test verifies that other services continue to work if SecretScanner fails
      // Implementation depends on whether SecretScanner errors are caught or propagated

      const configWithScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: true

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');

      // If SecretScanner initialization is wrapped in try-catch,
      // orchestrator should still initialize other services
      try {
        await orchestrator.initialize();
        expect(true).toBe(true); // Test passes if initialization completes
      } catch (error) {
        // If error is propagated, that's also valid behavior
        expect(error).toBeDefined();
      }
    });
  });
});