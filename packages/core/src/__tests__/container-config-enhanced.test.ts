import { describe, it, expect } from 'vitest';
import { ContainerConfigSchema } from '../types';

/**
 * Enhanced test coverage for ContainerConfig new fields
 * Tests edge cases, validation boundaries, and integration scenarios
 * for the dockerfile, buildContext, and imageTag fields
 */
describe('ContainerConfig Enhanced Validation Tests', () => {
  describe('dockerfile field edge cases', () => {
    it('should reject empty dockerfile string', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: ''
      })).toThrow();
    });

    it('should accept dockerfile with spaces in path', () => {
      const result = ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: 'path with spaces/Dockerfile'
      });
      expect(result.dockerfile).toBe('path with spaces/Dockerfile');
    });

    it('should accept dockerfile with special characters', () => {
      const specialPaths = [
        'Dockerfile-dev',
        'Dockerfile.prod',
        'docker/Dockerfile_web',
        'deployments/api/Dockerfile@staging',
        'build-files/Dockerfile+optimization'
      ];

      for (const dockerfile of specialPaths) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          dockerfile
        });
        expect(result.dockerfile).toBe(dockerfile);
      }
    });

    it('should accept deeply nested dockerfile paths', () => {
      const deepPath = 'very/deep/nested/directory/structure/with/many/levels/Dockerfile';
      const result = ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: deepPath
      });
      expect(result.dockerfile).toBe(deepPath);
    });

    it('should accept windows-style paths', () => {
      const windowsPaths = [
        'C:\\project\\Dockerfile',
        '.\\docker\\Dockerfile.windows',
        '..\\..\\Dockerfile'
      ];

      for (const dockerfile of windowsPaths) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          dockerfile
        });
        expect(result.dockerfile).toBe(dockerfile);
      }
    });
  });

  describe('buildContext field edge cases', () => {
    it('should reject empty buildContext string', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: ''
      })).toThrow();
    });

    it('should accept buildContext with spaces', () => {
      const result = ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: 'path with spaces/context'
      });
      expect(result.buildContext).toBe('path with spaces/context');
    });

    it('should accept complex relative paths', () => {
      const complexPaths = [
        '../../../parent/context',
        './src/../dist',
        '../../build/context/../final',
        '../project/sub-module/.'
      ];

      for (const buildContext of complexPaths) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          buildContext
        });
        expect(result.buildContext).toBe(buildContext);
      }
    });

    it('should accept absolute paths with various depths', () => {
      const absolutePaths = [
        '/root/project',
        '/usr/local/src/app',
        '/home/user/development/microservices/api',
        '/opt/applications/web/frontend'
      ];

      for (const buildContext of absolutePaths) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          buildContext
        });
        expect(result.buildContext).toBe(buildContext);
      }
    });

    it('should accept special directory notations', () => {
      const specialNotations = [
        '.',
        './',
        '~',
        '~/project',
        '/tmp',
        '/var/tmp/build'
      ];

      for (const buildContext of specialNotations) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          buildContext
        });
        expect(result.buildContext).toBe(buildContext);
      }
    });
  });

  describe('imageTag field edge cases', () => {
    it('should reject empty imageTag string', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: ''
      })).toThrow();
    });

    it('should accept complex registry URLs with ports', () => {
      const complexTags = [
        'localhost:5000/my-app:latest',
        'registry.example.com:8080/team/service:v1.0.0',
        '127.0.0.1:3000/local/test:debug',
        'internal.registry:9999/enterprise/api:staging'
      ];

      for (const imageTag of complexTags) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          imageTag
        });
        expect(result.imageTag).toBe(imageTag);
      }
    });

    it('should accept various tag formats', () => {
      const tagFormats = [
        'simple-name',
        'app:latest',
        'company/service:v1.2.3',
        'registry.com/ns/app:feature-branch-123',
        'ghcr.io/owner/repo:pr-456',
        'us-central1-docker.pkg.dev/project/repo/image:sha-abcd1234',
        'quay.io/organization/application:2023-12-01-abc123'
      ];

      for (const imageTag of tagFormats) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          imageTag
        });
        expect(result.imageTag).toBe(imageTag);
      }
    });

    it('should accept semantic version tags', () => {
      const semverTags = [
        'app:1.0.0',
        'service:2.1.3-beta',
        'api:0.1.0-alpha.1',
        'web:3.0.0-rc.2',
        'worker:1.2.3-hotfix+build.456',
        'gateway:2.0.0+20231201'
      ];

      for (const imageTag of semverTags) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          imageTag
        });
        expect(result.imageTag).toBe(imageTag);
      }
    });

    it('should accept imageTag with special characters', () => {
      const specialCharTags = [
        'my-app_v1',
        'service.prod',
        'api-gateway+optimized',
        'worker.queue.v2',
        'web-frontend_staging'
      ];

      for (const imageTag of specialCharTags) {
        const result = ContainerConfigSchema.parse({
          image: 'node:20',
          imageTag
        });
        expect(result.imageTag).toBe(imageTag);
      }
    });
  });

  describe('field combination scenarios', () => {
    it('should handle all new fields together with valid values', () => {
      const config = {
        image: 'node:20-alpine',
        dockerfile: 'docker/multi-stage/Dockerfile.prod',
        buildContext: '/home/builder/project/src',
        imageTag: 'registry.company.com/team/api:v2.1.0-staging'
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.dockerfile).toBe(config.dockerfile);
      expect(result.buildContext).toBe(config.buildContext);
      expect(result.imageTag).toBe(config.imageTag);
    });

    it('should handle dockerfile and buildContext without imageTag', () => {
      const config = {
        image: 'ubuntu:22.04',
        dockerfile: 'deployments/Dockerfile.custom',
        buildContext: './app-context'
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.dockerfile).toBe(config.dockerfile);
      expect(result.buildContext).toBe(config.buildContext);
      expect(result.imageTag).toBeUndefined();
    });

    it('should handle imageTag without dockerfile and buildContext', () => {
      const config = {
        image: 'python:3.11-slim',
        imageTag: 'my-python-app:production'
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.dockerfile).toBeUndefined();
      expect(result.buildContext).toBeUndefined();
      expect(result.imageTag).toBe(config.imageTag);
    });

    it('should validate all fields as optional independently', () => {
      const baseConfig = { image: 'alpine:latest' };

      // Test each field individually
      const dockerfileOnly = ContainerConfigSchema.parse({
        ...baseConfig,
        dockerfile: 'Dockerfile'
      });
      expect(dockerfileOnly.dockerfile).toBe('Dockerfile');
      expect(dockerfileOnly.buildContext).toBeUndefined();
      expect(dockerfileOnly.imageTag).toBeUndefined();

      const buildContextOnly = ContainerConfigSchema.parse({
        ...baseConfig,
        buildContext: '.'
      });
      expect(buildContextOnly.dockerfile).toBeUndefined();
      expect(buildContextOnly.buildContext).toBe('.');
      expect(buildContextOnly.imageTag).toBeUndefined();

      const imageTagOnly = ContainerConfigSchema.parse({
        ...baseConfig,
        imageTag: 'custom:tag'
      });
      expect(imageTagOnly.dockerfile).toBeUndefined();
      expect(imageTagOnly.buildContext).toBeUndefined();
      expect(imageTagOnly.imageTag).toBe('custom:tag');
    });
  });

  describe('backward compatibility', () => {
    it('should maintain backward compatibility with existing configs', () => {
      const legacyConfig = {
        image: 'node:18',
        volumes: { '/app': '/workspace' },
        environment: { NODE_ENV: 'development' },
        resourceLimits: { cpu: 2, memory: '4g' },
        networkMode: 'bridge' as const,
        autoRemove: true,
        privileged: false
      };

      const result = ContainerConfigSchema.parse(legacyConfig);
      expect(result.image).toBe(legacyConfig.image);
      expect(result.volumes).toEqual(legacyConfig.volumes);
      expect(result.environment).toEqual(legacyConfig.environment);
      expect(result.dockerfile).toBeUndefined();
      expect(result.buildContext).toBeUndefined();
      expect(result.imageTag).toBeUndefined();
    });

    it('should work with minimal configuration', () => {
      const minimalConfig = { image: 'nginx' };
      const result = ContainerConfigSchema.parse(minimalConfig);

      expect(result.image).toBe('nginx');
      expect(result.dockerfile).toBeUndefined();
      expect(result.buildContext).toBeUndefined();
      expect(result.imageTag).toBeUndefined();
      expect(result.networkMode).toBe('bridge'); // Default value
      expect(result.autoRemove).toBe(true); // Default value
      expect(result.privileged).toBe(false); // Default value
    });
  });

  describe('real-world scenarios', () => {
    it('should support microservice build configuration', () => {
      const microserviceConfig = {
        image: 'node:20-alpine',
        dockerfile: 'services/api/Dockerfile.production',
        buildContext: '.',
        imageTag: 'company-registry.io/microservices/api:v1.2.3',
        environment: {
          NODE_ENV: 'production',
          SERVICE_NAME: 'api-service'
        },
        resourceLimits: {
          cpu: 1,
          memory: '512m'
        }
      };

      const result = ContainerConfigSchema.parse(microserviceConfig);
      expect(result.dockerfile).toBe(microserviceConfig.dockerfile);
      expect(result.buildContext).toBe(microserviceConfig.buildContext);
      expect(result.imageTag).toBe(microserviceConfig.imageTag);
      expect(result.environment?.SERVICE_NAME).toBe('api-service');
    });

    it('should support multi-platform build configuration', () => {
      const multiPlatformConfig = {
        image: 'ubuntu:22.04',
        dockerfile: 'docker/Dockerfile.multiarch',
        buildContext: '/build/workspace',
        imageTag: 'ghcr.io/company/app:linux-amd64-v2.0.0',
        volumes: {
          '/var/run/docker.sock': '/var/run/docker.sock'
        },
        capAdd: ['SYS_ADMIN'],
        privileged: false
      };

      const result = ContainerConfigSchema.parse(multiPlatformConfig);
      expect(result.dockerfile).toBe(multiPlatformConfig.dockerfile);
      expect(result.buildContext).toBe(multiPlatformConfig.buildContext);
      expect(result.imageTag).toBe(multiPlatformConfig.imageTag);
      expect(result.capAdd).toEqual(['SYS_ADMIN']);
      expect(result.privileged).toBe(false);
    });

    it('should support development environment with custom builds', () => {
      const devConfig = {
        image: 'python:3.11',
        dockerfile: 'dev/Dockerfile.debug',
        buildContext: './src',
        imageTag: 'dev-app:local-debug',
        volumes: {
          '/home/dev/project': '/app',
          '/home/dev/.cache': '/root/.cache'
        },
        environment: {
          DEBUG: 'true',
          PYTHONPATH: '/app',
          FLASK_ENV: 'development'
        },
        workingDir: '/app',
        autoRemove: false // Keep for debugging
      };

      const result = ContainerConfigSchema.parse(devConfig);
      expect(result.dockerfile).toBe(devConfig.dockerfile);
      expect(result.buildContext).toBe(devConfig.buildContext);
      expect(result.imageTag).toBe(devConfig.imageTag);
      expect(result.autoRemove).toBe(false);
      expect(result.environment?.DEBUG).toBe('true');
    });

    it('should support CI/CD pipeline configuration', () => {
      const ciConfig = {
        image: 'docker:24.0-dind',
        dockerfile: 'ci/Dockerfile.builder',
        buildContext: '/ci/workspace',
        imageTag: 'ci-registry.internal:5000/builders/node:pipeline-v3',
        environment: {
          CI: 'true',
          DOCKER_BUILDKIT: '1',
          BUILDX_EXPERIMENTAL: '1'
        },
        resourceLimits: {
          cpu: 4,
          memory: '8g',
          pidsLimit: 500
        },
        privileged: true, // Required for Docker-in-Docker
        volumes: {
          '/var/run/docker.sock': '/var/run/docker.sock'
        }
      };

      const result = ContainerConfigSchema.parse(ciConfig);
      expect(result.dockerfile).toBe(ciConfig.dockerfile);
      expect(result.buildContext).toBe(ciConfig.buildContext);
      expect(result.imageTag).toBe(ciConfig.imageTag);
      expect(result.privileged).toBe(true);
      expect(result.environment?.DOCKER_BUILDKIT).toBe('1');
      expect(result.resourceLimits?.memory).toBe('8g');
    });
  });

  describe('integration with other container fields', () => {
    it('should work properly with all container configuration options', () => {
      const fullConfig = {
        image: 'node:20-alpine',
        dockerfile: 'deployments/web/Dockerfile',
        buildContext: '/workspace/web-app',
        imageTag: 'prod-registry.company.com/web/frontend:v3.1.0',
        volumes: {
          '/app/dist': '/var/www/html',
          '/app/config': '/etc/nginx/conf.d'
        },
        environment: {
          NODE_ENV: 'production',
          APP_VERSION: '3.1.0',
          SENTRY_DSN: 'https://example.sentry.io'
        },
        resourceLimits: {
          cpu: 2,
          memory: '4g',
          cpuShares: 1024,
          pidsLimit: 100
        },
        networkMode: 'bridge' as const,
        workingDir: '/app',
        user: 'nginx:nginx',
        labels: {
          'app.name': 'frontend',
          'app.version': '3.1.0',
          'deployment.environment': 'production'
        },
        entrypoint: ['/docker-entrypoint.sh'],
        command: ['nginx', '-g', 'daemon off;'],
        autoRemove: true,
        privileged: false,
        securityOpts: ['no-new-privileges:true'],
        capDrop: ['ALL']
      };

      const result = ContainerConfigSchema.parse(fullConfig);

      // Verify new fields
      expect(result.dockerfile).toBe(fullConfig.dockerfile);
      expect(result.buildContext).toBe(fullConfig.buildContext);
      expect(result.imageTag).toBe(fullConfig.imageTag);

      // Verify integration with existing fields
      expect(result.image).toBe(fullConfig.image);
      expect(result.volumes).toEqual(fullConfig.volumes);
      expect(result.environment).toEqual(fullConfig.environment);
      expect(result.resourceLimits).toEqual(fullConfig.resourceLimits);
      expect(result.networkMode).toBe(fullConfig.networkMode);
      expect(result.workingDir).toBe(fullConfig.workingDir);
      expect(result.user).toBe(fullConfig.user);
      expect(result.labels).toEqual(fullConfig.labels);
      expect(result.entrypoint).toEqual(fullConfig.entrypoint);
      expect(result.command).toEqual(fullConfig.command);
      expect(result.autoRemove).toBe(fullConfig.autoRemove);
      expect(result.privileged).toBe(fullConfig.privileged);
      expect(result.securityOpts).toEqual(fullConfig.securityOpts);
      expect(result.capDrop).toEqual(fullConfig.capDrop);
    });
  });
});