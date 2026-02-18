# Screenshot Utility Testing Documentation

This document describes the comprehensive testing strategy for the `@apexcli/browser` screenshot utility.

## Test Organization

The test suite is organized into multiple files to cover different aspects of the functionality:

### Core Test Files

1. **`screenshot-utility.test.ts`** - Main functional tests
   - Basic screenshot capture functionality
   - Format support (PNG/JPEG)
   - Quality settings validation
   - File saving operations
   - Error handling
   - Convenience functions

2. **`screenshot-utility.edge.test.ts`** - Edge cases and integration tests
   - Extremely large pages
   - Complex CSS and animations
   - Unicode and special characters
   - Multiple viewport sizes
   - Concurrent operations
   - Different color modes
   - Performance under stress
   - Integration with real web content

3. **`screenshot-utility.stress.test.ts`** - Performance and stress tests
   - High-volume sequential captures
   - Concurrent screenshot operations
   - Multiple browser contexts
   - Memory and resource management
   - Endurance testing
   - Varying viewport sizes under load

4. **`test-utils.ts`** - Testing utilities and helpers
   - Test page generators
   - Screenshot validators
   - Performance monitoring
   - Mock scenarios
   - Test data generators

## Test Coverage Areas

### Functional Coverage

- ✅ **Basic Screenshot Capture**
  - Page and BrowserContext inputs
  - Default options handling
  - Buffer return validation

- ✅ **Format Support**
  - PNG format with signature validation
  - JPEG format with quality settings
  - Format-specific optimizations

- ✅ **Quality Settings**
  - JPEG quality range validation (1-100)
  - Quality impact on file size
  - PNG quality handling (ignored)

- ✅ **Screenshot Options**
  - Full page vs viewport capture
  - Background omission (transparency)
  - File path saving
  - Custom viewport sizes

- ✅ **Convenience Functions**
  - `capturePNG()` wrapper
  - `captureJPEG()` wrapper
  - `captureFullPageScreenshot()` wrapper
  - `captureViewportScreenshot()` wrapper

### Edge Cases Coverage

- ✅ **Large Content Handling**
  - Extremely tall pages (50,000px+)
  - Heavy DOM content (2000+ elements)
  - Complex CSS and animations

- ✅ **Content Variety**
  - Empty pages
  - Unicode and special characters
  - Transparent backgrounds
  - Gradient backgrounds

- ✅ **Concurrent Operations**
  - Multiple simultaneous screenshots
  - Different browser contexts
  - Rapid sequential captures

- ✅ **Error Scenarios**
  - Browser crashes
  - Network timeouts
  - Invalid file paths
  - JavaScript errors
  - Parameter validation

### Performance Coverage

- ✅ **Throughput Testing**
  - 20+ rapid sequential screenshots
  - 15+ concurrent operations
  - Multiple browser contexts (5+)

- ✅ **Memory Management**
  - Large file operations
  - Repeated captures
  - Long-running sessions (60s+)

- ✅ **Resource Efficiency**
  - Quality setting performance impact
  - Viewport size variations
  - File I/O operations

## Test Configuration

### Test Environment
- **Framework**: Vitest
- **Browser**: Playwright (Chromium)
- **Environment**: Node.js
- **Timeouts**: Extended for stress tests (up to 120s)

### Browser Setup
- **Headless Mode**: Enabled for CI/CD
- **Default Viewport**: 1280x720
- **Multiple Viewports**: 320x568 to 3840x2160

### File Management
- **Temporary Directories**: Auto-created for each test
- **Cleanup**: Automatic cleanup after each test
- **File Validation**: Size and content verification

## Running Tests

### Run All Tests
```bash
npm test --workspace=@apexcli/browser
```

### Run Specific Test Suites
```bash
# Main functional tests
npm test screenshot-utility.test.ts

# Edge case tests
npm test screenshot-utility.edge.test.ts

# Stress tests
npm test screenshot-utility.stress.test.ts
```

### Run with Coverage
```bash
npm run test -- --coverage
```

## Performance Benchmarks

### Expected Performance Ranges

| Operation | Expected Duration | Max Acceptable |
|-----------|------------------|----------------|
| Basic PNG capture | < 2s | 5s |
| Basic JPEG capture | < 2s | 5s |
| Full page capture | < 5s | 15s |
| Large page (50k px) | < 15s | 30s |
| Concurrent (15x) | < 10s | 30s |

### Memory Usage
- **Single screenshot**: < 50MB peak
- **Concurrent operations**: < 200MB peak
- **Long sessions**: No memory leaks

## Test Data and Scenarios

### Page Types Used
1. **Simple pages**: Basic HTML with minimal styling
2. **Complex pages**: CSS animations, gradients, effects
3. **Tall pages**: Large scrollable content (up to 50,000px)
4. **Heavy pages**: Many DOM elements (2000+)
5. **Unicode pages**: Special characters and emojis
6. **Empty pages**: Minimal content
7. **Transparent pages**: Background transparency testing

### Quality Levels Tested
- **JPEG qualities**: 1, 10, 25, 50, 75, 90, 100
- **Size validation**: Higher quality = larger file size
- **Performance impact**: Quality vs speed tradeoffs

### Viewport Sizes Tested
- **Mobile**: 320x568
- **Tablet**: 768x1024, 1024x768
- **Desktop**: 1280x720, 1920x1080
- **Large**: 2560x1440, 3840x2160

## Error Handling Validation

### Expected Error Scenarios
1. **Quality out of range** (< 1 or > 100)
2. **Invalid file paths** (non-existent directories)
3. **Browser crashes** (connection lost)
4. **Network timeouts** (slow loading pages)
5. **JavaScript errors** (page script failures)

### Error Response Validation
All error scenarios return structured responses:
```typescript
{
  success: false,
  error: "Descriptive error message",
  duration: number,
  data?: undefined
}
```

## Continuous Integration

### CI Requirements
- All tests must pass before merging
- Coverage should maintain > 90%
- No memory leaks detected
- Performance benchmarks met

### Test Stability
- Tests use deterministic content (data URLs)
- Timeouts account for CI environment variability
- Cleanup ensures no test interference
- Retry logic for flaky browser operations

## Debugging Test Failures

### Common Issues
1. **Timeout errors**: Increase test timeout for slow environments
2. **File permission errors**: Check temp directory permissions
3. **Browser launch failures**: Verify Playwright installation
4. **Memory errors**: Check available system memory

### Debug Helpers
- Performance monitoring built into tests
- File size and signature validation
- Detailed error messages
- Test result logging

### Troubleshooting Commands
```bash
# Run with debug output
DEBUG=pw:api npm test

# Run single test with verbose output
npm test -- --reporter=verbose screenshot-utility.test.ts

# Check browser installation
npx playwright install chromium
```

## Contributing

When adding new tests:

1. **Use existing utilities** from `test-utils.ts`
2. **Follow naming conventions** (`.test.ts`, `.edge.test.ts`, `.stress.test.ts`)
3. **Add appropriate timeouts** for long-running tests
4. **Validate both success and error cases**
5. **Clean up resources** in `afterEach` hooks
6. **Document performance expectations**

### Test Categories
- **Unit tests**: Single function validation (main test file)
- **Edge tests**: Boundary conditions and unusual scenarios
- **Stress tests**: Performance and resource limits
- **Integration tests**: Real-world usage scenarios

This comprehensive testing strategy ensures the screenshot utility is robust, performant, and reliable across various environments and use cases.