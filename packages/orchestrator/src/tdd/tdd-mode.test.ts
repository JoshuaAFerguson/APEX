import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TDDMode } from './tdd-mode';

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    exec: vi.fn(),
  };
});

const mockExec = vi.mocked((await import('child_process')).exec);

describe('TDDMode', () => {
  beforeEach(() => {
    mockExec.mockReset();
  });

  it('runs test command with test file', async () => {
    mockExec.mockImplementation((command, _options, callback) => {
      callback?.(null, 'ok', '');
      return {} as any;
    });

    const tdd = new TDDMode(
      { enabled: true, testCommand: 'npm test', watchMode: false, maxIterations: 3, regressionGuard: true },
      { projectPath: '/tmp' }
    );

    const result = await tdd.runTestFirstCycle('example.test.ts');
    expect(result.success).toBe(true);
    expect(result.command).toBe('npm test -- example.test.ts');
  });

  it('stops auto-correction loop when tests pass', async () => {
    let callCount = 0;
    mockExec.mockImplementation((_command, _options, callback) => {
      callCount += 1;
      if (callCount < 2) {
        callback?.(Object.assign(new Error('fail'), { code: 1 }), '', 'fail');
      } else {
        callback?.(null, 'ok', '');
      }
      return {} as any;
    });

    const tdd = new TDDMode(
      { enabled: true, testCommand: 'npm test', watchMode: false, maxIterations: 3, regressionGuard: true },
      { projectPath: '/tmp' }
    );

    const result = await tdd.autoCorrectionLoop('example.test.ts');
    expect(result.success).toBe(true);
    expect(result.iterations).toBe(2);
  });

  it('skips regression guard when disabled', async () => {
    const tdd = new TDDMode(
      { enabled: true, testCommand: 'npm test', watchMode: false, maxIterations: 1, regressionGuard: false },
      { projectPath: '/tmp' }
    );

    const result = await tdd.checkRegression();
    expect(result.status).toBe('skipped');
    expect(mockExec).not.toHaveBeenCalled();
  });
});
