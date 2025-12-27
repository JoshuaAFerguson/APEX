/**
 * Install Failure Recovery Integration Tests
 *
 * Tests comprehensive failure recovery scenarios for dependency installation:
 * - Network failures during install with automatic retry
 * - Corrupt package files with fallback strategies
 * - Permission errors with escalation attempts
 * - Retry behavior with exponential backoff
 * - Graceful degradation when install fails completely
 * - Recovery mechanisms and error reporting
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

describe('Install Failure Recovery Integration', () => {
  let workspaceManager: WorkspaceManager;
  let mockContainerManager: any;
  let mockDependencyDetector: any;
  let mockHealthMonitor: any;
  let capturedEvents: {
    started: DependencyInstallEventData[];
    completed: DependencyInstallCompletedEventData[];
  };
  const projectPath = '/test/recovery-project';

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
      createContainer: vi.fn().mockResolvedValue({ success: true, containerId: 'recovery-container' }),
      execCommand: vi.fn(),
      startEventsMonitoring: vi.fn(),
      stopEventsMonitoring: vi.fn(),
      isEventsMonitoringActive: vi.fn().mockReturnValue(false),
      listApexContainers: vi.fn().mockResolvedValue([]),
      stopContainer: vi.fn().mockResolvedValue({ success: true }),
      removeContainer: vi.fn().mockResolvedValue({ success: true })
    };

    mockDependencyDetector = {
      detectPackageManagers: vi.fn()
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

  describe('Network Failure Recovery Scenarios', () => {
    it('should recover from transient network failures with exponential backoff', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      let attemptCount = 0;
      const maxRetries = 3;

      // Simulate network failures that resolve after retries
      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        attemptCount++;

        if (attemptCount <= 2) {
          // First two attempts fail with network errors
          return {
            success: false,
            stdout: '',
            stderr: `npm ERR! network request to https://registry.npmjs.org failed, reason: ECONNRESET (attempt ${attemptCount})`,
            exitCode: 1
          };
        } else {
          // Third attempt succeeds
          return {
            success: true,
            stdout: `
added 235 packages, and audited 236 packages in 12s
found 0 vulnerabilities
            `,
            stderr: '',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'network-recovery-test',
        type: 'feature',
        title: 'Test Network Failure Recovery',
        description: 'Test network failure recovery with exponential backoff',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installRetries: maxRetries,
            installTimeout: 30000
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(attemptCount).toBe(3);

      // Verify events show retry attempts
      expect(capturedEvents.started).toHaveLength(3);
      expect(capturedEvents.completed).toHaveLength(3);

      // First two attempts should fail
      expect(capturedEvents.completed[0].success).toBe(false);
      expect(capturedEvents.completed[1].success).toBe(false);

      // Third attempt should succeed
      expect(capturedEvents.completed[2].success).toBe(true);
      expect(capturedEvents.completed[2].stdout).toContain('added 235 packages');
    });

    it('should handle DNS resolution failures with registry fallback', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      let attemptCount = 0;

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        attemptCount++;

        if (attemptCount === 1) {
          // First attempt fails with DNS error
          return {
            success: false,
            stdout: '',
            stderr: 'npm ERR! network getaddrinfo ENOTFOUND registry.npmjs.org',
            exitCode: 1
          };
        } else {
          // Second attempt with fallback registry succeeds
          return {
            success: true,
            stdout: 'Dependencies installed successfully using fallback registry',
            stderr: 'npm WARN using fallback registry https://registry.yarnpkg.com',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'dns-recovery-test',
        type: 'feature',
        title: 'Test DNS Resolution Failure Recovery',
        description: 'Test DNS failure recovery with registry fallback',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installRetries: 2,
            installTimeout: 30000
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(attemptCount).toBe(2);

      expect(capturedEvents.completed).toHaveLength(2);
      expect(capturedEvents.completed[0].success).toBe(false);
      expect(capturedEvents.completed[0].stderr).toContain('ENOTFOUND registry.npmjs.org');

      expect(capturedEvents.completed[1].success).toBe(true);
      expect(capturedEvents.completed[1].stderr).toContain('fallback registry');
    });

    it('should handle intermittent SSL/TLS errors with certificate recovery', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      let attemptCount = 0;

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        attemptCount++;

        if (attemptCount === 1) {
          return {
            success: false,
            stdout: '',
            stderr: 'WARNING: Retrying (Retry(total=4, connect=None, read=None, redirect=None, status=None)) after connection broken by \'SSLError\'',
            exitCode: 1
          };
        } else {
          return {
            success: true,
            stdout: 'Successfully installed package-1.0.0',
            stderr: '',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'ssl-recovery-test',
        type: 'feature',
        title: 'Test SSL Error Recovery',
        description: 'Test SSL/TLS error recovery',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim',
            autoDependencyInstall: true,
            installRetries: 2
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(capturedEvents.completed[1].success).toBe(true);
      expect(capturedEvents.completed[0].stderr).toContain('SSLError');
    });
  });

  describe('Corrupt Package File Recovery', () => {
    it('should recover from corrupted package.json by attempting repair', async () => {
      let repairAttempted = false;

      mockDependencyDetector.detectPackageManagers.mockImplementation(async () => {
        if (!repairAttempted) {
          // First call detects corruption
          return {
            projectPath,
            detectedManagers: [],
            hasPackageManagers: false,
            primaryManager: null,
            installCommands: [],
            errors: [{ file: 'package.json', error: 'Unexpected token } in JSON at position 245' }]
          };
        } else {
          // After repair attempt, detection succeeds
          return {
            projectPath,
            detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
            hasPackageManagers: true,
            primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
            installCommands: ['npm install']
          };
        }
      });

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        if (command.includes('package.json.backup')) {
          // Simulate repair command
          repairAttempted = true;
          return {
            success: true,
            stdout: 'package.json repaired from backup',
            stderr: '',
            exitCode: 0
          };
        } else {
          // Dependency install after repair
          return {
            success: true,
            stdout: 'Dependencies installed after repair',
            stderr: '',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'package-repair-test',
        type: 'feature',
        title: 'Test Package File Repair',
        description: 'Test recovery from corrupted package.json',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
          }
        }
      };

      // First creation attempt should trigger repair
      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(repairAttempted).toBe(true);
    });

    it('should gracefully handle malformed requirements.txt with syntax validation', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      let attemptCount = 0;

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        attemptCount++;

        if (attemptCount === 1) {
          // First attempt fails due to malformed requirement
          return {
            success: false,
            stdout: '',
            stderr: 'ERROR: Invalid requirement: "invalid===package===spec"',
            exitCode: 1
          };
        } else if (command.includes('requirements.txt.clean')) {
          // Cleanup command to fix requirements.txt
          return {
            success: true,
            stdout: 'Cleaned invalid lines from requirements.txt',
            stderr: '',
            exitCode: 0
          };
        } else {
          // Retry after cleanup
          return {
            success: true,
            stdout: 'Successfully installed cleaned dependencies',
            stderr: '',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'requirements-recovery-test',
        type: 'feature',
        title: 'Test Requirements File Recovery',
        description: 'Test recovery from malformed requirements.txt',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim',
            autoDependencyInstall: true,
            installRetries: 2
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(capturedEvents.completed.some(event =>
        event.stderr && event.stderr.includes('Invalid requirement')
      )).toBe(true);
    });

    it('should handle missing cargo build dependencies with auto-installation', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'cargo', language: 'rust', installCommand: 'cargo build', detected: true },
        installCommands: ['cargo build']
      });

      let buildToolsInstalled = false;

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        if (command.includes('cargo build') && !buildToolsInstalled) {
          return {
            success: false,
            stdout: '',
            stderr: 'error: failed to run custom build command for `some-sys v1.0.0`\nlinker `cc` not found',
            exitCode: 101
          };
        } else if (command.includes('apt-get install') || command.includes('apk add')) {
          buildToolsInstalled = true;
          return {
            success: true,
            stdout: 'Build tools installed successfully',
            stderr: '',
            exitCode: 0
          };
        } else if (command.includes('cargo build') && buildToolsInstalled) {
          return {
            success: true,
            stdout: 'Finished dev [unoptimized + debuginfo] target(s) in 45.23s',
            stderr: '',
            exitCode: 0
          };
        }
        return { success: false, stdout: '', stderr: 'Unexpected command', exitCode: 1 };
      });

      const task: Task = {
        id: 'cargo-build-tools-test',
        type: 'feature',
        title: 'Test Cargo Build Tools Recovery',
        description: 'Test recovery from missing build tools',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'rust:1.75-alpine',
            autoDependencyInstall: true,
            installRetries: 2
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(buildToolsInstalled).toBe(true);
    });
  });

  describe('Permission Error Recovery', () => {
    it('should escalate permissions and retry installation when permission denied', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'pip', language: 'python', installCommand: 'pip install -r requirements.txt', detected: true },
        installCommands: ['pip install -r requirements.txt']
      });

      let attemptCount = 0;

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        attemptCount++;

        if (attemptCount === 1) {
          // First attempt fails with permission error
          return {
            success: false,
            stdout: '',
            stderr: 'ERROR: Could not install packages due to an EnvironmentError: [Errno 13] Permission denied: \'/usr/local/lib/python3.11/site-packages\'',
            exitCode: 1
          };
        } else {
          // Second attempt with --user flag succeeds
          return {
            success: true,
            stdout: 'Successfully installed package-1.0.0 to user directory',
            stderr: 'WARNING: Installing to user directory due to permissions',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'permission-escalation-test',
        type: 'feature',
        title: 'Test Permission Error Recovery',
        description: 'Test permission escalation on install failure',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'python:3.11-slim',
            autoDependencyInstall: true,
            installRetries: 2,
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(attemptCount).toBe(2);

      expect(capturedEvents.completed[0].success).toBe(false);
      expect(capturedEvents.completed[0].stderr).toContain('Permission denied');

      expect(capturedEvents.completed[1].success).toBe(true);
      expect(capturedEvents.completed[1].stderr).toContain('user directory');
    });

    it('should handle read-only filesystem by using alternative paths', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      let attemptCount = 0;

      mockContainerManager.execCommand.mockImplementation(async (containerId: string, command: string, options: any) => {
        attemptCount++;

        if (attemptCount === 1) {
          return {
            success: false,
            stdout: '',
            stderr: 'npm ERR! EROFS: read-only file system, mkdir \'/usr/local/lib/node_modules\'',
            exitCode: 1
          };
        } else {
          // Retry with --prefix to writable location
          return {
            success: true,
            stdout: 'Dependencies installed to alternative location',
            stderr: 'npm WARN using alternative installation path due to read-only filesystem',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'readonly-fs-recovery-test',
        type: 'feature',
        title: 'Test Read-only FS Recovery',
        description: 'Test recovery from read-only filesystem',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installRetries: 2,
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);
      expect(capturedEvents.completed[1].stderr).toContain('alternative installation path');
    });
  });

  describe('Graceful Degradation and Fallback', () => {
    it('should gracefully degrade to workspace creation when all install attempts fail', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      // All attempts fail
      mockContainerManager.execCommand.mockResolvedValue({
        success: false,
        stdout: '',
        stderr: 'npm ERR! Maximum install attempts exceeded',
        exitCode: 1
      });

      const task: Task = {
        id: 'graceful-degradation-test',
        type: 'feature',
        title: 'Test Graceful Degradation',
        description: 'Test graceful degradation when install fails completely',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installRetries: 3,
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      // Workspace creation should still succeed even if dependency install fails
      expect(result).toBeDefined();
      expect(result.taskId).toBe(task.id);

      // All retry attempts should have been made
      expect(capturedEvents.started).toHaveLength(3);
      expect(capturedEvents.completed).toHaveLength(3);

      // All should have failed
      capturedEvents.completed.forEach(event => {
        expect(event.success).toBe(false);
      });
    });

    it('should provide helpful error reporting for common failure patterns', async () => {
      const failureScenarios = [
        {
          stderr: 'npm ERR! ENOSPC: no space left on device',
          expectedSuggestion: 'Free up disk space or increase container storage'
        },
        {
          stderr: 'ERROR: Could not find a version that satisfies the requirement',
          expectedSuggestion: 'Check package name spelling and version requirements'
        },
        {
          stderr: 'error: failed to connect to github.com',
          expectedSuggestion: 'Check network connectivity or use alternative registry'
        }
      ];

      for (const scenario of failureScenarios) {
        vi.clearAllMocks();
        capturedEvents.started = [];
        capturedEvents.completed = [];

        mockDependencyDetector.detectPackageManagers.mockResolvedValue({
          projectPath,
          detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
          hasPackageManagers: true,
          primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
          installCommands: ['npm install']
        });

        mockContainerManager.execCommand.mockResolvedValue({
          success: false,
          stdout: '',
          stderr: scenario.stderr,
          exitCode: 1
        });

        const task: Task = {
          id: 'error-reporting-test',
          type: 'feature',
          title: 'Test Error Reporting',
          description: 'Test error reporting and suggestions',
          workflow: 'feature',
          status: 'running',
          created: new Date(),
          workspace: {
            strategy: 'container',
            cleanup: true,
            container: {
              image: 'node:20-alpine',
              autoDependencyInstall: true,
            }
          }
        };

        const result = await workspaceManager.createWorkspace(task);

        expect(result.success).toBe(true); // Workspace created despite install failure
        expect(capturedEvents.completed[0].error).toContain(scenario.expectedSuggestion);
      }
    });

    it('should emit comprehensive recovery status events', async () => {
      mockDependencyDetector.detectPackageManagers.mockResolvedValue({
        projectPath,
        detectedManagers: [{ type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true }],
        hasPackageManagers: true,
        primaryManager: { type: 'npm', language: 'javascript', installCommand: 'npm install', detected: true },
        installCommands: ['npm install']
      });

      let recoveryStatusEvents: any[] = [];
      workspaceManager.on('dependency-install-recovery', (data: any) => {
        recoveryStatusEvents.push(data);
      });

      let attemptCount = 0;
      mockContainerManager.execCommand.mockImplementation(async () => {
        attemptCount++;

        if (attemptCount <= 2) {
          return {
            success: false,
            stdout: '',
            stderr: `Network error on attempt ${attemptCount}`,
            exitCode: 1
          };
        } else {
          return {
            success: true,
            stdout: 'Recovery successful',
            stderr: '',
            exitCode: 0
          };
        }
      });

      const task: Task = {
        id: 'recovery-events-test',
        type: 'feature',
        title: 'Test Recovery Events',
        description: 'Test recovery status event emission',
        workflow: 'feature',
        status: 'running',
        created: new Date(),
        workspace: {
          strategy: 'container',
          cleanup: true,
          container: {
            image: 'node:20-alpine',
            autoDependencyInstall: true,
            installRetries: 3,
          }
        }
      };

      const result = await workspaceManager.createWorkspace(task);

      expect(result.success).toBe(true);
      expect(recoveryStatusEvents).toHaveLength(2); // Two recovery attempts

      recoveryStatusEvents.forEach((event, index) => {
        expect(event.attempt).toBe(index + 2); // Recovery attempts 2 and 3
        expect(event.previousError).toContain('Network error');
        expect(event.strategy).toBeDefined();
      });
    });
  });
});