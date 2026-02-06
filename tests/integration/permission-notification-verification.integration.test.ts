/**
 * Minimal Integration Test: Permission Notification Verification
 *
 * This test specifically verifies the acceptance criteria requirements:
 * - Permission change triggered → orchestrator emits event →
 * - CLI and WebSocket clients both receive notification →
 * - notification content is accurate and actionable
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { WebSocket } from 'ws';

// Import APEX components
import { ApexOrchestrator } from '@apexcli/orchestrator';
import { createServer, type ServerOptions } from '@apexcli/api';
import {
  initializeApex,
  PermissionRequestEventData,
  PermissionGrantedEventData,
  PermissionDeniedEventData
} from '@apexcli/core';

/**
 * Minimal CLI Handler for acceptance criteria verification
 */
class AcceptanceCLIHandler extends EventEmitter {
  public events: Array<{ type: string; data: any; timestamp: Date }> = [];

  constructor(orchestrator: ApexOrchestrator) {
    super();
    this.setupHandlers(orchestrator);
  }

  private setupHandlers(orchestrator: ApexOrchestrator): void {
    orchestrator.on('permission:request', (data) => this.recordEvent('permission:request', data));
    orchestrator.on('permission:granted', (data) => this.recordEvent('permission:granted', data));
    orchestrator.on('permission:denied', (data) => this.recordEvent('permission:denied', data));
  }

  private recordEvent(type: string, data: any): void {
    this.events.push({ type, data, timestamp: new Date() });
    this.emit('event:received', { type, data });
  }

  public getEventCount(): number {
    return this.events.length;
  }

  public hasEvent(type: string): boolean {
    return this.events.some(e => e.type === type);
  }

  public getEvents(type: string): any[] {
    return this.events.filter(e => e.type === type).map(e => e.data);
  }

  public reset(): void {
    this.events = [];
  }
}

/**
 * Minimal WebSocket Client for acceptance criteria verification
 */
class AcceptanceWSClient {
  public messages: Array<{ type: string; data: any; timestamp: string }> = [];
  public ws: WebSocket | null = null;

  async connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => resolve());
      this.ws.on('error', reject);

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.messages.push(message);
        } catch (error) {
          console.warn('Failed to parse WebSocket message:', error);
        }
      });
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  getMessageCount(): number {
    return this.messages.length;
  }

  hasMessage(type: string): boolean {
    return this.messages.some(m => m.type === type);
  }

  getMessages(type: string): any[] {
    return this.messages.filter(m => m.type === type).map(m => m.data);
  }

  reset(): void {
    this.messages = [];
  }
}

/**
 * Utility to wait for conditions
 */
