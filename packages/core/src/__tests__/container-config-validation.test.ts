import { describe, it, expect } from 'vitest';
import { ContainerConfigSchema } from '../types';

/**
 * Validation-focused tests for new ContainerConfig fields
 * These tests specifically verify the Zod validation behavior
 * for dockerfile, buildContext, and imageTag fields
 */
describe('ContainerConfig New Fields Validation', () => {
  describe('String validation behavior', () => {
    it('should enforce string type for dockerfile field', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: 123
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: true
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: null
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: {}
      })).toThrow();
    });

    it('should enforce string type for buildContext field', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: 123
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: true
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: null
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: []
      })).toThrow();
    });

    it('should enforce string type for imageTag field', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: 123
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: true
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: null
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: {}
      })).toThrow();
    });
  });

  describe('Optional field validation', () => {
    it('should allow undefined for all new fields', () => {
      const config = {
        image: 'node:20',
        dockerfile: undefined,
        buildContext: undefined,
        imageTag: undefined
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.dockerfile).toBeUndefined();
      expect(result.buildContext).toBeUndefined();
      expect(result.imageTag).toBeUndefined();
    });

    it('should not require any new fields in configuration', () => {
      const minimalConfig = { image: 'alpine:latest' };
      const result = ContainerConfigSchema.parse(minimalConfig);

      expect(result.image).toBe('alpine:latest');
      expect('dockerfile' in result).toBe(false); // Field not present
      expect('buildContext' in result).toBe(false); // Field not present
      expect('imageTag' in result).toBe(false); // Field not present
    });
  });

  describe('Empty string validation', () => {
    it('should reject empty dockerfile string', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: ''
      })).toThrow('String must contain at least 1 character(s)');
    });

    it('should reject empty buildContext string', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: ''
      })).toThrow('String must contain at least 1 character(s)');
    });

    it('should reject empty imageTag string', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: ''
      })).toThrow('String must contain at least 1 character(s)');
    });
  });

  describe('Whitespace validation', () => {
    it('should accept whitespace in dockerfile paths', () => {
      const result = ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: 'path with spaces/Dockerfile'
      });
      expect(result.dockerfile).toBe('path with spaces/Dockerfile');
    });

    it('should accept whitespace in buildContext paths', () => {
      const result = ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: 'build context with spaces'
      });
      expect(result.buildContext).toBe('build context with spaces');
    });

    it('should accept whitespace in imageTag', () => {
      // Note: While Docker doesn't allow spaces in image tags,
      // our schema validation should only enforce string type and non-empty
      const result = ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: 'registry with spaces/image:tag' // Would fail at Docker level
      });
      expect(result.imageTag).toBe('registry with spaces/image:tag');
    });

    it('should reject strings with only whitespace', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: '   '
      })).toThrow(); // Zod trims strings, so this becomes empty

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        buildContext: '\t\n  '
      })).toThrow(); // Whitespace-only should fail

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        imageTag: '  \n\t  '
      })).toThrow(); // Whitespace-only should fail
    });
  });

  describe('Combined field validation', () => {
    it('should validate all new fields together', () => {
      const config = {
        image: 'ubuntu:22.04',
        dockerfile: 'Dockerfile.custom',
        buildContext: './app',
        imageTag: 'my-app:v1.0.0'
      };

      const result = ContainerConfigSchema.parse(config);
      expect(result.dockerfile).toBe('Dockerfile.custom');
      expect(result.buildContext).toBe('./app');
      expect(result.imageTag).toBe('my-app:v1.0.0');
    });

    it('should fail validation if any new field is invalid type', () => {
      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: 'valid/path',
        buildContext: 123, // Invalid type
        imageTag: 'valid:tag'
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: [], // Invalid type
        buildContext: './valid',
        imageTag: 'valid:tag'
      })).toThrow();

      expect(() => ContainerConfigSchema.parse({
        image: 'node:20',
        dockerfile: 'valid/path',
        buildContext: './valid',
        imageTag: null // Invalid type
      })).toThrow();
    });
  });

  describe('Schema preservation', () => {
    it('should preserve exact string values without modification', () => {
      const originalConfig = {
        image: 'node:20',
        dockerfile: 'path/to/Dockerfile',
        buildContext: '/absolute/path',
        imageTag: 'registry.com/app:v1.2.3'
      };

      const result = ContainerConfigSchema.parse(originalConfig);

      // Values should be preserved exactly as provided
      expect(result.dockerfile).toBe(originalConfig.dockerfile);
      expect(result.buildContext).toBe(originalConfig.buildContext);
      expect(result.imageTag).toBe(originalConfig.imageTag);
    });

    it('should maintain type safety for inferred types', () => {
      const result = ContainerConfigSchema.parse({
        image: 'alpine:latest',
        dockerfile: 'Dockerfile',
        buildContext: '.',
        imageTag: 'custom:latest'
      });

      // TypeScript should infer these as string | undefined
      const dockerfile: string | undefined = result.dockerfile;
      const buildContext: string | undefined = result.buildContext;
      const imageTag: string | undefined = result.imageTag;

      expect(typeof dockerfile).toBe('string');
      expect(typeof buildContext).toBe('string');
      expect(typeof imageTag).toBe('string');
    });
  });

  describe('Integration with existing validation', () => {
    it('should maintain existing required field validation', () => {
      // image field should still be required
      expect(() => ContainerConfigSchema.parse({
        dockerfile: 'Dockerfile',
        buildContext: '.',
        imageTag: 'app:latest'
        // Missing required 'image' field
      })).toThrow();
    });

    it('should work with all existing optional fields', () => {
      const fullConfig = {
        image: 'node:20',
        dockerfile: 'Dockerfile.prod',
        buildContext: './production',
        imageTag: 'prod-app:v2.0.0',
        volumes: { '/app': '/workspace' },
        environment: { NODE_ENV: 'production' },
        resourceLimits: { cpu: 2, memory: '4g' },
        networkMode: 'bridge' as const,
        workingDir: '/app',
        user: 'node',
        autoRemove: true,
        privileged: false
      };

      const result = ContainerConfigSchema.parse(fullConfig);

      // New fields should work
      expect(result.dockerfile).toBe('Dockerfile.prod');
      expect(result.buildContext).toBe('./production');
      expect(result.imageTag).toBe('prod-app:v2.0.0');

      // Existing fields should still work
      expect(result.volumes).toEqual(fullConfig.volumes);
      expect(result.environment).toEqual(fullConfig.environment);
      expect(result.networkMode).toBe('bridge');
    });
  });
});