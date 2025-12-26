import { describe, it, expect } from 'vitest';
import { ContainerConfigSchema } from '../types';

/**
 * Additional edge case tests for dependency auto-install feature
 * Supplements the main container-config.test.ts with specific edge cases
 */
describe('ContainerConfig Dependency Install Edge Cases', () => {
  describe('field interaction scenarios', () => {
    it('should handle autoDependencyInstall false with customInstallCommand present', () => {
      // User might disable auto-install but still provide a custom command for manual control
      const config = {
        image: 'node:20',
        autoDependencyInstall: false,
        customInstallCommand: 'npm install --production',
        installTimeout: 30000,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.autoDependencyInstall).toBe(false);
      expect(result.customInstallCommand).toBe('npm install --production');
      expect(result.installTimeout).toBe(30000);
    });

    it('should handle autoDependencyInstall true without customInstallCommand', () => {
      // Default behavior - auto-detect dependency manager
      const config = {
        image: 'python:3.11',
        autoDependencyInstall: true,
        installTimeout: 180000,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.autoDependencyInstall).toBe(true);
      expect(result.customInstallCommand).toBeUndefined();
      expect(result.installTimeout).toBe(180000);
    });

    it('should handle only installTimeout specified (other fields use defaults)', () => {
      const config = {
        image: 'ruby:3.2',
        installTimeout: 300000,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.autoDependencyInstall).toBe(true); // Default
      expect(result.customInstallCommand).toBeUndefined(); // Default
      expect(result.installTimeout).toBe(300000);
    });
  });

  describe('customInstallCommand edge cases', () => {
    it('should handle very long complex commands', () => {
      const longCommand = [
        'apt-get update',
        '&&',
        'apt-get install -y python3-pip git',
        '&&',
        'pip3 install --no-cache-dir tensorflow torch pandas numpy scikit-learn',
        '&&',
        'pip3 install --no-cache-dir jupyter notebook matplotlib seaborn',
        '&&',
        'apt-get clean',
        '&&',
        'rm -rf /var/lib/apt/lists/*'
      ].join(' ');

      const config = {
        image: 'ubuntu:22.04',
        customInstallCommand: longCommand,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.customInstallCommand).toBe(longCommand);
    });

    it('should handle commands with special characters and quotes', () => {
      const specialCommand = `bash -c "echo 'Installing deps...' && npm ci && echo 'Done!'"`;

      const config = {
        image: 'node:20',
        customInstallCommand: specialCommand,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.customInstallCommand).toBe(specialCommand);
    });

    it('should handle multi-line commands with line continuation', () => {
      const multilineCommand = 'npm install && \\\nnpm run build:prod && \\\nnpm run test:ci';

      const config = {
        image: 'node:20',
        customInstallCommand: multilineCommand,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.customInstallCommand).toBe(multilineCommand);
    });

    it('should handle commands with environment variable substitution', () => {
      const envCommand = 'pip install -r ${REQUIREMENTS_FILE:-requirements.txt} --index-url $PIP_INDEX_URL';

      const config = {
        image: 'python:3.11',
        customInstallCommand: envCommand,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.customInstallCommand).toBe(envCommand);
    });
  });

  describe('installTimeout edge cases', () => {
    it('should handle very small positive timeout values', () => {
      const config = {
        image: 'alpine:3.18',
        installTimeout: 1, // 1ms - technically valid but very small
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.installTimeout).toBe(1);
    });

    it('should handle very large timeout values', () => {
      const config = {
        image: 'ubuntu:22.04',
        installTimeout: 3600000, // 1 hour
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.installTimeout).toBe(3600000);
    });

    it('should handle fractional timeout values precisely', () => {
      const config = {
        image: 'node:20',
        installTimeout: 30000.123,
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.installTimeout).toBe(30000.123);
    });

    it('should reject infinity values', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        installTimeout: Infinity,
      })).toThrow();
    });

    it('should reject NaN values', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        installTimeout: NaN,
      })).toThrow();
    });
  });

  describe('real-world scenario combinations', () => {
    it('should handle monorepo setup with custom install strategy', () => {
      const config = {
        image: 'node:20-alpine',
        autoDependencyInstall: true,
        customInstallCommand: 'npm ci && npx lerna bootstrap --hoist',
        installTimeout: 600000, // 10 minutes for large monorepos
        environment: {
          NODE_ENV: 'development',
          LERNA_VERSION: '7.0.0',
        },
        resourceLimits: {
          cpu: 4,
          memory: '8g',
        },
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.autoDependencyInstall).toBe(true);
      expect(result.customInstallCommand).toBe('npm ci && npx lerna bootstrap --hoist');
      expect(result.installTimeout).toBe(600000);
      expect(result.environment?.NODE_ENV).toBe('development');
    });

    it('should handle Docker multi-stage build dependency install', () => {
      const config = {
        image: 'node:20-alpine',
        dockerfile: 'Dockerfile.multistage',
        autoDependencyInstall: false, // Handled by Dockerfile
        buildContext: '.',
        environment: {
          SKIP_PREFLIGHT_CHECK: 'true',
          BUILD_STAGE: 'dependencies',
        },
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.autoDependencyInstall).toBe(false);
      expect(result.dockerfile).toBe('Dockerfile.multistage');
      expect(result.environment?.BUILD_STAGE).toBe('dependencies');
    });

    it('should handle AI/ML project with pip and conda dependencies', () => {
      const config = {
        image: 'continuumio/miniconda3:latest',
        autoDependencyInstall: true,
        customInstallCommand: 'conda env create -f environment.yml && conda activate ml-env && pip install -r requirements.txt',
        installTimeout: 1800000, // 30 minutes for ML dependencies
        resourceLimits: {
          cpu: 8,
          memory: '16g',
        },
        environment: {
          CONDA_ENV: 'ml-env',
          PYTHONPATH: '/workspace',
        },
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.customInstallCommand).toContain('conda env create');
      expect(result.customInstallCommand).toContain('pip install');
      expect(result.installTimeout).toBe(1800000);
    });

    it('should handle legacy project with manual dependency management', () => {
      const config = {
        image: 'php:8.1-apache',
        autoDependencyInstall: false, // No automatic detection
        customInstallCommand: 'composer install --no-dev --optimize-autoloader && php artisan migrate:fresh',
        installTimeout: 240000, // 4 minutes
        environment: {
          APP_ENV: 'production',
          COMPOSER_ALLOW_SUPERUSER: '1',
        },
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.autoDependencyInstall).toBe(false);
      expect(result.customInstallCommand).toContain('composer install');
      expect(result.customInstallCommand).toContain('artisan migrate');
    });
  });

  describe('validation error scenarios', () => {
    it('should provide clear error for invalid autoDependencyInstall type', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        autoDependencyInstall: 'yes', // Should be boolean
      })).toThrow();
    });

    it('should provide clear error for invalid installTimeout type', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        installTimeout: '30000', // Should be number, not string
      })).toThrow();
    });

    it('should handle null values gracefully', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        customInstallCommand: null,
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        installTimeout: null,
      })).toThrow();
    });

    it('should handle undefined values (optional fields)', () => {
      // These should work since the fields are optional
      const config = {
        image: 'node:20',
        customInstallCommand: undefined,
        installTimeout: undefined,
        autoDependencyInstall: undefined, // Should use default
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.autoDependencyInstall).toBe(true); // Default
      expect(result.customInstallCommand).toBeUndefined();
      expect(result.installTimeout).toBeUndefined();
    });
  });

  describe('schema consistency checks', () => {
    it('should maintain backward compatibility with old configs', () => {
      // Old config without new fields should still work
      const oldConfig = {
        image: 'node:18',
        volumes: { '/app': '/workspace' },
        environment: { NODE_ENV: 'production' },
        networkMode: 'bridge' as const,
      };

      const result = ContainerConfigSchema.parse(oldConfig);
      expect(result.image).toBe('node:18');
      expect(result.autoDependencyInstall).toBe(true); // Default
      expect(result.customInstallCommand).toBeUndefined();
      expect(result.installTimeout).toBeUndefined();
    });

    it('should allow progressive enhancement of configs', () => {
      // Start with minimal config
      let config = ContainerConfigSchema.parse({ image: 'node:20' });
      expect(config.autoDependencyInstall).toBe(true);

      // Add custom install command
      config = ContainerConfigSchema.parse({
        image: 'node:20',
        customInstallCommand: 'npm ci --production',
      });
      expect(config.customInstallCommand).toBe('npm ci --production');

      // Add timeout
      config = ContainerConfigSchema.parse({
        image: 'node:20',
        customInstallCommand: 'npm ci --production',
        installTimeout: 120000,
      });
      expect(config.installTimeout).toBe(120000);
    });
  });
});