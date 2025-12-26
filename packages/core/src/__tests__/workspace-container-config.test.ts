import { describe, it, expect } from 'vitest';
import { ApexConfigSchema } from '../types';

describe('Workspace Container Configuration', () => {
  describe('ApexConfigSchema with workspace.container.resourceLimits', () => {
    it('should parse config with complete workspace.container.resourceLimits', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2.0,
              memory: '1g',
              memoryReservation: '512m',
              memorySwap: '2g',
              cpuShares: 1024,
              pidsLimit: 100
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'development'
            },
            autoRemove: true,
            installTimeout: 30000
          }
        }
      });

      expect(config.workspace?.defaultStrategy).toBe('container');
      expect(config.workspace?.container?.image).toBe('node:20-alpine');
      expect(config.workspace?.container?.resourceLimits?.cpu).toBe(2.0);
      expect(config.workspace?.container?.resourceLimits?.memory).toBe('1g');
      expect(config.workspace?.container?.resourceLimits?.memoryReservation).toBe('512m');
      expect(config.workspace?.container?.resourceLimits?.memorySwap).toBe('2g');
      expect(config.workspace?.container?.resourceLimits?.cpuShares).toBe(1024);
      expect(config.workspace?.container?.resourceLimits?.pidsLimit).toBe(100);
      expect(config.workspace?.container?.networkMode).toBe('bridge');
      expect(config.workspace?.container?.environment?.NODE_ENV).toBe('development');
    });

    it('should parse config with partial workspace.container.resourceLimits', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {
          container: {
            image: 'python:3.11-slim',
            resourceLimits: {
              cpu: 1.5,
              memory: '512m'
            }
          }
        }
      });

      expect(config.workspace?.defaultStrategy).toBe('none'); // default
      expect(config.workspace?.cleanupOnComplete).toBe(true); // default
      expect(config.workspace?.container?.image).toBe('python:3.11-slim');
      expect(config.workspace?.container?.resourceLimits?.cpu).toBe(1.5);
      expect(config.workspace?.container?.resourceLimits?.memory).toBe('512m');
      expect(config.workspace?.container?.resourceLimits?.memoryReservation).toBeUndefined();
      expect(config.workspace?.container?.autoRemove).toBe(true); // default
    });

    it('should parse config without workspace section', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' }
      });

      expect(config.workspace).toBeUndefined();
    });

    it('should apply workspace defaults when workspace is empty object', () => {
      const config = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {}
      });

      expect(config.workspace?.defaultStrategy).toBe('none');
      expect(config.workspace?.cleanupOnComplete).toBe(true);
      expect(config.workspace?.container).toBeUndefined();
    });

    it('should validate cpu limits within constraints', () => {
      // Valid CPU values
      const validConfig = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 0.5 // Minimum allowed
            }
          }
        }
      });
      expect(validConfig.workspace?.container?.resourceLimits?.cpu).toBe(0.5);

      const validConfigMax = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {
          container: {
            resourceLimits: {
              cpu: 64 // Maximum allowed
            }
          }
        }
      });
      expect(validConfigMax.workspace?.container?.resourceLimits?.cpu).toBe(64);

      // Invalid CPU values should throw
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              resourceLimits: {
                cpu: 0.05 // Below minimum
              }
            }
          }
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              resourceLimits: {
                cpu: 128 // Above maximum
              }
            }
          }
        });
      }).toThrow();
    });

    it('should validate memory format with regex', () => {
      const validMemoryFormats = ['256m', '1g', '2G', '512M', '1024K', '2048k'];

      for (const memory of validMemoryFormats) {
        const config = ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              resourceLimits: {
                memory
              }
            }
          }
        });
        expect(config.workspace?.container?.resourceLimits?.memory).toBe(memory);
      }

      // Invalid memory formats should throw
      const invalidMemoryFormats = ['256', '1gb', '2tb', 'invalid', '1.5g'];

      for (const memory of invalidMemoryFormats) {
        expect(() => {
          ApexConfigSchema.parse({
            project: { name: 'test-project' },
            workspace: {
              container: {
                resourceLimits: {
                  memory
                }
              }
            }
          });
        }).toThrow();
      }
    });

    it('should validate cpuShares within constraints', () => {
      // Valid cpuShares values
      const validConfigMin = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {
          container: {
            resourceLimits: {
              cpuShares: 2 // Minimum allowed
            }
          }
        }
      });
      expect(validConfigMin.workspace?.container?.resourceLimits?.cpuShares).toBe(2);

      const validConfigMax = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {
          container: {
            resourceLimits: {
              cpuShares: 262144 // Maximum allowed
            }
          }
        }
      });
      expect(validConfigMax.workspace?.container?.resourceLimits?.cpuShares).toBe(262144);

      // Invalid cpuShares values should throw
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              resourceLimits: {
                cpuShares: 1 // Below minimum
              }
            }
          }
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              resourceLimits: {
                cpuShares: 500000 // Above maximum
              }
            }
          }
        });
      }).toThrow();
    });

    it('should validate pidsLimit as positive number', () => {
      const validConfig = ApexConfigSchema.parse({
        project: { name: 'test-project' },
        workspace: {
          container: {
            resourceLimits: {
              pidsLimit: 50
            }
          }
        }
      });
      expect(validConfig.workspace?.container?.resourceLimits?.pidsLimit).toBe(50);

      // Invalid pidsLimit values should throw
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              resourceLimits: {
                pidsLimit: 0 // Must be at least 1
              }
            }
          }
        });
      }).toThrow();
    });

    it('should validate networkMode enum values', () => {
      const validNetworkModes = ['bridge', 'host', 'none', 'container'];

      for (const networkMode of validNetworkModes) {
        const config = ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              networkMode
            }
          }
        });
        expect(config.workspace?.container?.networkMode).toBe(networkMode);
      }

      // Invalid network mode should throw
      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test-project' },
          workspace: {
            container: {
              networkMode: 'invalid'
            }
          }
        });
      }).toThrow();
    });

    it('should handle real-world container configuration scenario', () => {
      const config = ApexConfigSchema.parse({
        version: '1.0',
        project: {
          name: 'my-node-app',
          language: 'typescript',
          framework: 'nextjs'
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 1.0,
              memory: '1g',
              memoryReservation: '512m',
              cpuShares: 1024,
              pidsLimit: 200
            },
            networkMode: 'bridge',
            environment: {
              NODE_ENV: 'development',
              PORT: '3000',
              DEBUG: 'myapp:*'
            },
            autoRemove: true,
            installTimeout: 60000
          }
        },
        autonomy: {
          default: 'review-before-merge'
        }
      });

      // Verify project config
      expect(config.project.name).toBe('my-node-app');
      expect(config.project.language).toBe('typescript');

      // Verify workspace config
      expect(config.workspace?.defaultStrategy).toBe('container');
      expect(config.workspace?.cleanupOnComplete).toBe(true);

      // Verify container config
      expect(config.workspace?.container?.image).toBe('node:20-alpine');
      expect(config.workspace?.container?.autoRemove).toBe(true);
      expect(config.workspace?.container?.installTimeout).toBe(60000);

      // Verify resource limits
      const resourceLimits = config.workspace?.container?.resourceLimits;
      expect(resourceLimits?.cpu).toBe(1.0);
      expect(resourceLimits?.memory).toBe('1g');
      expect(resourceLimits?.memoryReservation).toBe('512m');
      expect(resourceLimits?.cpuShares).toBe(1024);
      expect(resourceLimits?.pidsLimit).toBe(200);

      // Verify network and environment
      expect(config.workspace?.container?.networkMode).toBe('bridge');
      expect(config.workspace?.container?.environment?.NODE_ENV).toBe('development');
      expect(config.workspace?.container?.environment?.PORT).toBe('3000');
      expect(config.workspace?.container?.environment?.DEBUG).toBe('myapp:*');

      // Verify other config sections still work
      expect(config.autonomy?.default).toBe('review-before-merge');
    });
  });
});