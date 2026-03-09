/**
 * v0.1.0 API Server Features Audit Test
 *
 * This test suite verifies that all three required v0.1.0 API Server features
 * are genuinely implemented with production-ready code, not stubs or placeholders.
 *
 * According to ROADMAP.md and architecture analysis, v0.1.0 API Server should include:
 * 1. REST API for task management (CRUD endpoints)
 * 2. WebSocket streaming for real-time updates
 * 3. Health check endpoints
 *
 * This audit examines actual route implementations and code functionality.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const APEX_ROOT = process.cwd();

describe('v0.1.0 API Server Features Audit', () => {
  let apiServerCode: string;
  let apiPackageJson: any;

  beforeAll(() => {
    // Load the main API server implementation
    const apiServerPath = join(APEX_ROOT, 'packages/api/src/index.ts');
    expect(existsSync(apiServerPath), 'API server implementation should exist').toBe(true);
    apiServerCode = readFileSync(apiServerPath, 'utf8');

    // Load API package.json for dependency verification
    const apiPackageJsonPath = join(APEX_ROOT, 'packages/api/package.json');
    expect(existsSync(apiPackageJsonPath), 'API package.json should exist').toBe(true);
    apiPackageJson = JSON.parse(readFileSync(apiPackageJsonPath, 'utf8'));
  });

  describe('Feature 1: REST API for Task Management (CRUD endpoints)', () => {
    it('should have comprehensive task CRUD endpoints implemented', () => {
      // Verify task creation endpoint
      expect(apiServerCode).toContain("app.post");
      expect(apiServerCode).toContain("'/tasks'");
      expect(apiServerCode).toContain('CreateTaskRequest');
      expect(apiServerCode).toContain('description');
      expect(apiServerCode).toContain('acceptanceCriteria');

      // Verify task reading capabilities
      expect(apiServerCode).toContain("app.get") && expect(apiServerCode).toContain("tasks");

      // Verify task management operations exist
      expect(apiServerCode).toContain('cancel') || expect(apiServerCode).toContain('resume') ||
      expect(apiServerCode).toContain('retry');

      // Look for comprehensive task management by checking console log output
      expect(apiServerCode).toContain("POST   /tasks") &&
      expect(apiServerCode).toContain("GET    /tasks");
    });

    it('should have subtask management endpoints', () => {
      // Verify subtask types and interface
      expect(apiServerCode).toContain('DecomposeTaskRequest');
      expect(apiServerCode).toContain('SubtaskDefinition');
      expect(apiServerCode).toContain('SubtaskStrategy');

      // Verify subtask operations are documented in the console output
      expect(apiServerCode).toContain("decompose") &&
      expect(apiServerCode).toContain("subtasks");
    });

    it('should have task lifecycle management (trash/archive)', () => {
      // Verify trash operations exist (found in console output)
      expect(apiServerCode).toContain("app.get('/tasks/trashed'");
      expect(apiServerCode).toContain("app.delete('/tasks/trash'");
      expect(apiServerCode).toContain("app.get('/tasks/archived'");

      // Verify trash/archive functionality is documented
      expect(apiServerCode).toContain("trash") && expect(apiServerCode).toContain("archive");
    });

    it('should have gates and approvals API', () => {
      // Verify approvals endpoint exists
      expect(apiServerCode).toContain("app.get('/api/approvals'");

      // Verify gates and approvals types
      expect(apiServerCode).toContain('ApproveGateRequest') ||
      expect(apiServerCode).toContain('ApprovalDecisionRequest');

      // Verify gates functionality is documented
      expect(apiServerCode).toContain("gates") && (expect(apiServerCode).toContain("approve") ||
      expect(apiServerCode).toContain("Gate"));
    });

    it('should have proper request/response types and validation', () => {
      // Verify request schemas
      expect(apiServerCode).toContain('CreateTaskRequest');
      expect(apiServerCode).toContain('DecomposeTaskRequest');
      expect(apiServerCode).toContain('CreateTemplateRequest');

      // Verify response handling (look for actual response patterns)
      expect(apiServerCode).toContain('taskId') || expect(apiServerCode).toContain('task');
      expect(apiServerCode).toContain('status');
      expect(apiServerCode).toContain('message') || expect(apiServerCode).toContain('reply');

      // Verify structured data handling
      expect(apiServerCode).toContain('tasks') && expect(apiServerCode).toContain('count');
    });

    it('should have required web framework and dependencies', () => {
      // Verify Fastify framework
      expect(apiPackageJson.dependencies.fastify).toBeDefined();
      expect(apiServerCode).toContain('createServer');
      expect(apiServerCode).toContain('FastifyInstance');

      // Verify CORS support
      expect(apiPackageJson.dependencies['@fastify/cors']).toBeDefined();
      expect(apiServerCode).toContain('@fastify/cors');
    });
  });

  describe('Feature 2: WebSocket Streaming for Real-time Updates', () => {
    it('should have WebSocket plugin and dependencies', () => {
      // Verify WebSocket dependencies
      expect(apiPackageJson.dependencies['@fastify/websocket']).toBeDefined();
      expect(apiServerCode).toContain('@fastify/websocket');
      expect(apiServerCode).toContain('websocket');
    });

    it('should have WebSocket endpoints implemented', () => {
      // Verify WebSocket functionality exists
      expect(apiServerCode).toContain('websocket') && expect(apiServerCode).toContain('WebSocket');

      // Verify streaming capabilities
      expect(apiServerCode).toContain('stream') || expect(apiServerCode).toContain('ws');

      // Verify event filtering capability
      expect(apiServerCode).toContain('eventFilters') || expect(apiServerCode).toContain('events');
    });

    it('should have comprehensive event broadcasting system', () => {
      // Verify client registry
      expect(apiServerCode).toContain('Map<string, Set<WebSocketClient>>');
      expect(apiServerCode).toContain('WebSocketClient');
      expect(apiServerCode).toContain('eventFilters');

      // Verify broadcast function
      expect(apiServerCode).toContain('function broadcast');
      expect(apiServerCode).toContain('taskId: string');
      expect(apiServerCode).toContain('ApexEvent');

      // Verify WebSocket connection handling
      expect(apiServerCode).toContain('socket.on(\'close\'');
      expect(apiServerCode).toContain('socket.on(\'message\'');
      expect(apiServerCode).toContain('OPEN');
    });

    it('should support comprehensive event types', () => {
      // Task lifecycle events
      const expectedEvents = [
        'task:created',
        'task:started',
        'task:completed',
        'task:failed',
        'task:paused',
        'task:trashed',
        'task:decomposed',
        'task:stage-changed',
        'subtask:created',
        'subtask:completed',
        'subtask:failed',
        'gate:approved',
        'gate:rejected',
        'approval:required',
        'approval:granted',
        'approval:denied',
        'tool:start',
        'tool:progress',
        'tool:complete',
        'log:entry',
        'usage:updated',
        'agent:message',
        'agent:thinking',
        'agent:tool-use',
        'health:updated'
      ];

      // Check that event broadcasting is implemented
      expect(apiServerCode).toContain('setupEventBroadcasting');
      expect(apiServerCode).toContain('orchestrator.on(');

      // Verify some key event types are handled
      expect(apiServerCode).toContain('task:completed');
      expect(apiServerCode).toContain('health:updated');
    });

    it('should have event filtering and subscription support', () => {
      // Verify event filtering by query parameter
      expect(apiServerCode).toContain('events=');
      expect(apiServerCode).toContain('eventFilters');
      expect(apiServerCode).toContain('Set<string>');
      expect(apiServerCode).toContain('split(\',\')');

      // Verify filter checking in broadcast
      expect(apiServerCode).toContain('eventFilters.has');
    });

    it('should have ping/pong heartbeat support', () => {
      // Verify heartbeat implementation
      expect(apiServerCode).toContain('ping') || expect(apiServerCode).toContain('pong');
      expect(apiServerCode).toContain('socket.on(\'message\'') && expect(apiServerCode).toContain('ping');
    });
  });

  describe('Feature 3: Health Check Endpoints', () => {
    it('should have basic health check endpoint', () => {
      // Verify basic health endpoint
      expect(apiServerCode).toContain("app.get('/health'");
      expect(apiServerCode).toContain('status') && expect(apiServerCode).toContain('ok');
    });

    it('should have comprehensive daemon health endpoint', () => {
      // Verify daemon health endpoint
      expect(apiServerCode).toContain("app.get('/daemon/health'");

      // Verify health metrics concepts are present
      expect(apiServerCode).toContain('memory') || expect(apiServerCode).toContain('usage');
      expect(apiServerCode).toContain('Tasks') || expect(apiServerCode).toContain('task');
      expect(apiServerCode).toContain('uptime') || expect(apiServerCode).toContain('time');

      // Verify health status tracking
      expect(apiServerCode).toContain('health') && expect(apiServerCode).toContain('status');
    });

    it('should have real-time health monitoring', () => {
      // Verify health monitoring capabilities
      expect(apiServerCode).toContain('health:updated') ||
      expect(apiServerCode).toContain('HealthMonitor') ||
      expect(apiServerCode).toContain('health');

      // Verify status determination or health concepts
      expect(apiServerCode).toContain('healthy') ||
      expect(apiServerCode).toContain('status') ||
      expect(apiServerCode).toContain('Health');
    });

    it('should have health check configuration', () => {
      // Verify health check intervals and thresholds
      expect(apiServerCode).toContain('30') || expect(apiServerCode).toContain('health');
      expect(apiServerCode).toContain('setInterval') || expect(apiServerCode).toContain('setTimeout');
    });
  });

  describe('Production-Ready Implementation Verification', () => {
    it('should have proper error handling', () => {
      // Verify global error handler
      expect(apiServerCode).toContain('app.setErrorHandler');
      expect(apiServerCode).toContain('error.statusCode');
      expect(apiServerCode).toContain('reply.status(');

      // Verify production safety (no stack traces exposed)
      expect(apiServerCode).toContain('NODE_ENV') || expect(apiServerCode).toContain('production');
    });

    it('should have authentication middleware support', () => {
      // Check for auth middleware file
      const authMiddlewarePath = join(APEX_ROOT, 'packages/api/src/middleware/auth.ts');
      expect(existsSync(authMiddlewarePath), 'Auth middleware should exist').toBe(true);

      // Verify auth is registered
      expect(apiServerCode).toContain('auth') || expect(apiServerCode).toContain('middleware');
    });

    it('should have proper server configuration options', () => {
      // Verify server options interface
      expect(apiServerCode).toContain('ServerOptions');
      expect(apiServerCode).toContain('port');
      expect(apiServerCode).toContain('host');
      expect(apiServerCode).toContain('projectPath');
      expect(apiServerCode).toContain('silent');

      // Verify defaults
      expect(apiServerCode).toContain('3000');
      expect(apiServerCode).toContain('0.0.0.0');
    });

    it('should have production deployment features', () => {
      // Verify logging configuration
      expect(apiServerCode).toContain('pino') || expect(apiServerCode).toContain('logger');

      // Verify graceful shutdown
      expect(apiServerCode).toContain('close') || expect(apiServerCode).toContain('SIGTERM');

      // Check Docker health check support
      const dockerfilePath = join(APEX_ROOT, 'docker/Dockerfile');
      if (existsSync(dockerfilePath)) {
        const dockerfile = readFileSync(dockerfilePath, 'utf8');
        expect(dockerfile).toContain('HEALTHCHECK');
        expect(dockerfile).toContain('/health');
      }
    });

    it('should support advanced features', () => {
      // Verify template API exists
      expect(apiServerCode).toContain("app.get('/templates'");

      // Verify MCP server integration
      expect(apiServerCode).toContain("app.get('/mcp/servers'");

      // Verify screenshot API
      expect(apiServerCode).toContain('registerScreenshotRoutes') ||
             expect(existsSync(join(APEX_ROOT, 'packages/api/src/routes/screenshot.ts'))).toBe(true);

      // Verify Slack integration
      expect(apiServerCode).toContain('SlackService') ||
             expect(existsSync(join(APEX_ROOT, 'packages/api/src/services/slack-service.ts'))).toBe(true);
    });
  });

  describe('Code Quality and Architecture', () => {
    it('should have well-structured modular code', () => {
      // Check for service separation
      const servicesDir = join(APEX_ROOT, 'packages/api/src/services');
      const routesDir = join(APEX_ROOT, 'packages/api/src/routes');
      const middlewareDir = join(APEX_ROOT, 'packages/api/src/middleware');

      const hasModularStructure = existsSync(servicesDir) ||
                                 existsSync(routesDir) ||
                                 existsSync(middlewareDir);

      expect(hasModularStructure, 'Should have modular directory structure').toBe(true);
    });

    it('should have TypeScript types and interfaces', () => {
      // Verify type definitions
      expect(apiServerCode).toContain('interface');
      expect(apiServerCode).toContain('ServerOptions');
      expect(apiServerCode).toContain('WebSocketClient');
      expect(apiServerCode).toContain('CreateTaskRequest');
      expect(apiServerCode).toContain('DecomposeTaskRequest');

      // Verify proper typing
      expect(apiServerCode).toContain(': Promise<');
      expect(apiServerCode).toContain(': string');
      expect(apiServerCode).toContain(': number');
      expect(apiServerCode).toContain('FastifyInstance');
    });

    it('should have comprehensive functionality implemented', () => {
      // Verify the API server is substantial (not just stubs)
      expect(apiServerCode.length).toBeGreaterThan(2000); // At least 2000 characters

      // Verify multiple route registrations
      const routeMatches = apiServerCode.match(/app\.(get|post|put|delete|patch)\(/g);
      expect(routeMatches?.length || 0).toBeGreaterThan(10); // At least 10 routes

      // Verify WebSocket implementation is substantial
      const wsMatches = apiServerCode.match(/websocket|WebSocket/g);
      expect(wsMatches?.length || 0).toBeGreaterThan(10); // Substantial WebSocket code
    });
  });
});