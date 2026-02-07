# Test Isolation Patterns Guide

This guide provides comprehensive examples and best practices for using the APEX test isolation system.

## Table of Contents

- [Overview](#overview)
- [Quick Reference](#quick-reference)
- [Usage Patterns](#usage-patterns)
- [Real-World Examples](#real-world-examples)
- [Troubleshooting](#troubleshooting)
- [Advanced Techniques](#advanced-techniques)

## Overview

The APEX test isolation system provides a comprehensive solution for creating parallel-safe, reproducible tests. It ensures that:

1. **Each test runs in complete isolation** with unique temporary directories, environment variables, and mock state
2. **All resources are automatically cleaned up** after each test, preventing leaks and interference
3. **Tests can run in parallel** without affecting each other
4. **State changes are tracked and restored** to maintain test independence

## Quick Reference

### Import Statement

```typescript
import {
  createIsolatedTest,
  withIsolation,
  createTestContextFactory,
  CleanupPriority,
  type IsolatedTestContext
} from '../../tests/test-utils/isolation';
```

### Basic Usage Patterns

```typescript
// Pattern 1: withIsolation (recommended for simple tests)
it('should work with automatic cleanup', async () => {
  await withIsolation(async (ctx) => {
    // Your test code here
  });
});

// Pattern 2: Manual lifecycle (for complex test suites)
describe('Feature', () => {
  let ctx: IsolatedTestContext;

  beforeEach(async () => {
    ctx = await createIsolatedTest({ prefix: 'feature' });
  });

  afterEach(async () => {
    await ctx.teardown();
  });

  it('should work', async () => {
    // Use ctx here
  });
});

// Pattern 3: Factory pattern (for consistent setup)
describe('Feature', () => {
  const { setup, teardown, getContext } = createTestContextFactory({
    prefix: 'feature',
    withDatabase: true
  });

  beforeEach(setup);
  afterEach(teardown);

  it('should work', () => {
    const ctx = getContext();
    // Use ctx here
  });
});
```

## Usage Patterns

### File System Testing

```typescript
// Testing file operations with automatic cleanup
it('should handle file operations safely', async () => {
  await withIsolation(async (ctx) => {
    // Create temporary files - automatically cleaned up
    const configFile = await ctx.files.createTempFile('config.yaml', `
      version: 1.0
      environment: test
    `);

    const dataDir = await ctx.files.createTempDir('data');
    const userFile = await ctx.files.createTempFile('data/users.json', '[]');

    // Test file operations
    expect(await fs.readFile(configFile, 'utf8')).toContain('version: 1.0');
    expect(await fs.stat(dataDir)).toSatisfy(stats => stats.isDirectory());

    // Track external files created by your code
    ctx.files.trackPath('/tmp/some-external-file');

    // All files cleaned up automatically, even external ones
  });
});
```

### Environment Variable Testing

```typescript
// Testing code that depends on environment variables
it('should handle different environments', async () => {
  await withIsolation(async (ctx) => {
    // Set test environment - original values restored after test
    ctx.env.setEnv('NODE_ENV', 'test');
    ctx.env.setEnv('API_URL', 'http://localhost:3000');
    ctx.env.setEnv('DEBUG', 'true');

    // Delete sensitive variables for testing
    ctx.env.deleteEnv('PRODUCTION_SECRET');

    // Test your code with the modified environment
    const config = loadConfiguration();
    expect(config.environment).toBe('test');
    expect(config.apiUrl).toBe('http://localhost:3000');

    // Environment automatically restored to original state
  });
});
```

### Mock and Spy Testing

```typescript
// Testing with isolated mocks and spies
it('should track external API calls', async () => {
  await withIsolation(async (ctx) => {
    // Create tracked spies - automatically restored
    const fetchSpy = ctx.mocks.spyOn(global, 'fetch');
    const logSpy = ctx.mocks.spyOn(console, 'log');

    // Create mock functions
    const mockCallback = ctx.mocks.fn((data) => {
      return `processed: ${data}`;
    });

    // Set up mock responses
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ status: 'ok' })));

    // Test your code
    await myApiClient.getData();

    expect(fetchSpy).toHaveBeenCalledWith('https://api.example.com/data');
    expect(logSpy).toHaveBeenCalledWith('API call successful');

    // All mocks restored automatically
  });
});
```

### Timer Testing

```typescript
// Testing code with timers and intervals
it('should handle background timers safely', async () => {
  await withIsolation(async (ctx) => {
    let executionCount = 0;

    // Create tracked timers - automatically cleaned up
    const timeout = ctx.timers.setTimeout(() => {
      console.log('Timeout executed');
    }, 100);

    const interval = ctx.timers.setInterval(() => {
      executionCount++;
    }, 50);

    // Wait for some executions
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(executionCount).toBeGreaterThan(0);

    // Timers cleaned up automatically - won't continue running
  });
});
```

### Process Testing

```typescript
// Testing code that spawns child processes
it('should manage child processes', async () => {
  await withIsolation(async (ctx) => {
    // Spawn a child process
    const child = spawn('node', ['-e', 'setTimeout(() => {}, 10000)']);

    // Track it for cleanup
    ctx.processes.track(child, 'test-node-process');

    // Test interaction with the process
    expect(child.pid).toBeDefined();

    // Process killed automatically during cleanup
  });
});
```

## Real-World Examples

### Testing Database Operations

```typescript
describe('User Repository', () => {
  it('should create and find users', async () => {
    await withIsolation(async (ctx) => {
      // Each test gets its own database file
      const db = new Database(ctx.dbPath);
      await db.migrate();

      const userRepo = new UserRepository(db);

      // Create test user
      const user = await userRepo.create({
        name: 'John Doe',
        email: 'john@example.com'
      });

      // Find user
      const found = await userRepo.findById(user.id);

      expect(found).toMatchObject({
        name: 'John Doe',
        email: 'john@example.com'
      });

      // Database file cleaned up automatically
    }, { withDatabase: true });
  });
});
```

### Testing Configuration Loading

```typescript
describe('Config Loader', () => {
  it('should load config from environment and files', async () => {
    await withIsolation(async (ctx) => {
      // Set up environment
      ctx.env.setEnv('APP_PORT', '3000');
      ctx.env.setEnv('APP_ENV', 'test');

      // Create config file
      const configPath = await ctx.files.createTempFile('app.json', JSON.stringify({
        database: {
          host: 'localhost',
          port: 5432
        },
        logging: {
          level: 'debug'
        }
      }));

      // Test config loading
      const config = loadConfig(configPath);

      expect(config).toMatchObject({
        port: 3000,
        environment: 'test',
        database: {
          host: 'localhost',
          port: 5432
        }
      });

      // Environment and files cleaned up automatically
    });
  });
});
```

### Testing File Processing

```typescript
describe('CSV Processor', () => {
  it('should process CSV files and generate reports', async () => {
    await withIsolation(async (ctx) => {
      // Create input CSV file
      const inputCsv = await ctx.files.createTempFile('input.csv', `
name,age,city
Alice,30,New York
Bob,25,San Francisco
Charlie,35,Chicago
      `.trim());

      // Create output directory
      const outputDir = await ctx.files.createTempDir('output');

      // Process CSV
      const processor = new CsvProcessor();
      await processor.process(inputCsv, outputDir);

      // Check output files
      const summaryFile = path.join(outputDir, 'summary.json');
      const reportFile = path.join(outputDir, 'report.html');

      expect(await fs.readFile(summaryFile, 'utf8')).toContain('totalRecords');
      expect(await fs.stat(reportFile)).toBeTruthy();

      // All files cleaned up automatically
    });
  });
});
```

### Testing HTTP Server

```typescript
describe('HTTP Server', () => {
  it('should handle requests correctly', async () => {
    await withIsolation(async (ctx) => {
      // Set up test environment
      ctx.env.setEnv('PORT', '0'); // Random available port
      ctx.env.setEnv('NODE_ENV', 'test');

      // Create server config
      const configPath = await ctx.files.createTempFile('server.json', JSON.stringify({
        cors: { origin: '*' },
        rateLimit: { max: 100 }
      }));

      // Start server
      const server = new HttpServer({ configFile: configPath });
      await server.start();

      // Track server for cleanup
      ctx.registerCleanup(
        () => server.stop(),
        CleanupPriority.HIGH,
        'stop-http-server'
      );

      // Test server
      const response = await fetch(\`http://localhost:\${server.port}/health\`);
      expect(response.status).toBe(200);

      // Server stopped automatically during cleanup
    });
  });
});
```

## Troubleshooting

### Debugging Cleanup Issues

```typescript
it('should help debug resource cleanup', async () => {
  await withIsolation(async (ctx) => {
    // Add debug cleanup to see execution order
    ctx.registerCleanup(
      () => console.log('Debug: Custom cleanup executed'),
      CleanupPriority.NORMAL,
      'debug-cleanup'
    );

    // Monitor resource usage
    console.log('Context ID:', ctx.id);
    console.log('Temp dir:', ctx.tempDir);
    console.log('Start time:', ctx.startTime);

    // Create some resources to track
    await ctx.files.createTempFile('debug.txt', 'debug content');
    ctx.env.setEnv('DEBUG_VAR', 'debug_value');

    // Check what's being tracked
    console.log('Tracked files:', ctx.files.getTrackedPaths());
    console.log('Modified env vars:', ctx.env.getModified());
    console.log('Active mocks:', ctx.mocks.getActiveCount());

    // Get elapsed time
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Test duration:', ctx.getElapsed(), 'ms');

  }, { suppressCleanupErrors: true }); // Suppress cleanup errors for debugging
});
```

### Common Issues and Solutions

#### Issue: Tests hang or timeout

```typescript
// Bad: Timers not tracked
it('might hang', async () => {
  setTimeout(() => {
    // This timer might outlive the test
  }, 1000);
});

// Good: Timers tracked and cleaned up
it('will not hang', async () => {
  await withIsolation(async (ctx) => {
    ctx.timers.setTimeout(() => {
      // This timer is cleaned up automatically
    }, 1000);
  });
});
```

#### Issue: Environment pollution between tests

```typescript
// Bad: Direct environment modification
process.env.NODE_ENV = 'test'; // Affects other tests

// Good: Isolated environment changes
await withIsolation(async (ctx) => {
  ctx.env.setEnv('NODE_ENV', 'test'); // Restored automatically
});
```

#### Issue: File system pollution

```typescript
// Bad: Manual file creation
await fs.writeFile('/tmp/test-file.txt', 'data'); // May not be cleaned up

// Good: Tracked file creation
await withIsolation(async (ctx) => {
  await ctx.files.createTempFile('test-file.txt', 'data'); // Cleaned up automatically
});
```

## Advanced Techniques

### Custom Cleanup Operations

```typescript
it('should handle complex cleanup scenarios', async () => {
  await withIsolation(async (ctx) => {
    // Create a database connection
    const db = new Database(ctx.dbPath);
    await db.connect();

    // Register high-priority cleanup for database
    ctx.registerCleanup(
      async () => {
        await db.close();
        console.log('Database connection closed');
      },
      CleanupPriority.CRITICAL,
      'close-database'
    );

    // Create a cache that needs cleanup
    const cache = new Redis({ port: 6380 });
    await cache.connect();

    // Register cleanup for cache
    ctx.registerCleanup(
      async () => {
        await cache.flushall();
        await cache.disconnect();
        console.log('Cache cleared and disconnected');
      },
      CleanupPriority.HIGH,
      'cleanup-cache'
    );

    // Test your code...

    // Cleanup happens in order: database -> cache -> built-in utilities
  });
});
```

### Shared Test Context Factory

```typescript
// Create a reusable factory for complex test setups
function createApiTestContext() {
  return createTestContextFactory({
    prefix: 'api-test',
    withDatabase: true,
    withMocks: true
  });
}

describe('API Endpoint Tests', () => {
  const { setup, teardown, getContext } = createApiTestContext();

  beforeEach(setup);
  afterEach(teardown);

  beforeEach(async () => {
    const ctx = getContext();

    // Common setup for all API tests
    ctx.env.setEnv('NODE_ENV', 'test');

    const db = new Database(ctx.dbPath);
    await db.migrate();

    // Store db in context data for reuse
    ctx.data.db = db;
  });

  it('should create users via API', async () => {
    const ctx = getContext();
    const db = ctx.data.db as Database;

    // Test implementation using shared context
  });
});
```

### Parallel Test Validation

```typescript
describe('Parallel Safety Tests', () => {
  // These tests should be able to run in parallel without interference
  const testCases = Array.from({ length: 10 }, (_, i) => i);

  testCases.forEach(index => {
    it(\`should work independently - test \${index}\`, async () => {
      await withIsolation(async (ctx) => {
        // Each test gets its own isolated environment
        ctx.env.setEnv('TEST_INDEX', String(index));

        const file = await ctx.files.createTempFile(
          \`test-\${index}.txt\`,
          \`Test data for test \${index}\`
        );

        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

        // Verify isolation
        expect(process.env.TEST_INDEX).toBe(String(index));
        expect(await fs.readFile(file, 'utf8')).toContain(\`Test data for test \${index}\`);

        // This won't interfere with other parallel tests
      }, { prefix: \`parallel-\${index}\` });
    });
  });
});
```

### Performance Testing with Isolation

```typescript
it('should measure performance in isolation', async () => {
  await withIsolation(async (ctx) => {
    // Create test data
    const dataFile = await ctx.files.createTempFile('large-data.json',
      JSON.stringify(Array.from({ length: 10000 }, (_, i) => ({ id: i, value: Math.random() })))
    );

    // Measure performance
    const startTime = ctx.startTime.getTime();

    // Run the operation being tested
    const result = await processLargeFile(dataFile);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Assert on both correctness and performance
    expect(result.processed).toBe(10000);
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds

    console.log(\`Processing took \${duration}ms\`);
    console.log(\`Test total time: \${ctx.getElapsed()}ms\`);
  });
});
```

This comprehensive guide should help you implement robust, isolated tests using the APEX test isolation system. The patterns and examples can be adapted to your specific testing needs while maintaining the benefits of parallel execution and automatic cleanup.