import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdleProcessor } from '../idle-processor';
import { TaskStore } from '../store';
import { DaemonConfig, TestingAntiPattern } from '@apexcli/core';
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

describe('Test Anti-Patterns - Comprehensive Coverage Tests', () => {
  let idleProcessor: IdleProcessor;
  let mockStore: TaskStore;
  let mockConfig: DaemonConfig;
  let mockProjectPath: string;
  let mockExecAsync: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockProjectPath = '/test/project';
    mockConfig = {
      pollInterval: 5000,
      autoStart: false,
      logLevel: 'info',
      installAsService: false,
      serviceName: 'apex-daemon',
      idleProcessing: {
        enabled: true,
        idleThreshold: 300000,
        taskGenerationInterval: 3600000,
        maxIdleTasks: 3,
      },
    };

    mockStore = {
      createTask: vi.fn(),
      getTasksByStatus: vi.fn().mockResolvedValue([]),
      getAllTasks: vi.fn().mockResolvedValue([]),
    } as any;

    idleProcessor = new IdleProcessor(mockProjectPath, mockConfig, mockStore);

    // Set up mock exec
    mockExecAsync = vi.fn();
    const mockExec = vi.fn((cmd: string, options: any, callback: Function) => {
      mockExecAsync(cmd, options).then((result: any) => {
        callback(null, result);
      }).catch((error: any) => {
        callback(error);
      });
    });

    const childProcess = require('child_process');
    childProcess.exec = mockExec;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Helper Method Coverage', () => {
    it('should test hasAssertions() method with various assertion patterns', async () => {
      // Test different assertion patterns
      const assertionTests = [
        {
          content: 'expect(result).toBe(true);',
          shouldHaveAssertions: true,
          description: 'expect().toBe()'
        },
        {
          content: 'assert(condition);',
          shouldHaveAssertions: true,
          description: 'assert()'
        },
        {
          content: 'result.should.be.true;',
          shouldHaveAssertions: true,
          description: 'should assertion'
        },
        {
          content: 'expect(data).to.be.defined;',
          shouldHaveAssertions: true,
          description: 'chai to assertion'
        },
        {
          content: 'expect(obj).toHaveProperty("name");',
          shouldHaveAssertions: true,
          description: 'toHaveProperty'
        },
        {
          content: 'expect(array).toContain(item);',
          shouldHaveAssertions: true,
          description: 'toContain'
        },
        {
          content: 'expect(str).toMatch(/pattern/);',
          shouldHaveAssertions: true,
          description: 'toMatch'
        },
        {
          content: 'expect(() => func()).toThrow();',
          shouldHaveAssertions: true,
          description: 'toThrow'
        },
        {
          content: 'expect(value).toBeTruthy();',
          shouldHaveAssertions: true,
          description: 'toBeTruthy'
        },
        {
          content: 'expect(value).toBeFalsy();',
          shouldHaveAssertions: true,
          description: 'toBeFalsy'
        },
        {
          content: 'const result = doSomething(); console.log(result);',
          shouldHaveAssertions: false,
          description: 'no assertions'
        },
        {
          content: 'const expected = "value"; // expecting something',
          shouldHaveAssertions: false,
          description: 'comment with "expect" word'
        }
      ];

      mockExecAsync.mockResolvedValue({
        stdout: './src/assertion-tests.test.ts\n',
        stderr: ''
      });

      for (const test of assertionTests) {
        const testContent = `
          describe('Test Suite', () => {
            it('${test.description}', () => {
              ${test.content}
            });
          });
        `;

        vi.mocked(fs.readFile).mockResolvedValueOnce(testContent);

        const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

        const hasNoAssertionPattern = antiPatterns.some(p => p.type === 'no-assertion');

        if (test.shouldHaveAssertions) {
          expect(hasNoAssertionPattern).toBe(false, `${test.description} should be detected as having assertions`);
        } else {
          expect(hasNoAssertionPattern).toBe(true, `${test.description} should be detected as not having assertions`);
        }
      }
    });

    it('should test hasOnlyConsoleLog() method with various scenarios', async () => {
      const consoleLogTests = [
        {
          content: 'console.log("debug info");',
          shouldBeConsoleOnly: true,
          description: 'single console.log'
        },
        {
          content: 'console.log("start"); console.log("end");',
          shouldBeConsoleOnly: true,
          description: 'multiple console.log statements'
        },
        {
          content: 'console.log("debug"); expect(result).toBe(true);',
          shouldBeConsoleOnly: false,
          description: 'console.log with assertion'
        },
        {
          content: 'const value = getData(); console.log(value);',
          shouldBeConsoleOnly: false,
          description: 'console.log with other code'
        },
        {
          content: '// console.log("commented out");',
          shouldBeConsoleOnly: false,
          description: 'commented console.log'
        },
        {
          content: 'console.error("error"); console.log("debug");',
          shouldBeConsoleOnly: false,
          description: 'console.log with console.error'
        }
      ];

      mockExecAsync.mockResolvedValue({
        stdout: './src/console-tests.test.ts\n',
        stderr: ''
      });

      for (const test of consoleLogTests) {
        const testContent = `
          describe('Console Tests', () => {
            it('${test.description}', () => {
              ${test.content}
            });
          });
        `;

        vi.mocked(fs.readFile).mockResolvedValueOnce(testContent);

        const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

        const hasConsoleOnlyPattern = antiPatterns.some(p => p.type === 'console-only');

        if (test.shouldBeConsoleOnly) {
          expect(hasConsoleOnlyPattern).toBe(true, `${test.description} should be detected as console-only`);
        } else {
          expect(hasConsoleOnlyPattern).toBe(false, `${test.description} should NOT be detected as console-only`);
        }
      }
    });

    it('should test isEmptyTest() method with various empty scenarios', async () => {
      const emptyTests = [
        {
          content: '',
          shouldBeEmpty: true,
          description: 'completely empty'
        },
        {
          content: '  ',
          shouldBeEmpty: true,
          description: 'only whitespace'
        },
        {
          content: '// TODO: implement this test',
          shouldBeEmpty: true,
          description: 'only comments'
        },
        {
          content: '/* This test needs implementation */',
          shouldBeEmpty: true,
          description: 'only block comments'
        },
        {
          content: `
            // TODO: implement
            // This should test user creation
          `,
          shouldBeEmpty: true,
          description: 'multiple comments'
        },
        {
          content: 'const value = 42;',
          shouldBeEmpty: false,
          description: 'has actual code'
        },
        {
          content: 'expect(true).toBe(true);',
          shouldBeEmpty: false,
          description: 'has assertion'
        },
        {
          content: '// comment\nconst x = 1;',
          shouldBeEmpty: false,
          description: 'comment with code'
        }
      ];

      mockExecAsync.mockResolvedValue({
        stdout: './src/empty-tests.test.ts\n',
        stderr: ''
      });

      for (const test of emptyTests) {
        const testContent = `
          describe('Empty Tests', () => {
            it('${test.description}', () => {
              ${test.content}
            });
          });
        `;

        vi.mocked(fs.readFile).mockResolvedValueOnce(testContent);

        const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

        const hasEmptyTestPattern = antiPatterns.some(p => p.type === 'empty-test');

        if (test.shouldBeEmpty) {
          expect(hasEmptyTestPattern).toBe(true, `${test.description} should be detected as empty`);
        } else {
          expect(hasEmptyTestPattern).toBe(false, `${test.description} should NOT be detected as empty`);
        }
      }
    });

    it('should test hasHardcodedTimeouts() method with various timeout patterns', async () => {
      const timeoutTests = [
        {
          content: 'setTimeout(() => { expect(true).toBe(true); }, 1000);',
          shouldHaveTimeouts: true,
          description: 'setTimeout'
        },
        {
          content: 'setInterval(() => { checkStatus(); }, 500);',
          shouldHaveTimeouts: true,
          description: 'setInterval'
        },
        {
          content: 'sleep(2000); expect(result).toBeDefined();',
          shouldHaveTimeouts: true,
          description: 'sleep function'
        },
        {
          content: 'delay(1000); verify();',
          shouldHaveTimeouts: true,
          description: 'delay function'
        },
        {
          content: 'await wait(3000); check();',
          shouldHaveTimeouts: true,
          description: 'wait with number'
        },
        {
          content: 'test.timeout(5000);',
          shouldHaveTimeouts: true,
          description: 'test timeout'
        },
        {
          content: 'return new Promise(resolve => setTimeout(resolve, 2000));',
          shouldHaveTimeouts: true,
          description: 'Promise with setTimeout'
        },
        {
          content: 'expect(result).toBe(true);',
          shouldHaveTimeouts: false,
          description: 'no timeouts'
        },
        {
          content: 'await waitFor(() => element.isVisible());',
          shouldHaveTimeouts: false,
          description: 'waitFor without hardcoded timeout'
        },
        {
          content: '// setTimeout(() => {}, 1000); commented out',
          shouldHaveTimeouts: false,
          description: 'commented timeout'
        }
      ];

      mockExecAsync.mockResolvedValue({
        stdout: './src/timeout-tests.test.ts\n',
        stderr: ''
      });

      for (const test of timeoutTests) {
        const testContent = `
          describe('Timeout Tests', () => {
            it('${test.description}', () => {
              ${test.content}
            });
          });
        `;

        vi.mocked(fs.readFile).mockResolvedValueOnce(testContent);

        const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

        const hasTimeoutPattern = antiPatterns.some(p => p.type === 'hardcoded-timeout');

        if (test.shouldHaveTimeouts) {
          expect(hasTimeoutPattern).toBe(true, `${test.description} should be detected as having hardcoded timeouts`);
        } else {
          expect(hasTimeoutPattern).toBe(false, `${test.description} should NOT be detected as having hardcoded timeouts`);
        }
      }
    });

    it('should test isCommentedOutTest() method with various comment patterns', async () => {
      const commentTests = [
        {
          line: '// it("should work", () => {',
          shouldBeCommentedTest: true,
          description: 'commented it() test'
        },
        {
          line: '//   test("should validate", () => {',
          shouldBeCommentedTest: true,
          description: 'commented test() with whitespace'
        },
        {
          line: '// describe("User module", () => {',
          shouldBeCommentedTest: true,
          description: 'commented describe() test'
        },
        {
          line: '// it(`should handle ${dynamic} tests`, () => {',
          shouldBeCommentedTest: true,
          description: 'commented test with template literal'
        },
        {
          line: '// This is just a regular comment',
          shouldBeCommentedTest: false,
          description: 'regular comment'
        },
        {
          line: '// const value = "it should work";',
          shouldBeCommentedTest: false,
          description: 'comment with "it" in string'
        },
        {
          line: 'it("should work", () => {',
          shouldBeCommentedTest: false,
          description: 'active test'
        },
        {
          line: '/* it("should work", () => { */',
          shouldBeCommentedTest: false,
          description: 'block comment (not handled)'
        }
      ];

      mockExecAsync.mockResolvedValue({
        stdout: './src/comment-tests.test.ts\n',
        stderr: ''
      });

      for (const test of commentTests) {
        const testContent = `
          describe('Comment Tests', () => {
            ${test.line}
            it('active test', () => {
              expect(true).toBe(true);
            });
          });
        `;

        vi.mocked(fs.readFile).mockResolvedValueOnce(testContent);

        const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

        const hasCommentedPattern = antiPatterns.some(p => p.type === 'commented-out');

        if (test.shouldBeCommentedTest) {
          expect(hasCommentedPattern).toBe(true, `${test.description} should be detected as commented test`);
        } else {
          expect(hasCommentedPattern).toBe(false, `${test.description} should NOT be detected as commented test`);
        }
      }
    });
  });

  describe('Complex Test File Scenarios', () => {
    it('should handle mixed frameworks (Jest, Vitest, Mocha, Jasmine)', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/multi-framework.test.ts\n',
        stderr: ''
      });

      const mixedFrameworkContent = `
        // Jest style
        describe('Jest style tests', () => {
          it('should work with Jest', () => {
            expect(jest.fn()).toHaveBeenCalledTimes(0);
          });

          it('no assertions here', () => {
            const mockFn = jest.fn();
          });
        });

        // Vitest style
        describe('Vitest tests', () => {
          it('should work with Vitest', () => {
            expect(vi.fn()).toHaveBeenCalledTimes(0);
          });

          it('empty vitest test', () => {
            // TODO: implement
          });
        });

        // Mocha/Chai style
        describe('Mocha tests', () => {
          it('should work with Chai', () => {
            result.should.be.true;
          });

          it('timeout test', () => {
            setTimeout(() => {
              result.should.equal(expected);
            }, 1000);
          });
        });

        // Jasmine style
        describe('Jasmine tests', () => {
          it('should work with Jasmine', () => {
            expect(spy).toHaveBeenCalled();
          });

          // it('commented jasmine test', () => {
          //   expect(something).toBeDefined();
          // });
        });
      `;

      vi.mocked(fs.readFile).mockResolvedValueOnce(mixedFrameworkContent);

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Should detect various anti-patterns across frameworks
      expect(antiPatterns.length).toBeGreaterThan(0);

      const types = antiPatterns.map(p => p.type);
      expect(types).toContain('no-assertion');
      expect(types).toContain('empty-test');
      expect(types).toContain('hardcoded-timeout');
      expect(types).toContain('commented-out');
    });

    it('should handle async/await test patterns correctly', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/async-tests.test.ts\n',
        stderr: ''
      });

      const asyncTestContent = `
        describe('Async tests', () => {
          it('should handle async without await', async () => {
            const result = fetchData();
            console.log(result);
          });

          it('should handle proper async test', async () => {
            const result = await fetchData();
            expect(result).toBeDefined();
          });

          it('should handle Promise timeout', () => {
            return new Promise((resolve) => {
              setTimeout(() => {
                resolve(true);
              }, 2000);
            });
          });

          it('empty async test', async () => {
            // TODO: implement async logic
          });

          it('async console only', async () => {
            const data = await getData();
            console.log('Received:', data);
          });
        });
      `;

      vi.mocked(fs.readFile).mockResolvedValueOnce(asyncTestContent);

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(antiPatterns.length).toBeGreaterThan(0);

      // Should detect anti-patterns in async tests
      const descriptions = antiPatterns.map(p => p.description);
      expect(descriptions.some(d => d.includes('async without await') || d.includes('no assertions'))).toBe(true);
      expect(descriptions.some(d => d.includes('empty') || d.includes('TODO'))).toBe(true);
      expect(descriptions.some(d => d.includes('console.log'))).toBe(true);
    });

    it('should handle deeply nested describe blocks', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/nested-tests.test.ts\n',
        stderr: ''
      });

      const nestedTestContent = `
        describe('Level 1', () => {
          describe('Level 2', () => {
            describe('Level 3', () => {
              it('deep test without assertion', () => {
                const value = processDeepData();
              });

              describe('Level 4', () => {
                it('very deep empty test', () => {
                });

                describe('Level 5', () => {
                  it('deepest test with timeout', () => {
                    setTimeout(() => {
                      expect(true).toBe(true);
                    }, 1500);
                  });

                  // it('deepest commented test', () => {
                  //   expect(false).toBe(false);
                  // });
                });
              });
            });
          });
        });
      `;

      vi.mocked(fs.readFile).mockResolvedValueOnce(nestedTestContent);

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(antiPatterns.length).toBeGreaterThan(0);

      // Should correctly identify anti-patterns at any nesting level
      const types = antiPatterns.map(p => p.type);
      expect(types).toContain('no-assertion');
      expect(types).toContain('empty-test');
      expect(types).toContain('hardcoded-timeout');
      expect(types).toContain('commented-out');
    });

    it('should handle test files with JSX/TSX content', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/component.test.tsx\n',
        stderr: ''
      });

      const jsxTestContent = `
        import React from 'react';
        import { render, fireEvent, screen } from '@testing-library/react';
        import { MyComponent } from './MyComponent';

        describe('MyComponent', () => {
          it('should render component', () => {
            render(<MyComponent title="Test" />);
            // Missing assertion
          });

          it('should handle click events', () => {
            const onClickMock = jest.fn();
            render(<MyComponent onClick={onClickMock} />);

            fireEvent.click(screen.getByRole('button'));
            console.log('Click event fired');
          });

          it('should handle props correctly', async () => {
            const props = { title: 'Test', disabled: false };
            const { rerender } = render(<MyComponent {...props} />);

            expect(screen.getByText('Test')).toBeInTheDocument();

            await rerender(<MyComponent title="Updated" />);
            expect(screen.getByText('Updated')).toBeInTheDocument();
          });

          it('empty component test', () => {
            // TODO: Add component interaction tests
          });

          // it('should handle error states', () => {
          //   const errorProps = { error: true };
          //   render(<MyComponent {...errorProps} />);
          //   expect(screen.getByText('Error')).toBeInTheDocument();
          // });
        });
      `;

      vi.mocked(fs.readFile).mockResolvedValueOnce(jsxTestContent);

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(antiPatterns.length).toBeGreaterThan(0);

      // Should handle JSX syntax and detect anti-patterns
      const types = antiPatterns.map(p => p.type);
      expect(types).toContain('no-assertion');
      expect(types).toContain('console-only');
      expect(types).toContain('empty-test');
      expect(types).toContain('commented-out');

      // Verify file paths are handled correctly for .tsx files
      antiPatterns.forEach(pattern => {
        expect(pattern.file).toMatch(/\.tsx$/);
      });
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle extremely large test files efficiently', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/large-test-file.test.ts\n',
        stderr: ''
      });

      // Generate a large test file with many tests
      const generateLargeTestFile = () => {
        let content = 'describe("Large test suite", () => {\n';

        // Add 100 test cases with different anti-patterns
        for (let i = 0; i < 100; i++) {
          const testType = i % 5;
          switch (testType) {
            case 0:
              content += `  it("test ${i} no assertion", () => {\n    const value = process${i}();\n  });\n`;
              break;
            case 1:
              content += `  it("test ${i} console only", () => {\n    console.log("test ${i}");\n  });\n`;
              break;
            case 2:
              content += `  it("test ${i} empty", () => {\n  });\n`;
              break;
            case 3:
              content += `  it("test ${i} timeout", () => {\n    setTimeout(() => expect(true).toBe(true), 1000);\n  });\n`;
              break;
            case 4:
              content += `  // it("test ${i} commented", () => {\n  //   expect(true).toBe(true);\n  // });\n`;
              break;
          }
        }

        content += '});';
        return content;
      };

      const largeTestContent = generateLargeTestFile();
      vi.mocked(fs.readFile).mockResolvedValueOnce(largeTestContent);

      const startTime = Date.now();
      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();
      const endTime = Date.now();

      // Should complete within reasonable time (less than 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);

      // Should detect anti-patterns but respect performance limits
      expect(antiPatterns.length).toBeGreaterThan(0);
      expect(antiPatterns.length).toBeLessThanOrEqual(50); // Implementation limit
    });

    it('should handle malformed test syntax gracefully', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/malformed.test.ts\n',
        stderr: ''
      });

      const malformedTestContent = `
        describe('Malformed tests', () => {
          it('unclosed test', () => {
            const value = 42;
            // Missing closing brace

          it('missing quotes', () => {
            expect(value).toBe(42;
          });

          it('nested functions', () => {
            function inner() {
              function deeper() {
                return true;
              }
              return deeper();
            }
            // No assertion
          });

          // Incomplete commented test
          // it('incomplete comment

          it('normal test', () => {
            expect(true).toBe(true);
          });
        });
      `;

      vi.mocked(fs.readFile).mockResolvedValueOnce(malformedTestContent);

      // Should not throw errors with malformed syntax
      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      expect(Array.isArray(antiPatterns)).toBe(true);
      // Should still detect what it can
      expect(antiPatterns.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle files with no test blocks gracefully', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/no-tests.test.ts\n',
        stderr: ''
      });

      const noTestContent = `
        // This file has .test.ts extension but no actual tests
        import { someFunction } from './utils';

        const testData = {
          name: 'test',
          value: 42
        };

        function helper() {
          return testData;
        }

        // Some constants
        const TIMEOUT = 1000;
        const API_URL = 'https://api.example.com';
      `;

      vi.mocked(fs.readFile).mockResolvedValueOnce(noTestContent);

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Should return empty array for files with no tests
      expect(Array.isArray(antiPatterns)).toBe(true);
      expect(antiPatterns).toHaveLength(0);
    });
  });

  describe('File Path Handling', () => {
    it('should correctly clean file paths', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './src/path-test.test.ts\n./nested/folder/deep.test.ts\n',
        stderr: ''
      });

      const testContent = `
        describe('Path test', () => {
          it('no assertion test', () => {
            const value = 42;
          });
        });
      `;

      vi.mocked(fs.readFile).mockResolvedValue(testContent);

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Check that file paths are cleaned (no leading './')
      antiPatterns.forEach(pattern => {
        expect(pattern.file).not.toMatch(/^\.\//);
        expect(pattern.file).toMatch(/^src\//);
      });
    });

    it('should handle different test file extensions', async () => {
      mockExecAsync.mockResolvedValue({
        stdout: './test.test.js\n./test.spec.ts\n./test.test.jsx\n./test.spec.tsx\n',
        stderr: ''
      });

      const testContent = `
        describe('Extension test', () => {
          it('empty test', () => {
          });
        });
      `;

      vi.mocked(fs.readFile).mockResolvedValue(testContent);

      const antiPatterns = await idleProcessor.analyzeTestAntiPatterns();

      // Should handle all test file extensions
      const files = [...new Set(antiPatterns.map(p => p.file))];
      expect(files.some(f => f.endsWith('.test.js'))).toBe(true);
      expect(files.some(f => f.endsWith('.spec.ts'))).toBe(true);
      expect(files.some(f => f.endsWith('.test.jsx'))).toBe(true);
      expect(files.some(f => f.endsWith('.spec.tsx'))).toBe(true);
    });
  });
});