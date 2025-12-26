import { ApexConfigSchema } from '../types.js';

describe('Real-world Workspace Configuration Examples', () => {
  describe('Common development environments', () => {
    it('should validate typical Node.js TypeScript project config', () => {
      const nodeConfig = {
        version: '1.0',
        project: {
          name: 'my-node-app',
          language: 'typescript',
          framework: 'express',
          testCommand: 'npm test',
          buildCommand: 'npm run build',
          lintCommand: 'npm run lint',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '2g',
              memoryReservation: '1g',
            },
            environment: {
              NODE_ENV: 'development',
              NPM_CONFIG_CACHE: '/tmp/.npm',
              DEBUG: 'app:*',
            },
            networkMode: 'bridge',
            autoRemove: true,
            installTimeout: 600000, // 10 minutes for npm install
          },
        },
        autonomy: {
          default: 'review-before-merge',
        },
        limits: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 10.0,
          maxConcurrentTasks: 2,
        },
      };

      const result = ApexConfigSchema.parse(nodeConfig);
      expect(result.workspace?.defaultStrategy).toBe('container');
      expect(result.workspace?.container?.image).toBe('node:20-alpine');
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(2);
      expect(result.workspace?.container?.environment?.NODE_ENV).toBe('development');
    });

    it('should validate Python data science project config', () => {
      const pythonConfig = {
        project: {
          name: 'ml-project',
          language: 'python',
          framework: 'jupyter',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'python:3.11-slim',
            resourceLimits: {
              cpu: 4,
              memory: '8g',
              memoryReservation: '4g',
              memorySwap: '16g',
            },
            environment: {
              PYTHONUNBUFFERED: '1',
              JUPYTER_ENABLE_LAB: '1',
              PIP_NO_CACHE_DIR: '1',
            },
            installTimeout: 900000, // 15 minutes for pip install
          },
        },
      };

      const result = ApexConfigSchema.parse(pythonConfig);
      expect(result.workspace?.container?.resourceLimits?.memory).toBe('8g');
      expect(result.workspace?.container?.environment?.PYTHONUNBUFFERED).toBe('1');
    });

    it('should validate minimal container config for lightweight projects', () => {
      const minimalConfig = {
        project: {
          name: 'simple-script',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'alpine:3.18',
            resourceLimits: {
              cpu: 0.25,
              memory: '128m',
              pidsLimit: 20,
            },
            autoRemove: true,
          },
        },
      };

      const result = ApexConfigSchema.parse(minimalConfig);
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(0.25);
      expect(result.workspace?.container?.resourceLimits?.memory).toBe('128m');
    });

    it('should validate Go microservice development config', () => {
      const goConfig = {
        project: {
          name: 'go-microservice',
          language: 'go',
          framework: 'gin',
          testCommand: 'go test ./...',
          buildCommand: 'go build -o app .',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'golang:1.21-alpine',
            resourceLimits: {
              cpu: 1.5,
              memory: '1g',
              cpuShares: 768,
            },
            environment: {
              GOOS: 'linux',
              GOARCH: 'amd64',
              CGO_ENABLED: '0',
            },
            networkMode: 'bridge',
          },
        },
      };

      const result = ApexConfigSchema.parse(goConfig);
      expect(result.workspace?.container?.environment?.GOOS).toBe('linux');
      expect(result.workspace?.container?.resourceLimits?.cpuShares).toBe(768);
    });

    it('should validate Rust development environment config', () => {
      const rustConfig = {
        project: {
          name: 'rust-cli-tool',
          language: 'rust',
          testCommand: 'cargo test',
          buildCommand: 'cargo build --release',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: false, // Keep for debugging
          container: {
            image: 'rust:1.75-alpine',
            resourceLimits: {
              cpu: 3,
              memory: '4g',
              memoryReservation: '2g',
              cpuShares: 1536,
              pidsLimit: 100,
            },
            environment: {
              RUST_BACKTRACE: '1',
              CARGO_HOME: '/usr/local/cargo',
              RUSTUP_HOME: '/usr/local/rustup',
            },
            installTimeout: 1200000, // 20 minutes for cargo build
          },
        },
      };

      const result = ApexConfigSchema.parse(rustConfig);
      expect(result.workspace?.cleanupOnComplete).toBe(false);
      expect(result.workspace?.container?.environment?.RUST_BACKTRACE).toBe('1');
    });
  });

  describe('Production-like environments', () => {
    it('should validate high-performance container config', () => {
      const highPerfConfig = {
        project: {
          name: 'performance-critical-app',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 8,
              memory: '16g',
              memoryReservation: '8g',
              memorySwap: '32g',
              cpuShares: 4096,
              pidsLimit: 500,
            },
            networkMode: 'host', // For performance
            autoRemove: false, // Keep for analysis
            installTimeout: 1800000, // 30 minutes
          },
        },
      };

      const result = ApexConfigSchema.parse(highPerfConfig);
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(8);
      expect(result.workspace?.container?.networkMode).toBe('host');
    });

    it('should validate resource-constrained environment config', () => {
      const constrainedConfig = {
        project: {
          name: 'resource-limited-env',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'alpine:3.18',
            resourceLimits: {
              cpu: 0.1,
              memory: '64m',
              cpuShares: 64,
              pidsLimit: 5,
            },
            networkMode: 'none', // No network for security
            environment: {},
            autoRemove: true,
          },
        },
      };

      const result = ApexConfigSchema.parse(constrainedConfig);
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(0.1);
      expect(result.workspace?.container?.networkMode).toBe('none');
    });
  });

  describe('Complex multi-service development scenarios', () => {
    it('should validate database development environment', () => {
      const dbConfig = {
        project: {
          name: 'database-migration-tool',
          language: 'typescript',
        },
        workspace: {
          defaultStrategy: 'container',
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 1,
              memory: '1g',
              memoryReservation: '512m',
            },
            environment: {
              NODE_ENV: 'development',
              DB_HOST: 'localhost',
              DB_PORT: '5432',
              DB_NAME: 'testdb',
              PGUSER: 'postgres',
            },
            networkMode: 'bridge',
            installTimeout: 300000,
          },
        },
      };

      const result = ApexConfigSchema.parse(dbConfig);
      expect(result.workspace?.container?.environment?.DB_HOST).toBe('localhost');
    });

    it('should validate CI/CD pipeline container config', () => {
      const ciConfig = {
        project: {
          name: 'ci-pipeline',
          testCommand: 'npm run test:ci',
          buildCommand: 'npm run build:production',
          lintCommand: 'npm run lint:fix',
        },
        workspace: {
          defaultStrategy: 'container',
          cleanupOnComplete: true,
          container: {
            image: 'node:20-alpine',
            resourceLimits: {
              cpu: 2,
              memory: '2g',
              cpuShares: 1024,
              pidsLimit: 50,
            },
            environment: {
              NODE_ENV: 'test',
              CI: 'true',
              FORCE_COLOR: '1',
              NPM_CONFIG_PROGRESS: 'false',
            },
            autoRemove: true,
            installTimeout: 600000,
          },
        },
        autonomy: {
          default: 'full', // Automated CI
        },
      };

      const result = ApexConfigSchema.parse(ciConfig);
      expect(result.workspace?.container?.environment?.CI).toBe('true');
      expect(result.autonomy?.default).toBe('full');
    });
  });

  describe('Edge cases and special configurations', () => {
    it('should handle configuration with only some resource limits', () => {
      const partialResourceConfig = {
        project: { name: 'partial-resources' },
        workspace: {
          container: {
            image: 'ubuntu:22.04',
            resourceLimits: {
              memory: '1g', // Only memory specified
            },
          },
        },
      };

      const result = ApexConfigSchema.parse(partialResourceConfig);
      expect(result.workspace?.container?.resourceLimits?.memory).toBe('1g');
      expect(result.workspace?.container?.resourceLimits?.cpu).toBeUndefined();
    });

    it('should handle configuration with no resource limits', () => {
      const noResourceConfig = {
        project: { name: 'no-limits' },
        workspace: {
          container: {
            image: 'node:20',
            environment: {
              NODE_ENV: 'production',
            },
          },
        },
      };

      const result = ApexConfigSchema.parse(noResourceConfig);
      expect(result.workspace?.container?.resourceLimits).toBeUndefined();
      expect(result.workspace?.container?.environment?.NODE_ENV).toBe('production');
    });

    it('should handle mixed strategies with partial container config', () => {
      const mixedConfig = {
        project: { name: 'mixed-strategy' },
        workspace: {
          defaultStrategy: 'worktree', // Not container, but container config provided as fallback
          cleanupOnComplete: false,
          container: {
            image: 'alpine:latest',
            resourceLimits: {
              cpu: 0.5,
            },
          },
        },
      };

      const result = ApexConfigSchema.parse(mixedConfig);
      expect(result.workspace?.defaultStrategy).toBe('worktree');
      expect(result.workspace?.container?.image).toBe('alpine:latest');
    });

    it('should handle maximum realistic values', () => {
      const maxConfig = {
        project: { name: 'max-resources' },
        workspace: {
          container: {
            image: 'ubuntu:22.04',
            resourceLimits: {
              cpu: 64, // Maximum
              memory: '999999999k', // Very large
              memoryReservation: '500000000k',
              memorySwap: '1999999999k',
              cpuShares: 262144, // Maximum
              pidsLimit: 10000,
            },
            installTimeout: 3600000, // 1 hour
          },
        },
      };

      const result = ApexConfigSchema.parse(maxConfig);
      expect(result.workspace?.container?.resourceLimits?.cpu).toBe(64);
      expect(result.workspace?.container?.resourceLimits?.cpuShares).toBe(262144);
    });
  });
});