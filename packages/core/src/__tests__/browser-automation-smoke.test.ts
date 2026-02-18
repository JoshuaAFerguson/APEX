import {
  ConsoleSeveritySchema,
  StackFrameSchema,
  ConsoleMessageSchema,
  BrowserErrorSchema,
} from '../types.js';

/**
 * Smoke test for browser automation types
 * Basic validation that schemas are properly exported and functional
 */
describe('Browser Automation Types - Smoke Test', () => {
  it('should export all browser automation schemas', () => {
    expect(ConsoleSeveritySchema).toBeDefined();
    expect(StackFrameSchema).toBeDefined();
    expect(ConsoleMessageSchema).toBeDefined();
    expect(BrowserErrorSchema).toBeDefined();
  });

  it('should validate basic ConsoleSeverity', () => {
    const result = ConsoleSeveritySchema.parse('error');
    expect(result).toBe('error');
  });

  it('should validate basic StackFrame', () => {
    const stackFrame = {
      fileName: 'test.js',
      lineNumber: 1,
      columnNumber: 1,
    };
    const result = StackFrameSchema.parse(stackFrame);
    expect(result).toEqual(stackFrame);
  });

  it('should validate basic ConsoleMessage', () => {
    const message = {
      severity: 'info' as const,
      message: 'test',
      timestamp: new Date(),
    };
    const result = ConsoleMessageSchema.parse(message);
    expect(result).toEqual(message);
  });

  it('should validate basic BrowserError', () => {
    const error = {
      name: 'Error',
      message: 'test error',
      timestamp: new Date(),
    };
    const result = BrowserErrorSchema.parse(error);
    expect(result).toEqual(error);
  });
});