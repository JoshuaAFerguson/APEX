/**
 * Integration tests for MockServer class
 *
 * Tests for real-world usage scenarios and integration patterns
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockServer } from '../mock-server';

describe('MockServer Integration', () => {
  let mockServer: MockServer;

  afterEach(async () => {
    if (mockServer && mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  describe('Real-world API mocking scenarios', () => {
    it('should mock a REST API with CRUD operations', async () => {
      mockServer = new MockServer();

      // In-memory data store for the mock API
      const dataStore = new Map();
      let nextId = 1;

      await mockServer.addRoutes((app) => {
        // GET /api/items - List all items
        app.get('/api/items', async () => {
          return { items: Array.from(dataStore.values()) };
        });

        // GET /api/items/:id - Get single item
        app.get('/api/items/:id', async (request, reply) => {
          const id = (request.params as any).id;
          const item = dataStore.get(id);
          if (!item) {
            return reply.status(404).send({ error: 'Item not found' });
          }
          return { item };
        });

        // POST /api/items - Create new item
        app.post('/api/items', async (request) => {
          const body = request.body as any;
          const item = {
            id: String(nextId++),
            ...body,
            createdAt: new Date().toISOString(),
          };
          dataStore.set(item.id, item);
          return { item };
        });

        // PUT /api/items/:id - Update item
        app.put('/api/items/:id', async (request, reply) => {
          const id = (request.params as any).id;
          const body = request.body as any;
          const existing = dataStore.get(id);
          if (!existing) {
            return reply.status(404).send({ error: 'Item not found' });
          }
          const updated = {
            ...existing,
            ...body,
            updatedAt: new Date().toISOString(),
          };
          dataStore.set(id, updated);
          return { item: updated };
        });

        // DELETE /api/items/:id - Delete item
        app.delete('/api/items/:id', async (request, reply) => {
          const id = (request.params as any).id;
          if (!dataStore.has(id)) {
            return reply.status(404).send({ error: 'Item not found' });
          }
          dataStore.delete(id);
          return reply.status(204).send();
        });
      });

      await mockServer.start();
      const baseUrl = mockServer.getUrl();

      // Test the complete CRUD workflow

      // 1. Initially empty
      let response = await fetch(`${baseUrl}/api/items`);
      let data = await response.json();
      expect(data.items).toHaveLength(0);

      // 2. Create new item
      response = await fetch(`${baseUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Item', description: 'A test item' }),
      });
      data = await response.json();
      expect(response.status).toBe(200);
      expect(data.item).toMatchObject({
        id: '1',
        name: 'Test Item',
        description: 'A test item',
      });

      // 3. Get the created item
      response = await fetch(`${baseUrl}/api/items/1`);
      data = await response.json();
      expect(response.status).toBe(200);
      expect(data.item.name).toBe('Test Item');

      // 4. Update the item
      response = await fetch(`${baseUrl}/api/items/1`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Item' }),
      });
      data = await response.json();
      expect(response.status).toBe(200);
      expect(data.item.name).toBe('Updated Item');

      // 5. Delete the item
      response = await fetch(`${baseUrl}/api/items/1`, {
        method: 'DELETE',
      });
      expect(response.status).toBe(204);

      // 6. Verify deletion
      response = await fetch(`${baseUrl}/api/items/1`);
      expect(response.status).toBe(404);
    });

    it('should support test data fixtures', async () => {
      mockServer = new MockServer();

      // Mock fixture data
      const fixtures = {
        users: [
          { id: 1, name: 'Alice', email: 'alice@example.com' },
          { id: 2, name: 'Bob', email: 'bob@example.com' },
        ],
        posts: [
          { id: 1, title: 'Hello World', authorId: 1 },
          { id: 2, title: 'Testing 123', authorId: 2 },
        ],
      };

      await mockServer.addRoutes((app) => {
        app.get('/fixtures/users', async () => ({ users: fixtures.users }));
        app.get('/fixtures/posts', async () => ({ posts: fixtures.posts }));

        app.get('/fixtures/users/:id', async (request, reply) => {
          const id = parseInt((request.params as any).id, 10);
          const user = fixtures.users.find(u => u.id === id);
          if (!user) {
            return reply.status(404).send({ error: 'User not found' });
          }
          return { user };
        });

        // Join endpoint for relational data
        app.get('/fixtures/posts-with-authors', async () => {
          const postsWithAuthors = fixtures.posts.map(post => ({
            ...post,
            author: fixtures.users.find(u => u.id === post.authorId),
          }));
          return { posts: postsWithAuthors };
        });
      });

      await mockServer.start();
      const baseUrl = mockServer.getUrl();

      // Test fixture endpoints
      let response = await fetch(`${baseUrl}/fixtures/users`);
      let data = await response.json();
      expect(data.users).toHaveLength(2);

      response = await fetch(`${baseUrl}/fixtures/posts`);
      data = await response.json();
      expect(data.posts).toHaveLength(2);

      response = await fetch(`${baseUrl}/fixtures/users/1`);
      data = await response.json();
      expect(data.user.name).toBe('Alice');

      response = await fetch(`${baseUrl}/fixtures/posts-with-authors`);
      data = await response.json();
      expect(data.posts[0].author.name).toBe('Alice');
      expect(data.posts[1].author.name).toBe('Bob');
    });
  });

  describe('Testing framework integration', () => {
    it('should work seamlessly in beforeEach/afterEach patterns', async () => {
      const servers: MockServer[] = [];

      // Simulate test setup
      for (let i = 0; i < 3; i++) {
        const server = new MockServer();
        await server.addRoutes((app) => {
          app.get('/test', async () => ({ testId: i }));
        });
        await server.start();
        servers.push(server);
      }

      // Verify each server works independently
      for (let i = 0; i < servers.length; i++) {
        const response = await fetch(`${servers[i].getUrl()}/test`);
        const data = await response.json();
        expect(data.testId).toBe(i);
      }

      // Cleanup (simulate afterEach)
      await Promise.all(servers.map(server => server.stop()));

      servers.forEach(server => {
        expect(server.isRunning()).toBe(false);
      });
    });

    it('should handle content type variations', async () => {
      mockServer = new MockServer();

      await mockServer.addRoutes((app) => {
        // JSON endpoint
        app.post('/api/json', async (request) => {
          return { received: request.body, type: 'json' };
        });

        // Form data endpoint
        app.post('/api/form', async (request) => {
          return { received: request.body, type: 'form' };
        });

        // Text endpoint
        app.post('/api/text', async (request) => {
          return { received: request.body, type: 'text' };
        });
      });

      await mockServer.start();
      const baseUrl = mockServer.getUrl();

      // Test JSON
      let response = await fetch(`${baseUrl}/api/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'json data' }),
      });
      let data = await response.json();
      expect(data.type).toBe('json');
      expect(data.received.test).toBe('json data');

      // Test form data
      const formData = new FormData();
      formData.append('name', 'test user');
      formData.append('email', 'test@example.com');

      response = await fetch(`${baseUrl}/api/form`, {
        method: 'POST',
        body: formData,
      });
      data = await response.json();
      expect(data.type).toBe('form');

      // Test plain text
      response = await fetch(`${baseUrl}/api/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'plain text data',
      });
      data = await response.json();
      expect(data.type).toBe('text');
      expect(data.received).toBe('plain text data');
    });

    it('should support middleware-like functionality', async () => {
      mockServer = new MockServer();

      const requestLog: any[] = [];

      await mockServer.addRoutes((app) => {
        // Add a request logging hook
        app.addHook('onRequest', async (request) => {
          requestLog.push({
            method: request.method,
            url: request.url,
            timestamp: new Date().toISOString(),
          });
        });

        app.get('/tracked-endpoint', async () => {
          return { message: 'This request was logged' };
        });

        app.post('/tracked-endpoint', async (request) => {
          return { message: 'This POST was logged', body: request.body };
        });

        app.get('/logs', async () => {
          return { logs: requestLog };
        });
      });

      await mockServer.start();
      const baseUrl = mockServer.getUrl();

      // Make several requests
      await fetch(`${baseUrl}/tracked-endpoint`);
      await fetch(`${baseUrl}/tracked-endpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });

      // Check logs
      const response = await fetch(`${baseUrl}/logs`);
      const data = await response.json();

      expect(data.logs.length).toBeGreaterThanOrEqual(2);
      expect(data.logs.some((log: any) => log.method === 'GET')).toBe(true);
      expect(data.logs.some((log: any) => log.method === 'POST')).toBe(true);
    });
  });
});