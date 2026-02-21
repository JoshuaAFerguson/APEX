import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectTypeScript,
  detectYarn,
  detectPnpm,
  detectClaudeApiKey,
} from '../doctor-utils.js';

describe('Toolchain Detection Utilities', () => {
  describe('detectTypeScript', () => {
    it('should detect global TypeScript installation', async () => {
      const result = await detectTypeScript({ local: false });

      expect(result.name).toBe('typescript');
      expect(result.required).toBe(false);
      expect(result.requiredVersion).toBe('4.0.0');
      expect(result.metadata?.installation).toBe('global');

      // Result should be either found or not found, but have proper structure
      if (result.currentVersion) {
        expect(typeof result.currentVersion).toBe('string');
        expect(result.metadata?.raw).toBeDefined();
      } else {
        expect(result.metadata?.error).toBeDefined();
      }
    });

    it('should detect local TypeScript installation', async () => {
      const result = await detectTypeScript({ local: true, cwd: process.cwd() });

      expect(result.name).toBe('typescript');
      expect(result.required).toBe(false);
      expect(result.requiredVersion).toBe('4.0.0');

      // For this project, TypeScript should be available as a dev dependency
      if (result.currentVersion) {
        expect(typeof result.currentVersion).toBe('string');
        // Should indicate local installation method
        expect(result.metadata?.installation).toMatch(/local|package\.json/);
      }
    });

    it('should handle missing TypeScript gracefully', async () => {
      const result = await detectTypeScript({ local: true, cwd: '/nonexistent' });

      expect(result.name).toBe('typescript');
      expect(result.currentVersion).toBeNull();
      expect(result.metadata?.error).toBeDefined();
    });
  });

  describe('detectYarn', () => {
    it('should detect Yarn availability', async () => {
      const result = await detectYarn();

      expect(result.name).toBe('yarn');
      expect(result.required).toBe(false);
      expect(result.requiredVersion).toBe('1.22.0');
      expect(result.metadata?.packageManager).toBe(true);

      // Result should be either found or not found
      if (result.currentVersion) {
        expect(typeof result.currentVersion).toBe('string');
        expect(result.metadata?.raw).toBeDefined();
      } else {
        expect(result.metadata?.error).toBeDefined();
      }
    });
  });

  describe('detectPnpm', () => {
    it('should detect pnpm availability', async () => {
      const result = await detectPnpm();

      expect(result.name).toBe('pnpm');
      expect(result.required).toBe(false);
      expect(result.requiredVersion).toBe('7.0.0');
      expect(result.metadata?.packageManager).toBe(true);

      // Result should be either found or not found
      if (result.currentVersion) {
        expect(typeof result.currentVersion).toBe('string');
        expect(result.metadata?.raw).toBeDefined();
      } else {
        expect(result.metadata?.error).toBeDefined();
      }
    });
  });

  describe('detectClaudeApiKey', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv };
      delete process.env.CLAUDE_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
    });

    afterEach(() => {
      // Restore environment
      process.env = originalEnv;
    });

    it('should detect API key in environment variables', async () => {
      process.env.CLAUDE_API_KEY = 'test-key';

      const result = await detectClaudeApiKey();

      expect(result.name).toBe('claude-api-key');
      expect(result.currentVersion).toBe('present');
      expect(result.requiredVersion).toBe('present');
      expect(result.required).toBe(true);
      expect(result.path).toBe('CLAUDE_API_KEY');
      expect(result.metadata?.source).toBe('CLAUDE_API_KEY');
    });

    it('should detect ANTHROPIC_API_KEY as fallback', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-key';

      const result = await detectClaudeApiKey();

      expect(result.name).toBe('claude-api-key');
      expect(result.currentVersion).toBe('present');
      expect(result.path).toBe('ANTHROPIC_API_KEY');
      expect(result.metadata?.source).toBe('ANTHROPIC_API_KEY');
    });

    it('should handle missing API key', async () => {
      const result = await detectClaudeApiKey();

      expect(result.name).toBe('claude-api-key');
      expect(result.currentVersion).toBeNull();
      expect(result.requiredVersion).toBe('present');
      expect(result.required).toBe(true);
      expect(result.path).toBeUndefined();
    });

    it('should use custom environment variable', async () => {
      process.env.CUSTOM_API_KEY = 'test-key';

      const result = await detectClaudeApiKey({ envVar: 'CUSTOM_API_KEY' });

      expect(result.name).toBe('claude-api-key');
      expect(result.currentVersion).toBe('present');
      expect(result.path).toBe('CUSTOM_API_KEY');
    });

    it('should skip environment check when disabled', async () => {
      process.env.CLAUDE_API_KEY = 'test-key';

      const result = await detectClaudeApiKey({ checkEnv: false });

      expect(result.name).toBe('claude-api-key');
      expect(result.currentVersion).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should work together for comprehensive toolchain checking', async () => {
      const [tsResult, yarnResult, pnpmResult, apiKeyResult] = await Promise.all([
        detectTypeScript({ local: true }),
        detectYarn(),
        detectPnpm(),
        detectClaudeApiKey()
      ]);

      // All should return properly structured ToolchainCheck objects
      for (const result of [tsResult, yarnResult, pnpmResult, apiKeyResult]) {
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('currentVersion');
        expect(result).toHaveProperty('requiredVersion');
        expect(result).toHaveProperty('required');
        expect(result).toHaveProperty('metadata');
        expect(typeof result.required).toBe('boolean');
      }

      // TypeScript should be available in this project
      expect(tsResult.name).toBe('typescript');

      // API key check should have proper structure
      expect(apiKeyResult.name).toBe('claude-api-key');
      expect(apiKeyResult.required).toBe(true);
    });
  });
});