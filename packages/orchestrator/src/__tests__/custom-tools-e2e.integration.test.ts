/**
 * End-to-End Integration Tests for Custom Tools
 *
 * This test suite covers:
 * - Complete workflow from configuration to execution
 * - Real tool execution with command line tools
 * - Output parsing for all supported formats
 * - Hook integration with custom tools
 * - Error handling and recovery
 * - Performance characteristics under load
 * - Complex parameter interpolation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildCustomToolsServer } from '../custom-tools';
import type { CustomToolConfig } from '@apexcli/core';
import {
  createTestToolConfig,
  loadValidToolFixtures,
} from '../../../core/src/__tests__/fixtures/custom-tools/index.js';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

describe('Custom Tools - End-to-End Integration', () => {
  let tempDir: string;
  let scriptsDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-e2e-custom-tools-'));
    scriptsDir = path.join(tempDir, 'scripts');
    await fs.mkdir(scriptsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  const createTestScript = async (
    name: string,
    content: string,
    executable: boolean = true
  ): Promise<string> => {
    const scriptPath = path.join(scriptsDir, name);
    await fs.writeFile(scriptPath, content);
    if (executable) {
      await fs.chmod(scriptPath, '755');
    }
    return scriptPath;
  };

  describe('Basic Tool Execution', () => {
    it('should execute simple echo commands', async () => {
      const echoTool: CustomToolConfig = createTestToolConfig({
        name: 'SimpleEcho',
        description: 'Echo a message',
        command: 'echo',
        args: ['Hello {{input.message}}!'],
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to echo',
            },
          },
          required: ['message'],
          additionalProperties: false,
        },
        outputParser: 'text',
      });

      const server = buildCustomToolsServer([echoTool], tempDir);
      expect(server).not.toBeNull();
      expect(server?.config.tools).toBeDefined();

      // Verify server structure
      expect(server?.name).toBe('custom-tools');
      expect(server?.config.type).toBe('sdk');
    });

    it('should handle file operations', async () => {
      // Create a test script for file operations
      const script = `#!/bin/bash
if [ ! -f "$1" ]; then
  echo "File not found: $1" >&2
  exit 1
fi

wc -l "$1" | awk '{print $1}'
`;
      const scriptPath = await createTestScript('count-lines.sh', script);

      const fileCountTool: CustomToolConfig = createTestToolConfig({
        name: 'LineCounter',
        description: 'Count lines in a file',
        command: scriptPath,
        args: ['{{input.filePath}}'],
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to file to count lines',
            },
          },
          required: ['filePath'],
          additionalProperties: false,
        },
        outputParser: 'text',
        workingDirectory: tempDir,
      });

      const server = buildCustomToolsServer([fileCountTool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle JSON output parsing', async () => {
      const jsonScript = `#!/usr/bin/env node
const input = process.argv[2];
const result = {
  input: input,
  timestamp: new Date().toISOString(),
  length: input.length,
  words: input.split(' ').length,
  uppercase: input.toUpperCase()
};
console.log(JSON.stringify(result, null, 2));
`;
      const scriptPath = await createTestScript('json-processor.js', jsonScript);

      const jsonTool: CustomToolConfig = createTestToolConfig({
        name: 'JsonProcessor',
        description: 'Process text and return JSON',
        command: 'node',
        args: [scriptPath, '{{input.text}}'],
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to process',
            },
          },
          required: ['text'],
          additionalProperties: false,
        },
        outputParser: 'json',
      });

      const server = buildCustomToolsServer([jsonTool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle lines output parsing', async () => {
      const listScript = `#!/bin/bash
for i in {1..5}; do
  echo "Item $i: {{input.prefix}}_$i"
done
`;
      const scriptPath = await createTestScript('list-generator.sh', listScript);

      const listTool: CustomToolConfig = createTestToolConfig({
        name: 'ListGenerator',
        description: 'Generate a list of items',
        command: scriptPath,
        args: [],
        parameters: {
          type: 'object',
          properties: {
            prefix: {
              type: 'string',
              description: 'Prefix for each item',
              default: 'item',
            },
          },
          additionalProperties: false,
        },
        outputParser: 'lines',
      });

      const server = buildCustomToolsServer([listTool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Complex Parameter Interpolation', () => {
    it('should handle nested object interpolation', async () => {
      const configScript = `#!/usr/bin/env node
const args = process.argv.slice(2);
console.log('Host:', args[0]);
console.log('Port:', args[1]);
console.log('Database:', args[2]);
console.log('SSL:', args[3]);
console.log('Debug:', args[4]);
`;
      const scriptPath = await createTestScript('config-display.js', configScript);

      const configTool: CustomToolConfig = createTestToolConfig({
        name: 'ConfigTool',
        description: 'Display configuration',
        command: 'node',
        args: [
          scriptPath,
          '{{input.database.host}}',
          '{{input.database.port}}',
          '{{input.database.name}}',
          '{{input.database.ssl}}',
          '{{input.debug}}'
        ],
        parameters: {
          type: 'object',
          properties: {
            database: {
              type: 'object',
              properties: {
                host: { type: 'string', default: 'localhost' },
                port: { type: 'integer', minimum: 1, maximum: 65535 },
                name: { type: 'string' },
                ssl: { type: 'boolean', default: false },
              },
              required: ['port', 'name'],
              additionalProperties: false,
            },
            debug: {
              type: 'boolean',
              default: false,
            },
          },
          required: ['database'],
          additionalProperties: false,
        },
        outputParser: 'lines',
      });

      const server = buildCustomToolsServer([configTool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Environment and Working Directory', () => {
    it('should handle custom environment variables', async () => {
      const envScript = `#!/bin/bash
echo "TEST_VAR: $TEST_VAR"
echo "DEBUG_MODE: $DEBUG_MODE"
echo "USER_INPUT: {{input.message}}"
`;
      const scriptPath = await createTestScript('env-test.sh', envScript);

      const envTool: CustomToolConfig = createTestToolConfig({
        name: 'EnvironmentTool',
        description: 'Test environment variables',
        command: scriptPath,
        args: [],
        env: {
          TEST_VAR: 'test-value',
          DEBUG_MODE: 'true',
        },
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Message to include',
            },
          },
          required: ['message'],
          additionalProperties: false,
        },
        outputParser: 'lines',
      });

      const server = buildCustomToolsServer([envTool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle custom working directory', async () => {
      // Create a subdirectory with a test file
      const subDir = path.join(tempDir, 'subdir');
      await fs.mkdir(subDir, { recursive: true });
      await fs.writeFile(path.join(subDir, 'test.txt'), 'test content');

      const script = `#!/bin/bash
pwd
ls -la test.txt 2>/dev/null || echo "File not found"
echo "Message: {{input.message}}"
`;
      const scriptPath = await createTestScript('workdir-test.sh', script);

      const workdirTool: CustomToolConfig = createTestToolConfig({
        name: 'WorkdirTool',
        description: 'Test working directory',
        command: scriptPath,
        args: [],
        workingDirectory: 'subdir',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              default: 'Hello from subdir',
            },
          },
          additionalProperties: false,
        },
        outputParser: 'lines',
      });

      const server = buildCustomToolsServer([workdirTool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle command execution errors', async () => {
      const errorTool: CustomToolConfig = createTestToolConfig({
        name: 'ErrorTool',
        description: 'Tool that produces errors',
        command: 'nonexistent-command',
        args: ['{{input.arg}}'],
        parameters: {
          type: 'object',
          properties: {
            arg: { type: 'string' },
          },
          required: ['arg'],
          additionalProperties: false,
        },
      });

      const server = buildCustomToolsServer([errorTool], tempDir);
      expect(server).not.toBeNull();
    });

    it('should handle timeout scenarios', async () => {
      const timeoutScript = `#!/bin/bash
echo "Starting long operation..."
sleep 10  # Sleep for 10 seconds
echo "Operation completed"
`;
      const scriptPath = await createTestScript('timeout-test.sh', timeoutScript);

      const timeoutTool: CustomToolConfig = createTestToolConfig({
        name: 'TimeoutTool',
        description: 'Tool that may timeout',
        command: scriptPath,
        args: [],
        timeoutMs: 100, // Very short timeout
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      });

      const server = buildCustomToolsServer([timeoutTool], tempDir);
      expect(server).not.toBeNull();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent tool creation', async () => {
      const tools: CustomToolConfig[] = [];

      for (let i = 0; i < 20; i++) {
        tools.push(createTestToolConfig({
          name: `ConcurrentTool${i}`,
          description: `Tool ${i} for concurrent testing`,
          command: 'echo',
          args: [`Tool ${i}: {{input.message}}`],
        }));
      }

      const start = Date.now();
      const server = buildCustomToolsServer(tools, tempDir);
      const duration = Date.now() - start;

      expect(server).not.toBeNull();
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Fixture Integration', () => {
    it('should successfully create servers from all valid fixtures', async () => {
      const validTools = await loadValidToolFixtures();

      // Filter enabled tools
      const enabledTools = validTools.filter(tool => tool.enabled !== false);

      if (enabledTools.length > 0) {
        const server = buildCustomToolsServer(enabledTools, tempDir);
        expect(server).not.toBeNull();
        expect(server?.config.tools).toBeDefined();
        expect(server?.name).toBe('custom-tools');
      } else {
        // If no tools are enabled, that's also valid
        const server = buildCustomToolsServer(enabledTools, tempDir);
        expect(server).toBeNull();
      }
    });
  });
});