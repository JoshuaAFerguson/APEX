import { truncateToolOutput } from '../utils.js';

describe('truncateToolOutput - simple validation', () => {
  it('should import and run without error', () => {
    const result = truncateToolOutput('Hello world');
    expect(result).toBeDefined();
    expect(result.output).toBe('Hello world');
    expect(result.truncated).toBe(false);
  });
});