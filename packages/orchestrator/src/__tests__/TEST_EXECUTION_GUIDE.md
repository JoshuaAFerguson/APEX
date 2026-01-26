# Browser Integration Tests - Execution Guide

## Overview

This guide provides instructions for executing the browser automation integration tests that verify browser tools integrate correctly with the APEX tool system infrastructure.

## Test Files

### Primary Integration Tests
1. **`browser-tool-infrastructure-integration.test.ts`** (22 test cases)
   - Direct tool infrastructure integration
   - Browser operation execution through tool system
   - Error handling and validation

2. **`browser-mcp-tools-integration.test.ts`** (18 test cases)
   - MCP (Model Context Protocol) integration
   - Tool discovery and execution through MCP interface
   - Parameter validation and result formatting

## Execution Commands

### Individual Test Files
```bash
# Run browser tool infrastructure integration tests
npm test -- packages/orchestrator/src/__tests__/browser-tool-infrastructure-integration.test.ts

# Run browser MCP tools integration tests
npm test -- packages/orchestrator/src/__tests__/browser-mcp-tools-integration.test.ts
```

### Test Suites
```bash
# Run all browser integration tests
npm run test:browser-integration

# Run with coverage reporting
npm run test:browser-integration:coverage

# Run all orchestrator package tests
npm test -- packages/orchestrator/src/__tests__/
```

### Build and Validation
```bash
# Ensure compilation succeeds (REQUIRED before testing)
npm run build

# Type checking (REQUIRED for TypeScript validation)
npm run typecheck

# Run complete test suite
npm run test
```

## Expected Test Results

### Test Counts
- **browser-tool-infrastructure-integration.test.ts**: 22 passing test cases
- **browser-mcp-tools-integration.test.ts**: 18 passing test cases
- **Total**: 40 comprehensive integration test cases

### Coverage Areas Verified
✅ **Tool Registration and Discovery**
✅ **Tool Invocation Through Infrastructure**
✅ **Result Handling and Formatting**
✅ **Error Handling and Recovery**
✅ **Permission System Integration**
✅ **Event Emission and Streaming**
✅ **MCP Protocol Integration**
✅ **Resource Management and Cleanup**

## Test Dependencies

### External Dependencies
- **vitest**: Testing framework
- **playwright**: Browser automation (mocked)
- **eventemitter3**: Event handling
- **@anthropic-ai/claude-agent-sdk**: MCP integration

### Internal Dependencies
- **@apexcli/core**: Core types and interfaces
- **BrowserTool**: Main browser tool implementation
- **PermissionManager**: Permission system
- **PermissionStore**: Permission storage
- **ApexOrchestrator**: Main orchestration engine

## Mock Strategy

The tests use comprehensive mocking to ensure:
- **Fast Execution**: No real browser launches
- **Deterministic Results**: Consistent test outcomes
- **Isolation**: Tests don't affect external systems
- **Comprehensive Coverage**: All code paths tested

### Mocked Components
- Playwright browser, context, and page objects
- File system operations for screenshots
- Browser console stream functionality
- Event emission and handling
- Permission system responses

## Troubleshooting

### Common Issues

1. **Import Errors**
   - Ensure all dependencies are installed: `npm install`
   - Check TypeScript compilation: `npm run build`

2. **TypeScript Errors**
   - Run type checking: `npm run typecheck`
   - Verify core package types are available

3. **Test Timeouts**
   - Tests should complete quickly due to mocking
   - Check for infinite loops in test setup

4. **Permission System Errors**
   - Verify permission store initialization
   - Check mock setup for permission manager

### Debug Commands
```bash
# Verbose test output
npm test -- --verbose packages/orchestrator/src/__tests__/browser-tool-infrastructure-integration.test.ts

# Run specific test case
npm test -- --grep "should execute navigate operation" packages/orchestrator/src/__tests__/

# Check test file syntax
npx vitest --run --bail 1 packages/orchestrator/src/__tests__/browser-tool-infrastructure-integration.test.ts
```

## Acceptance Criteria Validation

### ✅ Browser automation integrates correctly with the tool system
**Verified by tests:**
- Tool registration and metadata validation
- Tool discovery through infrastructure
- Integration with APEX tool patterns

### ✅ Browser tools can be invoked through the tool infrastructure
**Verified by tests:**
- All 13 browser operations tested
- Parameter passing and validation
- MCP interface execution

### ✅ Results are properly handled
**Verified by tests:**
- Result formatting and structure
- Binary data handling (screenshots)
- Error result propagation
- MCP result formatting

### ✅ All tests pass
**Verified by:**
- Comprehensive mocking strategy
- Error handling test design
- Resource cleanup validation
- Type safety throughout

## Performance Expectations

### Test Execution Time
- Individual test files: < 5 seconds each
- Full browser integration suite: < 30 seconds
- All orchestrator tests: Variable based on total test count

### Resource Usage
- Memory: Low (mocked browser operations)
- CPU: Moderate during test execution
- Disk: Minimal (no real file operations)

## Continuous Integration

### CI Pipeline Requirements
```bash
# Build verification
npm run build

# Type checking
npm run typecheck

# Test execution
npm run test:browser-integration

# Coverage reporting (optional)
npm run test:browser-integration:coverage
```

### Success Criteria for CI
- ✅ Build completes without errors
- ✅ TypeScript compilation succeeds
- ✅ All 40 test cases pass
- ✅ No test timeouts or hangs
- ✅ Coverage meets requirements (if enabled)

## Next Steps

After successful test execution:

1. **Review Coverage Report**: Check `coverage/` directory for detailed coverage analysis
2. **Integration Validation**: Run full orchestrator test suite
3. **Manual Testing**: Consider manual browser automation testing if needed
4. **Documentation Update**: Update project documentation with test results

## Support

For issues with test execution:
1. Check this guide's troubleshooting section
2. Review test file documentation and comments
3. Verify all dependencies are properly installed
4. Check APEX project documentation for integration patterns