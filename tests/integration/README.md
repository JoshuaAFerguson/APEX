# APEX Integration Tests

This directory contains integration tests that verify the interaction between different APEX packages.

## Error Display Flow Integration Test

The `error-display-flow.integration.test.ts` file contains comprehensive tests for the end-to-end error handling and display flow across APEX packages.

### Test Coverage

The integration test covers:

1. **ApexError Creation and Context Handling**
   - Error instantiation with different error codes
   - Context propagation (task ID, agent ID, stage, operation)
   - Error metadata and timestamp handling
   - Error chaining and causality

2. **Error Formatting Infrastructure**
   - Core ErrorFormatter functionality
   - CLI ErrorFormatter integration
   - Multiple verbosity levels (minimal, normal, verbose)
   - ANSI color code handling for terminal output

3. **Real-world Error Scenarios**
   - Database connection failures
   - File permission errors
   - API rate limiting
   - TypeScript compilation errors
   - Workflow execution failures

4. **Cross-Package Integration**
   - Core package types and utilities
   - Orchestrator error propagation
   - CLI display formatting
   - Error context preservation through transformation chains

5. **Edge Cases and Error Boundaries**
   - Malformed error information handling
   - Large error messages and stack traces
   - Terminal width considerations
   - Performance with high error volumes

### Test Structure

#### Basic Error Flow
- Simple error creation and formatting
- Basic CLI formatter functionality
- Core ApexError properties validation

#### End-to-End Error Flow
- Complete error lifecycle from creation to display
- Error transformation between package formats
- Context preservation and propagation
- Multiple verbosity level testing

#### Realistic Error Scenarios
- Database connection errors
- File system permission issues
- API rate limiting scenarios
- Multiple error aggregation and display

#### Edge Cases
- Malformed error handling
- Performance with large volumes
- Cross-package integration verification

### Running the Tests

```bash
# Run all integration tests
npm test tests/integration/

# Run specific error flow integration test
npm test tests/integration/error-display-flow.integration.test.ts

# Run with coverage
npm test:coverage
```

### Dependencies

The integration test uses:

- **Vitest** for the testing framework
- **@apexcli/core** for ApexError and core error formatting types
- **@apexcli/cli** for CLI-specific error formatting
- Custom ANSI stripping utility for output validation

### Implementation Notes

1. **Import Paths**: Uses workspace package references (`@apexcli/core`, `@apexcli/cli`) to ensure proper package isolation testing

2. **ANSI Handling**: Includes custom `stripAnsi` function to remove terminal color codes for consistent test assertions

3. **Error Context**: Tests preserve and validate error context through the complete transformation chain from core errors to CLI display

4. **Real-world Scenarios**: Tests include realistic error scenarios that would occur during actual APEX usage

5. **Performance Considerations**: Includes tests for handling large volumes of errors efficiently

### Validation

To validate the integration test setup without running the full test suite, you can use the validation script:

```bash
npx ts-node validate-integration-test.ts
```

This script tests the basic error flow integration and import paths.