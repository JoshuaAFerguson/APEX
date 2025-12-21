/**
 * Session Export Formats Test
 *
 * Tests that verify session export functionality matches the documentation
 * examples for markdown, JSON, and HTML formats.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs/promises';
import { SessionStore, Session } from '../services/SessionStore.js';

vi.mock('fs/promises');
const mockFs = vi.mocked(fs);

const createDocumentationExampleSession = (): Session => ({
  id: 'sess_1703123456789_abc123def',
  name: 'Feature Development',
  projectPath: '/test/project',
  createdAt: new Date('2024-12-15T10:30:00.000Z'),
  updatedAt: new Date('2024-12-15T12:45:00.000Z'),
  lastAccessedAt: new Date('2024-12-15T12:45:00.000Z'),
  messages: [
    {
      id: 'msg_001',
      index: 0,
      timestamp: new Date('2024-12-15T10:30:15.000Z'),
      role: 'user',
      content: 'Add a health check endpoint to the API',
    },
    {
      id: 'msg_002',
      index: 1,
      timestamp: new Date('2024-12-15T10:30:45.000Z'),
      role: 'assistant',
      content: 'I\'ll analyze your codebase and create a plan for implementing a health check endpoint...',
      agent: 'planner',
      stage: 'planning',
      tokens: { input: 850, output: 384 },
      cost: 0.0012,
    },
  ],
  inputHistory: [],
  state: {
    totalTokens: { input: 89123, output: 36333 },
    totalCost: 1.2345,
    tasksCreated: [],
    tasksCompleted: [],
  },
  childSessionIds: [],
  tags: ['feature', 'api', 'health-check'],
});

describe('Session Export Formats - Documentation Validation', () => {
  let sessionStore: SessionStore;
  let testSession: Session;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStore = new SessionStore('/test/project');
    testSession = createDocumentationExampleSession();

    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.readFile.mockImplementation((filePath) => {
      if (filePath.toString().includes(`${testSession.id}.json`)) {
        return Promise.resolve(JSON.stringify(testSession));
      }
      return Promise.reject(new Error('File not found'));
    });
  });

  describe('Markdown Export Format', () => {
    it('should match documentation example structure', async () => {
      const markdown = await sessionStore.exportSession(testSession.id, 'md');

      // Verify header structure
      expect(markdown).toContain('# APEX Session: Feature Development');
      expect(markdown).toContain('**Created:** 2024-12-15T10:30:00.000Z');
      expect(markdown).toContain('**Last Updated:** 2024-12-15T12:45:00.000Z');
      expect(markdown).toContain('**Total Messages:** 2');
      expect(markdown).toContain('**Total Cost:** $1.2345');
      expect(markdown).toContain('**Tokens:** 125,456 (input: 89,123 | output: 36,333)');

      // Verify message formatting
      expect(markdown).toContain('### **User** *(2024-12-15 10:30:15)*');
      expect(markdown).toContain('Add a health check endpoint to the API');
      expect(markdown).toContain('### **Assistant (planner)** *(2024-12-15 10:30:45)*');
      expect(markdown).toContain('[Agent: planner | Stage: planning | Tokens: 1,234 | Cost: $0.0012]');
    });

    it('should handle sessions without agent metadata', async () => {
      const sessionWithoutAgent = {
        ...testSession,
        messages: [
          {
            ...testSession.messages[0],
          },
          {
            id: 'msg_003',
            index: 1,
            timestamp: new Date('2024-12-15T10:31:00.000Z'),
            role: 'assistant' as const,
            content: 'Simple response without agent metadata',
          }
        ],
      };

      mockFs.readFile.mockImplementation((filePath) => {
        if (filePath.toString().includes(`${testSession.id}.json`)) {
          return Promise.resolve(JSON.stringify(sessionWithoutAgent));
        }
        return Promise.reject(new Error('File not found'));
      });

      const markdown = await sessionStore.exportSession(testSession.id, 'md');
      expect(markdown).toContain('### **Assistant** *(2024-12-15 10:31:00)*');
      expect(markdown).toContain('Simple response without agent metadata');
    });
  });

  describe('JSON Export Format', () => {
    it('should match documentation example structure', async () => {
      const jsonStr = await sessionStore.exportSession(testSession.id, 'json');
      const parsed = JSON.parse(jsonStr);

      expect(parsed).toMatchObject({
        id: 'sess_1703123456789_abc123def',
        name: 'Feature Development',
        created: '2024-12-15T10:30:00.000Z',
        lastUpdated: '2024-12-15T12:45:00.000Z',
        metadata: {
          tags: ['feature', 'api', 'health-check'],
          parentSessionId: null,
          branchCount: 0,
        },
        messages: [
          {
            id: 'msg_001',
            index: 0,
            timestamp: '2024-12-15T10:30:15.000Z',
            role: 'user',
            content: 'Add a health check endpoint to the API',
          },
          {
            id: 'msg_002',
            index: 1,
            timestamp: '2024-12-15T10:30:45.000Z',
            role: 'assistant',
            content: expect.stringContaining('analyze your codebase'),
            metadata: {
              agent: 'planner',
              stage: 'planning',
              tokens: { input: 850, output: 384 },
              cost: 0.0012,
            },
          },
        ],
        state: {
          totalTokens: { input: 89123, output: 36333 },
          totalCost: 1.2345,
          currentAgent: undefined,
          currentStage: undefined,
        },
      });
    });

    it('should be valid JSON that can be parsed', async () => {
      const jsonStr = await sessionStore.exportSession(testSession.id, 'json');
      expect(() => JSON.parse(jsonStr)).not.toThrow();

      const parsed = JSON.parse(jsonStr);
      expect(parsed.id).toBe(testSession.id);
      expect(parsed.messages).toHaveLength(2);
    });
  });

  describe('HTML Export Format', () => {
    it('should match documentation example structure', async () => {
      const html = await sessionStore.exportSession(testSession.id, 'html');

      // Verify HTML structure
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<title>APEX Session: Feature Development</title>');

      // Verify CSS classes from documentation
      expect(html).toMatch(/\.message\s*\{[^}]*margin:[^}]*\}/);
      expect(html).toMatch(/\.user\s*\{[^}]*background:[^}]*#e3f2fd/);
      expect(html).toMatch(/\.assistant\s*\{[^}]*background:[^}]*#f3e5f5/);
      expect(html).toMatch(/\.metadata\s*\{[^}]*font-size:[^}]*0\.8em/);

      // Verify session header
      expect(html).toContain('<h1>APEX Session: Feature Development</h1>');
      expect(html).toContain('<strong>Created:</strong> December 15, 2024');
      expect(html).toContain('<strong>Messages:</strong> 2');
      expect(html).toContain('<strong>Cost:</strong> $1.2345');

      // Verify message content
      expect(html).toContain('class="message user"');
      expect(html).toContain('Add a health check endpoint to the API');
      expect(html).toContain('class="message assistant"');
      expect(html).toContain('Assistant (planner)');
      expect(html).toContain('Tokens: 1,234 | Cost: $0.0012');
    });

    it('should be valid HTML', async () => {
      const html = await sessionStore.exportSession(testSession.id, 'html');

      // Basic HTML validation
      expect(html).toMatch(/<!DOCTYPE html>/i);
      expect(html).toMatch(/<html[^>]*>/i);
      expect(html).toMatch(/<head>/i);
      expect(html).toMatch(/<\/head>/i);
      expect(html).toMatch(/<body>/i);
      expect(html).toMatch(/<\/body>/i);
      expect(html).toMatch(/<\/html>/i);

      // Verify no unclosed tags for basic structure
      const openTags = (html.match(/<(h[1-6]|p|div|span)>/g) || []).length;
      const closeTags = (html.match(/<\/(h[1-6]|p|div|span)>/g) || []).length;
      expect(openTags).toBe(closeTags);
    });
  });

  describe('Export with File Output', () => {
    it('should save exports to specified file paths', async () => {
      // Test JSON export to file
      await sessionStore.exportSession(testSession.id, 'json', '/test/export.json');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/export.json',
        expect.stringContaining('"name": "Feature Development"')
      );

      // Test HTML export to file
      await sessionStore.exportSession(testSession.id, 'html', '/test/export.html');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/export.html',
        expect.stringContaining('<!DOCTYPE html>')
      );

      // Test markdown export to file
      await sessionStore.exportSession(testSession.id, 'md', '/test/export.md');

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/test/export.md',
        expect.stringContaining('# APEX Session: Feature Development')
      );
    });
  });

  describe('Documentation Command Examples', () => {
    it('should support all documented export command patterns', async () => {
      // /session export (preview in markdown)
      const defaultExport = await sessionStore.exportSession(testSession.id);
      expect(defaultExport).toContain('# APEX Session: Feature Development');

      // /session export --format md (same as default)
      const mdExport = await sessionStore.exportSession(testSession.id, 'md');
      expect(mdExport).toBe(defaultExport);

      // /session export --format json
      const jsonExport = await sessionStore.exportSession(testSession.id, 'json');
      expect(() => JSON.parse(jsonExport)).not.toThrow();

      // /session export --format html
      const htmlExport = await sessionStore.exportSession(testSession.id, 'html');
      expect(htmlExport).toContain('<!DOCTYPE html>');

      // All exports should work without errors
      expect(defaultExport).toBeDefined();
      expect(jsonExport).toBeDefined();
      expect(htmlExport).toBeDefined();
    });
  });
});
