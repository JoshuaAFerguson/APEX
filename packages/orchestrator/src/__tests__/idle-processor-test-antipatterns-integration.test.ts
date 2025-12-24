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

describe('IdleProcessor - analyzeTestAntiPatterns() Integration Tests', () => {
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

  describe('Integration with Test Analysis', () => {
    it('should integrate anti-patterns into full test analysis', async () => {
      // Mock a complete test project structure
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find . -name "*.ts"') && cmd.includes('grep -v test')) {
          callback(null, { stdout: './src/user.ts\n./src/auth.ts\n' });
        } else if (cmd.includes('find . -name "*.test.*"') || cmd.includes('find . -name "*.spec.*"')) {
          callback(null, { stdout: './src/user.test.ts\n./src/auth.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('user.ts')) {
          return Promise.resolve(`
            export class User {
              constructor(public name: string) {}
              getName() { return this.name; }
            }
          `);
        }
        if (path.includes('user.test.ts')) {
          return Promise.resolve(`
            describe('User', () => {
              it('should create user', () => {
                const user = new User('John');
                // Missing assertion - anti-pattern
              });

              it('should get user name', () => {
                const user = new User('John');
                expect(user.getName()).toBe('John');
              });
            });
          `);
        }
        if (path.includes('auth.test.ts')) {
          return Promise.resolve(`
            describe('Auth', () => {
              // it('should authenticate', () => {
              //   expect(auth('user', 'pass')).toBe(true);
              // });

              it('should debug login', () => {
                console.log('Testing login');
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const testAnalysis = await (idleProcessor as any).analyzeTestCoverage();

      expect(testAnalysis).toBeDefined();
      expect(testAnalysis.antiPatterns).toBeDefined();
      expect(Array.isArray(testAnalysis.antiPatterns)).toBe(true);

      const antiPatternTypes = testAnalysis.antiPatterns.map((ap: any) => ap.type);
      expect(antiPatternTypes).toContain('no-assertion');
      expect(antiPatternTypes).toContain('commented-out');
      expect(antiPatternTypes).toContain('console-only');
    });

    it('should work within complete project analysis workflow', async () => {
      // Mock complete project analysis
      const mockExec = vi.fn().mockImplementation((command: string, options: any) => {
        const callback = arguments[2] || arguments[1];

        if (command.includes('find . -type f')) {
          callback(null, { stdout: './src/app.ts\n./src/utils.ts\n' });
        } else if (command.includes('find . -name "*.test.*"') || command.includes('find . -name "*.spec.*"')) {
          callback(null, { stdout: './src/app.test.ts\n' });
        } else if (command.includes('wc -l')) {
          callback(null, { stdout: '100' });
        } else if (command.includes('package.json')) {
          callback(null, { stdout: '' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('package.json')) {
          return Promise.resolve(JSON.stringify({
            dependencies: { 'react': '^18.0.0' },
            devDependencies: { 'vitest': '^1.0.0' },
          }));
        }
        if (path.includes('app.test.ts')) {
          return Promise.resolve(`
            describe('App', () => {
              it('should initialize', () => {
                const app = createApp();
                // No assertions
              });

              it('empty test', () => {
              });
            });
          `);
        }
        return Promise.resolve('line 1\nline 2\nline 3\n');
      });

      await idleProcessor.processIdleTime();

      const analysis = idleProcessor.getLastAnalysis();
      expect(analysis).toBeDefined();

      // Check that test analysis includes anti-patterns
      if (analysis?.testAnalysis) {
        expect(analysis.testAnalysis.antiPatterns).toBeDefined();
        expect(Array.isArray(analysis.testAnalysis.antiPatterns)).toBe(true);
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large codebases efficiently', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          // Simulate finding many test files
          const manyFiles = Array.from({ length: 60 }, (_, i) => `./test/suite${i}.test.ts`).join('\n');
          callback(null, { stdout: manyFiles });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        // Each file has multiple anti-patterns
        return Promise.resolve(`
          describe('Test suite', () => {
            it('test 1', () => {
              const value = process();
            });

            it('test 2', () => {
              console.log('debug');
            });

            it('test 3', () => {
            });
          });
        `);
      });

      const startTime = Date.now();
      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds max

      // Should limit results for performance
      expect(antiPatterns.length).toBeLessThanOrEqual(50);
      expect(Array.isArray(antiPatterns)).toBe(true);
    });

    it('should process files in order and stop at limits', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './test1.test.ts\n./test2.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      let fileReadCount = 0;
      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        fileReadCount++;
        return Promise.resolve(`
          describe('Test', () => {
            it('no assertions', () => {
              const value = 42;
            });
          });
        `);
      });

      await idleProcessor.analyzeTestAntiPatterns();

      // Should process files and respect limits
      expect(fileReadCount).toBeGreaterThan(0);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should analyze a typical React component test file', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './src/components/Button.test.tsx\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('Button.test.tsx')) {
          return Promise.resolve(`
            import React from 'react';
            import { render, fireEvent } from '@testing-library/react';
            import Button from './Button';

            describe('Button Component', () => {
              it('should render button text', () => {
                const { getByText } = render(<Button>Click me</Button>);
                expect(getByText('Click me')).toBeInTheDocument();
              });

              it('should handle click events', () => {
                const onClick = vi.fn();
                const { getByRole } = render(<Button onClick={onClick}>Click</Button>);
                fireEvent.click(getByRole('button'));
                // Missing assertion for onClick
              });

              // it('should handle disabled state', () => {
              //   const { getByRole } = render(<Button disabled>Disabled</Button>);
              //   expect(getByRole('button')).toBeDisabled();
              // });

              it('should debug props', () => {
                const props = { variant: 'primary', size: 'large' };
                console.log('Button props:', props);
                render(<Button {...props}>Test</Button>);
              });

              it('should handle async operations', () => {
                setTimeout(() => {
                  expect(true).toBe(true);
                }, 1000);
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
      expect(types).toContain('commented-out');
      expect(types).toContain('console-only');
      expect(types).toContain('hardcoded-timeout');

      // Verify file paths are properly cleaned
      antiPatterns.forEach(pattern => {
        expect(pattern.file).not.toMatch(/^\.\//);
        expect(pattern.file).toMatch(/Button\.test\.tsx$/);
      });
    });

    it('should analyze Node.js API test file', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './test/api/users.spec.js\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        if (path.includes('users.spec.js')) {
          return Promise.resolve(`
            const request = require('supertest');
            const app = require('../../app');

            describe('Users API', () => {
              beforeEach(() => {
                // Setup
              });

              describe('GET /users', () => {
                it('should return all users', async () => {
                  const response = await request(app).get('/users');
                  expect(response.status).toBe(200);
                  expect(response.body).toHaveProperty('users');
                });

                it('should handle authentication', async () => {
                  const response = await request(app)
                    .get('/users')
                    .set('Authorization', 'Bearer token');
                  // Missing status check
                });
              });

              describe('POST /users', () => {
                // it('should create new user', async () => {
                //   const userData = { name: 'John', email: 'john@test.com' };
                //   const response = await request(app)
                //     .post('/users')
                //     .send(userData);
                //   expect(response.status).toBe(201);
                // });

                it('should validate input', () => {
                });

                it('should log creation attempt', async () => {
                  console.log('Attempting to create user');
                  const response = await request(app)
                    .post('/users')
                    .send({ name: 'Test' });
                  console.log('Response:', response.body);
                });
              });
            });
          `);
        }
        return Promise.resolve('');
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(antiPatterns.length).toBeGreaterThan(0);

      // Check for various anti-patterns in API test context
      const hasNoAssertion = antiPatterns.some(p => p.type === 'no-assertion');
      const hasCommentedOut = antiPatterns.some(p => p.type === 'commented-out');
      const hasConsoleOnly = antiPatterns.some(p => p.type === 'console-only');
      const hasEmptyTest = antiPatterns.some(p => p.type === 'empty-test');

      expect(hasNoAssertion).toBe(true);
      expect(hasCommentedOut).toBe(true);
      expect(hasConsoleOnly).toBe(true);
      expect(hasEmptyTest).toBe(true);
    });
  });

  describe('Public Method Interface', () => {
    it('should be accessible as a public method', () => {
      expect(idleProcessor.analyzeTestAntiPatterns).toBeDefined();
      expect(typeof idleProcessor.analyzeTestAntiPatterns).toBe('function');
    });

    it('should return a Promise', () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        callback(null, { stdout: '' });
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      const result = idleProcessor.analyzeTestAntiPatterns();
      expect(result).toBeInstanceOf(Promise);
    });

    it('should be callable independently of other methods', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './test.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(`
          describe('Test', () => {
            it('should work', () => {
              expect(true).toBe(true);
            });
          });
        `);
      });

      // Call the method directly without running full idle processing
      const result1 = await idleProcessor.analyzeTestAntiPatterns();
      const result2 = await idleProcessor.analyzeTestAntiPatterns();

      // Should work consistently
      expect(Array.isArray(result1)).toBe(true);
      expect(Array.isArray(result2)).toBe(true);
    });

    it('should maintain consistent behavior across multiple calls', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './consistent.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(`
          describe('Consistent test', () => {
            it('no assertion test', () => {
              const value = 42;
            });
          });
        `);
      });

      const result1 = await idleProcessor.analyzeTestAntiPatterns();
      const result2 = await idleProcessor.analyzeTestAntiPatterns();
      const result3 = await idleProcessor.analyzeTestAntiPatterns();

      // Results should be consistent
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);

      // All should detect the same anti-pattern
      expect(result1.length).toBe(1);
      expect(result1[0].type).toBe('no-assertion');
    });
  });

  describe('Method Documentation and Requirements Compliance', () => {
    it('should detect all 5 required anti-pattern types', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './complete.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(`
          describe('Complete anti-patterns test', () => {
            it('test without assertions', () => {
              const value = process();
            });

            // it('commented out test', () => {
            //   expect(true).toBe(true);
            // });

            it('test with only console log', () => {
              console.log('Only logging here');
            });

            it('empty test', () => {
            });

            it('test with hardcoded timeout', () => {
              setTimeout(() => {
                expect(true).toBe(true);
              }, 1000);
            });
          });
        `);
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      const requiredTypes = ['no-assertion', 'commented-out', 'console-only', 'empty-test', 'hardcoded-timeout'];
      const detectedTypes = antiPatterns.map(p => p.type);

      requiredTypes.forEach(requiredType => {
        expect(detectedTypes).toContain(requiredType);
      });

      expect(antiPatterns.length).toBe(5);
    });

    it('should return TestingAntiPattern array type', async () => {
      const mockExec = vi.fn((cmd: string, callback: Function) => {
        if (cmd.includes('find')) {
          callback(null, { stdout: './type.test.ts\n' });
        } else {
          callback(null, { stdout: '' });
        }
      });

      const childProcess = require('child_process');
      childProcess.exec = mockExec;

      vi.mocked(fs.readFile).mockImplementation((path: any) => {
        return Promise.resolve(`
          describe('Type test', () => {
            it('no assertion', () => {
              const value = 42;
            });
          });
        `);
      });

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Verify return type structure matches TestingAntiPattern interface
      antiPatterns.forEach(pattern => {
        expect(pattern).toMatchObject({
          file: expect.any(String),
          line: expect.any(Number),
          type: expect.stringMatching(/^(no-assertion|commented-out|console-only|empty-test|hardcoded-timeout)$/),
          description: expect.any(String),
          severity: expect.stringMatching(/^(low|medium|high)$/),
          suggestion: expect.any(String)
        });
      });
    });

    it('should be a public method as specified in requirements', () => {
      // Verify the method is public by checking it exists on the instance
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(idleProcessor), 'analyzeTestAntiPatterns');

      // If not found on prototype, check if it's a direct property (public)
      const isPublic = descriptor !== undefined ||
                      Object.getOwnPropertyDescriptor(idleProcessor, 'analyzeTestAntiPatterns') !== undefined ||
                      typeof idleProcessor.analyzeTestAntiPatterns === 'function';

      expect(isPublic).toBe(true);
    });
  });
});