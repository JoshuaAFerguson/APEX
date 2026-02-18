/**
 * Custom Tool Test Fixtures Loader
 *
 * Provides utilities for loading and accessing custom tool test fixtures.
 * Fixtures are organized into categories:
 * - valid/: Valid tool configurations for success path testing
 * - invalid/: Invalid configurations for error handling tests
 * - edge-cases/: Edge case configurations for boundary testing
 *
 * @example
 * ```typescript
 * import {
 *   loadValidToolFixtures,
 *   loadInvalidToolFixtures,
 *   getFixturePath,
 * } from './fixtures/custom-tools/index.js';
 *
 * // Load all valid fixtures
 * const validTools = await loadValidToolFixtures();
 *
 * // Load specific fixture file
 * const basicTools = await loadFixtureFile('valid', 'basic-tools.yaml');
 * ```
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as yaml from 'yaml';
import { CustomToolConfigSchema, type CustomToolConfig } from '../../../types.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Fixture categories
 */
export type FixtureCategory = 'valid' | 'invalid' | 'edge-cases';

/**
 * Cache for loaded fixtures to avoid repeated file reads
 */
const fixtureCache = new Map<string, unknown>();

/**
 * Get the absolute path to a fixture file
 *
 * @param category - The fixture category (valid, invalid, edge-cases)
 * @param filename - The fixture filename (e.g., 'basic-tools.yaml')
 * @returns Absolute path to the fixture file
 */
export function getFixturePath(category: FixtureCategory, filename: string): string {
  return path.join(__dirname, category, filename);
}

/**
 * Get the path to the fixtures directory
 *
 * @returns Absolute path to the fixtures directory
 */
export function getFixturesDirectory(): string {
  return __dirname;
}

/**
 * Load raw YAML content from a fixture file
 *
 * @param category - The fixture category
 * @param filename - The fixture filename
 * @returns Raw YAML string content
 */
export async function getRawFixture(category: FixtureCategory, filename: string): Promise<string> {
  const filepath = getFixturePath(category, filename);
  return fs.readFile(filepath, 'utf-8');
}

/**
 * Load and parse a fixture file
 *
 * @param category - The fixture category
 * @param filename - The fixture filename
 * @returns Parsed fixture data (unvalidated)
 */
export async function loadFixtureFile<T = unknown>(
  category: FixtureCategory,
  filename: string
): Promise<T> {
  const cacheKey = `${category}/${filename}`;

  if (fixtureCache.has(cacheKey)) {
    return fixtureCache.get(cacheKey) as T;
  }

  const content = await getRawFixture(category, filename);
  const parsed = yaml.parse(content) as T;

  fixtureCache.set(cacheKey, parsed);
  return parsed;
}

/**
 * Load all YAML files from a fixture category
 *
 * @param category - The fixture category to load
 * @returns Map of filename to parsed content
 */
export async function loadCategoryFixtures(
  category: FixtureCategory
): Promise<Map<string, unknown>> {
  const categoryPath = path.join(__dirname, category);
  const fixtures = new Map<string, unknown>();

  try {
    const files = await fs.readdir(categoryPath);
    const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

    for (const file of yamlFiles) {
      const content = await loadFixtureFile(category, file);
      fixtures.set(file, content);
    }
  } catch (error) {
    // Directory may not exist yet during initial setup
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  return fixtures;
}

/**
 * Load all valid tool fixtures and validate them against the schema
 *
 * @returns Array of validated CustomToolConfig objects
 */
export async function loadValidToolFixtures(): Promise<CustomToolConfig[]> {
  const fixtures = await loadCategoryFixtures('valid');
  const tools: CustomToolConfig[] = [];

  for (const [filename, content] of fixtures) {
    if (Array.isArray(content)) {
      for (const item of content) {
        const result = CustomToolConfigSchema.safeParse(item);
        if (result.success) {
          tools.push(result.data);
        } else {
          console.warn(`Invalid tool in ${filename}:`, result.error.message);
        }
      }
    } else if (content && typeof content === 'object') {
      const result = CustomToolConfigSchema.safeParse(content);
      if (result.success) {
        tools.push(result.data);
      }
    }
  }

  return tools;
}

/**
 * Load invalid tool fixtures (without validation - for error testing)
 *
 * @returns Array of invalid tool configuration objects
 */
export async function loadInvalidToolFixtures(): Promise<Record<string, unknown>[]> {
  const fixtures = await loadCategoryFixtures('invalid');
  const tools: Record<string, unknown>[] = [];

  for (const content of fixtures.values()) {
    if (Array.isArray(content)) {
      tools.push(...(content as Record<string, unknown>[]));
    } else if (content && typeof content === 'object') {
      tools.push(content as Record<string, unknown>);
    }
  }

  return tools;
}

/**
 * Load edge case fixtures
 *
 * @returns Array of edge case tool configurations
 */
export async function loadEdgeCaseFixtures(): Promise<CustomToolConfig[]> {
  const fixtures = await loadCategoryFixtures('edge-cases');
  const tools: CustomToolConfig[] = [];

  for (const content of fixtures.values()) {
    if (Array.isArray(content)) {
      for (const item of content) {
        const result = CustomToolConfigSchema.safeParse(item);
        if (result.success) {
          tools.push(result.data);
        }
      }
    } else if (content && typeof content === 'object') {
      const result = CustomToolConfigSchema.safeParse(content);
      if (result.success) {
        tools.push(result.data);
      }
    }
  }

  return tools;
}

/**
 * Clear the fixture cache
 * Useful in tests that modify fixtures
 */
export function clearFixtureCache(): void {
  fixtureCache.clear();
}

/**
 * Check if a fixture file exists
 *
 * @param category - The fixture category
 * @param filename - The fixture filename
 * @returns True if the fixture file exists
 */
export async function fixtureExists(category: FixtureCategory, filename: string): Promise<boolean> {
  try {
    await fs.access(getFixturePath(category, filename));
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a test tool configuration programmatically
 * Useful for tests that need to generate fixtures dynamically
 *
 * @param overrides - Partial tool configuration to merge with defaults
 * @returns A valid CustomToolConfig object
 */
export function createTestToolConfig(overrides: Partial<CustomToolConfig> = {}): CustomToolConfig {
  const defaults: CustomToolConfig = {
    name: 'TestTool',
    description: 'A test tool for testing',
    command: 'echo',
    args: ['{{input.message}}'],
    parameters: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo',
        },
      },
      required: ['message'],
      additionalProperties: false,
    },
    outputParser: 'text',
    timeoutMs: 60000,
    enabled: true,
  };

  return { ...defaults, ...overrides };
}

/**
 * Validate a tool configuration against the schema
 *
 * @param config - Tool configuration to validate
 * @returns Validation result with success/error info
 */
export function validateToolConfig(config: unknown): {
  success: boolean;
  data?: CustomToolConfig;
  error?: string;
} {
  const result = CustomToolConfigSchema.safeParse(config);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
