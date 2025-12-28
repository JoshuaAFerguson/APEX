import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';

// Mock child_process.exec
const mockExecAsync = vi.fn();
const mockKill = vi.fn();

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn(() => mockExecAsync),
}));

// Mock process.kill
const originalKill = process.kill;

// We need to import and test the cross-platform functions directly
// Since they're not exported, we'll test them through the DaemonManager interface
import { DaemonManager, DaemonError } from './daemon';

describe('Cross-Platform Process Signal Management', () => {
  const originalPlatform = process.platform;
  let daemonManager: DaemonManager;

  beforeEach(() => {
    vi.clearAllMocks();
    process.kill = mockKill;
    daemonManager = new DaemonManager({ projectPath: '/test/project' });
  });

  afterEach(() => {
    process.kill = originalKill;
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
    vi.resetAllMocks();
  });

  describe('Windows Platform (win32)', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });
    });

    describe('Process Detection', () => {
      it('should use tasklist command to check process existence', async () => {
        // Mock file system reads for PID file
        vi.doMock('fs', () => ({
          promises: {
            readFile: vi.fn().mockResolvedValue(JSON.stringify({
              pid: 12345,
              startedAt: new Date().toISOString(),
              projectPath: '/test/project'
            })),
          },
        }));

        // Mock successful tasklist output
        mockExecAsync.mockResolvedValue({
          stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","12345","Console","1","50,000 K"\n',
        });

        const result = await daemonManager.isDaemonRunning();

        expect(result).toBe(true);
        expect(mockExecAsync).toHaveBeenCalledWith('tasklist /fi "PID eq 12345" /fo csv');
      });

      it('should handle tasklist command with various output formats', async () => {
        vi.doMock('fs', () => ({
          promises: {
            readFile: vi.fn().mockResolvedValue(JSON.stringify({
              pid: 9999,
              startedAt: new Date().toISOString(),
              projectPath: '/test/project'
            })),
          },
        }));

        // Test different tasklist output scenarios
        const testCases = [
          // Process found
          {
            stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","9999","Console","1","50,000 K"\n',
            expected: true,
            description: 'process found in output'
          },
          // No process found (header only)
          {
            stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n',
            expected: false,
            description: 'header only, no processes'
          },
          // Multiple processes, target not found
          {
            stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"notepad.exe","1234","Console","1","10,000 K"\n"chrome.exe","5678","Console","1","100,000 K"\n',
            expected: false,
            description: 'multiple processes, target not in list'
          },
          // Empty output
          {
            stdout: '',
            expected: false,
            description: 'empty output'
          },
          // Output with extra whitespace and empty lines
          {
            stdout: '\n\n"Image Name","PID","Session Name","Session#","Mem Usage"\n\n"node.exe","9999","Console","1","50,000 K"\n\n\n',
            expected: true,
            description: 'output with whitespace and empty lines'
          }
        ];

        for (const testCase of testCases) {
          mockExecAsync.mockReset();
          mockExecAsync.mockResolvedValue({ stdout: testCase.stdout });

          const result = await daemonManager.isDaemonRunning();
          expect(result).toBe(testCase.expected);
          expect(mockExecAsync).toHaveBeenCalledWith('tasklist /fi "PID eq 9999" /fo csv');
        }
      });

      it('should return false when tasklist command fails', async () => {
        vi.doMock('fs', () => ({
          promises: {
            readFile: vi.fn().mockResolvedValue(JSON.stringify({
              pid: 12345,
              startedAt: new Date().toISOString(),
              projectPath: '/test/project'
            })),
          },
        }));

        // Mock tasklist command failure
        mockExecAsync.mockRejectedValue(new Error('Command failed'));

        const result = await daemonManager.isDaemonRunning();
        expect(result).toBe(false);
      });
    });

    describe('Process Termination', () => {
      it('should use taskkill for graceful termination', async () => {
        vi.doMock('fs', () => ({
          promises: {
            readFile: vi.fn().mockResolvedValue(JSON.stringify({
              pid: 12345,
              startedAt: new Date().toISOString(),
              projectPath: '/test/project'
            })),
            unlink: vi.fn().mockResolvedValue(undefined),
            appendFile: vi.fn().mockResolvedValue(undefined),
          },
        }));

        // Mock tasklist showing process exists initially, then doesn't exist after kill
        let processExists = true;
        mockExecAsync.mockImplementation(async (cmd: string) => {
          if (cmd.includes('tasklist')) {
            if (processExists) {
              return { stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","12345","Console","1","50,000 K"\n' };
            } else {
              return { stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n' };
            }
          } else if (cmd.includes('taskkill') && !cmd.includes('/f')) {
            // Graceful termination
            setTimeout(() => { processExists = false; }, 10);
            return { stdout: 'SUCCESS: Sent termination signal to process with PID 12345.' };
          }
        });

        const result = await daemonManager.stopDaemon();
        expect(result).toBe(true);
        expect(mockExecAsync).toHaveBeenCalledWith('taskkill /pid 12345');
      });

      it('should use taskkill /f for force kill', async () => {
        vi.doMock('fs', () => ({
          promises: {
            readFile: vi.fn().mockResolvedValue(JSON.stringify({
              pid: 12345,
              startedAt: new Date().toISOString(),
              projectPath: '/test/project'
            })),
            unlink: vi.fn().mockResolvedValue(undefined),
            appendFile: vi.fn().mockResolvedValue(undefined),
          },
        }));

        // Mock tasklist showing process exists
        mockExecAsync.mockImplementation(async (cmd: string) => {
          if (cmd.includes('tasklist')) {
            return { stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","12345","Console","1","50,000 K"\n' };
          } else if (cmd.includes('taskkill /f')) {
            return { stdout: 'SUCCESS: The process with PID 12345 has been terminated.' };
          }
        });

        const result = await daemonManager.killDaemon();
        expect(result).toBe(true);
        expect(mockExecAsync).toHaveBeenCalledWith('taskkill /f /pid 12345');
      });

      it('should handle taskkill permission errors', async () => {
        vi.doMock('fs', () => ({
          promises: {
            readFile: vi.fn().mockResolvedValue(JSON.stringify({
              pid: 12345,
              startedAt: new Date().toISOString(),
              projectPath: '/test/project'
            })),
            unlink: vi.fn().mockResolvedValue(undefined),
            appendFile: vi.fn().mockResolvedValue(undefined),
          },
        }));

        mockExecAsync.mockImplementation(async (cmd: string) => {
          if (cmd.includes('tasklist')) {
            return { stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","12345","Console","1","50,000 K"\n' };
          } else if (cmd.includes('taskkill')) {
            throw new Error('Access is denied.');
          }
        });

        await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
        await expect(daemonManager.stopDaemon()).rejects.toThrow('Failed to stop daemon process');
      });
    });
  });

  describe('Unix-like Platforms (linux, darwin, freebsd)', () => {
    const unixPlatforms = ['linux', 'darwin', 'freebsd'];

    unixPlatforms.forEach(platform => {
      describe(`${platform} platform`, () => {
        beforeEach(() => {
          Object.defineProperty(process, 'platform', {
            value: platform,
            writable: true,
          });
          mockKill.mockClear();
        });

        describe('Process Detection', () => {
          it('should use process.kill(pid, 0) to check process existence', async () => {
            vi.doMock('fs', () => ({
              promises: {
                readFile: vi.fn().mockResolvedValue(JSON.stringify({
                  pid: 12345,
                  startedAt: new Date().toISOString(),
                  projectPath: '/test/project'
                })),
              },
            }));

            mockKill.mockReturnValue(undefined); // Process exists

            const result = await daemonManager.isDaemonRunning();
            expect(result).toBe(true);
            expect(mockKill).toHaveBeenCalledWith(12345, 0);
          });

          it('should return false for ESRCH (process not found)', async () => {
            vi.doMock('fs', () => ({
              promises: {
                readFile: vi.fn().mockResolvedValue(JSON.stringify({
                  pid: 12345,
                  startedAt: new Date().toISOString(),
                  projectPath: '/test/project'
                })),
              },
            }));

            mockKill.mockImplementation(() => {
              const error = new Error('No such process') as NodeJS.ErrnoException;
              error.code = 'ESRCH';
              throw error;
            });

            const result = await daemonManager.isDaemonRunning();
            expect(result).toBe(false);
          });

          it('should return true for EPERM (permission denied, but process exists)', async () => {
            vi.doMock('fs', () => ({
              promises: {
                readFile: vi.fn().mockResolvedValue(JSON.stringify({
                  pid: 12345,
                  startedAt: new Date().toISOString(),
                  projectPath: '/test/project'
                })),
              },
            }));

            mockKill.mockImplementation(() => {
              const error = new Error('Operation not permitted') as NodeJS.ErrnoException;
              error.code = 'EPERM';
              throw error;
            });

            const result = await daemonManager.isDaemonRunning();
            expect(result).toBe(true);
          });

          it('should handle other error codes gracefully', async () => {
            vi.doMock('fs', () => ({
              promises: {
                readFile: vi.fn().mockResolvedValue(JSON.stringify({
                  pid: 12345,
                  startedAt: new Date().toISOString(),
                  projectPath: '/test/project'
                })),
              },
            }));

            mockKill.mockImplementation(() => {
              const error = new Error('Unknown error') as NodeJS.ErrnoException;
              error.code = 'EUNKNOWN';
              throw error;
            });

            const result = await daemonManager.isDaemonRunning();
            expect(result).toBe(false); // Unknown errors treated as process not running
          });
        });

        describe('Process Termination', () => {
          it('should use SIGTERM for graceful termination', async () => {
            vi.doMock('fs', () => ({
              promises: {
                readFile: vi.fn().mockResolvedValue(JSON.stringify({
                  pid: 12345,
                  startedAt: new Date().toISOString(),
                  projectPath: '/test/project'
                })),
                unlink: vi.fn().mockResolvedValue(undefined),
                appendFile: vi.fn().mockResolvedValue(undefined),
              },
            }));

            let processRunning = true;
            mockKill.mockImplementation((pid, signal) => {
              if (signal === 'SIGTERM') {
                setTimeout(() => { processRunning = false; }, 10);
                return undefined;
              }
              if (signal === 0) {
                if (!processRunning) {
                  const error = new Error('No such process') as NodeJS.ErrnoException;
                  error.code = 'ESRCH';
                  throw error;
                }
                return undefined;
              }
            });

            const result = await daemonManager.stopDaemon();
            expect(result).toBe(true);
            expect(mockKill).toHaveBeenCalledWith(12345, 'SIGTERM');
          });

          it('should use SIGKILL for force kill', async () => {
            vi.doMock('fs', () => ({
              promises: {
                readFile: vi.fn().mockResolvedValue(JSON.stringify({
                  pid: 12345,
                  startedAt: new Date().toISOString(),
                  projectPath: '/test/project'
                })),
                unlink: vi.fn().mockResolvedValue(undefined),
                appendFile: vi.fn().mockResolvedValue(undefined),
              },
            }));

            mockKill.mockImplementation((pid, signal) => {
              if (signal === 0) return undefined; // Process exists
              if (signal === 'SIGKILL') return undefined; // Force kill succeeds
            });

            const result = await daemonManager.killDaemon();
            expect(result).toBe(true);
            expect(mockKill).toHaveBeenCalledWith(12345, 'SIGKILL');
          });

          it('should handle signal sending errors', async () => {
            vi.doMock('fs', () => ({
              promises: {
                readFile: vi.fn().mockResolvedValue(JSON.stringify({
                  pid: 12345,
                  startedAt: new Date().toISOString(),
                  projectPath: '/test/project'
                })),
                unlink: vi.fn().mockResolvedValue(undefined),
                appendFile: vi.fn().mockResolvedValue(undefined),
              },
            }));

            mockKill.mockImplementation((pid, signal) => {
              if (signal === 0) return undefined; // Process exists
              if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                throw new Error('Permission denied');
              }
            });

            await expect(daemonManager.stopDaemon()).rejects.toThrow(DaemonError);
            await expect(daemonManager.killDaemon()).rejects.toThrow(DaemonError);
          });
        });
      });
    });
  });

  describe('Platform Compatibility', () => {
    it('should default to Unix behavior for unknown platforms', async () => {
      Object.defineProperty(process, 'platform', {
        value: 'some-unknown-platform',
        writable: true,
      });

      vi.doMock('fs', () => ({
        promises: {
          readFile: vi.fn().mockResolvedValue(JSON.stringify({
            pid: 12345,
            startedAt: new Date().toISOString(),
            projectPath: '/test/project'
          })),
        },
      }));

      mockKill.mockReturnValue(undefined);

      const result = await daemonManager.isDaemonRunning();
      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 0);
    });

    it('should handle platform switching during operation', async () => {
      // Start with Windows
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });

      vi.doMock('fs', () => ({
        promises: {
          readFile: vi.fn().mockResolvedValue(JSON.stringify({
            pid: 12345,
            startedAt: new Date().toISOString(),
            projectPath: '/test/project'
          })),
        },
      }));

      mockExecAsync.mockResolvedValue({
        stdout: '"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","12345","Console","1","50,000 K"\n',
      });

      let result = await daemonManager.isDaemonRunning();
      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith('tasklist /fi "PID eq 12345" /fo csv');

      // Switch to Linux
      Object.defineProperty(process, 'platform', {
        value: 'linux',
        writable: true,
      });

      mockKill.mockReturnValue(undefined);
      mockExecAsync.mockClear();

      result = await daemonManager.isDaemonRunning();
      expect(result).toBe(true);
      expect(mockKill).toHaveBeenCalledWith(12345, 0);
      expect(mockExecAsync).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });
    });

    it('should handle malformed tasklist output', async () => {
      vi.doMock('fs', () => ({
        promises: {
          readFile: vi.fn().mockResolvedValue(JSON.stringify({
            pid: 12345,
            startedAt: new Date().toISOString(),
            projectPath: '/test/project'
          })),
        },
      }));

      const malformedOutputs = [
        'Not CSV format at all',
        '"Incomplete"CSV,"Output"\n',
        '"Header","Only"\n', // Just header
        null,
        undefined,
        '',
        '{}', // JSON instead of CSV
      ];

      for (const output of malformedOutputs) {
        mockExecAsync.mockReset();
        mockExecAsync.mockResolvedValue({ stdout: output || '' });

        const result = await daemonManager.isDaemonRunning();
        expect(result).toBe(false); // Should safely handle all malformed outputs
      }
    });

    it('should handle very large PIDs', async () => {
      const largePid = 2147483647; // Max 32-bit signed integer

      vi.doMock('fs', () => ({
        promises: {
          readFile: vi.fn().mockResolvedValue(JSON.stringify({
            pid: largePid,
            startedAt: new Date().toISOString(),
            projectPath: '/test/project'
          })),
        },
      }));

      mockExecAsync.mockResolvedValue({
        stdout: `"Image Name","PID","Session Name","Session#","Mem Usage"\n"node.exe","${largePid}","Console","1","50,000 K"\n`,
      });

      const result = await daemonManager.isDaemonRunning();
      expect(result).toBe(true);
      expect(mockExecAsync).toHaveBeenCalledWith(`tasklist /fi "PID eq ${largePid}" /fo csv`);
    });
  });
});