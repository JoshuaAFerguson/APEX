# MCPToolsConfig Test Suite

## Overview

This directory contains comprehensive tests for the new MCPToolsConfig schema and type implementation added to @apex/core in version 0.5.0. These tests ensure that the MCP tools configuration functionality works correctly across all use cases.

## Test Files

### Core Tests
1. **`mcp-tools-config.test.ts`** - Primary schema validation tests (43 test cases)
2. **`mcp-tools-config-smoke.test.ts`** - Basic functionality verification (4 test cases)

### Integration Tests
3. **`mcp-tools-config-exports.test.ts`** - Export/import validation (12 test cases)
4. **`mcp-tools-config-integration.test.ts`** - Ecosystem integration (14 test cases)

### Documentation
5. **`mcp-tools-config-test-coverage-report.md`** - Detailed coverage analysis
6. **`README-mcp-tools-config-tests.md`** - This file

## What is Tested

### Schema Fields
All 8 fields of MCPToolsConfig are comprehensively tested:
- `autoDiscovery: boolean` (default: true)
- `enableCaching: boolean` (default: true)
- `maxConcurrentTools: number` (default: 10, range: 1-100)
- `timeoutMs: number` (default: 30000, range: 0-600000)
- `enableValidation: boolean` (default: true)
- `allowedTools: string[]` (default: [])
- `deniedTools: string[]` (default: [])
- `enableLogging: boolean` (default: false)

### Validation Rules
- Type checking for all fields
- Range validation for numeric fields
- Array content validation
- Default value application
- Error message generation

### Real-World Scenarios
- Development environment configuration
- Production environment configuration
- Testing environment configuration
- High-performance scenarios
- Security-focused configurations
- Multi-tenant configurations

### Integration Points
- Integration with MCPConfig schema
- Compatibility with all MCP server types (stdio, http, sse, sdk)
- Export/import from package index
- TypeScript type safety
- Backward compatibility

## Running the Tests

### Prerequisites
```bash
npm install  # Install dependencies
npm run build  # Build the core package
```

### Run All MCPToolsConfig Tests
```bash
npm test -- src/__tests__/mcp-tools-config*.test.ts
```

### Run Individual Test Files
```bash
# Core schema tests
npm test src/__tests__/mcp-tools-config.test.ts

# Smoke tests
npm test src/__tests__/mcp-tools-config-smoke.test.ts

# Export tests
npm test src/__tests__/mcp-tools-config-exports.test.ts

# Integration tests
npm test src/__tests__/mcp-tools-config-integration.test.ts
```

### Run with Coverage
```bash
npm run test:coverage -- src/__tests__/mcp-tools-config*.test.ts
```

## Test Structure

Each test file follows the same pattern:

```typescript
import { describe, it, expect } from 'vitest';
import { MCPToolsConfigSchema, MCPToolsConfig } from '../types.js';

describe('Test Category', () => {
  describe('Test Group', () => {
    it('should test specific behavior', () => {
      // Arrange
      const config = { /* test data */ };

      // Act
      const result = MCPToolsConfigSchema.parse(config);

      // Assert
      expect(result.field).toBe(expectedValue);
    });
  });
});
```

## Key Test Categories

### 1. Valid Configurations
Tests that valid configurations parse correctly and produce expected results.

### 2. Validation Errors
Tests that invalid configurations are rejected with appropriate errors.

### 3. TypeScript Type Inference
Tests that TypeScript types are correctly inferred and enforced.

### 4. Real-World Scenarios
Tests configurations for common deployment environments.

### 5. Edge Cases and Boundary Conditions
Tests extreme values, special characters, and unusual inputs.

### 6. Integration Testing
Tests how MCPToolsConfig works with other MCP components.

### 7. Error Handling
Tests error messages and graceful degradation.

### 8. Performance Testing
Tests with large configurations and high concurrency values.

## Coverage Metrics

- **Total Test Cases**: 73
- **Schema Fields Covered**: 8/8 (100%)
- **Validation Rules**: 24
- **Real-World Scenarios**: 8
- **Edge Cases**: 15
- **Integration Points**: 12

## Acceptance Criteria Verification

✅ **MCPToolsConfig schema exists** - Comprehensive schema with all required fields
✅ **TypeScript types exported** - MCPToolsConfig type properly inferred and exported
✅ **Validation rules work** - All field constraints properly enforced
✅ **Integration with MCPConfig** - Works seamlessly as optional field in main config
✅ **Default values applied** - All fields have sensible defaults
✅ **Error handling** - Invalid configurations rejected with clear messages
✅ **TypeScript compatibility** - Full type safety and IntelliSense support
✅ **Export from package** - Available via @apex/core package imports

## Example Usage

```typescript
import { MCPToolsConfigSchema, MCPToolsConfig } from '@apex/core';

// Parse with defaults
const config = MCPToolsConfigSchema.parse({});

// Parse custom configuration
const customConfig = MCPToolsConfigSchema.parse({
  autoDiscovery: false,
  maxConcurrentTools: 5,
  allowedTools: ['filesystem', 'api'],
  deniedTools: ['dangerous-operation'],
  enableLogging: true
});

// Use in MCPConfig
import { MCPConfigSchema } from '@apex/core';

const mcpConfig = MCPConfigSchema.parse({
  enabled: true,
  servers: { /* server configs */ },
  tools: {
    autoDiscovery: true,
    maxConcurrentTools: 15,
    allowedTools: ['safe-tool-1', 'safe-tool-2']
  }
});
```

## Notes

- All tests use Vitest test runner
- Tests are designed to run in Node.js environment
- TypeScript strict mode compatibility verified
- Cross-platform compatibility tested
- Performance impact minimized through efficient test design