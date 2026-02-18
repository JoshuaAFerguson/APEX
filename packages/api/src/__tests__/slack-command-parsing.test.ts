import { describe, it, expect } from 'vitest';
import { parseSlackCommandText } from '../services/slack-service';

describe('parseSlackCommandText', () => {
  it('returns help for empty input', () => {
    expect(parseSlackCommandText('')).toEqual({ command: 'help', args: '' });
    expect(parseSlackCommandText('   ')).toEqual({ command: 'help', args: '' });
  });

  it('parses command and args', () => {
    expect(parseSlackCommandText('run ship it')).toEqual({
      command: 'run',
      args: 'ship it',
      channelOverride: undefined,
    });
  });

  it('parses channel override with space', () => {
    expect(parseSlackCommandText('status --channel #apex')).toEqual({
      command: 'status',
      args: '',
      channelOverride: '#apex',
    });
  });

  it('parses channel override with equals', () => {
    expect(parseSlackCommandText('report 123 --channel=C12345')).toEqual({
      command: 'report',
      args: '123',
      channelOverride: 'C12345',
    });
  });

  it('normalizes command casing', () => {
    expect(parseSlackCommandText('RuN do thing')).toEqual({
      command: 'run',
      args: 'do thing',
      channelOverride: undefined,
    });
  });
});
