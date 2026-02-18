# Form Controls Integration Test Infrastructure

This directory contains the integration test infrastructure for form controls in the APEX project.

## Overview

The form integration test infrastructure provides a comprehensive testing environment for form controls, including:

- Text inputs, select dropdowns, checkboxes, radio buttons
- File upload functionality
- Form validation scenarios
- Real-time user interaction simulation
- Accessibility testing
- Cross-browser form behavior validation

## Architecture

### Configuration
- `vitest.config.ts` - Specialized Vitest configuration for form testing
- Uses jsdom environment for DOM simulation
- Extended timeouts for form interactions
- Coverage reporting focused on form-related code

### Setup
- `setup.ts` - Global test setup with form-specific polyfills
- Mock File/FileReader APIs for file upload testing
- Custom matchers for form validation testing
- Utility functions for realistic user interaction simulation

### Test Files
- `infrastructure-verification.test.ts` - Validates test infrastructure
- `form-controls-sample.test.ts` - Sample test demonstrating capabilities
- Additional form test files following `*.test.ts` pattern

## Features

### Form Testing Utilities

#### `simulateTyping(element, text, options)`
Simulates realistic user typing with configurable delays:
```typescript
await simulateTyping(inputElement, 'user@example.com', { delay: 50 });
```

#### `simulateFileSelection(fileInput, files)`
Simulates file selection for upload inputs:
```typescript
const mockFile = createMockFile('document.pdf', 'content', 'application/pdf');
simulateFileSelection(fileInput, [mockFile]);
```

#### `fillFormWithTestData(form, testData)`
Fills an entire form with test data:
```typescript
await fillFormWithTestData(form, {
  username: 'testuser',
  email: 'test@example.com',
  country: 'us'
});
```

#### `waitForValidation(form, timeout)`
Waits for form validation to complete:
```typescript
const isValid = await waitForValidation(form, 1000);
```

### Custom Matchers

#### `toBeValidForm()`
Checks if a form passes validation:
```typescript
expect(form).toBeValidForm();
```

#### `toHaveValidationError(field?, message?)`
Checks for validation errors:
```typescript
expect(form).toHaveValidationError('email', 'required');
```

#### `toHaveFormData(expectedData)`
Validates form data matches expected values:
```typescript
expect(form).toHaveFormData({ username: 'testuser' });
```

#### `toBeAccessibleForm()`
Validates form accessibility:
```typescript
expect(form).toBeAccessibleForm();
```

## Running Tests

### Single Test Run
```bash
npm run test:form-integration
```

### Watch Mode (Development)
```bash
npm run test:form-integration:watch
```

### Coverage Report
```bash
npm run test:form-integration:coverage
```

### Infrastructure Validation
```bash
npm run validate:form-infrastructure
```

## Environment Requirements

- **Node.js**: >=18.0.0
- **Dependencies**:
  - vitest ^4.0.15
  - jsdom ^24.0.0 (available via monorepo)
  - TypeScript ^5.3.0

## API Mocks

The test environment includes mocks for:

- **File APIs**: File, FileReader, URL.createObjectURL
- **Clipboard API**: navigator.clipboard
- **Resize/Intersection Observers**: For responsive form components
- **Form Data**: Enhanced FormData support for testing

## Coverage Configuration

Coverage reporting focuses on:
- Form component files: `src/components/forms/**/*.{ts,tsx}`
- Form utilities: `src/utils/form-*.{ts,tsx}`
- Validation logic: `src/utils/validation*.{ts,tsx}`
- Form hooks: `src/hooks/use*form*.{ts,tsx}`

### Coverage Thresholds
- General form code: 80% lines/functions, 75% branches
- Form utilities: 90% lines/functions, 85% branches
- Validation logic: 95% lines/functions, 90% branches

## Best Practices

### Test Structure
1. Create realistic form elements with proper labels and validation
2. Use semantic HTML and ARIA attributes
3. Test both success and error scenarios
4. Include accessibility validation

### User Interaction Simulation
1. Use `simulateTyping()` for realistic text input
2. Simulate proper event sequences (focus, input, blur, change)
3. Test keyboard navigation and shortcuts
4. Include error recovery scenarios

### File Upload Testing
1. Create appropriate mock files with correct MIME types
2. Test file size and type validation
3. Test multiple file selection scenarios
4. Verify file data handling in form submission

## Example Test

```typescript
describe('Contact Form Integration', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    form = createContactForm();
    document.body.appendChild(form);
  });

  it('should submit with valid data', async () => {
    await fillFormWithTestData(form, {
      name: 'John Doe',
      email: 'john@example.com',
      message: 'Hello world'
    });

    expect(form).toBeValidForm();
    expect(form).toBeAccessibleForm();

    const submitBtn = form.querySelector('[type="submit"]');
    submitBtn.click();

    // Assert form submission behavior
  });
});
```

## Integration Points

This infrastructure integrates with:
- APEX core form validation utilities
- Web UI component testing
- Browser automation tests for E2E form scenarios
- Accessibility testing pipeline

## Troubleshooting

### Common Issues

1. **DOM not available**: Ensure jsdom environment is configured
2. **File upload errors**: Verify File/FileReader mocks are loaded
3. **Timing issues**: Increase timeouts for complex form interactions
4. **Accessibility failures**: Check label associations and ARIA attributes

### Debug Logging
Enable verbose output with:
```bash
npm run test:form-integration -- --reporter=verbose
```

For more detailed debugging, set environment variables:
```bash
DEBUG=1 npm run test:form-integration
```

## Contributing

When adding new form test capabilities:

1. Add utility functions to `setup.ts`
2. Create or extend custom matchers
3. Update coverage configuration for new form modules
4. Document new testing patterns in this README
5. Add verification tests to ensure infrastructure works

## Related Documentation

- [APEX Testing Architecture](../../docs/testing/architecture.md)
- [Browser Integration Tests](../browser-integration/README.md)
- [Accessibility Testing Guide](../../docs/testing/accessibility.md)