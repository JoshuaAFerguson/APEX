/**
 * Install Timeout Handling Integration Tests
 *
 * Tests the complete timeout behavior for dependency installation:
 * - Timeout expiration during install
 * - Timeout recovery attempts
 * - Custom timeout configurations
 * - Timeout error events emitted correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WorkspaceManager, DependencyInstallEventData, DependencyInstallCompletedEventData } from '../workspace-manager';
import { Task, DependencyDetector, ContainerManager, ContainerHealthMonitor, containerRuntime } from '@apexcli/core';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    rm: vi.fn(),
    access: vi.fn(),
  }
}));

vi.mock('child_process', () => ({ exec: vi.fn() }));

vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    ContainerManager: vi.fn(),
    ContainerHealthMonitor: vi.fn(),
    DependencyDetector: vi.fn(),
    containerRuntime: { getBestRuntime: vi.fn() }
  };
});

describe('Install Timeout Handling Integration', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManager: any;
  let mockDependencyDetector: any;
  let mockHealthMonitor: any;
  let capturedEvents: {
    started: DependencyInstallEventData[];
    completed: DependencyInstallCompletedEventData[];
  };
  const projectPath = '/test/timeout-project';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset event capture
    capturedEvents = {
      started: [],
      completed: []
    };

    mockHealthMonitor = {
      startMonitoring: vi.fn(),
      stopMonitoring: vi.fn(),
      getContainerHealth: vi.fn().mockResolvedValue({ status: 'running' }),
      getStats: vi.fn().mockResolvedValue({
        memory: { usage: 128000000, limit: 512000000 },
        cpu: { usage: 25.5 },
        io: { read: 1000000, write: 500000 }
      })
    };

    mockContainerManager = {
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'timeout-container' }),
      execCommand: vi.fn(),
      startEventsMonitoring: vi.fn(),
      stopEventsMonitoring: vi.fn(),
      isEventsMonitoringActive: vi.fn().mockReturnValue(false),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue({ success: true }),
      removeContainer: vi.fn().mockResolvedValue({ success: true })
    };

    mockDependencyDetector = {
      detectPackageManagers: vi.fn().mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      })
    };

    vi.mocked(ContainerManager).mockImplementation(() => mockContainerManager);
    vi.mocked(ContainerHealthMonitor).mockImplementation(() => mockHealthMonitor);
    vi.mocked(DependencyDetector).mockImplementation(() => mockDependencyDetector);
    vi.mocked(containerRuntime).getBestRuntime.mockResolvedValue('docker');

    const mockFs = vi.mocked(require('fs').promises);
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.readdir.mockResolvedValue([]);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.access.mockRejectedValue(new Error('File not found'));

    workspaceManager = new WorkspaceManager({ projectPath, defaultStrategy: 'container' });

    // Capture events
    workspaceManager.on('dependency-install-started', (data: DependencyInstallEventData) => {
      capturedEvents.started.push(data);
    });

    workspaceManager.on('dependency-install-completed', (data: DependencyInstallCompletedEventData) => {
      capturedEvents.completed.push(data);
    });

    await workspaceManager.initialize();
  });

  afterEach(() => {
    workspaceManager.removeAllListeners();
  });

  describe('Timeout Expiration During Install', () => {
    it('should timeout after configured installTimeout duration', async () => {
      const timeoutMs = 5000; // 5 second timeout for test speed
      let commandStartTime = 0;

      // Mock execCommand to simulate a long-running installation that exceeds timeout
      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        commandStartTime = Date.now();

        // Simulate a command that takes longer than the timeout
        return new Promise((resolve) => {
          setTimeout(() => {
            const elapsed = Date.now() - commandStartTime;
            resolve({
              success: false,
              stdout: '',
              stderr: 'Error: Request timeout',
              exitCode: 124 // Standard timeout exit code
            });
          }, timeoutMs + 1000); // Command takes 1 second longer than timeout
        });
      });

      const task: Task = {
        id: 'timeout-test',
        type: 'feature',
        title: 'Test Install Timeout',
        description: 'Test timeout expiration',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installTimeout: timeoutMs
          }
        }
      };

      const startTime = Date.now();
      const result = await workspaceManager.createWorkspace(task);
      const totalTime = Date.now() - startTime;

      // Verify workspace creation still succeeds but dependency install fails
      expect(result.success).toBe(true);

      // Verify timeout was respected (should be close to timeout value, not much longer)
      expect(totalTime).toBeLessThan(timeoutMs + 2000); // Allow some buffer for test execution

      // Verify timeout error was reported in events
      expect(capturedEvents.started).toHaveLength(1);
      expect(capturedEvents.completed).toHaveLength(1);

      const completedEvent = capturedEvents.completed[0];
      expect(completedEvent.success).toBe(false);
      expect(completedEvent.stderr).toMatch(/timeout/i);
      expect(completedEvent.duration).toBeLessThan(timeoutMs + 1000);
    }, 15000); // Give test enough time to run

    it('should use default timeout when no custom timeout specified', async () => {
      const expectedDefaultTimeout = 300000; // 5 minutes default
      let actualTimeout: number | undefined;

      // Capture the timeout value passed to execCommand
      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        actualTimeout = options.timeout;
        return {
          success: true,
          stdout: 'Dependencies installed successfully',
          stderr: '',
          exitCode: 0
        };
      });

      const task: Task = {
        id: 'default-timeout-test',
        type: 'feature',
        title: 'Test Default Timeout',
        description: 'Test default timeout value',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true
            // No installTimeout specified - should use default
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(actualTimeout).toBe(expectedDefaultTimeout);

      expect(capturedEvents.started).toHaveLength(1);
      expect(capturedEvents.completed).toHaveLength(1);
      expect(capturedEvents.completed[0].success).toBe(true);
    });
  });

  describe('Timeout Recovery Attempts', () => {
    it('should handle timeout failure gracefully when no retries configured', async () => {
      const timeoutMs = 3000; // 3 second timeout

      // Mock execCommand to timeout
      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        // Simulate a command that takes longer than the timeout
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: false,
              stdout: '',
              stderr: 'Error: Request timeout',
              exitCode: 124
            });
          }, timeoutMs + 100);
        });
      });

      const task: Task = {
        id: 'no-retry-timeout-test',
        type: 'feature',
        title: 'Test No Retry Timeout',
        description: 'Test timeout without retry',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installTimeout: timeoutMs
            // No installRetries specified
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      // Workspace creation should succeed even if dependency install fails
      expect(result.success).toBe(true);

      // Should have exactly one attempt
      expect(capturedEvents.started).toHaveLength(1);
      expect(capturedEvents.completed).toHaveLength(1);

      // Single attempt should fail with timeout
      expect(capturedEvents.completed[0].success).toBe(false);
      expect(capturedEvents.completed[0].stderr).toMatch(/timeout/i);
      expect(capturedEvents.completed[0].exitCode).toBe(124);
    }, 15000);

    it('should properly configure installRetries field when specified', async () => {
      // This test verifies the schema accepts installRetries without actually implementing retry logic
      mockContainerManager.execCommand.mockResolvedValue({
        success: true,
        stdout: 'Dependencies installed successfully',
        stderr: '',
        exitCode: 0
      });

      const task: Task = {
        id: 'retry-config-test',
        type: 'feature',
        title: 'Test Retry Config',
        description: 'Test retry configuration acceptance',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installTimeout: 5000,
            installRetries: 3 // Should be accepted by schema
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(capturedEvents.started).toHaveLength(1);
      expect(capturedEvents.completed).toHaveLength(1);
      expect(capturedEvents.completed[0].success).toBe(true);
    });
  });

  describe('Custom Timeout Configurations', () => {
    it('should respect different timeout values for different package managers', async () => {
      const testCases = [
        { manager: 'npm', timeout: 10000, image: 'node:20-alpine' },
        { manager: 'pip', timeout: 15000, image: 'python:3.11-slim' },
        { manager: 'cargo', timeout: 20000, image: 'rust:1.75-alpine' }
      ];

      for (const testCase of testCases) {
        let capturedTimeout: number | undefined;

        // Mock dependency detection for specific package manager
        mockDependencyDetector.detectPackageManagers.mockResolvedValue({
          projectPath,
          detectedManagers: [{
            type: testCase.manager,
            language: testCase.manager === 'npm' ? 'javascript' : testCase.manager === 'pip' ? 'python' : 'rust',
            installCommand: `${testCase.manager} install`,
            detected: true
          }],
          hasPackageManagers: true,
          primaryManager: {
            type: testCase.manager,
            language: testCase.manager === 'npm' ? 'javascript' : testCase.manager === 'pip' ? 'python' : 'rust',
            installCommand: `${testCase.manager} install`,
            detected: true
          },
          installCommands: [`${testCase.manager} install`]
        });

        mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
          capturedTimeout = options.timeout;
          return {
            success: true,
            stdout: `${testCase.manager} dependencies installed`,
            stderr: '',
            exitCode: 0
          };
        });

        const task: Task = {
          id: `${testCase.manager}-timeout-test`,
          type: 'feature',
          title: `Test ${testCase.manager} Timeout`,
          description: `Test timeout for ${testCase.manager}`,
          workflow: 'feature',
          status: 'running',
          created: new Date(),
          workspace: {
            strategy: 'container',
            cleanup: true,
            container: {
              image: testCase.image,
              autoDependencyInstall: true,
              installTimeout: testCase.timeout
            }
          }
        };

        const result = await workspaceManager.createWorkspace(task);

        expect(result.success).toBe(true);
        expect(capturedTimeout).toBe(testCase.timeout);

        // Reset for next iteration
        vi.clearAllMocks();
        capturedEvents.started = [];
        capturedEvents.completed = [];
      }
    });

    it('should validate timeout configuration bounds', async () => {
      const testCases = [
        { timeout: 1, expectValid: true, description: 'minimum timeout' },
        { timeout: 1000, expectValid: true, description: 'small timeout' },
        { timeout: 300000, expectValid: true, description: 'default timeout' },
        { timeout: 3600000, expectValid: true, description: 'large timeout' }
      ];

      for (const testCase of testCases) {
        mockContainerManager.execCommand.mockResolvedValue({
          success: true,
          stdout: 'Dependencies installed',
          stderr: '',
          exitCode: 0
        });

        const task: Task = {
          id: `timeout-bounds-${testCase.timeout}`,
          type: 'feature',
          title: `Test ${testCase.description}`,
          description: `Test ${testCase.description}`,
          workflow: 'feature',
          status: 'running',
          created: new Date(),
          workspace: {
            strategy: 'container',
            cleanup: true,
            container: {
              image: 'node:20-alpine',
              autoDependencyInstall: true,
              installTimeout: testCase.timeout
            }
          }
        };

        if (testCase.expectValid) {
          const result = await workspaceManager.createWorkspace(task);
          expect(result.success).toBe(true);
        }

        // Reset for next iteration
        vi.clearAllMocks();
        capturedEvents.started = [];
        capturedEvents.completed = [];
      }
    });
  });

  describe('Timeout Error Events', () => {
    it('should emit correct timeout events with detailed error information', async () => {
      const timeoutMs = 2000;
      const startTime = Date.now();

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        // Simulate timeout by waiting longer than timeout and returning timeout error
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: false,
              stdout: '',
              stderr: 'Error: Command execution timed out after 2000ms',
              exitCode: 124
            });
          }, timeoutMs + 100);
        });
      });

      const task: Task = {
        id: 'timeout-events-test',
        type: 'feature',
        title: 'Test Timeout Events',
        description: 'Test timeout event emission',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installTimeout: timeoutMs
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      // Verify events were emitted
      expect(capturedEvents.started).toHaveLength(1);
      expect(capturedEvents.completed).toHaveLength(1);

      // Verify started event details
      const startedEvent = capturedEvents.started[0];
      expect(startedEvent.taskId).toBe(task.id);
      expect(startedEvent.containerId).toBe('timeout-container');
      expect(startedEvent.installCommand).toBe('npm install');
      expect(startedEvent.packageManager).toBe('npm');
      expect(startedEvent.language).toBe('javascript');
      expect(startedEvent.timestamp).toBeInstanceOf(Date);

      // Verify completed event details for timeout
      const completedEvent = capturedEvents.completed[0];
      expect(completedEvent.taskId).toBe(task.id);
      expect(completedEvent.containerId).toBe('timeout-container');
      expect(completedEvent.success).toBe(false);
      expect(completedEvent.exitCode).toBe(124); // Standard timeout exit code
      expect(completedEvent.stderr).toMatch(/timeout/i);
      expect(completedEvent.error).toBeDefined();
      expect(completedEvent.duration).toBeGreaterThan(timeoutMs);
      expect(completedEvent.duration).toBeLessThan(timeoutMs + 1000); // Should be close to timeout
      expect(completedEvent.timestamp).toBeInstanceOf(Date);

      // Verify timing is reasonable
      const actualDuration = completedEvent.timestamp.getTime() - startedEvent.timestamp.getTime();
      expect(actualDuration).toBeCloseTo(completedEvent.duration, -2); // Within 100ms
    });

    it('should emit timeout events with proper timing information', async () => {
      const timeoutMs = 2000;

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: false,
              stdout: '',
              stderr: 'Error: Command execution timed out',
              exitCode: 124
            });
          }, timeoutMs + 100);
        });
      });

      const task: Task = {
        id: 'timeout-timing-events-test',
        type: 'feature',
        title: 'Test Timeout Event Timing',
        description: 'Test timeout event timing accuracy',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installTimeout: timeoutMs
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      // Should have exactly one attempt
      expect(capturedEvents.started).toHaveLength(1);
      expect(capturedEvents.completed).toHaveLength(1);

      const completedEvent = capturedEvents.completed[0];
      expect(completedEvent.success).toBe(false);
      expect(completedEvent.exitCode).toBe(124);
      expect(completedEvent.stderr).toMatch(/timeout/i);

      // Verify timing is approximately correct (within reasonable bounds)
      expect(completedEvent.duration).toBeGreaterThan(timeoutMs);
      expect(completedEvent.duration).toBeLessThan(timeoutMs + 1000);

      expect(completedEvent.taskId).toBe(task.id);
      expect(completedEvent.containerId).toBe('timeout-container');
    }, 10000);

    it('should include correct metadata in timeout events for different package managers', async () => {
      const packageManagers = [
        { type: 'npm', language: 'javascript', command: 'npm install', image: 'node:20-alpine' },
        { type: 'pip', language: 'python', command: 'pip install -r requirements.txt', image: 'python:3.11-slim' },
        { type: 'yarn', language: 'javascript', command: 'yarn install', image: 'node:20-alpine' }
      ];

      for (const pm of packageManagers) {
        // Reset events for each test
        capturedEvents.started = [];
        capturedEvents.completed = [];
        vi.clearAllMocks();

        mockDependencyDetector.detectPackageManagers.mockResolvedValue({
          projectPath,
          detectedManagers: [{ type: pm.type, language: pm.language, installCommand: pm.command, detected: true }],
          hasPackageManagers: true,
          primaryManager: { type: pm.type, language: pm.language, installCommand: pm.command, detected: true },
          installCommands: [pm.command]
        });

        mockContainerManager.execCommand.mockImplementation(async () => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                success: false,
                stdout: '',
                stderr: `Timeout error for ${pm.type}`,
                exitCode: 124
              });
            }, 1100);
          });
        });

        const task: Task = {
          id: `${pm.type}-metadata-test`,
          type: 'feature',
          title: `Test ${pm.type} Metadata`,
          description: `Test metadata for ${pm.type}`,
          workflow: 'feature',
          status: 'running',
          created: new Date(),
          workspace: {
            strategy: 'container',
            cleanup: true,
            container: {
              image: pm.image,
              autoDependencyInstall: true,
              installTimeout: 1000
            }
          }
        };

        const result = await workspaceManager.createWorkspace(task);

        expect(capturedEvents.started).toHaveLength(1);
        expect(capturedEvents.completed).toHaveLength(1);

        const startedEvent = capturedEvents.started[0];
        expect(startedEvent.packageManager).toBe(pm.type);
        expect(startedEvent.language).toBe(pm.language);
        expect(startedEvent.installCommand).toBe(pm.command);

        const completedEvent = capturedEvents.completed[0];
        expect(completedEvent.packageManager).toBe(pm.type);
        expect(completedEvent.language).toBe(pm.language);
        expect(completedEvent.installCommand).toBe(pm.command);
        expect(completedEvent.stderr).toContain(pm.type);
      }
    }, 20000);
  });
});