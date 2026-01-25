# MockMCPServerBuilder Test Suite

This directory contains comprehensive tests for the MockMCPServerBuilder implementation.

## Test Files

### Core Tests
- **`mock-mcp-server-builder.test.ts`** - Original core functionality tests (44 test cases)
  - Basic configuration and validation
  - Tool handler configuration
  - Delay and error injection setup
  - Scenario management
  - Builder pattern validation

### Comprehensive Tests
- **`mock-mcp-server-builder-comprehensive.test.ts`** - Edge cases and advanced scenarios (47 test cases)
  - Error handling and boundary conditions
  - Complex configurations and state management
  - Performance and memory efficiency
  - Advanced scenario configurations
  - Type safety validation

### Integration Tests
- **`mock-mcp-server-builder-integration.test.ts`** - Real server integration (24 test cases)
  - MockMCPServerFacade integration
  - MockMCPServer integration
  - End-to-end workflow testing
  - Real-world usage patterns
  - Error recovery scenarios

### Validation Tests
- **`mock-mcp-server-builder-validation.test.ts`** - Test suite validation (20 test cases)
  - Test infrastructure validation
  - Basic functionality verification
  - Type system validation
  - Error recovery testing

## Documentation
- **`test-coverage-report.md`** - Detailed coverage analysis and metrics
- **`README.md`** - This file

## Running Tests

```bash
# Run all MockMCPServerBuilder tests
npm test -- src/mcp/mock-server/__tests__/

# Run specific test file
npm test -- src/mcp/mock-server/__tests__/mock-mcp-server-builder.test.ts

# Run with coverage
npm test -- --coverage src/mcp/mock-server/__tests__/

# Run in watch mode during development
npm run test:watch -- src/mcp/mock-server/__tests__/
```

## Test Coverage Summary

- **Total Test Cases**: 135 across 4 test files
- **Coverage Areas**: 12 major functional areas
- **Test Types**: Unit, integration, performance, edge cases
- **Expected Coverage**: >95% line coverage, >90% branch coverage

## Key Test Categories

1. **Builder Configuration**
   - Server identity and transport setup
   - Tool handler configuration (static, dynamic, sequence)
   - Delay and error injection configuration
   - Scenario management

2. **Integration Validation**
   - Real MockMCPServer/Facade creation
   - Server lifecycle management
   - Transport and connection handling
   - Request history and statistics

3. **Error Handling**
   - Invalid input handling
   - Builder state recovery
   - Server error scenarios
   - Graceful degradation

4. **Performance**
   - Large configuration handling
   - Build time efficiency
   - Memory usage optimization
   - Concurrent access patterns

5. **Advanced Scenarios**
   - Complex nested configurations
   - Multi-scenario testing
   - Real-world usage patterns
   - Type safety preservation

## Test Quality Standards

- **Isolation**: Tests are independent and don't interfere with each other
- **Deterministic**: All tests produce consistent results
- **Fast**: Individual tests complete within reasonable time
- **Comprehensive**: Both happy path and error conditions covered
- **Maintainable**: Clear structure and documentation

## Contributing

When adding new tests:

1. Follow the existing test structure and naming conventions
2. Include both positive and negative test cases
3. Test error conditions and edge cases
4. Add integration tests for significant new features
5. Update this README and coverage report as needed

## Test Infrastructure

- **Framework**: Vitest
- **Assertion Library**: Vitest expect
- **Mocking**: Vitest vi
- **TypeScript**: Full type checking enabled
- **Coverage**: Built-in Vitest coverage reporting