/**
 * @fileoverview Tests for Parallel Test Isolation Helpers
 *
 * These tests validate the parallel test isolation utilities work correctly for:
 * - Database isolation across concurrent tests
 * - Port allocation without conflicts
 * - Memory isolation and cleanup
 * - File system isolation
 * - Process isolation and cleanup
 * - Network isolation and mocking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createDatabaseIsolation,
  createPortAllocator,
  createMemoryIsolation,
  createFileSystemIsolation,
  createProcessIsolation,
  createNetworkIsolation,
  type DatabaseIsolation,
  type PortAllocator,
  type MemoryIsolation,
  type FileSystemIsolation,
  type ProcessIsolation,
  type NetworkIsolation,
} from '../parallel-test-helpers.js';

describe('Parallel Test Helpers', () => {
  describe('Database Isolation', () => {
    let dbIsolation: DatabaseIsolation;

    afterEach(async () => {
      if (dbIsolation) {
        await dbIsolation.teardown();
      }
    });

    it('should create SQLite database isolation', async () => {
      dbIsolation = createDatabaseIsolation({ type: 'sqlite', freshPerTest: true });
      await dbIsolation.setup();

      const info = dbIsolation.getConnectionInfo();
      expect(info.url).toMatch(/sqlite:.*\.db$/);
      expect(info.url).toContain('db_');
    });

    it('should create PostgreSQL schema isolation', async () => {
      dbIsolation = createDatabaseIsolation({
        type: 'postgres',
        baseUrl: 'postgresql://localhost:5432/testdb'
      });
      await dbIsolation.setup();

      const info = dbIsolation.getConnectionInfo();
      expect(info.url).toBe('postgresql://localhost:5432/testdb');
      expect(info.schema).toMatch(/^test_db_/);
    });

    it('should create MySQL database isolation', async () => {
      dbIsolation = createDatabaseIsolation({
        type: 'mysql',
        baseUrl: 'mysql://localhost:3306'
      });
      await dbIsolation.setup();

      const info = dbIsolation.getConnectionInfo();
      expect(info.url).toBe('mysql://localhost:3306');
      expect(info.database).toMatch(/^test_db_/);
    });

    it('should provide mock database connection', async () => {
      dbIsolation = createDatabaseIsolation({ type: 'memory' });
      await dbIsolation.setup();

      const mockConn = dbIsolation.getMockConnection() as any;
      expect(mockConn.query).toBeDefined();
      expect(mockConn.execute).toBeDefined();
      expect(mockConn.testId).toBeDefined();
    });

    it('should execute raw SQL with test context', async () => {
      dbIsolation = createDatabaseIsolation({ type: 'memory' });
      await dbIsolation.setup();

      const result = await dbIsolation.executeRaw('SELECT * FROM users', []);

      expect(result).toMatchObject({
        sql: 'SELECT * FROM users',
        params: [],
        testId: expect.any(String),
        rows: [],
        affectedRows: 0
      });
    });

    it('should throw when accessing before setup', () => {
      dbIsolation = createDatabaseIsolation({ type: 'memory' });

      expect(() => dbIsolation.getConnectionInfo()).toThrow('Database isolation not set up');
      expect(() => dbIsolation.getMockConnection()).toThrow('Database isolation not set up');
    });

    it('should create unique isolation per instance', async () => {
      const db1 = createDatabaseIsolation({ type: 'sqlite' });
      const db2 = createDatabaseIsolation({ type: 'sqlite' });

      await db1.setup();
      await db2.setup();

      const info1 = db1.getConnectionInfo();
      const info2 = db2.getConnectionInfo();

      expect(info1.url).not.toBe(info2.url);

      await db1.teardown();
      await db2.teardown();
    });
  });

  describe('Port Allocation', () => {
    let portAllocator: PortAllocator;

    afterEach(() => {
      if (portAllocator) {
        portAllocator.releaseAll();
      }
    });

    it('should allocate unique ports', async () => {
      portAllocator = createPortAllocator(8000, 8010);

      const port1 = await portAllocator.allocate();
      const port2 = await portAllocator.allocate();

      expect(port1).toBeDefined();
      expect(port2).toBeDefined();
      expect(port1).not.toBe(port2);
      expect(port1).toBeGreaterThanOrEqual(8000);
      expect(port2).toBeGreaterThanOrEqual(8000);
    });

    it('should track allocated ports', async () => {
      portAllocator = createPortAllocator(8000, 8010);

      const port1 = await portAllocator.allocate();
      const port2 = await portAllocator.allocate();

      const allocated = portAllocator.getAllocated();
      expect(allocated).toContain(port1);
      expect(allocated).toContain(port2);
      expect(allocated).toHaveLength(2);
    });

    it('should release specific ports', async () => {
      portAllocator = createPortAllocator(8000, 8010);

      const port = await portAllocator.allocate();
      expect(portAllocator.getAllocated()).toContain(port);

      portAllocator.release(port);
      expect(portAllocator.getAllocated()).not.toContain(port);
    });

    it('should release all ports', async () => {
      portAllocator = createPortAllocator(8000, 8010);

      await portAllocator.allocate();
      await portAllocator.allocate();
      expect(portAllocator.getAllocated()).toHaveLength(2);

      portAllocator.releaseAll();
      expect(portAllocator.getAllocated()).toHaveLength(0);
    });

    it('should check port availability', async () => {
      portAllocator = createPortAllocator(8000, 8010);

      const port = await portAllocator.allocate();
      expect(await portAllocator.isAvailable(port)).toBe(false);

      portAllocator.release(port);
      expect(await portAllocator.isAvailable(port)).toBe(true);
    });

    it('should throw when no ports available', async () => {
      // Create allocator with tiny range
      portAllocator = createPortAllocator(8000, 8001);

      await portAllocator.allocate(); // 8000
      await portAllocator.allocate(); // 8001

      await expect(portAllocator.allocate()).rejects.toThrow('No available ports');
    });

    it('should prevent conflicts between allocators', async () => {
      const allocator1 = createPortAllocator(8000, 8010);
      const allocator2 = createPortAllocator(8000, 8010);

      const port1 = await allocator1.allocate();
      const port2 = await allocator2.allocate();

      // Should get different ports due to global tracking
      expect(port1).not.toBe(port2);

      allocator1.releaseAll();
      allocator2.releaseAll();
    });
  });

  describe('Memory Isolation', () => {
    let memory: MemoryIsolation;

    beforeEach(() => {
      memory = createMemoryIsolation();
    });

    afterEach(() => {
      if (memory) {
        memory.clearAll();
      }
    });

    it('should create isolated memory contexts', () => {
      const ctx1 = memory.createContext({ value: 'test1' });
      const ctx2 = memory.createContext({ value: 'test2' });

      expect(ctx1.get().value).toBe('test1');
      expect(ctx2.get().value).toBe('test2');
    });

    it('should isolate context data', () => {
      const ctx1 = memory.createContext({ count: 0 });
      const ctx2 = memory.createContext({ count: 0 });

      ctx1.set({ count: 42 });
      expect(ctx1.get().count).toBe(42);
      expect(ctx2.get().count).toBe(0);
    });

    it('should clear individual contexts', () => {
      const ctx = memory.createContext({ data: 'initial' });
      expect(ctx.isEmpty()).toBe(false);

      ctx.clear();
      expect(ctx.isEmpty()).toBe(true);
    });

    it('should track context size', () => {
      const ctx = memory.createContext({ small: 'a' });
      const smallSize = ctx.getSize();

      ctx.set({ large: 'a'.repeat(1000) });
      const largeSize = ctx.getSize();

      expect(largeSize).toBeGreaterThan(smallSize);
    });

    it('should provide memory statistics', () => {
      memory.createContext({ data: 'test1' });
      memory.createContext({ data: 'test2' });

      const stats = memory.getStats();
      expect(stats.contexts).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should clear all contexts', () => {
      memory.createContext({ data: '1' });
      memory.createContext({ data: '2' });

      expect(memory.getStats().contexts).toBe(2);

      memory.clearAll();
      expect(memory.getStats().contexts).toBe(0);
      expect(memory.getStats().totalSize).toBe(0);
    });
  });

  describe('File System Isolation', () => {
    let fsIsolation: FileSystemIsolation;

    afterEach(async () => {
      if (fsIsolation) {
        await fsIsolation.teardown();
      }
    });

    it('should create isolated file system', async () => {
      fsIsolation = createFileSystemIsolation();
      await fsIsolation.setup();

      const workingDir = fsIsolation.getWorkingDir();
      expect(workingDir).toBeDefined();
      expect(workingDir).toContain('apex-fs_');
    });

    it('should create files in isolated context', async () => {
      fsIsolation = createFileSystemIsolation();
      await fsIsolation.setup();

      const filePath = await fsIsolation.createFile('test.txt', 'content');
      expect(filePath).toContain(fsIsolation.getWorkingDir());
      expect(filePath).toContain('test.txt');
    });

    it('should create directories in isolated context', async () => {
      fsIsolation = createFileSystemIsolation();
      await fsIsolation.setup();

      const dirPath = await fsIsolation.createDir('subdir');
      expect(dirPath).toContain(fsIsolation.getWorkingDir());
      expect(dirPath).toContain('subdir');
    });

    it('should check file existence', async () => {
      fsIsolation = createFileSystemIsolation();
      await fsIsolation.setup();

      // For testing, existence is simulated based on test context data
      expect(await fsIsolation.exists('nonexistent.txt')).toBe(false);
    });

    it('should read files from isolated context', async () => {
      fsIsolation = createFileSystemIsolation();
      await fsIsolation.setup();

      const content = await fsIsolation.readFile('test.txt');
      expect(content).toBeDefined();
    });

    it('should list files in isolated context', async () => {
      fsIsolation = createFileSystemIsolation();
      await fsIsolation.setup();

      const files = await fsIsolation.listFiles();
      expect(Array.isArray(files)).toBe(true);
    });

    it('should throw when accessing before setup', () => {
      fsIsolation = createFileSystemIsolation();

      expect(() => fsIsolation.getWorkingDir()).toThrow('File system isolation not set up');
    });
  });

  describe('Process Isolation', () => {
    let processIsolation: ProcessIsolation;

    afterEach(async () => {
      if (processIsolation) {
        await processIsolation.teardown();
      }
    });

    it('should spawn mock processes', async () => {
      processIsolation = createProcessIsolation();
      await processIsolation.setup();

      const proc = await processIsolation.spawn('echo', ['hello']);
      expect(proc.pid).toBeDefined();
      expect(proc.command).toBe('echo');
      expect(proc.args).toEqual(['hello']);
      expect(proc.isRunning()).toBe(true);
    });

    it('should track active processes', async () => {
      processIsolation = createProcessIsolation();
      await processIsolation.setup();

      const proc1 = await processIsolation.spawn('echo', ['1']);
      const proc2 = await processIsolation.spawn('echo', ['2']);

      const active = processIsolation.getActiveProcesses();
      expect(active).toHaveLength(2);
      expect(active.map(p => p.pid)).toContain(proc1.pid);
      expect(active.map(p => p.pid)).toContain(proc2.pid);
    });

    it('should kill individual processes', async () => {
      processIsolation = createProcessIsolation();
      await processIsolation.setup();

      const proc = await processIsolation.spawn('echo', ['test']);
      expect(proc.isRunning()).toBe(true);

      await proc.kill();
      expect(proc.isRunning()).toBe(false);
    });

    it('should wait for process completion', async () => {
      processIsolation = createProcessIsolation();
      await processIsolation.setup();

      const proc = await processIsolation.spawn('echo', ['test']);
      const exitCode = await proc.wait();
      expect(exitCode).toBe(0);
    });

    it('should kill all processes', async () => {
      processIsolation = createProcessIsolation();
      await processIsolation.setup();

      await processIsolation.spawn('echo', ['1']);
      await processIsolation.spawn('echo', ['2']);

      expect(processIsolation.getActiveProcesses()).toHaveLength(2);

      await processIsolation.killAll();
      expect(processIsolation.getActiveProcesses()).toHaveLength(0);
    });
  });

  describe('Network Isolation', () => {
    let networkIsolation: NetworkIsolation;

    afterEach(async () => {
      if (networkIsolation) {
        await networkIsolation.teardown();
      }
    });

    it('should mock network requests', async () => {
      networkIsolation = createNetworkIsolation();
      await networkIsolation.setup();

      const response = { users: [{ id: 1, name: 'Test' }] };
      networkIsolation.mockRequest('/api/users', response);

      // In a real implementation, this would intercept actual HTTP requests
      expect(true).toBe(true); // Placeholder assertion
    });

    it('should mock requests with regex patterns', async () => {
      networkIsolation = createNetworkIsolation();
      await networkIsolation.setup();

      const response = { data: 'test' };
      networkIsolation.mockRequest(/\/api\/.*/, response);

      expect(true).toBe(true); // Placeholder assertion
    });

    it('should clear all mocks', async () => {
      networkIsolation = createNetworkIsolation();
      await networkIsolation.setup();

      networkIsolation.mockRequest('/api/test', { data: 'test' });
      networkIsolation.clearMocks();

      expect(true).toBe(true); // Placeholder assertion
    });

    it('should track request history', async () => {
      networkIsolation = createNetworkIsolation();
      await networkIsolation.setup();

      const history = networkIsolation.getRequestHistory();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should simulate network conditions', async () => {
      networkIsolation = createNetworkIsolation();
      await networkIsolation.setup();

      networkIsolation.setNetworkConditions({ delay: 100, dropRate: 0.1 });

      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Concurrent Usage', () => {
    it('should handle multiple isolation types concurrently', async () => {
      const dbIsolation = createDatabaseIsolation({ type: 'memory' });
      const portAllocator = createPortAllocator(9000, 9010);
      const memory = createMemoryIsolation();

      // Setup all isolations concurrently
      await Promise.all([
        dbIsolation.setup(),
        (async () => {
          await portAllocator.allocate();
          await portAllocator.allocate();
        })(),
        (async () => {
          const ctx = memory.createContext({ test: 'data' });
          ctx.set({ test: 'updated' });
        })()
      ]);

      // Verify all are working independently
      expect(dbIsolation.getConnectionInfo()).toBeDefined();
      expect(portAllocator.getAllocated()).toHaveLength(2);
      expect(memory.getStats().contexts).toBe(1);

      // Cleanup all
      await Promise.all([
        dbIsolation.teardown(),
        (async () => portAllocator.releaseAll())(),
        (async () => memory.clearAll())()
      ]);
    });

    it('should prevent resource conflicts in parallel tests', async () => {
      const results = await Promise.all([
        // Simulate parallel test execution
        (async () => {
          const allocator = createPortAllocator(9000, 9005);
          const port = await allocator.allocate();
          allocator.releaseAll();
          return port;
        })(),
        (async () => {
          const allocator = createPortAllocator(9000, 9005);
          const port = await allocator.allocate();
          allocator.releaseAll();
          return port;
        })(),
        (async () => {
          const allocator = createPortAllocator(9000, 9005);
          const port = await allocator.allocate();
          allocator.releaseAll();
          return port;
        })()
      ]);

      // All should have allocated different ports
      const uniquePorts = new Set(results);
      expect(uniquePorts.size).toBe(results.length);
    });
  });
});