import { describe, it, expect } from 'vitest';
import {
  loadValidToolFixtures,
  loadInvalidToolFixtures,
  loadEdgeCaseFixtures,
  loadFixtureFile,
  getRawFixture,
  getFixturePath,
  fixtureExists,
  createTestToolConfig,
  validateToolConfig,
} from './fixtures/custom-tools/index.js';
import type { CustomToolConfig } from '../types.js';

describe('Custom Tool Test Fixtures', () => {
  describe('Valid Fixtures', () => {
    it('should load all valid tool fixtures', async () => {
      const validTools = await loadValidToolFixtures();

      expect(validTools).toBeDefined();
      expect(Array.isArray(validTools)).toBe(true);
      expect(validTools.length).toBeGreaterThan(0);

      // Verify each tool is properly validated
      validTools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('command');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.command).toBe('string');
      });
    });

    it('should load basic tools fixture', async () => {
      const basicTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'basic-tools.yaml');

      expect(Array.isArray(basicTools)).toBe(true);
      expect(basicTools.length).toBeGreaterThan(0);

      // Check for specific tools we know should be there
      const echoTool = basicTools.find(tool => tool.name === 'EchoTool');
      expect(echoTool).toBeDefined();
      expect(echoTool?.description).toContain('Echo a message');
      expect(echoTool?.command).toBe('echo');
    });

    it('should load parameter types fixture', async () => {
      const paramTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'parameter-types.yaml');

      expect(Array.isArray(paramTools)).toBe(true);

      // Check for tools with different parameter types
      const stringParamTool = paramTools.find(tool => tool.name === 'StringParamTool');
      expect(stringParamTool).toBeDefined();
      expect(stringParamTool?.parameters?.properties?.name?.type).toBe('string');

      const numericTool = paramTools.find(tool => tool.name === 'NumericParamTool');
      expect(numericTool).toBeDefined();
      expect(numericTool?.parameters?.properties?.count?.type).toBe('integer');
    });

    it('should load output parsers fixture', async () => {
      const outputTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'output-parsers.yaml');

      expect(Array.isArray(outputTools)).toBe(true);

      // Check for different output parser types
      const jsonTool = outputTools.find(tool => tool.name === 'JsonOutputTool');
      expect(jsonTool).toBeDefined();
      expect(jsonTool?.outputParser).toBe('json');

      const linesTool = outputTools.find(tool => tool.name === 'LinesOutputTool');
      expect(linesTool).toBeDefined();
      expect(linesTool?.outputParser).toBe('lines');
    });

    it('should load environment config fixture', async () => {
      const envTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'environment-config.yaml');

      expect(Array.isArray(envTools)).toBe(true);

      const envTool = envTools.find(tool => tool.name === 'EnvVarTool');
      expect(envTool).toBeDefined();
      expect(envTool?.env).toBeDefined();
      expect(envTool?.env).toHaveProperty('TEST_VAR');
    });

    it('should load advanced schemas fixture', async () => {
      const advancedTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'advanced-schemas.yaml');

      expect(Array.isArray(advancedTools)).toBe(true);

      const enumTool = advancedTools.find(tool => tool.name === 'EnumParamTool');
      expect(enumTool).toBeDefined();
      expect(enumTool?.parameters?.properties?.level?.enum).toBeDefined();
      expect(Array.isArray(enumTool?.parameters?.properties?.level?.enum)).toBe(true);
    });
  });

  describe('Invalid Fixtures', () => {
    it('should load invalid tool fixtures', async () => {
      const invalidTools = await loadInvalidToolFixtures();

      expect(invalidTools).toBeDefined();
      expect(Array.isArray(invalidTools)).toBe(true);
      expect(invalidTools.length).toBeGreaterThan(0);
    });

    it('should contain tools with missing required fields', async () => {
      const missingRequired = await loadFixtureFile('invalid', 'missing-required.yaml');

      expect(Array.isArray(missingRequired)).toBe(true);
      expect((missingRequired as any[]).length).toBeGreaterThan(0);

      // Verify that these tools fail validation
      for (const tool of missingRequired as any[]) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should contain tools with invalid types', async () => {
      const invalidTypes = await loadFixtureFile('invalid', 'invalid-types.yaml');

      expect(Array.isArray(invalidTypes)).toBe(true);

      // Verify that these tools fail validation
      for (const tool of invalidTypes as any[]) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });

    it('should contain tools with schema violations', async () => {
      const violations = await loadFixtureFile('invalid', 'schema-violations.yaml');

      expect(Array.isArray(violations)).toBe(true);

      // Verify that these tools fail validation
      for (const tool of violations as any[]) {
        const result = validateToolConfig(tool);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Edge Case Fixtures', () => {
    it('should load edge case fixtures', async () => {
      const edgeTools = await loadEdgeCaseFixtures();

      expect(edgeTools).toBeDefined();
      expect(Array.isArray(edgeTools)).toBe(true);
      expect(edgeTools.length).toBeGreaterThan(0);
    });

    it('should handle empty parameters correctly', async () => {
      const emptyParamTools = await loadFixtureFile<CustomToolConfig[]>('edge-cases', 'empty-parameters.yaml');

      expect(Array.isArray(emptyParamTools)).toBe(true);

      const emptyTool = emptyParamTools.find(tool => tool.name === 'EmptyParamsTool');
      expect(emptyTool).toBeDefined();
      expect(emptyTool?.parameters).toBeDefined();
      expect(emptyTool?.parameters?.properties).toEqual({});
    });

    it('should handle boundary values correctly', async () => {
      const boundaryTools = await loadFixtureFile<CustomToolConfig[]>('edge-cases', 'boundary-values.yaml');

      expect(Array.isArray(boundaryTools)).toBe(true);

      // Check for boundary value tools
      const maxNameTool = boundaryTools.find(tool => tool.name?.length === 64);
      expect(maxNameTool).toBeDefined();

      const minTimeoutTool = boundaryTools.find(tool => tool.name === 'MinTimeoutTool');
      expect(minTimeoutTool).toBeDefined();
      expect(minTimeoutTool?.timeoutMs).toBe(1);
    });

    it('should handle special characters correctly', async () => {
      const specialCharTools = await loadFixtureFile<CustomToolConfig[]>('edge-cases', 'special-characters.yaml');

      expect(Array.isArray(specialCharTools)).toBe(true);

      const underscoreTool = specialCharTools.find(tool => tool.name === 'my_custom_tool');
      expect(underscoreTool).toBeDefined();

      const hyphenTool = specialCharTools.find(tool => tool.name === 'my-custom-tool');
      expect(hyphenTool).toBeDefined();
    });

    it('should handle interpolation patterns correctly', async () => {
      const interpolationTools = await loadFixtureFile<CustomToolConfig[]>('edge-cases', 'interpolation-patterns.yaml');

      expect(Array.isArray(interpolationTools)).toBe(true);

      const simpleTool = interpolationTools.find(tool => tool.name === 'SimpleInterpolationTool');
      expect(simpleTool).toBeDefined();
      expect(simpleTool?.args?.some(arg => arg.includes('{{input}}')));
    });
  });

  describe('Utility Functions', () => {
    it('should get fixture path correctly', () => {
      const path = getFixturePath('valid', 'basic-tools.yaml');
      expect(path).toBeDefined();
      expect(typeof path).toBe('string');
      expect(path).toContain('basic-tools.yaml');
    });

    it('should check fixture existence correctly', async () => {
      const exists = await fixtureExists('valid', 'basic-tools.yaml');
      expect(exists).toBe(true);

      const notExists = await fixtureExists('valid', 'nonexistent-file.yaml');
      expect(notExists).toBe(false);
    });

    it('should get raw fixture content', async () => {
      const rawContent = await getRawFixture('valid', 'basic-tools.yaml');
      expect(rawContent).toBeDefined();
      expect(typeof rawContent).toBe('string');
      expect(rawContent).toContain('EchoTool');
    });

    it('should create test tool config programmatically', () => {
      const testTool = createTestToolConfig();
      expect(testTool).toBeDefined();
      expect(testTool.name).toBeDefined();
      expect(testTool.description).toBeDefined();
      expect(testTool.command).toBeDefined();

      // Test with overrides
      const customTool = createTestToolConfig({
        name: 'CustomTest',
        command: 'ls',
      });
      expect(customTool.name).toBe('CustomTest');
      expect(customTool.command).toBe('ls');
    });

    it('should validate tool configurations', () => {
      const validTool = createTestToolConfig();
      const result = validateToolConfig(validTool);
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.error).toBeUndefined();

      const invalidTool = { name: '', description: '', command: '' };
      const invalidResult = validateToolConfig(invalidTool);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.error).toBeDefined();
      expect(invalidResult.data).toBeUndefined();
    });
  });

  describe('Fixture Categories Coverage', () => {
    it('should have fixtures in all required categories', async () => {
      // Verify each category has at least some fixtures
      const validExists = await fixtureExists('valid', 'basic-tools.yaml');
      const invalidExists = await fixtureExists('invalid', 'missing-required.yaml');
      const edgeExists = await fixtureExists('edge-cases', 'empty-parameters.yaml');

      expect(validExists).toBe(true);
      expect(invalidExists).toBe(true);
      expect(edgeExists).toBe(true);
    });

    it('should cover all parameter types in valid fixtures', async () => {
      const paramTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'parameter-types.yaml');

      // Check that we have examples of different parameter types
      const hasString = paramTools.some(tool =>
        Object.values(tool.parameters?.properties || {}).some(prop => prop.type === 'string')
      );
      const hasInteger = paramTools.some(tool =>
        Object.values(tool.parameters?.properties || {}).some(prop => prop.type === 'integer')
      );
      const hasNumber = paramTools.some(tool =>
        Object.values(tool.parameters?.properties || {}).some(prop => prop.type === 'number')
      );
      const hasBoolean = paramTools.some(tool =>
        Object.values(tool.parameters?.properties || {}).some(prop => prop.type === 'boolean')
      );
      const hasArray = paramTools.some(tool =>
        Object.values(tool.parameters?.properties || {}).some(prop => prop.type === 'array')
      );
      const hasObject = paramTools.some(tool =>
        Object.values(tool.parameters?.properties || {}).some(prop => prop.type === 'object')
      );

      expect(hasString).toBe(true);
      expect(hasInteger).toBe(true);
      expect(hasNumber).toBe(true);
      expect(hasBoolean).toBe(true);
      expect(hasArray).toBe(true);
      expect(hasObject).toBe(true);
    });

    it('should cover all output parsers in valid fixtures', async () => {
      const outputTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'output-parsers.yaml');

      const hasText = outputTools.some(tool => tool.outputParser === 'text');
      const hasJson = outputTools.some(tool => tool.outputParser === 'json');
      const hasLines = outputTools.some(tool => tool.outputParser === 'lines');

      expect(hasText).toBe(true);
      expect(hasJson).toBe(true);
      expect(hasLines).toBe(true);
    });

    it('should cover environment and configuration options', async () => {
      const envTools = await loadFixtureFile<CustomToolConfig[]>('valid', 'environment-config.yaml');

      const hasEnv = envTools.some(tool => tool.env && Object.keys(tool.env).length > 0);
      const hasWorkingDir = envTools.some(tool => tool.workingDirectory);
      const hasCustomTimeout = envTools.some(tool => tool.timeoutMs && tool.timeoutMs !== 60000);

      expect(hasEnv).toBe(true);
      expect(hasWorkingDir).toBe(true);
      expect(hasCustomTimeout).toBe(true);
    });
  });
});