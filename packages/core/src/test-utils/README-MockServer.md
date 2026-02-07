# MockServer Test Utility

The `MockServer` class provides a simple, reusable mock server based on Fastify for testing purposes across the APEX project.

## Features

- **Programmatic start/stop** on dynamic ports
- **Basic health check route** responds correctly
- **Clean API** for test usage
- **Dynamic port assignment** when port is 0
- **Route registration** before server start
- **Error handling** for common test scenarios

## Installation

The MockServer requires Fastify as a dependency:

```bash
npm install fastify
```

## Basic Usage

```typescript
import { MockServer } from '@apexcli/core/test-utils';

// Basic usage
const mockServer = new MockServer();
await mockServer.start();

const url = mockServer.getUrl(); // e.g., "http://127.0.0.1:35421"
console.log(`Server running at ${url}`);

// Make requests to built-in routes
const healthResponse = await fetch(`${url}/health`);
const pingResponse = await fetch(`${url}/ping`);

await mockServer.stop();
```

## Advanced Usage

### Custom Configuration

```typescript
const mockServer = new MockServer({
  host: '0.0.0.0',
  port: 8080, // or 0 for dynamic assignment
  logger: true, // Enable logging
  serverOptions: {
    // Additional Fastify options
  }
});
```

### Adding Custom Routes

```typescript
const mockServer = new MockServer();

// Add routes before starting
await mockServer.addRoutes((app) => {
  app.get('/api/test', async () => ({ test: 'success' }));

  app.post('/api/data', async (request) => ({
    received: request.body,
    timestamp: Date.now(),
  }));
});

await mockServer.start();
```

### One-liner Creation

```typescript
const { server, url } = await MockServer.create({
  logger: false
});

// Server is already started and ready to use
// Use the URL for requests
// Clean up with server.stop() when done
```

## Built-in Routes

The MockServer provides several built-in routes for testing:

- **GET `/health`** - Health check with status, timestamp, and uptime
- **GET `/ping`** - Simple ping/pong response
- **POST `/echo`** - Echoes request data back
- **GET `/status/:code`** - Returns specified HTTP status code

## Methods

### Lifecycle

- `start(): Promise<void>` - Start the server
- `stop(): Promise<void>` - Stop the server
- `isRunning(): boolean` - Check if server is running

### Information

- `getUrl(): string` - Get full server URL
- `getPort(): number` - Get port number
- `getHost(): string` - Get host address

### Configuration

- `addRoutes(register): Promise<void>` - Add routes before starting
- `getFastifyInstance(): Promise<FastifyInstance>` - Get Fastify instance

### Utilities

- `MockServer.create(options): Promise<{ server, url }>` - Create and start in one call

## Error Handling

The MockServer handles common error scenarios:

- Starting an already running server
- Stopping a non-running server
- Getting URL/port of non-running server
- Adding routes to a running server
- Missing Fastify dependency

## Test Integration

Perfect for integration tests that need a real HTTP server:

```typescript
import { describe, it, beforeEach, afterEach } from 'vitest';
import { MockServer } from '@apexcli/core/test-utils';

describe('My API Integration Tests', () => {
  let mockServer: MockServer;

  beforeEach(async () => {
    mockServer = new MockServer();
    await mockServer.addRoutes((app) => {
      // Add test-specific routes
    });
    await mockServer.start();
  });

  afterEach(async () => {
    if (mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  it('should test API integration', async () => {
    const response = await fetch(`${mockServer.getUrl()}/health`);
    expect(response.status).toBe(200);
  });
});
```

## Acceptance Criteria

✅ **MockServer class exists** with start(), stop(), and getUrl() methods
✅ **Server can be instantiated, started on an available port, and stopped** without errors
✅ **Basic health check route** responds correctly with proper JSON response

The MockServer meets all the specified acceptance criteria and provides additional functionality for comprehensive testing scenarios.