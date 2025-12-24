import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from '../idle-processor';
import { TaskStore } from '../store';
import { DaemonConfig } from '@apexcli/core';
import { promises as fs } from 'fs';

// Mock dependencies
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
  },
}));

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

describe('IdleProcessor - analyzeTestAntiPatterns() Method Tests', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockProjectPath = '/test/project';
    mockConfig = {
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn(),
      getAllTasks: vi.fn(),
    } as any;

    idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Individual Anti-Pattern Detection', () => {
    beforeEach(() => {
      // Set up common mock exec
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/test.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should detect tests without assertions specifically', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test.test.ts')) {
          return Promise.resolve(`
            describe('User service', () => {
              it('should create a user', () => {
                const user = createUser('John', 'john@email.com');
                console.log('User created:', user);
                // No assertions here
              });

              it('should validate user email', async () => {
                const result = await validateEmail('test@example.com');
                // Missing expect() or assert()
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      const noAssertionPatterns = antiPatterns.filter(p => p.type === 'no-assertion');
      expect(noAssertionPatterns).toHaveLength(2);

      expect(noAssertionPatterns[0]).toMatchObject({
        file: expect.stringContaining('test.test.ts'),
        type: 'no-assertion',
        severity: 'high',
        description: expect.stringContaining('assertions')
      });
    });

    it('should detect commented-out tests with different comment styles', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test.test.ts')) {
          return Promise.resolve(`
            describe('Authentication', () => {
              it('should login user', () => {
                expect(login('user', 'pass')).toBe(true);
              });

              // it('should handle invalid credentials', () => {
              //   expect(() => login('user', 'wrong')).toThrow();
              // });

              /* it('should logout user', () => {
                 expect(logout()).toBe(true);
               }); */

              // test('should reset password', () => {
              //   expect(resetPassword('user')).toBe(true);
              // });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      const commentedOutPatterns = antiPatterns.filter(p => p.type === 'commented-out');
      expect(commentedOutPatterns).toHaveLength(2); // Only line comments detected by current implementation

      commentedOutPatterns.forEach(pattern => {
        expect(pattern).toMatchObject({
          type: 'commented-out',
          severity: 'low',
          description: expect.stringContaining('Commented-out test found')
        });
      });
    });

    it('should detect tests with only console.log statements', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test.test.ts')) {
          return Promise.resolve(`
            describe('Debugging tests', () => {
              it('should debug API response', () => {
                const response = fetchData();
                console.log('Response:', response);
                console.log('Status:', response.status);
              });

              it('should trace execution flow', () => {
                console.log('Starting execution');
                const result = processData();
                console.log('Result:', result);
              });

              it('should test with actual assertions', () => {
                const result = add(2, 3);
                console.log('Adding numbers');
                expect(result).toBe(5);
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      const consoleOnlyPatterns = antiPatterns.filter(p => p.type === 'console-only');
      expect(consoleOnlyPatterns).toHaveLength(2);

      consoleOnlyPatterns.forEach(pattern => {
        expect(pattern).toMatchObject({
          type: 'console-only',
          severity: 'medium',
          description: expect.stringContaining('console.log')
        });
      });
    });

    it('should detect empty test blocks', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test.test.ts')) {
          return Promise.resolve(`
            describe('Empty tests', () => {
              it('should handle user registration', () => {
              });

              it('should validate form input', () => {
                // TODO: implement this test
              });

              it('should process payment', () => {
                /*
                 * This test needs to be implemented
                 */
              });

              it('should send notification', () => {
                const result = sendNotification();
                expect(result).toBe(true);
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      const emptyTestPatterns = antiPatterns.filter(p => p.type === 'empty-test');
      expect(emptyTestPatterns).toHaveLength(3);

      emptyTestPatterns.forEach(pattern => {
        expect(pattern).toMatchObject({
          type: 'empty-test',
          severity: 'medium',
          description: expect.stringContaining('empty')
        });
      });
    });

    it('should detect hardcoded timeouts', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('test.test.ts')) {
          return Promise.resolve(`
            describe('Timeout tests', () => {
              it('should wait for API response', () => {
                setTimeout(() => {
                  expect(getApiData()).toBeDefined();
                }, 2000);
              });

              it('should handle delayed operations', () => {
                setInterval(() => {
                  checkStatus();
                }, 1000);
                expect(true).toBe(true);
              });

              it('should test with custom delay', () => {
                sleep(500);
                expect(processCompleted()).toBe(true);
              });

              it('should use promise with timeout', () => {
                return new Promise(resolve => {
                  setTimeout(resolve, 3000);
                });
              });

              it('should test without timeouts', () => {
                expect(instantOperation()).toBe(true);
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      const timeoutPatterns = antiPatterns.filter(p => p.type === 'hardcoded-timeout');
      expect(timeoutPatterns).toHaveLength(4);

      timeoutPatterns.forEach(pattern => {
        expect(pattern).toMatchObject({
          type: 'hardcoded-timeout',
          severity: 'high',
          description: expect.stringContaining('hardcoded timeouts')
        });
      });
    });
  });

  describe('Complex Test Scenarios', () => {
    it('should handle nested test structures', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/nested.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('nested.test.ts')) {
          return Promise.resolve(`
            describe('User Management', () => {
              describe('Registration', () => {
                it('should create new user', () => {
                  const user = createUser();
                  // Missing assertion
                });

                describe('Validation', () => {
                  it('should validate email format', () => {
                    console.log('Validating email');
                  });
                });
              });

              describe('Authentication', () => {
                it('should authenticate user', () => {
                  setTimeout(() => {
                    expect(authenticate()).toBe(true);
                  }, 1000);
                });

                // it('should handle failed login', () => {
                //   expect(false).toBe(true);
                // });
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(antiPatterns.length).toBeGreaterThan(0);

      const types = antiPatterns.map(p => p.type);
      expect(types).toContain('no-assertion');
      expect(types).toContain('console-only');
      expect(types).toContain('hardcoded-timeout');
      expect(types).toContain('commented-out');
    });

    it('should handle mixed valid and invalid tests', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/mixed.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('mixed.test.ts')) {
          return Promise.resolve(`
            describe('Mixed tests', () => {
              it('should pass valid test', () => {
                expect(add(2, 3)).toBe(5);
              });

              it('should fail without assertion', () => {
                const result = multiply(4, 5);
              });

              it('should pass another valid test', () => {
                expect(subtract(10, 5)).toBe(5);
              });

              it('should only console log', () => {
                console.log('This is just logging');
              });

              it('should pass with async', async () => {
                const result = await fetchData();
                expect(result).toBeDefined();
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Should only detect anti-patterns, not valid tests
      expect(antiPatterns).toHaveLength(2);

      const types = antiPatterns.map(p => p.type);
      expect(types).toContain('no-assertion');
      expect(types).toContain('console-only');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed test files gracefully', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/malformed.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('malformed.test.ts')) {
          return Promise.resolve(`
            describe('Broken test', () => {
              it('should handle malformed syntax', () => {
                const unclosedFunction = () => {
                  // This function is not closed properly
              });

              // Incomplete test block
              it('incomplete test
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      // Should handle malformed content gracefully without crashing
    });

    it('should handle extremely large test files', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          // Simulate many test files
          const manyFiles = Array.from({ length: 30 }, (_, i) => `./test${i}.test.ts`).join('\n');
          callback(null, { stdout: manyFiles });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        // Create large test content with multiple anti-patterns
        const largeContent = `
          describe('Large test suite', () => {
            ${Array.from({ length: 20 }, (_, i) => `
              it('test ${i} without assertions', () => {
                const value = processData(${i});
              });
            `).join('\n')}
          });
        `;
        return Promise.resolve(largeContent);
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Should limit results for performance (implementation limits to 50)
      expect(antiPatterns.length).toBeLessThanOrEqual(50);
      expect(Array.isArray(antiPatterns)).toBe(true);
    });

    it('should handle test files with no test blocks', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/notest.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('notest.test.ts')) {
          return Promise.resolve(`
            // This file has the .test.ts extension but no actual tests
            import { describe, it, expect } from 'vitest';

            // Some utility functions
            function helper() {
              return true;
            }

            const constant = 42;

            // No describe or it blocks
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      expect(antiPatterns).toHaveLength(0);
    });

    it('should handle file read errors gracefully', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/unreadable.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'));

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      // Should handle file read errors gracefully
    });

    it('should handle find command errors gracefully', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(new Error('find command failed'), null);
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      expect(antiPatterns).toHaveLength(0);
    });
  });

  describe('Method Return Value Validation', () => {
    it('should always return an array', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        callback(null, { stdout: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      expect(antiPatterns).toHaveLength(0);
    });

    it('should return objects with correct structure', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/structure.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('structure.test.ts')) {
          return Promise.resolve(`
            describe('Structure test', () => {
              it('test without assertion', () => {
                const value = 42;
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(antiPatterns.length).toBeGreaterThan(0);

      antiPatterns.forEach(pattern => {
        expect(pattern).toHaveProperty('file');
        expect(pattern).toHaveProperty('line');
        expect(pattern).toHaveProperty('type');
        expect(pattern).toHaveProperty('description');
        expect(pattern).toHaveProperty('severity');
        expect(pattern).toHaveProperty('suggestion');

        expect(typeof pattern.file).toBe('string');
        expect(typeof pattern.line).toBe('number');
        expect(typeof pattern.type).toBe('string');
        expect(typeof pattern.description).toBe('string');
        expect(typeof pattern.severity).toBe('string');
        expect(typeof pattern.suggestion).toBe('string');

        expect(pattern.line).toBeGreaterThan(0);
        expect(['low', 'medium', 'high']).toContain(pattern.severity);
        expect(['no-assertion', 'commented-out', 'console-only', 'empty-test', 'hardcoded-timeout']).toContain(pattern.type);
      });
    });

    it('should respect performance limits', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          // Return many test files to test performance limiting
          const manyFiles = Array.from({ length: 100 }, (_, i) => `./test${i}.test.ts`).join('\n');
          callback(null, { stdout: manyFiles });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation(() => {
        return Promise.resolve(`
          describe('Performance test', () => {
            it('test without assertion', () => {
              const value = 42;
            });
          });
        `);
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Implementation should limit results to 50 for performance
      expect(antiPatterns.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Helper Method Testing', () => {
    beforeEach(() => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        callback(null, { stdout: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;
    });

    it('should correctly identify assertions in various formats', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(`
          describe('Assertion tests', () => {
            it('has expect assertion', () => {
              expect(true).toBe(true);
            });

            it('has assert assertion', () => {
              assert(true);
            });

            it('has should assertion', () => {
              result.should.be.true;
            });

            it('has chai to assertion', () => {
              expect(result).to.be.true;
            });

            it('has no assertion', () => {
              const result = doSomething();
            });
          });
        `);
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Only the test without assertions should be flagged
      const noAssertionPatterns = antiPatterns.filter(p => p.type === 'no-assertion');
      expect(noAssertionPatterns).toHaveLength(1);
    });

    it('should correctly identify console-only tests vs tests with both console and assertions', async () => {
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(`
          describe('Console tests', () => {
            it('only console logging', () => {
              console.log('debug info');
              console.log('more info');
            });

            it('console with assertions', () => {
              console.log('debug info');
              expect(true).toBe(true);
            });

            it('no console no assertions', () => {
              const value = 42;
            });
          });
        `);
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      const consoleOnlyPatterns = antiPatterns.filter(p => p.type === 'console-only');
      const noAssertionPatterns = antiPatterns.filter(p => p.type === 'no-assertion');

      expect(consoleOnlyPatterns).toHaveLength(1);
      expect(noAssertionPatterns).toHaveLength(1);
    });
  });
});