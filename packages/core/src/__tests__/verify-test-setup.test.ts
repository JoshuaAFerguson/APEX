import { describe, it, expect } from 'vitest';
import { ContainerConfigSchema } from '../types';

/**
 * Quick verification that our test setup is working correctly
 */
describe('Test Setup Verification', () => {
  it('should be able to import ContainerConfigSchema', () => {
    expect(ContainerConfigSchema).toBeDefined();
  });

  it('should be able to validate a basic container config', () => {
    const config = { image: 'node:20' };
    const result = ContainerConfigSchema.parse(config);
    expect(result.image).toBe('node:20');
  });

  it('should verify new fields exist in schema', () => {
    const config = {
      image: 'node:20',
      dockerfile: 'Dockerfile',
      buildContext: '.',
      imageTag: 'test:latest'
    };

    const result = ContainerConfigSchema.parse(config);
    expect(result.dockerfile).toBe('Dockerfile');
    expect(result.buildContext).toBe('.');
    expect(result.imageTag).toBe('test:latest');
  });
});