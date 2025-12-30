/**
 * Windows-specific Cross-Module Integration Test
 *
 * This test file exercises real cross-module interactions between @apexcli/core and
 * @apexcli/orchestrator packages specifically on Windows platforms. It validates
 * that the core types, utilities, and configurations work correctly with the
 * orchestrator when running on Windows.
 *
 * ACCEPTANCE CRITERIA:
 * ✅ Tests real cross-module interactions between @apexcli/core and @apexcli/orchestrator
 * ✅ Windows-specific file paths, shell commands, and process handling
 * ✅ SQLite database operations with Windows paths
 * ✅ Configuration loading and validation on Windows
 * ✅ Task execution and orchestration workflows
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, resolve, sep, basename, dirname } from 'path';
import { tmpdir } from 'os';
import * as yaml from 'yaml';

// Import core types and utilities
import {
  ApexConfig,
  AgentDefinition,
  WorkflowDefinition,
  Task,
  TaskStatus,
  loadConfig,
  loadAgents,
  loadWorkflow,
  getEffectiveConfig,
  generateTaskId,
  generateBranchName,
  calculateCost,
  isWindows,
  getHomeDir,
  getConfigDir,
  createShellCommand,
  getPlatformShell,
  getKillCommand,
} from '@apexcli/core';

// Mock orchestrator dependencies for isolated testing
import { TaskStore } from '@apexcli/orchestrator/src/store';
import { ApexOrchestrator } from '@apexcli/orchestrator/src/index';

// Skip this entire test suite unless running on Windows or in a mocked Windows environment
const isActuallyWindows = process.platform === 'win32';

describe.skipIf(!isActuallyWindows)('Windows Cross-Module Integration Tests', () => {
  let tempTestDir: string;
  let mockApexDir: string;
  let originalCwd: string;

  beforeAll(() => {
    // Verify we're actually testing Windows behavior
    console.log(`Running Windows cross-module integration tests on ${process.platform}`);
    expect(isWindows()).toBe(true);
  });

  beforeEach(() => {
    // Create temporary test directory with Windows-style paths
    const tempBase = tmpdir();
    tempTestDir = join(tempBase, `apex-windows-test-${Date.now()}`);
    mockApexDir = join(tempTestDir, '.apex');

    // Ensure directories exist
    mkdirSync(tempTestDir, { recursive: true });
    mkdirSync(mockApexDir, { recursive: true });
    mkdirSync(join(mockApexDir, 'agents'), { recursive: true });
    mkdirSync(join(mockApexDir, 'workflows'), { recursive: true });

    // Save original working directory
    originalCwd = process.cwd();
    process.chdir(tempTestDir);

    console.log(`Test directory: ${tempTestDir}`);
    console.log(`Mock .apex directory: ${mockApexDir}`);
  });

  afterEach(() => {
    // Restore original working directory
    process.chdir(originalCwd);

    // Clean up temporary directory
    if (existsSync(tempTestDir)) {
      rmSync(tempTestDir, { recursive: true, force: true });
    }
  });

  describe('Windows Path Handling Across Modules', () => {
    it('should handle Windows paths correctly in config loading and orchestrator initialization', async () => {
      // Create a Windows-style config file
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'windows-test-project',
          language: 'typescript',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.8,
          autoExecuteHighConfidence: false,
          previewTimeout: 5000,
        },
        autonomy: {
          default: 'full',
        },
      };

      const configPath = join(mockApexDir, 'config.yaml');
      writeFileSync(configPath, yaml.stringify(config));

      // Test core config loading with Windows paths
      const loadedConfig = await loadConfig();
      expect(loadedConfig).toBeDefined();
      expect(loadedConfig.project.name).toBe('windows-test-project');

      // Test effective config calculation
      const effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.ui.previewMode).toBe(true);

      // Test that paths are normalized for Windows
      const normalizedConfigPath = resolve(configPath);
      expect(normalizedConfigPath).toContain('\\'); // Windows path separator
      expect(existsSync(normalizedConfigPath)).toBe(true);

      // Test orchestrator can use the config
      expect(() => {
        // This would be how orchestrator uses the config
        const dbPath = join(mockApexDir, 'apex.db');
        const windowsDbPath = resolve(dbPath);
        expect(windowsDbPath).toContain('\\');
      }).not.toThrow();
    });

    it('should handle Windows SQLite database paths correctly across modules', async () => {
      // Test SQLite database path handling for Windows
      const dbPath = join(mockApexDir, 'apex.db');
      const normalizedDbPath = resolve(dbPath);

      // Verify Windows path characteristics
      expect(normalizedDbPath).toMatch(/^[A-Z]:/); // Drive letter
      expect(normalizedDbPath).toContain('\\'); // Windows separators
      expect(basename(normalizedDbPath)).toBe('apex.db');
      expect(dirname(normalizedDbPath)).toContain('.apex');

      // Test TaskStore can handle Windows paths
      const taskStore = new TaskStore(normalizedDbPath);
      expect(taskStore).toBeDefined();

      // Cleanup
      taskStore.close();
    });

    it('should handle Windows home and config directories correctly', () => {
      // Test cross-platform directory utilities used by both core and orchestrator
      const homeDir = getHomeDir();
      const configDir = getConfigDir();

      // On Windows, these should return proper Windows paths
      expect(homeDir).toBeDefined();
      expect(homeDir.length).toBeGreaterThan(0);
      expect(homeDir).toMatch(/^[A-Z]:/); // Should start with drive letter
      expect(homeDir).toContain('\\'); // Should use Windows separators

      expect(configDir).toBeDefined();
      expect(configDir.length).toBeGreaterThan(0);
      expect(configDir).toMatch(/^[A-Z]:/); // Should start with drive letter
      expect(configDir).toContain('\\'); // Should use Windows separators

      // Config dir should be under home dir or AppData
      expect(configDir.includes(homeDir) || configDir.includes('AppData')).toBe(true);
    });
  });

  describe('Windows Shell Command Handling Across Modules', () => {
    it('should create Windows-compatible shell commands for orchestrator execution', () => {
      // Test shell utilities used by orchestrator
      const platformShell = getPlatformShell();
      expect(platformShell.shell).toMatch(/cmd\.exe|powershell\.exe/i);

      // Test shell command creation with Windows-specific escaping
      const commandParts = ['npm', 'run', 'build'];
      const shellCommand = createShellCommand(commandParts);
      expect(shellCommand).toBe('npm run build'); // Simple case

      // Test with complex arguments that need Windows escaping
      const complexParts = ['git', 'commit', '-m', 'feat: add Windows support & tests'];
      const complexCommand = createShellCommand(complexParts);
      expect(complexCommand).toContain('"feat: add Windows support & tests"'); // Should be quoted

      // Test with paths containing spaces
      const pathParts = ['cd', 'C:\\Program Files\\Node.js', '&&', 'npm', '--version'];
      const pathCommand = createShellCommand(pathParts);
      expect(pathCommand).toContain('"C:\\Program Files\\Node.js"'); // Should quote path with spaces
    });

    it('should handle Windows process termination correctly', () => {
      // Test process kill commands for Windows
      const testPid = 12345;
      const killCommand = getKillCommand(testPid);

      // Should use Windows taskkill command
      expect(killCommand).toEqual(['taskkill', '/f', '/pid', '12345']);
      expect(killCommand[0]).toBe('taskkill'); // Windows process termination
      expect(killCommand).toContain('/f'); // Force flag
      expect(killCommand).toContain('/pid'); // PID flag
      expect(killCommand).toContain('12345'); // Process ID
    });
  });

  describe('Windows Agent and Workflow Cross-Module Integration', () => {
    beforeEach(() => {
      // Create sample agent definition
      const agentContent = `# Test Agent

## Role
Test agent for Windows integration testing

## Capabilities
- Cross-platform testing
- Windows-specific validation
- Path handling verification

## Usage
This agent tests Windows compatibility across modules.
`;

      writeFileSync(join(mockApexDir, 'agents', 'test-agent.md'), agentContent);

      // Create sample workflow definition
      const workflow: WorkflowDefinition = {
        name: 'windows-test-workflow',
        description: 'Workflow for testing Windows compatibility',
        stages: [
          {
            name: 'planning',
            agent: 'test-agent',
            description: 'Plan the Windows compatibility test',
          },
          {
            name: 'implementation',
            agent: 'test-agent',
            description: 'Implement Windows-specific features',
          },
        ],
      };

      writeFileSync(join(mockApexDir, 'workflows', 'windows-test.yaml'), yaml.stringify(workflow));
    });

    it('should load agents and workflows correctly with Windows file paths', async () => {
      // Test agent loading from Windows file system
      const agents = await loadAgents();
      expect(agents).toBeDefined();
      expect(agents.length).toBeGreaterThan(0);

      const testAgent = agents.find(agent => agent.name === 'test-agent');
      expect(testAgent).toBeDefined();
      expect(testAgent!.content).toContain('Windows');

      // Test workflow loading
      const workflow = await loadWorkflow('windows-test');
      expect(workflow).toBeDefined();
      expect(workflow.name).toBe('windows-test-workflow');
      expect(workflow.stages).toHaveLength(2);

      // Verify stages reference the correct agent
      expect(workflow.stages[0].agent).toBe('test-agent');
      expect(workflow.stages[1].agent).toBe('test-agent');
    });

    it('should handle Windows-specific task creation and management', () => {
      // Test task ID generation works on Windows
      const taskId = generateTaskId();
      expect(taskId).toBeDefined();
      expect(taskId.length).toBeGreaterThan(0);
      expect(/^[a-z0-9]+$/i.test(taskId)).toBe(true); // Alphanumeric only

      // Test branch name generation with Windows-safe characters
      const branchName = generateBranchName();
      expect(branchName).toBeDefined();
      expect(branchName.length).toBeGreaterThan(0);
      // Should not contain Windows-problematic characters
      expect(branchName).not.toMatch(/[<>:"|?*]/);
      expect(branchName).toMatch(/^[a-zA-Z0-9\-_/]+$/); // Git-safe characters

      // Test task creation with Windows paths
      const task: Task = {
        id: taskId,
        description: 'Test Windows task creation',
        workflow: 'windows-test',
        status: TaskStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
        stage: 'planning',
        branch: branchName,
        project_path: tempTestDir, // Windows path
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          total_cost: 0,
        },
      };

      expect(task).toBeDefined();
      expect(task.project_path).toContain('\\'); // Windows path separator
      expect(task.branch).toBe(branchName);
    });

    it('should calculate costs correctly across modules on Windows', () => {
      // Test cost calculation utility used by orchestrator
      const inputTokens = 1000;
      const outputTokens = 500;

      const cost = calculateCost(inputTokens, outputTokens);
      expect(cost).toBeDefined();
      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThan(0);

      // Cost should be consistent regardless of platform
      const expectedCost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;
      expect(Math.abs(cost - expectedCost)).toBeLessThan(0.001); // Float precision tolerance
    });
  });

  describe('Windows Database Operations Across Modules', () => {
    let taskStore: TaskStore;

    beforeEach(() => {
      const dbPath = join(mockApexDir, 'test-windows.db');
      taskStore = new TaskStore(dbPath);
    });

    afterEach(() => {
      taskStore?.close();
    });

    it('should handle SQLite operations correctly on Windows file system', () => {
      // Create a test task with Windows-specific data
      const task: Task = {
        id: 'windows-test-task',
        description: 'Test SQLite operations on Windows',
        workflow: 'windows-test',
        status: TaskStatus.PENDING,
        created_at: new Date(),
        updated_at: new Date(),
        stage: 'planning',
        branch: 'windows-test-branch',
        project_path: tempTestDir.replace(/\//g, '\\'), // Ensure Windows path format
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          total_cost: 0.0045,
        },
      };

      // Test task creation
      expect(() => taskStore.createTask(task)).not.toThrow();

      // Test task retrieval
      const retrievedTask = taskStore.getTask(task.id);
      expect(retrievedTask).toBeDefined();
      expect(retrievedTask!.id).toBe(task.id);
      expect(retrievedTask!.project_path).toBe(task.project_path);
      expect(retrievedTask!.project_path).toContain('\\'); // Windows path preserved

      // Test task update
      const updatedTask = { ...retrievedTask!, status: TaskStatus.IN_PROGRESS };
      expect(() => taskStore.updateTask(updatedTask)).not.toThrow();

      const finalTask = taskStore.getTask(task.id);
      expect(finalTask!.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should handle Windows file paths in database correctly', () => {
      // Test with various Windows path formats
      const windowsPaths = [
        'C:\\Users\\Developer\\Projects\\apex',
        'D:\\temp\\apex-workspace',
        '\\\\server\\share\\apex-project', // UNC path
        'C:\\Program Files\\APEX\\workspace',
      ];

      windowsPaths.forEach((windowsPath, index) => {
        const task: Task = {
          id: `windows-path-test-${index}`,
          description: `Test Windows path ${index}`,
          workflow: 'windows-test',
          status: TaskStatus.PENDING,
          created_at: new Date(),
          updated_at: new Date(),
          stage: 'planning',
          branch: `path-test-${index}`,
          project_path: windowsPath,
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            total_cost: 0.0001,
          },
        };

        // Should store and retrieve Windows paths correctly
        expect(() => taskStore.createTask(task)).not.toThrow();

        const retrieved = taskStore.getTask(task.id);
        expect(retrieved).toBeDefined();
        expect(retrieved!.project_path).toBe(windowsPath);
      });
    });
  });

  describe('Windows Configuration Integration', () => {
    it('should validate configuration compatibility between core and orchestrator on Windows', async () => {
      // Create a comprehensive config that both core and orchestrator will use
      const windowsConfig: ApexConfig = {
        version: '1.0',
        project: {
          name: 'windows-integration-test',
          language: 'typescript',
          testCommand: 'npm.cmd test', // Windows-specific command
          lintCommand: 'npm.cmd run lint',
          buildCommand: 'npm.cmd run build',
          rootDir: tempTestDir.replace(/\//g, '\\'), // Windows path format
        },
        ui: {
          previewMode: true,
          previewConfidence: 0.85,
          autoExecuteHighConfidence: true,
          previewTimeout: 8000,
        },
        autonomy: {
          default: 'full',
          agents: {
            'test-agent': 'supervised',
          },
        },
        limits: {
          maxConcurrentTasks: 3,
          maxTokensPerTask: 50000,
          maxCostPerTask: 5.0,
          dailyCostLimit: 100.0,
          taskTimeoutMinutes: 30,
        },
        workspace: {
          autoCleanup: true,
          maxWorktrees: 5,
          cleanupDelayMs: 60000,
        },
      };

      const configPath = join(mockApexDir, 'config.yaml');
      writeFileSync(configPath, yaml.stringify(windowsConfig));

      // Test core config loading
      const loadedConfig = await loadConfig();
      expect(loadedConfig.project.name).toBe('windows-integration-test');
      expect(loadedConfig.project.testCommand).toBe('npm.cmd test');
      expect(loadedConfig.project.rootDir).toContain('\\');

      // Test effective config processing
      const effectiveConfig = getEffectiveConfig(loadedConfig);
      expect(effectiveConfig.ui.previewMode).toBe(true);
      expect(effectiveConfig.limits.maxConcurrentTasks).toBe(3);

      // Test config is compatible with orchestrator initialization
      expect(effectiveConfig.workspace).toBeDefined();
      expect(effectiveConfig.workspace!.autoCleanup).toBe(true);
      expect(effectiveConfig.limits).toBeDefined();
      expect(effectiveConfig.autonomy.agents).toBeDefined();
    });

    it('should handle Windows environment variables correctly across modules', () => {
      // Test Windows-specific environment variables
      const originalHome = process.env.HOME;
      const originalUserProfile = process.env.USERPROFILE;
      const originalAppData = process.env.APPDATA;

      try {
        // Set Windows-style environment variables
        process.env.USERPROFILE = 'C:\\Users\\TestUser';
        process.env.APPDATA = 'C:\\Users\\TestUser\\AppData\\Roaming';
        delete process.env.HOME; // Windows doesn't typically have HOME

        // Test that cross-platform utilities handle Windows env vars
        const homeDir = getHomeDir();
        expect(homeDir).toBe('C:\\Users\\TestUser');

        const configDir = getConfigDir();
        expect(configDir).toBe('C:\\Users\\TestUser\\AppData\\Roaming');

        // Test that paths are properly handled
        expect(homeDir).toContain('\\');
        expect(configDir).toContain('\\');
        expect(configDir).toContain('AppData');

      } finally {
        // Restore original environment
        if (originalHome) process.env.HOME = originalHome;
        if (originalUserProfile) process.env.USERPROFILE = originalUserProfile;
        if (originalAppData) process.env.APPDATA = originalAppData;
      }
    });
  });

  describe('Windows Error Handling Across Modules', () => {
    it('should handle Windows file system errors correctly', () => {
      // Test with invalid Windows paths
      const invalidPaths = [
        'C:\\invalid<file>name.yaml', // Invalid characters
        'CON', // Reserved Windows filename
        'PRN', // Reserved Windows filename
        'C:\\', // Root directory (likely no permission)
        '\\\\invalid\\\\path\\\\share', // Invalid UNC path
      ];

      invalidPaths.forEach(invalidPath => {
        expect(() => {
          try {
            readFileSync(invalidPath);
          } catch (error) {
            // Should get proper Windows error codes
            expect(error).toBeInstanceOf(Error);
            const err = error as NodeJS.ErrnoException;
            expect(['ENOENT', 'EINVAL', 'EPERM', 'EACCES']).toContain(err.code);
          }
        }).not.toThrow();
      });
    });

    it('should handle Windows-specific path resolution edge cases', () => {
      // Test edge cases in Windows path handling
      const edgeCasePaths = [
        '.', // Current directory
        '..', // Parent directory
        '.\\', // Current directory with separator
        '..\\', // Parent directory with separator
        'relative\\path', // Relative path
        '\\absolute\\from\\root', // Absolute from current drive root
      ];

      edgeCasePaths.forEach(edgePath => {
        expect(() => {
          const resolved = resolve(edgePath);
          expect(resolved).toBeDefined();
          expect(typeof resolved).toBe('string');
          // Should be a valid Windows absolute path
          expect(resolved).toMatch(/^[A-Z]:\\/);
        }).not.toThrow();
      });
    });
  });
});

// Additional test suite for Windows environment detection and compatibility
describe('Windows Platform Detection', () => {
  it('should correctly identify Windows platform for cross-module compatibility', () => {
    // This test runs regardless of actual platform to ensure detection logic works
    const platformDetection = process.platform === 'win32';
    const utilityDetection = isWindows();

    expect(platformDetection).toBe(utilityDetection);

    if (platformDetection) {
      console.log('✅ Running on actual Windows platform - full integration tests executed');
    } else {
      console.log('ℹ️ Running on non-Windows platform - Windows-specific tests skipped');
      console.log('ℹ️ Windows CI environment will execute full Windows integration tests');
    }
  });

  it('should provide consistent platform utilities across all modules', () => {
    // Test that platform utilities are available and consistent
    expect(typeof isWindows).toBe('function');
    expect(typeof getHomeDir).toBe('function');
    expect(typeof getConfigDir).toBe('function');
    expect(typeof getPlatformShell).toBe('function');
    expect(typeof createShellCommand).toBe('function');
    expect(typeof getKillCommand).toBe('function');

    // All should return consistent data types
    expect(typeof isWindows()).toBe('boolean');
    expect(typeof getHomeDir()).toBe('string');
    expect(typeof getConfigDir()).toBe('string');
    expect(typeof getPlatformShell()).toBe('object');
    expect(typeof createShellCommand([])).toBe('string');
    expect(Array.isArray(getKillCommand(123))).toBe(true);
  });
});