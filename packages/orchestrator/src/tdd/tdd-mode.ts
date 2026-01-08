import { exec } from 'child_process';
import { promisify } from 'util';
import type { TDDModeConfig } from '@apexcli/core';

const execAsync = promisify(exec);

export interface CommandResult {
  success: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
}

export interface TDDResult {
  success: boolean;
  command: string;
  output: CommandResult;
}

export interface CorrectionResult {
  success: boolean;
  iterations: number;
  outputs: CommandResult[];
}

export interface RegressionResult {
  status: 'skipped' | 'passed' | 'failed';
  output?: CommandResult;
}

export interface TDDModeOptions {
  projectPath: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export class TDDMode {
  private config: TDDModeConfig;
  private projectPath: string;
  private env?: NodeJS.ProcessEnv;
  private timeoutMs: number;

  constructor(config: TDDModeConfig, options: TDDModeOptions) {
    this.config = config;
    this.projectPath = options.projectPath;
    this.env = options.env;
    this.timeoutMs = options.timeoutMs ?? 300000;
  }

  async runTestFirstCycle(testFile: string, _implFile?: string): Promise<TDDResult> {
    const command = this.buildTestCommand(testFile);
    const output = await this.runCommand(command);
    return {
      success: output.success,
      command,
      output,
    };
  }

  async autoCorrectionLoop(testFile: string): Promise<CorrectionResult> {
    const outputs: CommandResult[] = [];
    const maxIterations = this.config.maxIterations ?? 5;

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const command = this.buildTestCommand(testFile);
      const output = await this.runCommand(command);
      outputs.push(output);

      if (output.success) {
        return {
          success: true,
          iterations: iteration + 1,
          outputs,
        };
      }
    }

    return {
      success: false,
      iterations: outputs.length,
      outputs,
    };
  }

  async checkRegression(): Promise<RegressionResult> {
    if (this.config.regressionGuard === false) {
      return { status: 'skipped' };
    }

    const command = this.config.testCommand || 'npm test';
    const output = await this.runCommand(command);
    return {
      status: output.success ? 'passed' : 'failed',
      output,
    };
  }

  private buildTestCommand(testFile?: string): string {
    const baseCommand = this.config.testCommand || 'npm test';
    if (!testFile) {
      return baseCommand;
    }

    if (baseCommand.includes('{{testFile}}')) {
      return baseCommand.replace('{{testFile}}', testFile);
    }

    return `${baseCommand} -- ${testFile}`;
  }

  private async runCommand(command: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.projectPath,
        env: this.env ?? process.env,
        timeout: this.timeoutMs,
        maxBuffer: 1024 * 1024 * 10,
      });
      return {
        success: true,
        stdout: stdout ?? '',
        stderr: stderr ?? '',
      };
    } catch (error) {
      const execError = error as { stdout?: string; stderr?: string; code?: number | string; message?: string };
      const exitCode = typeof execError.code === 'number' ? execError.code : undefined;
      return {
        success: false,
        exitCode,
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? execError.message ?? '',
      };
    }
  }
}
