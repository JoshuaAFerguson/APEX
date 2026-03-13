import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BrowserTool } from '../packages/core/src/tools/browser/index.js';
import { ReadTool, WriteTool } from '../packages/core/src/tools/filesystem/index.js';
import { BashTool } from '../packages/core/src/tools/shell/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

/**
 * Debug test to understand actual tool response structures
 */
describe('v0.5.0 Debug Tool Responses', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'apex-debug-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up temp dir ${tempDir}:`, error);
    }
  });

  it('should debug browser tool response structure', async () => {
    const browserTool = new BrowserTool({ headless: true });

    try {
      const result = await browserTool.execute({
        operation: 'navigate',
        params: { url: 'https://example.com' }
      });

      console.log('Browser tool result:', JSON.stringify(result, null, 2));

      // Basic verification that it returns something
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

      await browserTool.cleanupAllSessions();
    } catch (error) {
      console.log('Browser tool error:', error);
      throw error;
    }
  });

  it('should debug read tool response structure', async () => {
    const readTool = new ReadTool();

    // Create test file
    const testFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'Line 1\\nLine 2\\nLine 3');

    try {
      const result = await readTool.execute({ file_path: testFile });

      console.log('Read tool result:', JSON.stringify(result, null, 2));
      console.log('Read tool result keys:', Object.keys(result));

      // Basic verification that it returns something
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

    } catch (error) {
      console.log('Read tool error:', error);
      throw error;
    }
  });

  it('should debug write tool response structure', async () => {
    const writeTool = new WriteTool();

    const testFile = path.join(tempDir, 'write-test.txt');

    try {
      const result = await writeTool.execute({
        filePath: testFile,
        content: 'Hello World!'
      });

      console.log('Write tool result:', JSON.stringify(result, null, 2));
      console.log('Write tool result keys:', Object.keys(result));

      // Basic verification that it returns something
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

    } catch (error) {
      console.log('Write tool error:', error);
      throw error;
    }
  });

  it('should debug bash tool response structure', async () => {
    const bashTool = new BashTool();

    try {
      const result = await bashTool.execute({
        command: 'echo "Hello World"'
      });

      console.log('Bash tool result:', JSON.stringify(result, null, 2));
      console.log('Bash tool result keys:', Object.keys(result));

      // Basic verification that it returns something
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');

    } catch (error) {
      console.log('Bash tool error:', error);
      throw error;
    }
  });

  it('should verify tool definitions exist', () => {
    const browserTool = new BrowserTool({ headless: true });
    const readTool = new ReadTool();
    const writeTool = new WriteTool();
    const bashTool = new BashTool();

    // Check that tools have the expected structure
    expect(browserTool.getDefinition().name).toBe('Browser');
    expect(readTool.getDefinition().name).toBe('Read');
    expect(writeTool.getDefinition().name).toBe('Write');
    expect(bashTool.getDefinition().name).toBe('Bash');

    // Check execution methods exist
    expect(typeof browserTool.execute).toBe('function');
    expect(typeof readTool.execute).toBe('function');
    expect(typeof writeTool.execute).toBe('function');
    expect(typeof bashTool.execute).toBe('function');
  });
});