# Documentation Testing Suite

This directory contains comprehensive tests for APEX documentation, ensuring accuracy, completeness, and usability.

## Getting Started Documentation Tests

The following test files validate the `docs/getting-started.md` documentation for v0.3.0 features:

### Test Files

1. **`getting-started-validation.test.ts`**
   - Main validation test suite
   - Validates all documented features match implementation
   - Checks for proper markdown formatting
   - Verifies code examples and command syntax
   - Tests documentation structure and flow

2. **`getting-started-features.integration.test.ts`**
   - Integration tests for documented features
   - Tests tab completion functionality
   - Validates session management commands
   - Verifies keyboard shortcuts integration
   - Tests rich terminal UI components

3. **`getting-started-content.test.ts`**
   - Lightweight content validation
   - Checks for presence of all required sections
   - Validates examples and formatting
   - Simple pass/fail validation

4. **`comprehensive-validation.test.ts`**
   - Comprehensive validation against acceptance criteria
   - Tests all v0.3.0 features coverage
   - Validates user experience elements
   - Ensures technical accuracy

5. **`validate-getting-started.js`**
   - Standalone validation script
   - Can be run without test framework
   - Automated content validation
   - Generates coverage reports

### Coverage Reports

- **`getting-started-coverage-report.md`** - Detailed test coverage report
- **`coverage-report.md`** - CLI Guide coverage report (existing)

## Test Coverage

### ✅ v0.3.0 Rich Terminal Interface Features
- Progress indicators with visual examples
- Interactive controls documentation
- Color-coded output system
- Real-time updates and terminal examples

### ✅ Session Management Basics
- Active sessions commands (sessions, resume, attach)
- Session persistence features
- Background execution
- Database storage documentation

### ✅ Tab Completion & Keyboard Shortcuts
- Command completion examples
- Autonomy level completion
- Essential shortcuts table
- Shell completion setup (bash, zsh, fish)

### ✅ Improved Onboarding Flow
- Step-by-step process (1-4 numbered steps)
- API key setup instructions
- Project initialization guidance
- First task example with realistic output

### ✅ CLI Guide Reference
- Link to cli-guide.md in proper context
- Description of advanced features
- Positioned in "Next Steps" section

## Running Tests

### With npm (recommended)
```bash
npm test docs/tests/
```

### Individual test files
```bash
npx vitest run docs/tests/getting-started-content.test.ts
npx vitest run docs/tests/comprehensive-validation.test.ts
```

### Standalone validation
```bash
node docs/tests/validate-getting-started.js
```

## Test Configuration

Tests are included in the main vitest configuration (`vitest.config.ts`):

```typescript
include: ['packages/*/src/**/*.test.ts', 'tests/**/*.test.ts', 'docs/tests/**/*.test.ts']
```

## Quality Metrics

- **Feature Documentation**: 100% of v0.3.0 features covered
- **Code Examples**: 15+ properly formatted code blocks
- **Interactive Examples**: Progress bars, terminal output, shortcuts table
- **Navigation**: Links to 5 related documentation files
- **Troubleshooting**: 4 common scenarios with solutions

## Acceptance Criteria Validation

All tests validate against the original acceptance criteria:

1. ✅ **Rich terminal UI features** - Progress indicators, interactive controls, color coding
2. ✅ **Session management basics** - Commands, persistence, background execution
3. ✅ **Tab completion and keyboard shortcuts** - Examples, setup instructions, tables
4. ✅ **Link to cli-guide.md** - Proper placement and description

## Maintenance

### Adding New Tests

1. Create test file following naming convention: `feature-name.test.ts`
2. Follow existing test patterns for consistency
3. Include both positive and negative test cases
4. Update this README with new coverage areas

### Updating Tests

When documentation changes:

1. Run existing tests to identify failures
2. Update test expectations to match new documentation
3. Add tests for any new features or sections
4. Regenerate coverage reports

### Best Practices

- **Accuracy**: Tests should validate against actual implementation
- **Completeness**: Cover all documented features and examples
- **Maintainability**: Write clear, readable test descriptions
- **Performance**: Keep tests lightweight and fast-running

## Future Enhancements

- Automated screenshot testing for terminal output examples
- Link validation for external URLs
- Spell check and grammar validation
- Integration with CI/CD for automatic validation
- Cross-reference validation between documentation files

## Status: ✅ PASSING

All tests currently pass and validate that the getting-started.md documentation:
- Accurately reflects v0.3.0 implementation
- Provides clear onboarding guidance
- Includes comprehensive feature coverage
- Maintains proper formatting and structure