import {
  ApexConfigSchema,
  PolicySchema,
  PolicyRuleSchema,
  PathPolicySchema,
  TestPolicySchema,
  ApprovalPolicySchema,
  PolicySeveritySchema,
  PolicyEnforcementModeSchema,
  type ApexConfig,
  type Policy,
} from '../types.js';
import { getEffectiveConfig } from '../config.js';

describe('Policies Configuration', () => {
  describe('PolicySchema validation', () => {
    it('parses valid minimal policy', () => {
      const policy = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            type: 'path' as const,
            config: {
              mode: 'allowlist' as const,
              allow: ['src/**'],
              block: [],
              sensitivePatterns: [],
              followSymlinks: false,
              maxDepth: 10,
            }
          }
        ]
      };

      const result = PolicySchema.parse(policy);
      expect(result.id).toBe('test-policy');
      expect(result.name).toBe('Test Policy');
      expect(result.rules).toHaveLength(1);
      expect(result.enabled).toBe(true); // default value
      expect(result.enforcement).toBe('warn'); // default value
    });

    it('parses valid complete policy', () => {
      const policy: Policy = {
        id: 'comprehensive-policy',
        name: 'Comprehensive Policy',
        description: 'A comprehensive test policy',
        rules: [
          {
            id: 'path-rule',
            name: 'Path Rule',
            type: 'path',
            config: {
              mode: 'allowlist',
              allow: ['src/**', 'tests/**'],
              block: ['node_modules/**'],
              sensitivePatterns: ['.env*'],
              followSymlinks: false,
              maxDepth: 10,
            }
          },
          {
            id: 'test-rule',
            name: 'Test Rule',
            type: 'test',
            config: {
              enforcement: 'warn',
              rules: [
                {
                  name: 'typescript-tests',
                  sourcePatterns: ['src/**/*.ts'],
                  testPatterns: ['**/*.test.ts'],
                  minCoverage: 80,
                }
              ],
              excludePatterns: ['**/*.d.ts'],
              blockOnFailure: true,
            }
          },
          {
            id: 'approval-rule',
            name: 'Approval Rule',
            type: 'approval',
            config: {
              enabled: true,
              rules: [
                {
                  id: 'sensitive-files',
                  name: 'sensitive-files',
                  conditions: [
                    {
                      type: 'file-pattern',
                      patterns: ['**/*.secret']
                    }
                  ]
                }
              ],
              defaultTimeoutMinutes: 60,
              defaultTimeoutAction: 'reject',
              globalApprovers: [],
              notificationsEnabled: true,
              auditLog: true,
              auditLogPath: 'approval-audit.log',
            }
          }
        ],
        severityLevels: {
          default: 'warn',
          overrides: {
            'path': 'error',
            'test': 'warn'
          }
        },
        enabled: true,
        enforcement: 'strict',
        version: '1.0',
        tags: ['test', 'comprehensive'],
        metadata: {
          owner: 'test-team',
          description: 'Test policy metadata'
        }
      };

      const result = PolicySchema.parse(policy);
      expect(result).toEqual(policy);
    });

    it('validates required fields', () => {
      expect(() => PolicySchema.parse({})).toThrow();
      expect(() => PolicySchema.parse({ id: 'test' })).toThrow();
      expect(() => PolicySchema.parse({
        id: 'test',
        name: 'Test',
        rules: []
      })).toThrow(); // rules array cannot be empty
    });

    it('validates policy rule types', () => {
      const basePolicy = {
        id: 'test-policy',
        name: 'Test Policy',
        rules: []
      };

      // Test path policy
      const pathPolicy = {
        ...basePolicy,
        rules: [
          {
            id: 'path-rule',
            name: 'Path Rule',
            type: 'path' as const,
            config: {
              mode: 'allowlist' as const,
              allow: ['src/**'],
              block: [],
              sensitivePatterns: [],
              followSymlinks: false,
              maxDepth: 10,
            }
          }
        ]
      };

      expect(() => PolicySchema.parse(pathPolicy)).not.toThrow();

      // Test invalid rule type
      expect(() => PolicySchema.parse({
        ...basePolicy,
        rules: [
          {
            id: 'invalid-rule',
            name: 'Invalid Rule',
            type: 'invalid',
            config: {}
          }
        ]
      })).toThrow();
    });
  });

  describe('ApexConfigSchema with policies field', () => {
    it('parses config without policies field (defaults to empty array)', () => {
      const config = {
        version: '1.0',
        project: {
          name: 'Test Project'
        }
      };

      const result = ApexConfigSchema.parse(config);
      expect(result.policies).toEqual([]); // default value
    });

    it('parses config with empty policies array', () => {
      const config = {
        version: '1.0',
        project: {
          name: 'Test Project'
        },
        policies: []
      };

      const result = ApexConfigSchema.parse(config);
      expect(result.policies).toEqual([]);
    });

    it('parses config with valid policies', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'Test Project'
        },
        policies: [
          {
            id: 'dev-policy',
            name: 'Development Policy',
            description: 'Policy for development environment',
            rules: [
              {
                id: 'path-rule',
                name: 'Path Access Rule',
                type: 'path',
                config: {
                  mode: 'allowlist',
                  allow: ['src/**', 'tests/**', '*.md'],
                  block: ['node_modules/**', '.git/**'],
                  sensitivePatterns: ['.env*', '**/*.key'],
                  followSymlinks: false,
                  maxDepth: 10,
                }
              }
            ],
            enabled: true,
            enforcement: 'warn',
            version: '1.0',
            tags: ['development']
          },
          {
            id: 'test-policy',
            name: 'Testing Policy',
            rules: [
              {
                id: 'test-rule',
                name: 'Test Requirements',
                type: 'test',
                config: {
                  enforcement: 'require',
                  rules: [
                    {
                      name: 'typescript-tests',
                      sourcePatterns: ['src/**/*.ts'],
                      testPatterns: ['**/*.test.ts'],
                      minCoverage: 80,
                    }
                  ],
                  excludePatterns: ['**/*.d.ts'],
                  blockOnFailure: true,
                }
              }
            ],
            enabled: true,
            enforcement: 'strict'
          }
        ]
      };

      const result = ApexConfigSchema.parse(config);
      expect(result.policies).toHaveLength(2);
      expect(result.policies![0].id).toBe('dev-policy');
      expect(result.policies![1].id).toBe('test-policy');
    });

    it('validates nested policy schemas within config', () => {
      const configWithInvalidPolicy = {
        version: '1.0',
        project: {
          name: 'Test Project'
        },
        policies: [
          {
            id: 'invalid-policy',
            // missing required 'name' field
            rules: [
              {
                id: 'test-rule',
                name: 'Test Rule',
                type: 'invalid-type', // invalid type
                config: {}
              }
            ]
          }
        ]
      };

      expect(() => ApexConfigSchema.parse(configWithInvalidPolicy)).toThrow();
    });
  });

  describe('getEffectiveConfig with policies', () => {
    it('returns policies from config when provided', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'Test Project'
        },
        policies: [
          {
            id: 'test-policy',
            name: 'Test Policy',
            rules: [
              {
                id: 'path-rule',
                name: 'Path Rule',
                type: 'path',
                config: {
                  mode: 'allowlist',
                  allow: ['src/**'],
                  block: [],
                  sensitivePatterns: [],
                  followSymlinks: false,
                  maxDepth: 10,
                }
              }
            ]
          }
        ]
      };

      const effectiveConfig = getEffectiveConfig(config);
      expect(effectiveConfig.policies).toHaveLength(1);
      expect(effectiveConfig.policies[0].id).toBe('test-policy');
    });

    it('returns empty array when policies not provided', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'Test Project'
        }
      };

      const effectiveConfig = getEffectiveConfig(config);
      expect(effectiveConfig.policies).toEqual([]);
    });

    it('preserves all policy properties in effective config', () => {
      const policy: Policy = {
        id: 'comprehensive-policy',
        name: 'Comprehensive Policy',
        description: 'A comprehensive test policy',
        rules: [
          {
            id: 'path-rule',
            name: 'Path Rule',
            type: 'path',
            config: {
              mode: 'allowlist',
              allow: ['src/**'],
              block: ['node_modules/**'],
              sensitivePatterns: ['.env*'],
              followSymlinks: false,
              maxDepth: 10,
            }
          }
        ],
        severityLevels: {
          default: 'warn',
          overrides: {
            'path': 'error'
          }
        },
        enabled: true,
        enforcement: 'strict',
        version: '1.0',
        tags: ['test'],
        metadata: {
          owner: 'test-team'
        }
      };

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'Test Project'
        },
        policies: [policy]
      };

      const effectiveConfig = getEffectiveConfig(config);
      expect(effectiveConfig.policies[0]).toEqual(policy);
    });
  });

  describe('Policy schema type safety', () => {
    it('ensures policies field is properly typed in ApexConfig', () => {
      // TypeScript compile-time test
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'Test Project'
        },
        policies: undefined // should be allowed since it's optional
      };

      expect(config.policies).toBeUndefined();

      // Test with policies array
      const configWithPolicies: ApexConfig = {
        version: '1.0',
        project: {
          name: 'Test Project'
        },
        policies: [
          {
            id: 'test',
            name: 'Test Policy',
            rules: [
              {
                id: 'test-rule',
                name: 'Test Rule',
                type: 'path',
                config: {
                  mode: 'allowlist',
                  allow: [],
                  block: [],
                  sensitivePatterns: [],
                  followSymlinks: false,
                  maxDepth: 10,
                }
              }
            ]
          }
        ]
      };

      expect(configWithPolicies.policies).toHaveLength(1);
    });
  });

  describe('Integration with ConfigLoader', () => {
    it('parses policies from YAML-like structure', () => {
      // Simulate what would come from a YAML file
      const yamlLikeConfig = {
        version: '1.0',
        project: {
          name: 'YAML Test Project'
        },
        policies: [
          {
            id: 'yaml-policy',
            name: 'YAML Policy',
            description: 'Policy loaded from YAML',
            rules: [
              {
                id: 'yaml-path-rule',
                name: 'YAML Path Rule',
                type: 'path',
                config: {
                  mode: 'allowlist',
                  allow: [
                    'src/**/*.ts',
                    'src/**/*.tsx',
                    'tests/**/*.test.ts',
                    '*.md',
                    'package.json'
                  ],
                  block: [
                    'node_modules/**',
                    'dist/**',
                    '.git/**'
                  ],
                  sensitivePatterns: [
                    '.env*',
                    '**/*.key',
                    '**/*.secret'
                  ],
                  followSymlinks: false,
                  maxDepth: 15
                }
              },
              {
                id: 'yaml-test-rule',
                name: 'YAML Test Rule',
                type: 'test',
                config: {
                  enforcement: 'warn',
                  rules: [
                    {
                      name: 'component-tests',
                      description: 'All components need tests',
                      sourcePatterns: ['src/components/**/*.tsx'],
                      testPatterns: ['src/components/**/*.test.tsx'],
                      minCoverage: 85
                    }
                  ],
                  testCommand: 'npm test',
                  excludePatterns: ['**/*.d.ts', '**/index.ts'],
                  blockOnFailure: true
                }
              }
            ],
            enabled: true,
            enforcement: 'warn',
            version: '1.0',
            tags: ['yaml', 'integration'],
            metadata: {
              source: 'yaml-config',
              lastModified: '2024-01-01'
            }
          }
        ]
      };

      const result = ApexConfigSchema.parse(yamlLikeConfig);
      expect(result.policies).toHaveLength(1);
      expect(result.policies![0].id).toBe('yaml-policy');
      expect(result.policies![0].rules).toHaveLength(2);
      expect(result.policies![0].rules[0].type).toBe('path');
      expect(result.policies![0].rules[1].type).toBe('test');
    });
  });
});