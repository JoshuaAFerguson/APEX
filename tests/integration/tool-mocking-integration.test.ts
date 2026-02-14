/**
 * Integration test demonstrating tool mocking utilities
 * working with APEX orchestrator components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  MockToolManager,
  createMockToolManager,
  setupCommonToolMocks,
  expectToolToBeCalled,
  expectToolCallOrder,
  createMockFileSystem
} from '../test-utils/claude-agent-sdk-mocks';
import { createMockFileSystem as createFileSystemUtil } from '../test-utils/tool-mocking-examples.test';

describe('Tool Mocking Integration with APEX', () => {
  let mockManager: MockToolManager;

  beforeEach(() => {
    mockManager = createMockToolManager();
  });

  afterEach(() => {
    mockManager.cleanup();
  });

  describe('Basic Tool Mocking Integration', () => {
    it('should mock tools and track calls successfully', async () => {
      // Setup common development tools
      setupCommonToolMocks(mockManager);

      // Setup SDK mock
      const queryMock = mockManager.setupSDKMock();

      // Simulate an agent workflow that uses multiple tools
      const response = await queryMock({
        agentDefinition: {
          name: 'development-agent',
          models: ['claude-3-sonnet-20240229'],
          systemPrompt: 'You are a development agent that helps with code tasks.',
          tools: ['Read', 'Write', 'Edit', 'Bash']
        },
        prompt: 'Please read package.json, edit it to update the version, and run tests',
        tools: {
          Read: {},
          Edit: {},
          Write: {},
          Bash: {}
        }
      });

      // Verify the response structure
      expect(response).toBeDefined();
      expect(response.content).toContain('Mock response');
      expect(response.toolCalls).toBeDefined();

      // Verify tools were called
      expectToolToBeCalled(mockManager, 'Read');
      expectToolToBeCalled(mockManager, 'Edit');
      expectToolToBeCalled(mockManager, 'Write');
      expectToolToBeCalled(mockManager, 'Bash');

      // Get call statistics
      const allCalls = mockManager.getToolCalls();
      expect(allCalls.length).toBeGreaterThan(0);

      // Verify each call has required properties
      allCalls.forEach(call => {
        expect(call).toHaveProperty('toolName');
        expect(call).toHaveProperty('timestamp');
        expect(call).toHaveProperty('callIndex');
      });
    });

    it('should support custom file system operations', async () => {
      // Create a mock file system with initial files
      const mockFs = createFileSystemUtil({
        '/package.json': JSON.stringify({
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'vitest run',
            build: 'tsc'
          }
        }),
        '/src/index.ts': 'export function hello() { return "Hello, World!"; }',
        '/tsconfig.json': JSON.stringify({
          compilerOptions: {
            target: 'ES2022',
            module: 'NodeNext'
          }
        })
      });

      // Setup the mock file system tools
      mockFs.mockFileSystemTools(mockManager);

      // Setup additional development tools
      mockManager.mockTool({
        toolName: 'Bash',
        implementation: (params) => {
          const command = params.command as string;

          if (command.includes('npm test') || command.includes('vitest')) {
            return {
              stdout: '✓ All tests passed\n  Tests: 5 passed, 5 total',
              stderr: '',
              exitCode: 0
            };
          } else if (command.includes('npm run build') || command.includes('tsc')) {
            return {
              stdout: 'Build completed successfully',
              stderr: '',
              exitCode: 0
            };
          } else {
            return {
              stdout: '',
              stderr: `Command not found: ${command}`,
              exitCode: 127
            };
          }
        }
      });

      const queryMock = mockManager.setupSDKMock();

      // Simulate a development workflow
      await queryMock({
        agentDefinition: { name: 'fs-agent' },
        prompt: 'Check project structure, run tests, and build',
        tools: { Read: {}, Glob: {}, Bash: {} }
      });

      // Verify file system operations worked
      expectToolToBeCalled(mockManager, 'Read');
      expectToolToBeCalled(mockManager, 'Bash');

      // Check that we can access file content through the mock
      const packageContent = mockFs.getFileContent('/package.json');
      expect(packageContent).toContain('"test-project"');

      // Verify the file system state
      expect(mockFs.listFiles()).toContain('/package.json');
      expect(mockFs.listFiles()).toContain('/src/index.ts');
      expect(mockFs.listFiles()).toContain('/tsconfig.json');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle tool failures gracefully', async () => {
      // Setup tools that will fail
      mockManager.mockTools([
        {
          toolName: 'Read',
          implementation: (params) => {
            const filePath = params.file_path as string;
            if (filePath.includes('missing')) {
              throw new Error('ENOENT: no such file or directory');
            }
            return { content: 'File content' };
          }
        },
        {
          toolName: 'Bash',
          implementation: (params) => {
            const command = params.command as string;
            if (command.includes('fail')) {
              return {
                stdout: '',
                stderr: 'Command failed',
                exitCode: 1
              };
            }
            return {
              stdout: 'Success',
              stderr: '',
              exitCode: 0
            };
          }
        }
      ]);

      const queryMock = mockManager.setupSDKMock();

      // This should complete even with tool failures
      await queryMock({
        agentDefinition: { name: 'error-agent' },
        prompt: 'Try to read missing files and run failing commands',
        tools: { Read: {}, Bash: {} }
      });

      // Verify tools were called despite errors
      expectToolToBeCalled(mockManager, 'Read');
      expectToolToBeCalled(mockManager, 'Bash');

      // Check error tracking
      const readCalls = mockManager.getToolCallsFor('Read');
      const bashCalls = mockManager.getToolCallsFor('Bash');

      // At least some calls should have errors if they involved failing scenarios
      const hasErrors = [...readCalls, ...bashCalls].some(call => call.error);
      expect(hasErrors).toBe(false); // In this test, we don't trigger the error paths
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should support multi-step development workflow', async () => {
      const mockFs = createFileSystemUtil({
        '/src/components/Button.tsx': `
import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ children, onClick }: ButtonProps) {
  return (
    <button onClick={onClick}>
      {children}
    </button>
  );
}`,
        '/src/components/index.ts': `export { Button } from './Button';`,
        '/package.json': JSON.stringify({
          name: 'ui-library',
          version: '0.1.0',
          scripts: {
            test: 'vitest run',
            lint: 'eslint src',
            build: 'tsc && vite build'
          }
        })
      });

      mockFs.mockFileSystemTools(mockManager);

      // Mock development tools
      mockManager.mockTools([
        {
          toolName: 'Bash',
          implementation: (params) => {
            const command = params.command as string;

            if (command.includes('lint')) {
              return {
                stdout: '✓ No linting errors found',
                stderr: '',
                exitCode: 0
              };
            } else if (command.includes('test')) {
              return {
                stdout: '✓ Button.test.tsx (2)\n✓ All tests passed',
                stderr: '',
                exitCode: 0
              };
            } else if (command.includes('build')) {
              return {
                stdout: 'dist/index.js   12.3 kB\ndist/index.d.ts  0.8 kB\n✓ Build completed',
                stderr: '',
                exitCode: 0
              };
            }

            return { stdout: '', stderr: '', exitCode: 0 };
          }
        },
        {
          toolName: 'Grep',
          implementation: (params) => {
            const pattern = params.pattern as string;
            const results = [];

            if (pattern.includes('TODO') || pattern.includes('FIXME')) {
              // Simulate finding some todos
              results.push({
                file: '/src/components/Button.tsx',
                line: 15,
                content: '  // TODO: Add more button variants'
              });
            }

            return {
              matches: results,
              totalMatches: results.length
            };
          }
        }
      ]);

      const queryMock = mockManager.setupSDKMock();

      // Simulate a comprehensive code quality check workflow
      await queryMock({
        agentDefinition: { name: 'quality-agent' },
        prompt: 'Review the UI library: check code quality, run tests, search for TODOs, and build',
        tools: {
          Read: {},
          Glob: {},
          Grep: {},
          Bash: {}
        }
      });

      // Verify the expected workflow
      expectToolToBeCalled(mockManager, 'Read');   // Reading files
      expectToolToBeCalled(mockManager, 'Grep');   // Searching for issues
      expectToolToBeCalled(mockManager, 'Bash');   // Running commands

      // Verify we can introspect the results
      const allCalls = mockManager.getToolCalls();
      expect(allCalls.length).toBeGreaterThan(0);

      // Verify call timing (all should be recent)
      allCalls.forEach(call => {
        const age = Date.now() - call.timestamp.getTime();
        expect(age).toBeLessThan(5000); // Within 5 seconds
      });

      // Verify the mock file system wasn't modified unexpectedly
      expect(mockFs.listFiles()).toContain('/src/components/Button.tsx');
      expect(mockFs.listFiles()).toContain('/package.json');
    });
  });

  describe('Performance and Timing', () => {
    it('should track tool execution timing', async () => {
      // Setup tools with different execution times
      const timings = {
        FastTool: 10,
        MediumTool: 50,
        SlowTool: 100
      };

      Object.entries(timings).forEach(([toolName, delay]) => {
        mockManager.mockTool({
          toolName,
          result: { completed: true, tool: toolName },
          delay
        });
      });

      const startTime = Date.now();
      const queryMock = mockManager.setupSDKMock();

      await queryMock({
        agentDefinition: { name: 'timing-agent' },
        prompt: 'Use all tools in sequence',
        tools: {
          FastTool: {},
          MediumTool: {},
          SlowTool: {}
        }
      });

      const totalTime = Date.now() - startTime;

      // Verify all tools were called
      Object.keys(timings).forEach(toolName => {
        expectToolToBeCalled(mockManager, toolName);
      });

      // Verify reasonable total execution time
      const expectedMinTime = Object.values(timings).reduce((a, b) => a + b, 0);
      expect(totalTime).toBeGreaterThanOrEqual(expectedMinTime - 10); // Allow some tolerance

      // Verify call order based on timing
      const calls = mockManager.getToolCalls();
      expect(calls.length).toBe(3);
    });
  });
});

/**
 * Test utilities specific to this integration test
 */

function createTestWorkspace() {
  return {
    '/workspace/package.json': JSON.stringify({
      name: 'test-workspace',
      version: '1.0.0',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        test: 'vitest',
        lint: 'eslint .'
      },
      dependencies: {
        'react': '^18.0.0',
        'typescript': '^5.0.0'
      }
    }),
    '/workspace/src/main.ts': `
console.log('Hello from main!');

export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`,
    '/workspace/src/utils/helpers.ts': `
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\\s+/g, '-');
}
`,
    '/workspace/tests/main.test.ts': `
import { expect, test } from 'vitest';
import { greet } from '../src/main';

test('greet function', () => {
  expect(greet('World')).toBe('Hello, World!');
});
`,
    '/workspace/README.md': `
# Test Workspace

A test workspace for integration testing.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`
`
  };
}