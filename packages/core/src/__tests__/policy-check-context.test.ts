import { describe, it, expect } from 'vitest';
import {
  PolicyCheckContext,
  PolicyCheckContextSchema,
  type PolicyCheckContext as PolicyCheckContextType,
} from '../types';

describe('PolicyCheckContext Schema and Type', () => {
  describe('PolicyCheckContextSchema', () => {
    it('should accept minimal valid context with only action', () => {
      const context: PolicyCheckContextType = {
        action: 'file_read'
      };

      expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();

      const parsed = PolicyCheckContextSchema.parse(context);
      expect(parsed.action).toBe('file_read');
      expect(parsed.resource).toBeUndefined();
      expect(parsed.agentId).toBeUndefined();
      expect(parsed.taskId).toBeUndefined();
    });

    it('should accept complete context with all optional fields', () => {
      const context: PolicyCheckContextType = {
        action: 'command_execute',
        resource: '/bin/bash',
        agentId: 'agent-123',
        taskId: 'task-456',
        stage: 'implementation',
        toolName: 'Bash',
        toolArguments: {
          command: 'npm test',
          timeout: 5000,
          cwd: '/project/root'
        },
        filePaths: [
          '/project/src/index.ts',
          '/project/tests/index.test.ts'
        ],
        content: 'console.log("Hello, world!");',
        userId: 'user-789',
        metadata: {
          requestId: 'req-abc123',
          sessionId: 'session-xyz789',
          timestamp: new Date().toISOString(),
          userAgent: 'Claude/1.0'
        }
      };

      expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();

      const parsed = PolicyCheckContextSchema.parse(context);
      expect(parsed.action).toBe('command_execute');
      expect(parsed.resource).toBe('/bin/bash');
      expect(parsed.agentId).toBe('agent-123');
      expect(parsed.taskId).toBe('task-456');
      expect(parsed.stage).toBe('implementation');
      expect(parsed.toolName).toBe('Bash');
      expect(parsed.toolArguments).toBeDefined();
      expect(parsed.filePaths).toHaveLength(2);
      expect(parsed.content).toBe('console.log("Hello, world!");');
      expect(parsed.userId).toBe('user-789');
      expect(parsed.metadata).toBeDefined();
    });

    describe('Action Field Validation', () => {
      it('should accept various action types', () => {
        const actions = [
          'file_read',
          'file_write',
          'file_delete',
          'command_execute',
          'api_call',
          'network_request',
          'database_query',
          'custom_action'
        ];

        actions.forEach(action => {
          const context: PolicyCheckContextType = { action };

          expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
          const parsed = PolicyCheckContextSchema.parse(context);
          expect(parsed.action).toBe(action);
        });
      });

      it('should reject empty action string', () => {
        expect(() => PolicyCheckContextSchema.parse({
          action: ''
        })).toThrow();
      });

      it('should reject non-string action values', () => {
        expect(() => PolicyCheckContextSchema.parse({
          action: 123
        })).toThrow();

        expect(() => PolicyCheckContextSchema.parse({
          action: null
        })).toThrow();

        expect(() => PolicyCheckContextSchema.parse({
          action: undefined
        })).toThrow();
      });
    });

    describe('Optional Fields Validation', () => {
      it('should handle optional string fields', () => {
        const stringFields = ['resource', 'agentId', 'taskId', 'stage', 'toolName', 'content', 'userId'];

        stringFields.forEach(field => {
          const context: PolicyCheckContextType = {
            action: 'test_action',
            [field]: 'test_value'
          };

          expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
          const parsed = PolicyCheckContextSchema.parse(context);
          expect(parsed[field as keyof PolicyCheckContextType]).toBe('test_value');
        });
      });

      it('should handle empty strings in optional fields', () => {
        const context: PolicyCheckContextType = {
          action: 'test_action',
          resource: '',
          agentId: '',
          taskId: '',
          stage: '',
          toolName: '',
          content: '',
          userId: ''
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.resource).toBe('');
      });

      it('should handle very long strings', () => {
        const longString = 'A'.repeat(10000);

        const context: PolicyCheckContextType = {
          action: 'test_action',
          resource: longString,
          content: longString
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.resource).toHaveLength(10000);
        expect(parsed.content).toHaveLength(10000);
      });
    });

    describe('File Paths Array Validation', () => {
      it('should accept empty file paths array', () => {
        const context: PolicyCheckContextType = {
          action: 'test_action',
          filePaths: []
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.filePaths).toEqual([]);
      });

      it('should accept single file path', () => {
        const context: PolicyCheckContextType = {
          action: 'file_read',
          filePaths: ['/path/to/file.ts']
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.filePaths).toEqual(['/path/to/file.ts']);
      });

      it('should accept multiple file paths', () => {
        const filePaths = [
          '/src/components/Button.tsx',
          '/src/components/Input.tsx',
          '/src/utils/helpers.ts',
          '/tests/components/Button.test.tsx'
        ];

        const context: PolicyCheckContextType = {
          action: 'file_write',
          filePaths
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.filePaths).toEqual(filePaths);
        expect(parsed.filePaths).toHaveLength(4);
      });

      it('should handle paths with special characters', () => {
        const specialPaths = [
          '/path/with spaces/file.ts',
          '/path/with-dashes/file.ts',
          '/path/with_underscores/file.ts',
          '/path/with.dots/file.ts',
          '/path/with(parentheses)/file.ts',
          '/path/with[brackets]/file.ts',
          '/path/with{braces}/file.ts',
          '/path/with@symbols#/file.ts',
          '/path/with$dollar%/file.ts'
        ];

        const context: PolicyCheckContextType = {
          action: 'file_access',
          filePaths: specialPaths
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.filePaths).toEqual(specialPaths);
      });

      it('should reject non-string elements in file paths array', () => {
        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          filePaths: [123, 'valid_path']
        })).toThrow();

        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          filePaths: ['valid_path', null]
        })).toThrow();

        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          filePaths: ['valid_path', undefined]
        })).toThrow();
      });

      it('should reject non-array file paths', () => {
        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          filePaths: 'not_an_array'
        })).toThrow();

        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          filePaths: { path: '/some/path' }
        })).toThrow();
      });
    });

    describe('Tool Arguments Validation', () => {
      it('should accept empty tool arguments object', () => {
        const context: PolicyCheckContextType = {
          action: 'tool_execute',
          toolArguments: {}
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.toolArguments).toEqual({});
      });

      it('should accept simple tool arguments', () => {
        const toolArguments = {
          command: 'npm test',
          timeout: 5000,
          verbose: true,
          env: 'development'
        };

        const context: PolicyCheckContextType = {
          action: 'command_execute',
          toolArguments
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.toolArguments).toEqual(toolArguments);
      });

      it('should accept complex nested tool arguments', () => {
        const toolArguments = {
          config: {
            database: {
              host: 'localhost',
              port: 5432,
              ssl: false
            },
            cache: {
              enabled: true,
              ttl: 300,
              providers: ['redis', 'memory']
            }
          },
          options: ['--verbose', '--no-cache'],
          metadata: {
            version: '1.0.0',
            build: new Date().toISOString()
          }
        };

        const context: PolicyCheckContextType = {
          action: 'api_call',
          toolArguments
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.toolArguments).toEqual(toolArguments);
      });

      it('should handle tool arguments with null values', () => {
        const toolArguments = {
          command: 'test',
          timeout: null,
          output: null
        };

        const context: PolicyCheckContextType = {
          action: 'tool_execute',
          toolArguments
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.toolArguments).toEqual(toolArguments);
      });

      it('should reject non-object tool arguments', () => {
        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          toolArguments: 'not_an_object'
        })).toThrow();

        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          toolArguments: 123
        })).toThrow();

        expect(() => PolicyCheckContextSchema.parse({
          action: 'test_action',
          toolArguments: ['array']
        })).toThrow();
      });
    });

    describe('Metadata Validation', () => {
      it('should accept empty metadata object', () => {
        const context: PolicyCheckContextType = {
          action: 'test_action',
          metadata: {}
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.metadata).toEqual({});
      });

      it('should accept simple metadata', () => {
        const metadata = {
          requestId: 'req-123',
          userId: 'user-456',
          version: '1.0.0'
        };

        const context: PolicyCheckContextType = {
          action: 'test_action',
          metadata
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.metadata).toEqual(metadata);
      });

      it('should accept complex nested metadata', () => {
        const metadata = {
          request: {
            id: 'req-123',
            timestamp: new Date().toISOString(),
            headers: {
              'content-type': 'application/json',
              'authorization': 'Bearer token'
            }
          },
          user: {
            id: 'user-456',
            roles: ['admin', 'developer'],
            permissions: ['read', 'write', 'execute']
          },
          system: {
            version: '1.0.0',
            environment: 'production',
            region: 'us-east-1',
            instanceId: 'i-0123456789abcdef0'
          }
        };

        const context: PolicyCheckContextType = {
          action: 'api_call',
          metadata
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.metadata).toEqual(metadata);
      });

      it('should handle metadata with various data types', () => {
        const metadata = {
          stringValue: 'test',
          numberValue: 42,
          booleanValue: true,
          nullValue: null,
          arrayValue: [1, 2, 3, 'four'],
          objectValue: { nested: true },
          dateString: new Date().toISOString()
        };

        const context: PolicyCheckContextType = {
          action: 'test_action',
          metadata
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.metadata).toEqual(metadata);
      });
    });

    describe('Real-world Usage Scenarios', () => {
      it('should handle file writing context', () => {
        const context: PolicyCheckContextType = {
          action: 'file_write',
          resource: '/project/src/components/NewComponent.tsx',
          agentId: 'developer-agent',
          taskId: 'task-implement-component',
          stage: 'implementation',
          toolName: 'Write',
          toolArguments: {
            file_path: '/project/src/components/NewComponent.tsx',
            content: 'export const NewComponent = () => <div>Hello</div>;'
          },
          filePaths: ['/project/src/components/NewComponent.tsx'],
          content: 'export const NewComponent = () => <div>Hello</div>;',
          userId: 'developer-user',
          metadata: {
            requestId: 'req-write-component',
            fileName: 'NewComponent.tsx',
            fileSize: 256,
            encoding: 'utf-8'
          }
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.action).toBe('file_write');
        expect(parsed.toolName).toBe('Write');
      });

      it('should handle command execution context', () => {
        const context: PolicyCheckContextType = {
          action: 'command_execute',
          resource: 'npm',
          agentId: 'tester-agent',
          taskId: 'task-run-tests',
          stage: 'testing',
          toolName: 'Bash',
          toolArguments: {
            command: 'npm run test:coverage',
            timeout: 30000,
            cwd: '/project'
          },
          filePaths: [],
          userId: 'ci-user',
          metadata: {
            requestId: 'req-test-execution',
            environment: 'ci',
            branch: 'feature/new-component',
            commitHash: 'abc123def456'
          }
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.action).toBe('command_execute');
        expect(parsed.stage).toBe('testing');
      });

      it('should handle API call context', () => {
        const context: PolicyCheckContextType = {
          action: 'api_call',
          resource: 'https://api.github.com/repos/owner/repo',
          agentId: 'github-agent',
          taskId: 'task-create-pr',
          stage: 'deployment',
          toolName: 'WebFetch',
          toolArguments: {
            url: 'https://api.github.com/repos/owner/repo/pulls',
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ***',
              'Content-Type': 'application/json'
            },
            body: '{"title":"New Feature","base":"main"}'
          },
          userId: 'deployment-user',
          metadata: {
            requestId: 'req-github-pr',
            apiVersion: 'v3',
            rateLimitRemaining: 4999,
            repository: 'owner/repo'
          }
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.action).toBe('api_call');
        expect(parsed.resource).toContain('github.com');
      });
    });

    describe('Edge Cases and Error Handling', () => {
      it('should reject completely empty object', () => {
        expect(() => PolicyCheckContextSchema.parse({})).toThrow();
      });

      it('should reject missing action field', () => {
        expect(() => PolicyCheckContextSchema.parse({
          resource: '/some/path',
          agentId: 'agent-123'
        })).toThrow();
      });

      it('should handle Unicode characters in string fields', () => {
        const context: PolicyCheckContextType = {
          action: '文件操作',
          resource: '/路径/文件.txt',
          content: 'console.log("你好世界"); // 🌍',
          metadata: {
            用户名: '开发者',
            emoji: '🚀🎉💻'
          }
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.action).toBe('文件操作');
        expect(parsed.content).toContain('你好世界');
      });

      it('should handle extremely large arrays and objects', () => {
        const largeFilePaths = Array.from({ length: 1000 }, (_, i) => `/path/to/file${i}.ts`);
        const largeMetadata: Record<string, unknown> = {};
        for (let i = 0; i < 1000; i++) {
          largeMetadata[`key${i}`] = `value${i}`;
        }

        const context: PolicyCheckContextType = {
          action: 'bulk_operation',
          filePaths: largeFilePaths,
          metadata: largeMetadata
        };

        expect(() => PolicyCheckContextSchema.parse(context)).not.toThrow();
        const parsed = PolicyCheckContextSchema.parse(context);
        expect(parsed.filePaths).toHaveLength(1000);
        expect(Object.keys(parsed.metadata || {})).toHaveLength(1000);
      });
    });
  });
});