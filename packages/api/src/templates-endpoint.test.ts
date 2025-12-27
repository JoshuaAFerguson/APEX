import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { createServer } from './index';
import { FastifyInstance } from 'fastify';

// Mock the orchestrator for focused template testing
vi.mock('@apex/orchestrator', () => {
  const mockTemplate = {
    id: 'template_test_123',
    name: 'Test Template',
    description: 'A test template for testing',
    workflow: 'feature',
    priority: 'normal' as const,
    effort: 'medium' as const,
    acceptanceCriteria: 'Should pass all tests',
    tags: ['test'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  class MockOrchestrator {
    private templates: Map<string, typeof mockTemplate> = new Map();

    async initialize() {}

    async createTemplate(data: Omit<typeof mockTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
      const template = {
        ...data,
        id: `template_${Date.now()}_test`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.templates.set(template.id, template);
      return template;
    }

    async listTemplates() {
      return Array.from(this.templates.values());
    }

    async getTemplate(id: string) {
      return this.templates.get(id) || null;
    }

    // Required for other API endpoints to work
    async createTask() { throw new Error('Not implemented in template test'); }
    async getTask() { throw new Error('Not implemented in template test'); }
    async listTasks() { throw new Error('Not implemented in template test'); }
    async updateTaskStatus() { throw new Error('Not implemented in template test'); }
    async trashTask() { throw new Error('Not implemented in template test'); }
    async restoreTask() { throw new Error('Not implemented in template test'); }
    async listTrashedTasks() { throw new Error('Not implemented in template test'); }
    async emptyTrash() { throw new Error('Not implemented in template test'); }
    async archiveTask() { throw new Error('Not implemented in template test'); }
    async listArchivedTasks() { throw new Error('Not implemented in template test'); }
    async getAgents() { return {}; }
    async getConfig() { return {}; }

    on() {}
    emit() {}
  }

  return {
    ApexOrchestrator: MockOrchestrator,
  };
});

describe('Templates API Focused Tests', () => {
  let testDir: string;
  let server: FastifyInstance;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-template-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Create minimal config
    await fs.writeFile(
      path.join(testDir, '.apex', 'config.yaml'),
      `version: "1.0"\nproject:\n  name: test-project\n`
    );

    server = await createServer({
      port: 0,
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true,
    });
  });

  afterEach(async () => {
    await server.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('POST /templates - Comprehensive Validation', () => {
    it('should create a template with all valid fields', async () => {
      const templateData = {
        name: 'Advanced Template',
        description: 'A comprehensive template with all fields',
        workflow: 'feature',
        priority: 'high',
        effort: 'large',
        acceptanceCriteria: 'Must implement feature X, Y, and Z with full test coverage',
        tags: ['feature', 'backend', 'api']
      };

      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: templateData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify all fields are correctly saved
      expect(body.id).toMatch(/^template_\d+_test$/);
      expect(body.name).toBe(templateData.name);
      expect(body.description).toBe(templateData.description);
      expect(body.workflow).toBe(templateData.workflow);
      expect(body.priority).toBe(templateData.priority);
      expect(body.effort).toBe(templateData.effort);
      expect(body.acceptanceCriteria).toBe(templateData.acceptanceCriteria);
      expect(body.tags).toEqual(templateData.tags);
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();
      expect(new Date(body.createdAt)).toBeInstanceOf(Date);
      expect(new Date(body.updatedAt)).toBeInstanceOf(Date);
    });

    it('should apply correct defaults for optional fields', async () => {
      const templateData = {
        name: 'Minimal Template',
        description: 'Only required fields',
        workflow: 'bugfix'
      };

      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: templateData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.priority).toBe('normal'); // Default value
      expect(body.effort).toBe('medium'); // Default value
      expect(body.tags).toEqual([]); // Default empty array
      expect(body.acceptanceCriteria).toBeUndefined(); // Should not be set if not provided
    });

    it('should validate all priority options', async () => {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];

      for (const priority of validPriorities) {
        const templateData = {
          name: `Template ${priority}`,
          description: `Template with ${priority} priority`,
          workflow: 'feature',
          priority
        };

        const response = await server.inject({
          method: 'POST',
          url: '/templates',
          headers: { 'Content-Type': 'application/json' },
          payload: templateData,
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.priority).toBe(priority);
      }
    });

    it('should validate all effort options', async () => {
      const validEfforts = ['xs', 'small', 'medium', 'large', 'xl'];

      for (const effort of validEfforts) {
        const templateData = {
          name: `Template ${effort}`,
          description: `Template with ${effort} effort`,
          workflow: 'feature',
          effort
        };

        const response = await server.inject({
          method: 'POST',
          url: '/templates',
          headers: { 'Content-Type': 'application/json' },
          payload: templateData,
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.effort).toBe(effort);
      }
    });

    it('should reject requests with malformed JSON', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: '{ invalid json',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Template name is required');
    });

    it('should reject name with only whitespace', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: '   \t\n   ',
          description: 'Valid description',
          workflow: 'feature'
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Template name is required');
    });

    it('should handle very long valid names up to 100 characters', async () => {
      const validLongName = 'x'.repeat(100);
      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: validLongName,
          description: 'Valid description',
          workflow: 'feature'
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe(validLongName);
    });

    it('should properly trim whitespace from all string fields', async () => {
      const templateData = {
        name: '   Test Template   ',
        description: '   Test description   ',
        workflow: '   feature   ',
        acceptanceCriteria: '   Test criteria   '
      };

      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: templateData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.name).toBe('Test Template');
      expect(body.description).toBe('Test description');
      expect(body.workflow).toBe('feature');
      expect(body.acceptanceCriteria).toBe('Test criteria');
    });

    it('should handle tags array properly', async () => {
      const templateData = {
        name: 'Tagged Template',
        description: 'Template with multiple tags',
        workflow: 'feature',
        tags: ['frontend', 'react', 'typescript', 'testing']
      };

      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: templateData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.tags).toEqual(['frontend', 'react', 'typescript', 'testing']);
    });

    it('should handle empty tags array', async () => {
      const templateData = {
        name: 'No Tags Template',
        description: 'Template with empty tags',
        workflow: 'bugfix',
        tags: []
      };

      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: templateData,
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.tags).toEqual([]);
    });

    it('should reject invalid priority values with detailed error', async () => {
      const invalidPriorities = ['super-high', 'lowest', 'critical', 'medium', ''];

      for (const invalidPriority of invalidPriorities) {
        const response = await server.inject({
          method: 'POST',
          url: '/templates',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            name: 'Test Template',
            description: 'Test description',
            workflow: 'feature',
            priority: invalidPriority
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Priority must be one of: low, normal, high, urgent');
      }
    });

    it('should reject invalid effort values with detailed error', async () => {
      const invalidEfforts = ['tiny', 'huge', 'epic', 'xxl', ''];

      for (const invalidEffort of invalidEfforts) {
        const response = await server.inject({
          method: 'POST',
          url: '/templates',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            name: 'Test Template',
            description: 'Test description',
            workflow: 'feature',
            effort: invalidEffort
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Effort must be one of: xs, small, medium, large, xl');
      }
    });
  });

  describe('GET /templates', () => {
    it('should handle concurrent template creation and listing', async () => {
      // Create multiple templates concurrently
      const createPromises = Array.from({ length: 5 }, (_, i) =>
        server.inject({
          method: 'POST',
          url: '/templates',
          headers: { 'Content-Type': 'application/json' },
          payload: {
            name: `Template ${i}`,
            description: `Description ${i}`,
            workflow: 'feature',
          },
        })
      );

      const createResponses = await Promise.all(createPromises);
      createResponses.forEach(response => {
        expect(response.statusCode).toBe(201);
      });

      // List all templates
      const listResponse = await server.inject({
        method: 'GET',
        url: '/templates',
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);
      expect(body.templates).toHaveLength(5);
      expect(body.count).toBe(5);

      // Verify all templates are present
      const templateNames = body.templates.map((t: any) => t.name);
      for (let i = 0; i < 5; i++) {
        expect(templateNames).toContain(`Template ${i}`);
      }
    });

    it('should return consistent response structure for empty list', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/templates',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('templates');
      expect(body).toHaveProperty('count');
      expect(body.templates).toBeInstanceOf(Array);
      expect(body.templates).toHaveLength(0);
      expect(body.count).toBe(0);
    });
  });

  describe('GET /templates/:id', () => {
    it('should validate ID parameter is not empty or just whitespace', async () => {
      const invalidIds = ['', ' ', '\t', '\n', '   '];

      for (const invalidId of invalidIds) {
        const response = await server.inject({
          method: 'GET',
          url: `/templates/${encodeURIComponent(invalidId)}`,
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Template ID is required');
      }
    });

    it('should handle special characters in template IDs gracefully', async () => {
      const specialIds = ['template@123', 'template%20with%20spaces', 'template-with-dashes', 'template_with_underscores'];

      for (const specialId of specialIds) {
        const response = await server.inject({
          method: 'GET',
          url: `/templates/${encodeURIComponent(specialId)}`,
        });

        expect(response.statusCode).toBe(404);
        const body = JSON.parse(response.body);
        expect(body.error).toBe('Template not found');
      }
    });

    it('should retrieve template immediately after creation', async () => {
      // Create a template
      const createResponse = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: 'Immediate Retrieval Test',
          description: 'Test immediate template retrieval',
          workflow: 'feature',
          priority: 'urgent',
          effort: 'xl',
          acceptanceCriteria: 'Must be retrievable immediately',
          tags: ['test', 'immediate']
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createdTemplate = JSON.parse(createResponse.body);

      // Immediately retrieve it
      const getResponse = await server.inject({
        method: 'GET',
        url: `/templates/${createdTemplate.id}`,
      });

      expect(getResponse.statusCode).toBe(200);
      const retrievedTemplate = JSON.parse(getResponse.body);

      // Verify all data matches exactly
      expect(retrievedTemplate).toEqual(createdTemplate);
    });
  });

  describe('Template API Edge Cases', () => {
    it('should handle Content-Type variations', async () => {
      const contentTypes = [
        'application/json',
        'application/json; charset=utf-8',
        'application/JSON'
      ];

      for (const contentType of contentTypes) {
        const response = await server.inject({
          method: 'POST',
          url: '/templates',
          headers: { 'Content-Type': contentType },
          payload: {
            name: `Template ${contentType}`,
            description: 'Content type test',
            workflow: 'feature'
          },
        });

        expect(response.statusCode).toBe(201);
      }
    });

    it('should handle missing Content-Type header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        payload: JSON.stringify({
          name: 'No Content Type',
          description: 'Test without content type',
          workflow: 'feature'
        }),
      });

      // Should still work with properly formatted JSON
      expect(response.statusCode).toBe(201);
    });

    it('should handle very large but valid payloads', async () => {
      const largeDescription = 'x'.repeat(5000);
      const largeCriteria = 'y'.repeat(3000);
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag${i}`);

      const response = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: 'Large Template',
          description: largeDescription,
          workflow: 'feature',
          acceptanceCriteria: largeCriteria,
          tags: manyTags
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.description).toBe(largeDescription);
      expect(body.acceptanceCriteria).toBe(largeCriteria);
      expect(body.tags).toEqual(manyTags);
    });
  });

  // ============================================================================
  // Missing Error Handling Tests for GET Endpoints
  // ============================================================================

  describe('GET /templates - Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      // Mock orchestrator to throw an error
      const mockOrchestrator = (server as any).orchestrator;
      const originalListTemplates = mockOrchestrator.listTemplates;
      mockOrchestrator.listTemplates = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      const response = await server.inject({
        method: 'GET',
        url: '/templates',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Database connection failed');

      // Restore original method
      mockOrchestrator.listTemplates = originalListTemplates;
    });

    it('should handle non-Error exceptions from orchestrator', async () => {
      // Mock orchestrator to throw a non-Error
      const mockOrchestrator = (server as any).orchestrator;
      const originalListTemplates = mockOrchestrator.listTemplates;
      mockOrchestrator.listTemplates = vi.fn().mockRejectedValue('String error');

      const response = await server.inject({
        method: 'GET',
        url: '/templates',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to list templates');

      // Restore original method
      mockOrchestrator.listTemplates = originalListTemplates;
    });
  });

  describe('GET /templates/:id - Error Handling', () => {
    it('should handle orchestrator errors gracefully', async () => {
      // Mock orchestrator to throw an error
      const mockOrchestrator = (server as any).orchestrator;
      const originalGetTemplate = mockOrchestrator.getTemplate;
      mockOrchestrator.getTemplate = vi.fn().mockRejectedValue(new Error('Database query failed'));

      const response = await server.inject({
        method: 'GET',
        url: '/templates/test-id',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Database query failed');

      // Restore original method
      mockOrchestrator.getTemplate = originalGetTemplate;
    });

    it('should handle non-Error exceptions from orchestrator', async () => {
      // Mock orchestrator to throw a non-Error
      const mockOrchestrator = (server as any).orchestrator;
      const originalGetTemplate = mockOrchestrator.getTemplate;
      mockOrchestrator.getTemplate = vi.fn().mockRejectedValue('String error');

      const response = await server.inject({
        method: 'GET',
        url: '/templates/test-id',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to get template');

      // Restore original method
      mockOrchestrator.getTemplate = originalGetTemplate;
    });

    it('should handle very long template IDs', async () => {
      const longId = 'x'.repeat(1000);
      const response = await server.inject({
        method: 'GET',
        url: `/templates/${longId}`,
      });

      // Should still work - backend should handle long IDs gracefully
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Template not found');
    });
  });

  // ============================================================================
  // Additional Edge Cases to Meet Acceptance Criteria
  // ============================================================================

  describe('GET Endpoints - Acceptance Criteria Validation', () => {
    it('should return exact format for GET /templates with populated database', async () => {
      // Create a few templates to test populated database
      const templates = [
        {
          name: 'Template 1',
          description: 'First template',
          workflow: 'feature',
          priority: 'high',
          effort: 'large',
          tags: ['test']
        },
        {
          name: 'Template 2',
          description: 'Second template',
          workflow: 'bugfix',
          priority: 'urgent',
          effort: 'small'
        }
      ];

      const createdTemplates = [];
      for (const template of templates) {
        const response = await server.inject({
          method: 'POST',
          url: '/templates',
          headers: { 'Content-Type': 'application/json' },
          payload: template,
        });
        expect(response.statusCode).toBe(201);
        createdTemplates.push(JSON.parse(response.body));
      }

      // Test the GET /templates endpoint
      const listResponse = await server.inject({
        method: 'GET',
        url: '/templates',
      });

      expect(listResponse.statusCode).toBe(200);
      const body = JSON.parse(listResponse.body);

      // Verify exact acceptance criteria format
      expect(body).toHaveProperty('templates');
      expect(body).toHaveProperty('count');
      expect(Array.isArray(body.templates)).toBe(true);
      expect(typeof body.count).toBe('number');
      expect(body.count).toBe(body.templates.length);
      expect(body.templates.length).toBeGreaterThanOrEqual(2);

      // Verify each template has all required fields
      body.templates.forEach((template: any) => {
        expect(template).toHaveProperty('id');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('workflow');
        expect(template).toHaveProperty('priority');
        expect(template).toHaveProperty('effort');
        expect(template).toHaveProperty('createdAt');
        expect(template).toHaveProperty('updatedAt');
      });
    });

    it('should return exact format for GET /templates/:id with existing template', async () => {
      // Create a template
      const createResponse = await server.inject({
        method: 'POST',
        url: '/templates',
        headers: { 'Content-Type': 'application/json' },
        payload: {
          name: 'Detail Test Template',
          description: 'For testing detailed retrieval',
          workflow: 'feature',
          priority: 'normal',
          effort: 'medium',
          acceptanceCriteria: 'Should return complete template object',
          tags: ['test', 'acceptance']
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createdTemplate = JSON.parse(createResponse.body);

      // Test GET /templates/:id endpoint
      const getResponse = await server.inject({
        method: 'GET',
        url: `/templates/${createdTemplate.id}`,
      });

      expect(getResponse.statusCode).toBe(200);
      const retrievedTemplate = JSON.parse(getResponse.body);

      // Verify it returns the complete template object (not wrapped)
      expect(retrievedTemplate).toEqual(createdTemplate);
      expect(retrievedTemplate.id).toBe(createdTemplate.id);
      expect(retrievedTemplate.name).toBe('Detail Test Template');
      expect(retrievedTemplate.description).toBe('For testing detailed retrieval');
      expect(retrievedTemplate.workflow).toBe('feature');
      expect(retrievedTemplate.priority).toBe('normal');
      expect(retrievedTemplate.effort).toBe('medium');
      expect(retrievedTemplate.acceptanceCriteria).toBe('Should return complete template object');
      expect(retrievedTemplate.tags).toEqual(['test', 'acceptance']);
    });

    it('should demonstrate correct behavior with empty database', async () => {
      // The empty database test is already covered in line 411-425
      // This is just for clarity in meeting acceptance criteria

      const response = await server.inject({
        method: 'GET',
        url: '/templates',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      // Verify empty database works correctly
      expect(body).toEqual({
        templates: [],
        count: 0
      });
    });

    it('should demonstrate 404 behavior for non-existent template', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/templates/non-existent-id-12345',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Template not found');
    });
  });
});