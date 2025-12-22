# Web UI Tests

This directory contains unit tests for the APEX Web UI library components.

## Test Files

### `api-client.test.ts`

Tests for the `ApexApiClient` class that handles all REST API communication with the APEX backend.

**Coverage:**
- Client initialization and configuration
- All API endpoints (tasks, agents, config)
- Error handling and ApiError class
- Request/response handling
- URL construction with query parameters
- Header management

**Test count:** 50+ tests covering all API methods and edge cases

### `utils.test.ts`

Tests for utility functions used throughout the web UI.

**Coverage:**
- `cn()` - Tailwind CSS class merging
- `formatDate()` - Date formatting with custom options
- `truncateId()` - Task ID truncation for display
- `formatCost()` - Currency formatting
- `getStatusVariant()` - Badge variant selection based on task status
- `formatStatus()` - Human-readable status formatting
- `getRelativeTime()` - Relative time formatting (e.g., "5m ago")

**Test count:** 60+ tests covering all utility functions and edge cases

## WebSocket Client Testing

The `websocket-client.ts` file is **not currently tested** due to its dependency on browser-specific APIs:

- **WebSocket API**: Not available in Node.js test environment
- **React Hooks**: Requires React DOM environment and special testing utilities
- **Timer-based reconnection**: Complex async behavior

### Future Testing Approach

To add WebSocket tests in the future, consider:

1. **Browser environment testing** using `@vitest/browser` or similar
2. **Mock WebSocket** using a library like `mock-socket` or `vitest-websocket-mock`
3. **React Testing Library** for hook testing with `@testing-library/react-hooks`
4. **Integration tests** with a real WebSocket server

### Example Setup (Future)

```typescript
// vitest.config.ts for browser mode
export default defineConfig({
  test: {
    environment: 'jsdom', // or 'happy-dom'
    setupFiles: ['./test-setup.ts'],
  },
});

// test-setup.ts
import { Server } from 'mock-socket';

global.mockWsServer = new Server('ws://localhost:3000/ws');
```

```typescript
// websocket-client.test.ts (future)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server } from 'mock-socket';
import { ApexWebSocketClient } from '../websocket-client';

describe('ApexWebSocketClient', () => {
  let mockServer: Server;

  beforeEach(() => {
    mockServer = new Server('ws://localhost:3000/ws');
  });

  afterEach(() => {
    mockServer.close();
  });

  it('should connect to WebSocket server', async () => {
    const client = new ApexWebSocketClient();
    client.connect();
    // Assert connection
  });
});
```

## Running Tests

From the workspace root:

```bash
# Run all tests
npm test

# Run web-ui tests specifically
npm test --workspace=@apexcli/web-ui

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Test Coverage Goals

- **API Client**: 100% coverage (all methods, error paths)
- **Utilities**: 100% coverage (all functions, edge cases)
- **WebSocket Client**: To be added when browser testing is configured

## Notes

- Tests use Vitest with globals enabled
- Node environment is sufficient for API client and utility tests
- Mocked `fetch` API for API client tests
- Mocked timers for date/time utility tests
- TypeScript type checking ensures type safety across all tests
