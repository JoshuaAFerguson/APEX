# WebFetch Testing Documentation

## Overview

This document provides comprehensive information about the testing strategy and implementation for the WebFetch tool integration in the APEX orchestrator system.

## Testing Goals

The testing strategy ensures that:

1. **WebFetch tool is properly integrated** with the APEX hooks system
2. **Security controls are enforced** for network requests
3. **Audit trails are created** for all WebFetch operations
4. **Events are properly emitted** for monitoring and debugging
5. **Edge cases and error conditions are handled** gracefully
6. **Performance requirements are met** for tool execution

## Test Files Structure

### Core Test Files

#### `hooks.test.ts` (Lines 383-607)
**Purpose**: Tests WebFetch integration with the hooks system
- ✅ WebFetch matcher registration
- ✅ Audit hook functionality
- ✅ Network permission validation
- ✅ Security restriction enforcement
- ✅ Event callback integration

#### `webfetch.test.ts`
**Purpose**: Tests core WebFetch tool functionality
- ✅ Parameter validation
- ✅ HTTP method support
- ✅ Error handling
- ✅ HTML/Markdown conversion
- ✅ Response handling
- ✅ Performance characteristics

### New Integration Test Files

#### `webfetch.integration.test.ts` (New)
**Purpose**: End-to-end integration testing
- ✅ Tool registration in orchestrator
- ✅ Hook pipeline execution
- ✅ Event emission verification
- ✅ Security policy enforcement
- ✅ Performance monitoring

#### `webfetch.hooks.edge-cases.test.ts` (New)
**Purpose**: Comprehensive edge case testing
- ✅ Malformed input handling
- ✅ Invalid URL scenarios
- ✅ Callback exception handling
- ✅ Timeout and performance testing
- ✅ AbortSignal propagation

### Additional Test Files (Existing)
- `webfetch.unit.test.ts`: Unit tests for specific functions
- `webfetch.cache.test.ts`: Cache functionality testing
- `webfetch.ai-analysis.test.ts`: AI analysis feature testing
- `webfetch.performance.test.ts`: Performance and load testing
- `webfetch.edge-cases.test.ts`: Additional edge cases

## Test Categories

### 1. Security Testing
Tests that WebFetch properly blocks dangerous requests:

```typescript
// Example: Testing localhost blocking
const restrictedUrls = [
  'http://localhost:3000',
  'https://127.0.0.1:8080',
  'file:///etc/passwd',
  'ftp://internal.server'
];
```

### 2. Audit Testing
Verifies that all WebFetch operations are properly logged:

```typescript
// Example: Checking audit logs
const task = await store.getTask(taskId);
const auditLogs = task?.logs.filter(l =>
  l.message.includes('WebFetch request')
);
expect(auditLogs.length).toBeGreaterThan(0);
```

### 3. Integration Testing
Confirms WebFetch works within the orchestrator ecosystem:

```typescript
// Example: Tool registration verification
const tools = orchestrator.getAvailableTools();
const webFetchTool = tools.find(tool => tool.name === 'WebFetch');
expect(webFetchTool).toBeDefined();
```

### 4. Event Testing
Validates proper event emission for monitoring:

```typescript
// Example: Event capture
orchestrator.on('tool.used', (event) => {
  expect(event.tool).toBe('WebFetch');
});
```

## Running the Tests

### Quick Test Run
```bash
# Run all WebFetch tests
npm test -- --grep "WebFetch"

# Run specific test files
npx vitest run packages/orchestrator/src/hooks.test.ts
npx vitest run packages/orchestrator/src/webfetch.integration.test.ts
```

### Comprehensive Test Execution
```bash
# Use the provided test runner script
./packages/orchestrator/src/run-webfetch-tests.sh

# Or manually run with coverage
npm run test:coverage -- packages/orchestrator/src/**/*webfetch*.test.ts
```

### Build Verification
```bash
# Ensure the code compiles
npm run build

# Type checking
npm run typecheck
```

## Test Scenarios Covered

### ✅ Security Scenarios
1. **Restricted URL Blocking**
   - localhost variants
   - Private IP ranges
   - File system access attempts
   - Invalid protocols

2. **Protocol Validation**
   - HTTP/HTTPS allowed
   - FTP, FILE, etc. blocked
   - Case sensitivity handling

3. **Sensitive Endpoint Detection**
   - URLs containing 'password', 'secret', 'token'
   - Warning generation without blocking

### ✅ Functional Scenarios
1. **HTTP Operations**
   - GET, POST, PUT, DELETE methods
   - Custom headers
   - Request bodies
   - Response handling

2. **Error Handling**
   - Network timeouts
   - Invalid domains
   - HTTP error codes
   - Malformed responses

3. **Content Processing**
   - HTML to Markdown conversion
   - Content type detection
   - Large response handling

### ✅ Integration Scenarios
1. **Orchestrator Integration**
   - Tool registration
   - Hook pipeline execution
   - Task lifecycle integration

2. **Event System**
   - tool.started, tool.completed events
   - tool.blocked events for security
   - log.added events for audit

3. **Performance**
   - Response time tracking
   - Memory usage monitoring
   - Concurrent request handling

### ✅ Edge Case Scenarios
1. **Input Validation**
   - Null/undefined inputs
   - Malformed data structures
   - Type mismatches

2. **Network Edge Cases**
   - Empty responses
   - Redirect chains
   - Special characters in URLs

3. **System Edge Cases**
   - Callback exceptions
   - AbortSignal handling
   - Timeout scenarios

## Expected Test Results

All tests should pass with the following coverage targets:

- **Function Coverage**: 100%
- **Branch Coverage**: ≥95%
- **Line Coverage**: ≥98%
- **Integration Coverage**: 100%

## Troubleshooting

### Common Test Issues

1. **Network Timeouts**: Tests use httpbin.org - ensure internet connectivity
2. **Permission Errors**: Ensure test directories are writable
3. **Port Conflicts**: Tests create temporary directories to avoid conflicts

### Debug Commands

```bash
# Run tests with verbose output
npx vitest run --reporter=verbose

# Run specific test with debugging
npx vitest run --reporter=verbose packages/orchestrator/src/hooks.test.ts

# Check TypeScript compilation
npx tsc --noEmit packages/orchestrator/src/webfetch.integration.test.ts
```

## Contributing

When adding new WebFetch functionality:

1. **Add corresponding tests** in appropriate test files
2. **Update security tests** if adding new URL handling
3. **Test integration points** if modifying hooks
4. **Verify event emission** for monitoring
5. **Document edge cases** and add tests for them

## Performance Considerations

- Tests should complete within 30 seconds total
- Individual WebFetch operations should complete within 10 seconds
- Hook execution should complete within 1 second
- Memory usage should remain stable across test runs

## Security Validation

All tests verify that:

- 🔒 Private networks cannot be accessed
- 🔒 File system access is blocked
- 🔒 Only HTTP/HTTPS protocols are allowed
- 🔒 All requests are properly audited
- 🔒 Security violations are logged and blocked

## Conclusion

The WebFetch testing suite provides comprehensive coverage of functionality, security, integration, and edge cases. The tests ensure that the WebFetch tool operates safely and reliably within the APEX orchestrator ecosystem while providing proper audit trails and event emission for monitoring and debugging.