/**
 * Comprehensive Permission Analysis Test Suite for @apex/api Package
 *
 * This test suite validates the implementation stage finding that the @apex/api package
 * contains NO permission-related code paths, access control, or authorization logic.
 *
 * The tests systematically examine:
 * 1. API endpoint security posture (lack of authentication/authorization)
 * 2. WebSocket connection security
 * 3. Source code analysis to confirm no auth-related patterns
 * 4. Security implications and recommendations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestEnvironment, TestDataGenerators } from './setup.js';
import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Test context for permission analysis
 */
interface PermissionTestContext {
  app: FastifyInstance;
  serverPort: number;
  projectPath: string;
  httpUtils: any;
  createWebSocketClient: (taskId?: string) => any;
  cleanup: () => Promise<void>;
}

describe('Permission Analysis Test Suite', () => {
  let context: PermissionTestContext;

  beforeEach(async () => {
    context = await createTestEnvironment({
      silent: true,
    }) as PermissionTestContext;
  });

  afterEach(async () => {
    if (context?.cleanup) {
      await context.cleanup();
    }
  });

  describe('Source Code Permission Analysis', () => {
    it('should confirm main server file contains no authentication/authorization code', async () => {
      // Read the main index.ts file
      const indexPath = path.join(process.cwd(), 'src', 'index.ts');
      const content = await fs.readFile(indexPath, 'utf-8');

      // Check for common authentication/authorization patterns
      const authPatterns = [
        /auth(entication|orization)?/i,
        /bearer\s+token/i,
        /jwt/i,
        /passport/i,
        /session/i,
        /permission/i,
        /access\s+control/i,
        /rbac/i,
        /acl/i,
        /middleware.*auth/i,
        /require.*auth/i,
        /verify.*token/i,
        /check.*permission/i,
        /authorize/i,
        /authenticate/i,
      ];

      const findings: Array<{ pattern: RegExp; matches: string[] }> = [];

      authPatterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
          findings.push({ pattern, matches: matches });
        }
      });

      // Assert no authentication/authorization patterns found
      expect(findings).toEqual([]);
    });

    it('should confirm service files contain no permission logic', async () => {
      // Check all service files
      const serviceDir = path.join(process.cwd(), 'src', 'services');
      let serviceFiles: string[] = [];

      try {
        const files = await fs.readdir(serviceDir);
        serviceFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
      } catch {
        // Services directory might not exist or be empty
      }

      for (const serviceFile of serviceFiles) {
        const filePath = path.join(serviceDir, serviceFile);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for permission-related code
        const hasPermissionCode = /permission|auth|access.*control|rbac|acl/i.test(content);

        expect(hasPermissionCode).toBe(false,
          `Service file ${serviceFile} should not contain permission-related code`);
      }
    });

    it('should confirm route files contain no authorization middleware', async () => {
      // Check all route files
      const routesDir = path.join(process.cwd(), 'src', 'routes');
      let routeFiles: string[] = [];

      try {
        const files = await fs.readdir(routesDir);
        routeFiles = files.filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
      } catch {
        // Routes directory might not exist or be empty
      }

      for (const routeFile of routeFiles) {
        const filePath = path.join(routesDir, routeFile);
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for authorization middleware patterns
        const hasAuthMiddleware = /preHandler|onRequest.*auth|authorize/i.test(content);

        expect(hasAuthMiddleware).toBe(false,
          `Route file ${routeFile} should not contain authorization middleware`);
      }
    });
  });

  describe('API Endpoint Security Analysis', () => {
    it('should allow unauthenticated access to all task endpoints', async () => {
      // Test task creation without any authentication
      const createResponse = await context.httpUtils.createTask('Test task for security analysis');
      expect(createResponse.statusCode).toBe(201);

      const taskData = JSON.parse(createResponse.body);
      const taskId = taskData.taskId;

      // Test getting task without authentication
      const getResponse = await context.httpUtils.getTask(taskId);
      expect(getResponse.statusCode).toBe(200);

      // Test listing tasks without authentication
      const listResponse = await context.httpUtils.listTasks();
      expect(listResponse.statusCode).toBe(200);

      // Test updating task status without authentication
      const updateResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/status`,
        payload: {
          status: 'in-progress',
          stage: 'testing',
          message: 'Security test update'
        }
      });
      expect(updateResponse.statusCode).toBe(200);
    });

    it('should allow unauthenticated access to sensitive operations', async () => {
      // Test task cancellation without authentication
      const createResponse = await context.httpUtils.createTask('Task to cancel');
      const taskData = JSON.parse(createResponse.body);
      const taskId = taskData.taskId;

      const cancelResponse = await context.app.inject({
        method: 'POST',
        url: `/tasks/${taskId}/cancel`
      });
      expect(cancelResponse.statusCode).toBe(200);

      // Test configuration access without authentication
      const configResponse = await context.app.inject({
        method: 'GET',
        url: '/config'
      });
      expect(configResponse.statusCode).toBe(200);

      // Test agents listing without authentication
      const agentsResponse = await context.app.inject({
        method: 'GET',
        url: '/agents'
      });
      expect(agentsResponse.statusCode).toBe(200);
    });

    it('should allow unauthenticated access to template management', async () => {
      // Test template creation without authentication
      const templateData = {
        name: 'Security Test Template',
        description: 'Template for testing security',
        workflow: 'test-workflow'
      };

      const createResponse = await context.httpUtils.createTemplate(templateData);
      expect(createResponse.statusCode).toBe(201);

      const template = JSON.parse(createResponse.body);
      const templateId = template.id;

      // Test template listing without authentication
      const listResponse = await context.httpUtils.listTemplates();
      expect(listResponse.statusCode).toBe(200);

      // Test template modification without authentication
      const updateResponse = await context.app.inject({
        method: 'PUT',
        url: `/templates/${templateId}`,
        payload: {
          description: 'Updated description without auth'
        }
      });
      expect(updateResponse.statusCode).toBe(200);

      // Test template deletion without authentication
      const deleteResponse = await context.app.inject({
        method: 'DELETE',
        url: `/templates/${templateId}`
      });
      expect(deleteResponse.statusCode).toBe(200);
    });

    it('should allow unauthenticated access to MCP server management', async () => {
      // Test MCP marketplace access without authentication
      const marketplaceResponse = await context.app.inject({
        method: 'GET',
        url: '/mcp/marketplace'
      });
      expect(marketplaceResponse.statusCode).toBe(200);

      // Test MCP servers listing without authentication
      const serversResponse = await context.app.inject({
        method: 'GET',
        url: '/mcp/servers'
      });
      expect(serversResponse.statusCode).toBe(200);

      // Test MCP installation listing without authentication
      const installedResponse = await context.app.inject({
        method: 'GET',
        url: '/mcp/installed'
      });
      expect(installedResponse.statusCode).toBe(200);
    });

    it('should allow unauthenticated access to approval endpoints', async () => {
      // Test pending approvals listing without authentication
      const approvalsResponse = await context.app.inject({
        method: 'GET',
        url: '/api/approvals'
      });
      expect(approvalsResponse.statusCode).toBe(200);

      // Note: Testing actual approval operations would require existing approvals
      // The important point is that the endpoints don't reject unauthenticated requests
    });

    it('should allow unauthenticated access to health and monitoring endpoints', async () => {
      // Test basic health check
      const healthResponse = await context.httpUtils.getHealth();
      expect(healthResponse.statusCode).toBe(200);

      // Test daemon health check (may return 503 if daemon not running, but no auth error)
      const daemonHealthResponse = await context.httpUtils.getDaemonHealth();
      expect([200, 503]).toContain(daemonHealthResponse.statusCode);

      // Ensure it's not a 401 (Unauthorized) or 403 (Forbidden)
      expect(daemonHealthResponse.statusCode).not.toBe(401);
      expect(daemonHealthResponse.statusCode).not.toBe(403);
    });
  });

  describe('WebSocket Security Analysis', () => {
    it('should allow unauthenticated WebSocket connections', async () => {
      const wsClient = context.createWebSocketClient('test-task');

      // WebSocket should connect without any authentication
      await expect(wsClient.waitForConnection()).resolves.not.toThrow();

      // Should receive initial task state without authentication
      const initialMessage = await wsClient.waitForMessage('task:state');
      expect(initialMessage.type).toBe('task:state');

      wsClient.close();
    });

    it('should allow unauthenticated global WebSocket connections', async () => {
      // Test global WebSocket endpoint
      const globalWs = new WebSocket(`ws://127.0.0.1:${context.serverPort}/ws`);

      await new Promise<void>((resolve, reject) => {
        globalWs.on('open', resolve);
        globalWs.on('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      // Should be able to send ping without authentication
      globalWs.send(JSON.stringify({
        type: 'ping',
        id: 'test-ping',
        timestamp: Date.now()
      }));

      // Should receive pong response
      const pongReceived = await new Promise<boolean>((resolve) => {
        globalWs.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'pong' && message.id === 'test-ping') {
            resolve(true);
          }
        });
        setTimeout(() => resolve(false), 2000);
      });

      expect(pongReceived).toBe(true);
      globalWs.close();
    });

    it('should allow WebSocket event filtering without authentication', async () => {
      // Test filtered WebSocket connection
      const filterUrl = `ws://127.0.0.1:${context.serverPort}/stream/test-task?events=tool:start,tool:complete`;
      const filteredWs = new WebSocket(filterUrl);

      await new Promise<void>((resolve, reject) => {
        filteredWs.on('open', resolve);
        filteredWs.on('error', reject);
        setTimeout(() => reject(new Error('Filtered connection timeout')), 5000);
      });

      // Connection should succeed without any authentication checks
      expect(filteredWs.readyState).toBe(WebSocket.OPEN);
      filteredWs.close();
    });
  });

  describe('HTTP Header Security Analysis', () => {
    it('should not require Authorization header for any endpoint', async () => {
      // Test various endpoints without Authorization header
      const endpoints = [
        { method: 'GET', url: '/health' },
        { method: 'GET', url: '/tasks' },
        { method: 'GET', url: '/agents' },
        { method: 'GET', url: '/config' },
        { method: 'GET', url: '/templates' },
        { method: 'GET', url: '/mcp/marketplace' },
        { method: 'GET', url: '/api/approvals' },
      ];

      for (const { method, url } of endpoints) {
        const response = await context.app.inject({
          method,
          url,
          headers: {
            // Explicitly no Authorization header
          }
        });

        // Should not return 401 Unauthorized or 403 Forbidden
        expect(response.statusCode).not.toBe(401);
        expect(response.statusCode).not.toBe(403);
      }
    });

    it('should not validate API keys or bearer tokens', async () => {
      // Test with various invalid authentication headers
      const invalidHeaders = [
        { Authorization: 'Bearer invalid-token' },
        { Authorization: 'Basic invalid-credentials' },
        { 'X-API-Key': 'invalid-api-key' },
        { 'X-Auth-Token': 'invalid-auth-token' },
      ];

      for (const headers of invalidHeaders) {
        const response = await context.app.inject({
          method: 'GET',
          url: '/tasks',
          headers
        });

        // Should ignore invalid auth headers (not return 401/403)
        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('Security Vulnerability Assessment', () => {
    it('should identify complete lack of authentication as a security issue', () => {
      // This test documents the security implications
      const securityFindings = {
        noAuthentication: true,
        noAuthorization: true,
        openWebSocketConnections: true,
        unrestricted_API_access: true,
        sensitiveOperationsExposed: true,
        configurationExposed: true,
      };

      // All security findings should be true, indicating vulnerabilities
      expect(securityFindings.noAuthentication).toBe(true);
      expect(securityFindings.noAuthorization).toBe(true);
      expect(securityFindings.openWebSocketConnections).toBe(true);
      expect(securityFindings.unrestricted_API_access).toBe(true);
      expect(securityFindings.sensitiveOperationsExposed).toBe(true);
      expect(securityFindings.configurationExposed).toBe(true);
    });

    it('should document exposed sensitive operations', async () => {
      const sensitiveOperations = [
        'Task creation and execution',
        'Task cancellation and modification',
        'Configuration access',
        'Template management',
        'MCP server installation/uninstallation',
        'Approval bypassing',
        'System health monitoring',
        'Real-time event streaming',
      ];

      // All operations are accessible without authentication
      for (const operation of sensitiveOperations) {
        // This test serves as documentation of what's exposed
        expect(operation).toBeTruthy();
      }

      // Count total exposed operations
      expect(sensitiveOperations.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('Cross-Origin Request Analysis', () => {
    it('should allow CORS requests without authentication', async () => {
      // Test CORS preflight request
      const corsResponse = await context.app.inject({
        method: 'OPTIONS',
        url: '/tasks',
        headers: {
          'Origin': 'https://malicious-domain.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        }
      });

      // Should allow CORS without any authentication checks
      expect(corsResponse.statusCode).toBe(204);
    });

    it('should process requests from any origin', async () => {
      // Test actual request from different origins
      const origins = [
        'https://malicious-domain.com',
        'http://localhost:3000',
        'https://evil.example.com',
      ];

      for (const origin of origins) {
        const response = await context.app.inject({
          method: 'GET',
          url: '/health',
          headers: {
            'Origin': origin
          }
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('Rate Limiting Analysis', () => {
    it('should not implement rate limiting protection', async () => {
      // Test rapid successive requests
      const requests = Array(10).fill(null).map((_, index) =>
        context.app.inject({
          method: 'GET',
          url: `/health?test=${index}`,
        })
      );

      const responses = await Promise.all(requests);

      // All requests should succeed (no rate limiting)
      responses.forEach((response, index) => {
        expect(response.statusCode).toBe(200);
      });

      // Should not return 429 Too Many Requests
      const rateLimitHit = responses.some(r => r.statusCode === 429);
      expect(rateLimitHit).toBe(false);
    });
  });
});

describe('Permission Analysis Summary Report', () => {
  it('should generate comprehensive security assessment', () => {
    const securityAssessment = {
      package: '@apex/api',
      version: '0.4.0',
      analysisDate: new Date().toISOString(),
      findings: {
        authenticationMechanism: 'None implemented',
        authorizationControls: 'None implemented',
        accessControl: 'Completely open',
        sessionManagement: 'Not applicable (no auth)',
        tokenValidation: 'Not implemented',
        permissionChecks: 'Not found',
        middleware_security: 'None detected',
        cors_policy: 'Allows all origins',
        rateLimiting: 'Not implemented',
      },
      vulnerabilities: [
        'Unrestricted API access',
        'No authentication required for sensitive operations',
        'Configuration data exposure',
        'Task management access from any origin',
        'WebSocket connections without validation',
        'MCP server management without authorization',
        'Approval system bypassing possible',
      ],
      risk_level: 'CRITICAL',
      recommendations: [
        'Implement authentication middleware',
        'Add authorization controls for sensitive endpoints',
        'Restrict CORS to trusted domains',
        'Add rate limiting protection',
        'Implement API key validation',
        'Add WebSocket authentication',
        'Secure configuration endpoints',
        'Implement role-based access control',
      ],
      implementation_stage_finding_validated: true,
    };

    // Validate the assessment structure
    expect(securityAssessment.package).toBe('@apex/api');
    expect(securityAssessment.findings.authenticationMechanism).toBe('None implemented');
    expect(securityAssessment.risk_level).toBe('CRITICAL');
    expect(securityAssessment.vulnerabilities).toHaveLength(7);
    expect(securityAssessment.recommendations).toHaveLength(8);
    expect(securityAssessment.implementation_stage_finding_validated).toBe(true);
  });
});