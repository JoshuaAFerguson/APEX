# Auto-Fix Execution Hook Test Suite

## Overview

This directory contains comprehensive tests for the auto-fix execution hook feature implemented in APEX v0.5.0. The auto-fix execution hook automatically triggers ImportAutoFixer after code generation workflow stages complete.

## Test Files

### 1. `auto-fix-execution-hook.test.ts`
**Purpose**: End-to-end integration tests for the complete auto-fix workflow

**Key Areas**:
- Stage completion detection and auto-fix triggering
- ImportAutoFixer service integration and configuration
- Event emission (`autofix:requested`, `autofix:completed`, etc.)
- File processing (git status parsing, file filtering)
- Stage result integration with AutoFixStageResults

**Test Count**: ~20 tests

### 2. `auto-fix-stage-completion.test.ts`
**Purpose**: Focused tests for stage completion detection logic

**Key Areas**:
- Code generation stage identification (by agent and output type)
- Configuration-based triggering (triggerStages, triggerAgents)
- File extension filtering and limits
- Stage failure handling
- Configuration validation and defaults

**Test Count**: ~18 tests

### 3. `auto-fix-service-integration.test.ts`
**Purpose**: Detailed service interaction and integration tests

**Key Areas**:
- ImportAutoFixer instantiation and configuration
- Service availability checking
- File processing (single and batch)
- Result conversion to AutoFixStageResults
- Error handling and graceful degradation
- Performance considerations

**Test Count**: ~18 tests

### 4. `auto-fix-test-coverage-report.md`
**Purpose**: Comprehensive documentation of test coverage

**Contents**:
- Feature description and acceptance criteria validation
- Detailed coverage analysis by test file
- Edge case coverage documentation
- Integration point verification
- Quality assurance methodology

### 5. `run-auto-fix-tests.js`
**Purpose**: Test validation utility script

**Function**:
- Validates test file structure
- Checks for required imports and patterns
- Provides test execution guidance
- Ensures test files are properly formed

## Running Tests

### All Auto-Fix Tests
```bash
npm test --workspace=@apex/orchestrator -- auto-fix
```

### Individual Test Files
```bash
# Integration tests
npm test --workspace=@apex/orchestrator -- auto-fix-execution-hook.test.ts

# Stage completion tests
npm test --workspace=@apex/orchestrator -- auto-fix-stage-completion.test.ts

# Service integration tests
npm test --workspace=@apex/orchestrator -- auto-fix-service-integration.test.ts
```

### With Coverage
```bash
npm test --workspace=@apex/orchestrator -- --coverage auto-fix
```

### Test Validation
```bash
node packages/orchestrator/src/__tests__/run-auto-fix-tests.js
```

## Test Structure

### Mocking Strategy
- **ImportAutoFixer**: Fully mocked to isolate orchestrator integration logic
- **File System**: `fs/promises` mocked for predictable test conditions
- **Git Operations**: `child_process` mocked for status parsing tests
- **Events**: Captured using vitest spies for emission verification

### Test Organization
- Each test file focuses on a specific aspect of the feature
- Tests are grouped by functional area using `describe` blocks
- Both positive and negative scenarios are covered
- Edge cases and error conditions are thoroughly tested

### Type Safety
- All tests use TypeScript with proper type definitions
- Interface compliance is verified through type assertions
- Mock objects maintain type compatibility with real services

## Coverage Areas

### ✅ Functional Coverage
- [x] Stage completion detection
- [x] Auto-fix service triggering
- [x] File processing and filtering
- [x] Result integration
- [x] Event emission
- [x] Configuration handling
- [x] Error recovery

### ✅ Integration Coverage
- [x] ApexOrchestrator integration
- [x] ImportAutoFixer service integration
- [x] Git workflow integration
- [x] Configuration system integration
- [x] Event system integration

### ✅ Error Coverage
- [x] Service unavailable scenarios
- [x] File processing errors
- [x] Configuration validation errors
- [x] Stage failure handling
- [x] Network/filesystem errors

## Expected Results

When all tests pass, you should see:
- **56+ test cases** passing across 3 test files
- **No timeout issues** from properly mocked async operations
- **Clean test output** with detailed assertion messages
- **Type safety** with no TypeScript compilation errors

## Dependencies

### Test Framework
- `vitest` - Testing framework with TypeScript support
- `@vitest/ui` - Optional UI for test visualization

### Type Definitions
- `@apexcli/core` - Core types and interfaces
- `@types/node` - Node.js type definitions

### Mocked Dependencies
- `fs/promises` - File system operations
- `child_process` - Git command execution
- `../import-auto-fixer/import-auto-fixer` - Auto-fix service

## Maintenance

### Adding Tests
1. Follow established mocking patterns
2. Maintain test isolation with proper setup/teardown
3. Include both success and failure scenarios
4. Update documentation when adding new coverage areas

### Updating Tests
1. Keep mocks in sync with actual service interfaces
2. Maintain type safety when changing interfaces
3. Update expected behaviors when implementation changes
4. Preserve test isolation principles

### Debugging
1. Use `console.log` sparingly in tests
2. Leverage vitest's built-in debugging capabilities
3. Check mock call counts and arguments
4. Verify event emission with proper data

## Future Enhancements

### Additional Test Areas
- [ ] Performance testing with large file sets
- [ ] Real ESLint integration tests
- [ ] Browser automation integration
- [ ] Multi-package monorepo scenarios

### Test Infrastructure
- [ ] Automated coverage reporting
- [ ] Performance regression detection
- [ ] Visual diff testing for code changes
- [ ] Continuous integration optimization

## Troubleshooting

### Common Issues

**Mock not found errors**:
- Ensure `vi.mock()` calls are at the top level
- Check that mocked modules exist and export correctly

**Type errors**:
- Verify all imported types are available from `@apexcli/core`
- Check that mock objects maintain interface compatibility

**Test timeouts**:
- Ensure async operations are properly mocked
- Use `vi.useFakeTimers()` for time-dependent tests

**Import errors**:
- Verify relative import paths are correct
- Check that all dependencies are installed

For additional help, see the main test coverage report in `auto-fix-test-coverage-report.md`.