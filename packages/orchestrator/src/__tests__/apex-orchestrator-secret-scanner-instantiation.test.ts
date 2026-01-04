/**
 * @fileoverview Unit tests for SecretScanner instantiation in ApexOrchestrator
 *
 * This test suite focuses on:
 * 1. SecretScanner instantiation during ApexOrchestrator initialization
 * 2. Configuration validation and passing
 * 3. Optional initialization behavior
 * 4. Error handling scenarios
 */

import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFile, mkdir } from 'fs/promises';

import { ApexOrchestrator } from '../index';
import { SecretScanner } from '../scanner';

// Mock SecretScanner to track constructor calls
vi.mock('../scanner', () => ({
  SecretScanner: vi.fn().mockImplementation(function(this: any, config: any) {
    this.config = config;
    this.scan = vi.fn().mockReturnValue([]);
    this.getPatterns = vi.fn().mockReturnValue([]);
    this.addPattern = vi.fn();
    this.removePattern = vi.fn();
  }),
}));

describe('ApexOrchestrator SecretScanner Instantiation', () => {
  let tempDir: string;
  let orchestrator: ApexOrchestrator;
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  const MockedSecretScanner = SecretScanner as any;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'apex-orchestrator-scanner-instantiation-test-'));

    // Mock console.log to capture initialization logging
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Clear mock calls before each test
    MockedSecretScanner.mockClear();

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

  describe('SecretScanner Constructor Invocation', () => {
    it('should call SecretScanner constructor when scanner config exists', async () => {
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
  maxLineLength: 5000

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

      // Verify SecretScanner constructor was called
      expect(MockedSecretScanner).toHaveBeenCalledTimes(1);

      // Verify constructor was called with correct config
      expect(MockedSecretScanner).toHaveBeenCalledWith({
        includeBuiltInPatterns: true,
        maskSecrets: false,
        maxLineLength: 5000,
      });
    });

    it('should not call SecretScanner constructor when no scanner config exists', async () => {
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

      // Verify SecretScanner constructor was NOT called
      expect(MockedSecretScanner).not.toHaveBeenCalled();
    });

    it('should pass complete configuration to SecretScanner constructor', async () => {
      const configWithCompleteScanner = `
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
  maskSecrets: true
  maxLineLength: 8000
  contextLength: 25
  customPatterns:
    - name: "test-pattern"
      regex: "TEST_[A-Z0-9]{16}"
      secretType: "test-secret"
      confidence: 0.9
      severity: "high"
      description: "Test pattern"

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithCompleteScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify SecretScanner constructor was called with complete config
      expect(MockedSecretScanner).toHaveBeenCalledTimes(1);

      const constructorCall = MockedSecretScanner.mock.calls[0];
      const passedConfig = constructorCall[0];

      expect(passedConfig).toEqual({
        includeBuiltInPatterns: false,
        maskSecrets: true,
        maxLineLength: 8000,
        contextLength: 25,
        customPatterns: [
          {
            name: "test-pattern",
            regex: "TEST_[A-Z0-9]{16}",
            secretType: "test-secret",
            confidence: 0.9,
            severity: "high",
            description: "Test pattern",
          },
        ],
      });
    });

    it('should handle empty scanner configuration object', async () => {
      const configWithEmptyScanner = `
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

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithEmptyScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Should call constructor with empty config object
      expect(MockedSecretScanner).toHaveBeenCalledTimes(1);
      expect(MockedSecretScanner).toHaveBeenCalledWith({});
    });
  });

  describe('Configuration Validation and Defaults', () => {
    it('should pass configuration exactly as received from config file', async () => {
      const configWithSpecificValues = `
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
  maxLineLength: 1000
  contextLength: 5

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithSpecificValues);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Verify exact configuration is passed through
      expect(MockedSecretScanner).toHaveBeenCalledWith({
        includeBuiltInPatterns: false,
        maskSecrets: false,
        maxLineLength: 1000,
        contextLength: 5,
      });
    });

    it('should handle partial configuration correctly', async () => {
      const configWithPartialScanner = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
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

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithPartialScanner);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Should pass only the configured values
      expect(MockedSecretScanner).toHaveBeenCalledWith({
        maskSecrets: true,
      });
    });

    it('should handle custom patterns array correctly', async () => {
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
  customPatterns:
    - name: "pattern1"
      regex: "PATTERN1_[A-Z0-9]{8}"
      secretType: "type1"
      confidence: 0.8
      severity: "medium"
      description: "Pattern 1"
    - name: "pattern2"
      regex: "PATTERN2_[a-f0-9]{16}"
      secretType: "type2"
      confidence: 0.95
      severity: "high"
      description: "Pattern 2"

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

      const constructorCall = MockedSecretScanner.mock.calls[0];
      const passedConfig = constructorCall[0];

      expect(passedConfig.customPatterns).toHaveLength(2);
      expect(passedConfig.customPatterns[0].name).toBe("pattern1");
      expect(passedConfig.customPatterns[1].name).toBe("pattern2");
    });
  });

  describe('Logging Behavior', () => {
    it('should log initialization when SecretScanner is created', async () => {
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

      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner initialized with configuration');
    });

    it('should log disabled message when SecretScanner is not created', async () => {
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

      expect(consoleSpy).toHaveBeenCalledWith('SecretScanner not configured - scanner will be disabled');
    });

    it('should not log both messages in same initialization', async () => {
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

      const enabledLogs = consoleSpy.mock.calls.filter(call =>
        call[0] === 'SecretScanner initialized with configuration'
      );
      const disabledLogs = consoleSpy.mock.calls.filter(call =>
        call[0] === 'SecretScanner not configured - scanner will be disabled'
      );

      expect(enabledLogs).toHaveLength(1);
      expect(disabledLogs).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should propagate SecretScanner constructor errors', async () => {
      // Make SecretScanner constructor throw
      MockedSecretScanner.mockImplementationOnce(() => {
        throw new Error('SecretScanner construction failed');
      });

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

      await expect(orchestrator.initialize()).rejects.toThrow('SecretScanner construction failed');
    });

    it('should handle constructor being called multiple times', async () => {
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

      // Initialize multiple times
      await orchestrator.initialize();
      await orchestrator.shutdown();
      await orchestrator.initialize();

      // Should create SecretScanner instance each time
      expect(MockedSecretScanner).toHaveBeenCalledTimes(2);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle scanner config with null values', async () => {
      const configWithNullValues = `
project:
  name: test-project
  version: 1.0.0

autonomy:
  default: guided

permissions:
  preset: autonomous
  customRules: []

scanner:
  includeBuiltInPatterns: null
  customPatterns: null

limits:
  maxRetries: 3
  maxConcurrentTasks: 2
  maxTaskTime: 3600

git:
  branchPrefix: "apex"
  autoCommit: false
  autoPush: false
`;

      await writeFile(join(tempDir, '.apex', 'config.yaml'), configWithNullValues);

      orchestrator = new ApexOrchestrator(tempDir, 'localhost:8080');
      await orchestrator.initialize();

      // Should pass config as-is, let SecretScanner handle null values
      expect(MockedSecretScanner).toHaveBeenCalledWith({
        includeBuiltInPatterns: null,
        customPatterns: null,
      });
    });

    it('should handle scanner config with undefined values', async () => {
      // Note: YAML doesn't naturally express undefined, but config validation might produce it
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

      // Should only pass defined values
      expect(MockedSecretScanner).toHaveBeenCalledWith({
        includeBuiltInPatterns: true,
      });
    });
  });
});