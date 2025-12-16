import { formatElapsed } from '../utils.js';

describe('formatElapsed', () => {
  it('formats sub-second durations as "0s"', () => {
    const startTime = new Date('2023-01-01T00:00:00.000Z');
    const currentTime = new Date('2023-01-01T00:00:00.500Z'); // 500ms later

    expect(formatElapsed(startTime, currentTime)).toBe('0s');
  });

  it('formats seconds only', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:00:42Z'); // 42 seconds later

    expect(formatElapsed(startTime, currentTime)).toBe('42s');
  });

  it('formats minutes and seconds', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:02:30Z'); // 2 minutes 30 seconds later

    expect(formatElapsed(startTime, currentTime)).toBe('2m 30s');
  });

  it('formats minutes only (no remaining seconds)', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:05:00Z'); // 5 minutes exactly

    expect(formatElapsed(startTime, currentTime)).toBe('5m');
  });

  it('formats hours and minutes', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T01:15:00Z'); // 1 hour 15 minutes later

    expect(formatElapsed(startTime, currentTime)).toBe('1h 15m');
  });

  it('formats hours only (no remaining minutes)', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T03:00:00Z'); // 3 hours exactly

    expect(formatElapsed(startTime, currentTime)).toBe('3h');
  });

  it('handles negative elapsed time (future start time)', () => {
    const startTime = new Date('2023-01-01T00:05:00Z'); // 5 minutes in future
    const currentTime = new Date('2023-01-01T00:00:00Z');

    expect(formatElapsed(startTime, currentTime)).toBe('0s');
  });

  it('uses current time by default', () => {
    const startTime = new Date(Date.now() - 5000); // 5 seconds ago

    const result = formatElapsed(startTime);

    // Should be approximately 5 seconds, allowing for execution time
    expect(result).toMatch(/^[45]s$/);
  });

  it('handles complex durations', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T02:30:45Z'); // 2 hours 30 minutes 45 seconds

    expect(formatElapsed(startTime, currentTime)).toBe('2h 30m');
  });

  it('handles edge case at exactly 1 second', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:00:01Z'); // exactly 1 second

    expect(formatElapsed(startTime, currentTime)).toBe('1s');
  });

  it('handles edge case at exactly 1 minute', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T00:01:00Z'); // exactly 1 minute

    expect(formatElapsed(startTime, currentTime)).toBe('1m');
  });

  it('handles edge case at exactly 1 hour', () => {
    const startTime = new Date('2023-01-01T00:00:00Z');
    const currentTime = new Date('2023-01-01T01:00:00Z'); // exactly 1 hour

    expect(formatElapsed(startTime, currentTime)).toBe('1h');
  });
});