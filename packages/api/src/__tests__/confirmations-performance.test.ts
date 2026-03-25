import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { createServer } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { ApexOrchestrator } from '@apexcli/orchestrator';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe.skip('Confirmations API Performance Tests', () => {
  let server: FastifyInstance;
  let orchestrator: ApexOrchestrator;
  let projectPath: string;

  beforeAll(async () => {
    // Create temporary directory for test project
    projectPath = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-confirmation-perf-test-'));

    // Create .apex directory structure
    const apexDir = path.join(projectPath, '.apex');
    await fs.mkdir(apexDir, { recursive: true });

    // Create minimal config.yaml for performance testing
    const configContent = `
version: "1.0"
name: "confirmation-performance-test"
description: "Performance test project for confirmation API"
agents:
  planner:
    name: "Planning Agent"
    role: "Creates plans and requires confirmation"
workflows:
  perf-workflow:
    name: "Performance Test Workflow"
    description: "Workflow for performance testing"
    stages:
      - name: "planning"
        agent: "planner"
        description: "Create implementation plan"
autonomy:
  level: "supervised"
`.trim();

    await fs.writeFile(path.join(apexDir, 'config.yaml'), configContent);

    // Initialize server with performance optimizations
    server = await createServer({
      projectPath,
      port: 0,
      silent: true  // Reduce logging overhead
    });
    await server.listen({ port: 0 });

    // Get orchestrator instance
    orchestrator = (server as any).orchestrator || new ApexOrchestrator({ projectPath });
    if (!orchestrator.isInitialized) {
      await orchestrator.initialize();
    }
  });

  afterAll(async () => {
    await server?.close();
    // Clean up temporary directory
    try {
      await fs.rm(projectPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test directory:', error);
    }
  });

  beforeEach(async () => {
    // Clear any existing data before each test
    await orchestrator.store.clearAll?.();
    vi.restoreAllMocks();
  });

  describe('Throughput Performance', () => {
    it('should handle high-throughput sequential requests', async () => {
      const numRequests = 100;
      const expectedMaxDuration = 5000; // 5 seconds

      // Mock orchestrator for fast responses
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'perf-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'performance',
        agent: 'perf-agent'
      }));

      try {
        const startTime = Date.now();

        // Sequential requests
        for (let i = 0; i < numRequests; i++) {
          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/sequential-${i}/respond`,
            payload: {
              response: 'accept',
              approver: `perf-user-${i}`
            }
          });

          expect(response.statusCode).toBe(200);
        }

        const duration = Date.now() - startTime;
        const requestsPerSecond = numRequests / (duration / 1000);

        expect(duration).toBeLessThan(expectedMaxDuration);
        expect(requestsPerSecond).toBeGreaterThan(20); // At least 20 RPS for sequential

        console.log(`Sequential: ${numRequests} requests in ${duration}ms (${requestsPerSecond.toFixed(2)} RPS)`);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    }, 10000); // 10 second timeout for this test

    it('should handle high-throughput concurrent requests', async () => {
      const numRequests = 100;
      const expectedMaxDuration = 3000; // 3 seconds for concurrent

      // Mock orchestrator for fast responses
      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'perf-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'performance',
        agent: 'perf-agent'
      }));

      try {
        const startTime = Date.now();

        // Concurrent requests
        const requests = Array.from({ length: numRequests }, (_, i) =>
          server.inject({
            method: 'POST',
            url: `/confirmations/concurrent-${i}/respond`,
            payload: {
              response: 'accept',
              approver: `perf-user-${i}`
            }
          })
        );

        const responses = await Promise.all(requests);
        const duration = Date.now() - startTime;
        const requestsPerSecond = numRequests / (duration / 1000);

        // All requests should succeed
        responses.forEach((response, index) => {
          expect(response.statusCode).toBe(200);
          const result = JSON.parse(response.body);
          expect(result.confirmationId).toBe(`concurrent-${index}`);
        });

        expect(duration).toBeLessThan(expectedMaxDuration);
        expect(requestsPerSecond).toBeGreaterThan(50); // At least 50 RPS for concurrent

        console.log(`Concurrent: ${numRequests} requests in ${duration}ms (${requestsPerSecond.toFixed(2)} RPS)`);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    }, 10000);

    it('should maintain performance with varying payload sizes', async () => {
      const payloadSizes = [
        { name: 'small', size: 100 },
        { name: 'medium', size: 1000 },
        { name: 'large', size: 10000 },
        { name: 'xlarge', size: 50000 }
      ];

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'size-test-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'size-test',
        agent: 'size-test-agent'
      }));

      try {
        for (const { name, size } of payloadSizes) {
          const comment = 'x'.repeat(size);
          const numRequests = 20;

          const startTime = Date.now();

          const requests = Array.from({ length: numRequests }, (_, i) =>
            server.inject({
              method: 'POST',
              url: `/confirmations/${name}-${i}/respond`,
              payload: {
                response: 'reject',
                approver: `size-user-${i}`,
                comments: comment
              }
            })
          );

          const responses = await Promise.all(requests);
          const duration = Date.now() - startTime;
          const requestsPerSecond = numRequests / (duration / 1000);

          responses.forEach(response => {
            expect(response.statusCode).toBe(200);
          });

          console.log(`${name} (${size} chars): ${numRequests} requests in ${duration}ms (${requestsPerSecond.toFixed(2)} RPS)`);

          // Performance should degrade gracefully with size
          expect(duration).toBeLessThan(5000); // Max 5 seconds even for large payloads
        }
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });

  describe('Memory Performance', () => {
    it('should handle memory efficiently with many concurrent requests', async () => {
      const numBatches = 10;
      const batchSize = 50;

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'memory-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'memory-test',
        agent: 'memory-agent'
      }));

      try {
        const initialMemory = process.memoryUsage();

        // Process in batches to simulate sustained load
        for (let batch = 0; batch < numBatches; batch++) {
          const requests = Array.from({ length: batchSize }, (_, i) =>
            server.inject({
              method: 'POST',
              url: `/confirmations/memory-${batch}-${i}/respond`,
              payload: {
                response: 'accept',
                approver: `memory-user-${batch}-${i}`
              }
            })
          );

          const responses = await Promise.all(requests);

          responses.forEach(response => {
            expect(response.statusCode).toBe(200);
          });

          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }

          const currentMemory = process.memoryUsage();
          const memoryGrowth = currentMemory.heapUsed - initialMemory.heapUsed;

          // Memory growth should be reasonable (less than 100MB)
          expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);

          console.log(`Batch ${batch + 1}: Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
        }
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    }, 30000); // 30 second timeout

    it('should handle large response objects without memory leaks', async () => {
      const numRequests = 50;

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'large-response-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {
          // Large context object
          largeData: Array.from({ length: 1000 }, (_, i) => ({
            index: i,
            data: `large-data-item-${i}`.repeat(10),
            timestamp: new Date(),
            metadata: {
              processed: true,
              tags: Array.from({ length: 5 }, (_, j) => `tag-${j}`)
            }
          }))
        },
        stage: 'large-response-test',
        agent: 'large-response-agent'
      }));

      try {
        const initialMemory = process.memoryUsage();

        for (let i = 0; i < numRequests; i++) {
          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/large-response-${i}/respond`,
            payload: {
              response: 'accept',
              approver: `large-user-${i}`
            }
          });

          expect(response.statusCode).toBe(200);
          const result = JSON.parse(response.body);
          expect(result.confirmationState.context.largeData).toHaveLength(1000);

          // Force garbage collection periodically
          if (i % 10 === 0 && global.gc) {
            global.gc();
          }
        }

        // Final garbage collection
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage();
        const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

        // Memory growth should be reasonable despite large objects
        expect(memoryGrowth).toBeLessThan(200 * 1024 * 1024); // Less than 200MB

        console.log(`Large response test: Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)}MB`);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });

  describe('Latency Performance', () => {
    it('should maintain low latency under normal load', async () => {
      const numRequests = 50;
      const maxLatencyThreshold = 100; // 100ms
      const latencies: number[] = [];

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'latency-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'latency-test',
        agent: 'latency-agent'
      }));

      try {
        for (let i = 0; i < numRequests; i++) {
          const startTime = Date.now();

          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/latency-${i}/respond`,
            payload: {
              response: 'accept',
              approver: `latency-user-${i}`
            }
          });

          const latency = Date.now() - startTime;
          latencies.push(latency);

          expect(response.statusCode).toBe(200);
        }

        const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

        console.log(`Latency stats - Avg: ${avgLatency.toFixed(2)}ms, Max: ${maxLatency}ms, P95: ${p95Latency}ms`);

        expect(avgLatency).toBeLessThan(maxLatencyThreshold);
        expect(p95Latency).toBeLessThan(maxLatencyThreshold * 2); // P95 within 2x threshold
        expect(maxLatency).toBeLessThan(maxLatencyThreshold * 5); // Max within 5x threshold
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });

    it('should handle orchestrator latency gracefully', async () => {
      const orchestratorDelays = [0, 10, 50, 100, 200]; // Various delays in ms

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      try {
        for (const delay of orchestratorDelays) {
          orchestrator.grantApproval = vi.fn().mockImplementation(async () => {
            await new Promise(resolve => setTimeout(resolve, delay));
            return Promise.resolve();
          });

          orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => {
            await new Promise(resolve => setTimeout(resolve, delay / 2));
            return Promise.resolve({
              requestId: id,
              gateName: `delayed-gate-${delay}`,
              status: 'approved' as any,
              requestedAt: new Date(),
              context: {},
              stage: 'delay-test',
              agent: 'delay-agent'
            });
          });

          const startTime = Date.now();

          const response = await server.inject({
            method: 'POST',
            url: `/confirmations/delay-${delay}/respond`,
            payload: {
              response: 'accept',
              approver: `delay-user-${delay}`
            }
          });

          const totalLatency = Date.now() - startTime;

          expect(response.statusCode).toBe(200);

          // Total latency should be roughly delay + processing overhead
          expect(totalLatency).toBeGreaterThanOrEqual(delay);
          expect(totalLatency).toBeLessThan(delay + 100); // Max 100ms processing overhead

          console.log(`Orchestrator delay ${delay}ms -> Total latency: ${totalLatency}ms`);
        }
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });

  describe('Resource Utilization', () => {
    it('should efficiently handle CPU-intensive validation', async () => {
      const numRequests = 30;

      const originalGrantApproval = orchestrator.grantApproval;
      const originalGetApprovalStateById = orchestrator.getApprovalStateById;

      orchestrator.grantApproval = vi.fn().mockResolvedValue(undefined);
      orchestrator.getApprovalStateById = vi.fn().mockImplementation(async (id) => ({
        requestId: id,
        gateName: 'cpu-intensive-gate',
        status: 'approved' as any,
        requestedAt: new Date(),
        context: {},
        stage: 'cpu-test',
        agent: 'cpu-agent'
      }));

      try {
        const startTime = Date.now();

        // Create requests with complex validation scenarios
        const requests = Array.from({ length: numRequests }, (_, i) => ({
          confirmationId: `cpu-intensive-${i}`,
          approver: `cpu-user-${i}`,
          comments: JSON.stringify({
            complex: Array.from({ length: 100 }, (_, j) => ({
              nested: {
                deep: {
                  structure: `value-${j}`,
                  calculated: Math.random() * 1000
                }
              }
            }))
          })
        }));

        const responses = await Promise.all(
          requests.map(req =>
            server.inject({
              method: 'POST',
              url: `/confirmations/${req.confirmationId}/respond`,
              payload: {
                response: 'reject',
                approver: req.approver,
                comments: req.comments
              }
            })
          )
        );

        const duration = Date.now() - startTime;
        const requestsPerSecond = numRequests / (duration / 1000);

        responses.forEach(response => {
          expect(response.statusCode).toBe(200);
        });

        // Should still maintain reasonable performance
        expect(duration).toBeLessThan(10000); // Max 10 seconds
        expect(requestsPerSecond).toBeGreaterThan(5); // At least 5 RPS

        console.log(`CPU-intensive: ${numRequests} requests in ${duration}ms (${requestsPerSecond.toFixed(2)} RPS)`);
      } finally {
        orchestrator.grantApproval = originalGrantApproval;
        orchestrator.getApprovalStateById = originalGetApprovalStateById;
      }
    });
  });
});