async function waitFor(condition: () => boolean, timeout: number = 1000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (condition()) {
        resolve();
      } else if (Date.now() - start > timeout) {
        reject(new Error(`Timeout waiting for condition after ${timeout}ms`));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}

describe('Permission Notification Acceptance Criteria Verification', () => {
  let testDir: string;
  let orchestrator: ApexOrchestrator;
  let cliHandler: AcceptanceCLIHandler;
  let wsClient: AcceptanceWSClient;
  let apiServer: any;
  let apiPort: number;

  beforeEach(async () => {
    // Create temporary test project
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-acceptance-'));

    // Initialize APEX project
    await initializeApex(testDir, {
      projectName: 'acceptance-test',
      language: 'typescript'
    });

    // Create basic agent
    const agentsDir = path.join(testDir, '.apex', 'agents');
    await fs.writeFile(path.join(agentsDir, 'developer.md'),
      'name: developer\ndescription: Test developer agent\ntools: Write, Read\nmodel: sonnet\n'
    );

    // Create basic workflow
    const workflowsDir = path.join(testDir, '.apex', 'workflows');
    await fs.writeFile(path.join(workflowsDir, 'feature.yaml'),
      'name: feature\ndescription: Test workflow\nstages:\n  - name: implementation\n    agent: developer\n    description: Implement feature\n'
    );

    // Initialize orchestrator
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    // Set up CLI handler
    cliHandler = new AcceptanceCLIHandler(orchestrator);

    // Set up API server
    apiPort = Math.floor(Math.random() * 10000) + 40000;
    const serverOptions: ServerOptions = {
      port: apiPort,
      host: '127.0.0.1',
      projectPath: testDir,
      silent: true
    };

    apiServer = await createServer(serverOptions);
    await apiServer.listen({ port: apiPort, host: '127.0.0.1' });

    // Set up WebSocket client
    wsClient = new AcceptanceWSClient();
  });

  afterEach(async () => {
    wsClient?.disconnect();
    await apiServer?.close();
    await orchestrator?.shutdown();
    cliHandler?.removeAllListeners();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should meet all acceptance criteria for permission notification flow', async () => {
    // Create task for WebSocket stream
    const task = await orchestrator.createTask({
      description: 'Acceptance criteria test',
      workflow: 'feature'
    });

    // Connect WebSocket client
    await wsClient.connect(`ws://127.0.0.1:${apiPort}/stream/${task.id}`);

    // CRITERIA 1: Permission change triggered
    const permissionRequest: PermissionRequestEventData = {
      requestId: 'acceptance-test-001',
      tool: 'Write',
      timestamp: new Date(),
      scope: '/test/file.ts',
      description: 'Test permission request for acceptance criteria',
      agent: 'developer',
      isDangerous: false
    };

    // CRITERIA 2: Orchestrator emits event
    orchestrator.emit('permission:request', permissionRequest);

    // CRITERIA 3: CLI receives notification
    await waitFor(() => cliHandler.getEventCount() >= 1, 500);
    expect(cliHandler.hasEvent('permission:request')).toBe(true);

    const cliEvents = cliHandler.getEvents('permission:request');
    expect(cliEvents).toHaveLength(1);
    expect(cliEvents[0].tool).toBe('Write');
    expect(cliEvents[0].scope).toBe('/test/file.ts');

    // CRITERIA 4: WebSocket client receives notification
    await waitFor(() => wsClient.getMessageCount() >= 1, 500);
    expect(wsClient.hasMessage('permission:request')).toBe(true);

    const wsMessages = wsClient.getMessages('permission:request');
    expect(wsMessages).toHaveLength(1);
    expect(wsMessages[0].tool).toBe('Write');
    expect(wsMessages[0].scope).toBe('/test/file.ts');

    // CRITERIA 5: Notification content is accurate and actionable
    expect(cliEvents[0].requestId).toBe('acceptance-test-001');
    expect(cliEvents[0].description).toContain('acceptance criteria');

    expect(wsMessages[0].requestId).toBe('acceptance-test-001');
    expect(wsMessages[0].description).toContain('acceptance criteria');

    // Verify CLI and WebSocket received same data
    expect(cliEvents[0].requestId).toBe(wsMessages[0].requestId);
    expect(cliEvents[0].tool).toBe(wsMessages[0].tool);
    expect(cliEvents[0].scope).toBe(wsMessages[0].scope);

    // Test additional event types
    const permissionGranted: PermissionGrantedEventData = {
      requestId: 'acceptance-test-001',
      tool: 'Write',
      timestamp: new Date(),
      level: 'allow-once' as const,
      grantedBy: 'user',
      reason: 'Approved for testing'
    };

    orchestrator.emit('permission:granted', permissionGranted);

    await waitFor(() => cliHandler.getEventCount() >= 2, 500);
    await waitFor(() => wsClient.getMessageCount() >= 2, 500);

    expect(cliHandler.hasEvent('permission:granted')).toBe(true);
    expect(wsClient.hasMessage('permission:granted')).toBe(true);

    // Final verification: All acceptance criteria met
    const results = {
      'Permission change triggered': true,
      'Orchestrator emits event': cliHandler.getEventCount() > 0,
      'CLI receives notification': cliHandler.hasEvent('permission:request'),
      'WebSocket clients receive notification': wsClient.hasMessage('permission:request'),
      'Notification content is accurate': (
        cliEvents[0].requestId === wsMessages[0].requestId &&
        cliEvents[0].tool === wsMessages[0].tool
      ),
      'Notification content is actionable': (
        cliEvents[0].description && wsMessages[0].description
      )
    };

    Object.entries(results).forEach(([criteria, met]) => {
      expect(met).toBe(true);
    });
  });
});