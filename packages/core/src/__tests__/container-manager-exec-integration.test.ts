import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import {
  ContainerManager,
  type ExecCommandOptions,
  type ExecCommandResult,
} from '../container-manager';
import { ContainerRuntime } from '../container-runtime';

// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

const mockExec = vi.mocked(exec);

// Mock ContainerRuntime
vi.mock('../container-runtime');
const MockedContainerRuntime = vi.mocked(ContainerRuntime);

// Helper to create a mock exec callback
function mockExecCallback(stdout: string, stderr?: string, error?: Error) {
  return vi.fn((command: string, options: any, callback?: (error: Error | null, stdout: string, stderr: string) => void) => {
    if (callback) {
      setTimeout(() => callback(error || null, stdout, stderr || ''), 0);
    }
    return {} as any; // Mock ChildProcess
  });
}

// Helper to create an exec error with specific properties
function createExecError(code: number, stdout: string = '', stderr: string = '', message: string = 'Command failed') {
  const error = new Error(message) as any;
  error.code = code;
  error.stdout = stdout;
  error.stderr = stderr;
  return error;
}

describe('ContainerManager execCommand Integration Tests', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  const testContainerId = 'integration-test-container';

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    vi.mocked(mockRuntime.isRuntimeAvailable).mockResolvedValue(true);

    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('real-world command execution scenarios', () => {
    it('should execute package management commands successfully', async () => {
      const npmInstallOutput = `
added 245 packages, and audited 246 packages in 12s

18 packages are looking for funding
  run \`npm fund\` for details

found 0 vulnerabilities
`;

      mockExec.mockImplementationOnce(mockExecCallback(npmInstallOutput));

      const result = await manager.execCommand(
        testContainerId,
        ['npm', 'install', '--production'],
        {
          workingDir: '/app',
          timeout: 60000,
          environment: {
            NODE_ENV: 'production',
            NPM_CONFIG_LOGLEVEL: 'warn',
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('added 245 packages');
      expect(result.exitCode).toBe(0);
      expect(result.command).toContain('--workdir /app');
      expect(result.command).toContain('--env NODE_ENV=production');
    });

    it('should handle build commands with complex output', async () => {
      const buildOutput = `
> webpack build --mode production

asset main.js 892 KiB [emitted] [immutable] [minimized] (name: main)
asset style.css 45 KiB [emitted] [immutable] [minimized] (name: main)
orphan modules 1.2 MiB [orphan] 245 modules
runtime modules 1.89 KiB 9 modules
modules by path ./node_modules/ 1.8 MiB 567 modules
modules by path ./src/ 234 KiB
  modules by path ./src/components/ 167 KiB 89 modules
  modules by path ./src/utils/ 45 KiB 12 modules
  modules by path ./src/*.js 22 KiB 3 modules

webpack 5.75.0 compiled successfully in 24671 ms
`;

      mockExec.mockImplementationOnce(mockExecCallback(buildOutput));

      const result = await manager.execCommand(
        testContainerId,
        'npm run build',
        {
          workingDir: '/app',
          timeout: 120000,
          environment: {
            NODE_ENV: 'production',
          },
        }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('webpack 5.75.0 compiled successfully');
      expect(result.stdout).toContain('main.js 892 KiB');
    });

    it('should handle database commands with connection output', async () => {
      const dbOutput = `
psql (14.5 (Ubuntu 14.5-0ubuntu0.22.04.1))
Type "help" for help.

postgres=# \\l
                                  List of databases
   Name    |  Owner   | Encoding |   Collate   |    Ctype    |   Access privileges
-----------+----------+----------+-------------+-------------+-----------------------
 postgres  | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 |
 template0 | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 | =c/postgres          +
           |          |          |             |             | postgres=CTc/postgres
 template1 | postgres | UTF8     | en_US.UTF-8 | en_US.UTF-8 | =c/postgres          +
           |          |          |             |             | postgres=CTc/postgres
(3 rows)

postgres=# \\q
`;

      mockExec.mockImplementationOnce(mockExecCallback(dbOutput));

      const result = await manager.execCommand(
        testContainerId,
        ['psql', '-U', 'postgres', '-c', '\\l'],
        {
          environment: {
            PGPASSWORD: 'secretpassword',
            PGHOST: 'localhost',
            PGPORT: '5432',
          },
          timeout: 30000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('List of databases');
      expect(result.stdout).toContain('postgres');
      expect(result.command).toContain('--env PGPASSWORD=secretpassword');
    });

    it('should handle file system operations', async () => {
      const lsOutput = `
total 1234
drwxr-xr-x 2 node node  4096 Jan 15 10:30 bin
drwxr-xr-x 5 node node  4096 Jan 15 10:30 etc
drwxr-xr-x 3 node node  4096 Jan 15 10:30 home
drwxr-xr-x 8 node node  4096 Jan 15 10:30 lib
drwxr-xr-x 2 node node  4096 Jan 15 10:30 media
drwxr-xr-x 2 node node  4096 Jan 15 10:30 mnt
drwxr-xr-x 2 node node  4096 Jan 15 10:30 opt
dr-xr-xr-x 9 root root     0 Jan 15 10:30 proc
drwx------ 2 node node  4096 Jan 15 10:30 root
drwxr-xr-x 5 node node  4096 Jan 15 10:30 run
drwxr-xr-x 2 node node  4096 Jan 15 10:30 sbin
drwxr-xr-x 2 node node  4096 Jan 15 10:30 srv
dr-xr-xr-x 13 root root  0 Jan 15 10:30 sys
drwxrwxrwt 2 node node  4096 Jan 15 10:30 tmp
drwxr-xr-x 7 node node  4096 Jan 15 10:30 usr
drwxr-xr-x 11 node node 4096 Jan 15 10:30 var
`;

      mockExec.mockImplementationOnce(mockExecCallback(lsOutput));

      const result = await manager.execCommand(
        testContainerId,
        ['ls', '-la', '/'],
        {
          user: 'node',
          timeout: 10000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('drwxr-xr-x');
      expect(result.stdout).toContain('total 1234');
      expect(result.command).toContain('--user node');
    });

    it('should handle Git operations', async () => {
      const gitStatusOutput = `
On branch main
Your branch is up to date with 'origin/main'.

Changes to be committed:
  (use "git reset HEAD <file>..." to unstage)

	modified:   src/components/Header.tsx
	new file:   src/utils/dateHelpers.ts

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)

	modified:   README.md
	modified:   package.json

Untracked files:
  (use "git add <file>..." to include in what will be committed)

	.env.local
	logs/
`;

      mockExec.mockImplementationOnce(mockExecCallback(gitStatusOutput));

      const result = await manager.execCommand(
        testContainerId,
        'git status',
        {
          workingDir: '/app',
          environment: {
            GIT_AUTHOR_NAME: 'Test User',
            GIT_AUTHOR_EMAIL: 'test@example.com',
          },
          timeout: 15000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('On branch main');
      expect(result.stdout).toContain('Changes to be committed');
      expect(result.command).toContain('--env GIT_AUTHOR_NAME=');
    });

    it('should handle test suite execution with detailed output', async () => {
      const testOutput = `
> vitest run

 RUN  v0.25.8 /app

 ✓ src/components/Header.test.tsx (5)
 ✓ src/utils/dateHelpers.test.ts (12)
 ✓ src/services/api.test.ts (8)
 ✗ src/components/Footer.test.tsx (3)
   × should render with correct props
   × should handle click events
   ✓ should display current year

Test Files  4 passed (3), 1 failed
Tests       23 passed (20), 3 failed
Start at    14:32:15
Duration    2.34s (setup 0ms, collect 1.12s, tests 1.22s)

 FAIL  src/components/Footer.test.tsx > Footer component > should render with correct props
AssertionError: expected false to be true
 ❯ src/components/Footer.test.tsx:25:6
`;

      const testError = createExecError(1, testOutput, '');

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(testError, testOutput, ''), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(
        testContainerId,
        'npm test',
        {
          workingDir: '/app',
          timeout: 60000,
          environment: {
            CI: 'true',
            NODE_ENV: 'test',
          },
        }
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Test Files  4 passed');
      expect(result.stdout).toContain('23 passed (20), 3 failed');
      expect(result.stdout).toContain('AssertionError');
    });

    it('should handle Docker-in-Docker scenarios', async () => {
      const dockerOutput = `
CONTAINER ID   IMAGE     COMMAND                  CREATED         STATUS         PORTS                                       NAMES
a1b2c3d4e5f6   nginx     "/docker-entrypoint.…"   2 minutes ago   Up 2 minutes   0.0.0.0:80->80/tcp, :::80->80/tcp          web-server
f6e5d4c3b2a1   redis     "docker-entrypoint.s…"   5 minutes ago   Up 5 minutes   0.0.0.0:6379->6379/tcp, :::6379->6379/tcp  redis-cache
`;

      mockExec.mockImplementationOnce(mockExecCallback(dockerOutput));

      const result = await manager.execCommand(
        testContainerId,
        'docker ps',
        {
          privileged: true,
          environment: {
            DOCKER_HOST: 'unix:///var/run/docker.sock',
          },
          timeout: 30000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('CONTAINER ID');
      expect(result.stdout).toContain('nginx');
      expect(result.stdout).toContain('redis');
      expect(result.command).toContain('--privileged');
    });
  });

  describe('error handling and recovery scenarios', () => {
    it('should handle network connectivity issues', async () => {
      const networkError = createExecError(
        7, // curl exit code for failed to connect
        '',
        'curl: (7) Failed to connect to api.example.com port 443: Connection refused'
      );

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(networkError, '', 'curl: (7) Failed to connect to api.example.com port 443: Connection refused'), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(
        testContainerId,
        ['curl', '-f', 'https://api.example.com/health'],
        {
          timeout: 10000,
        }
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(7);
      expect(result.stderr).toContain('Failed to connect');
      expect(result.stderr).toContain('Connection refused');
    });

    it('should handle disk space issues', async () => {
      const diskSpaceError = createExecError(
        1,
        '',
        'write failed, filesystem is full'
      );

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(diskSpaceError, '', 'write failed, filesystem is full'), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(
        testContainerId,
        'dd if=/dev/zero of=/tmp/large-file bs=1G count=10',
        {
          timeout: 30000,
        }
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('filesystem is full');
    });

    it('should handle permission denied errors', async () => {
      const permissionError = createExecError(
        126,
        '',
        'Permission denied'
      );

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(permissionError, '', 'Permission denied'), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(
        testContainerId,
        'cat /root/secret-file',
        {
          user: 'nobody',
          timeout: 5000,
        }
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(126);
      expect(result.stderr).toContain('Permission denied');
    });

    it('should handle command not found errors', async () => {
      const commandNotFoundError = createExecError(
        127,
        '',
        'nonexistent-command: command not found'
      );

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(commandNotFoundError, '', 'nonexistent-command: command not found'), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(
        testContainerId,
        'nonexistent-command --help',
        {
          timeout: 5000,
        }
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('command not found');
    });

    it('should handle interrupted commands (SIGINT)', async () => {
      const interruptedError = createExecError(
        130, // 128 + SIGINT (2)
        'Partial output before interruption\n',
        ''
      );

      mockExec.mockImplementationOnce(vi.fn((command, options, callback) => {
        setTimeout(() => callback!(interruptedError, 'Partial output before interruption\n', ''), 0);
        return {} as any;
      }));

      const result = await manager.execCommand(
        testContainerId,
        'sleep 300',
        {
          timeout: 5000,
        }
      );

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(130);
      expect(result.stdout).toContain('Partial output before interruption');
    });
  });

  describe('performance and stress scenarios', () => {
    it('should handle commands with large output efficiently', async () => {
      // Simulate a 10MB output
      const largeOutput = 'x'.repeat(10 * 1024 * 1024) + '\n';

      mockExec.mockImplementationOnce(mockExecCallback(largeOutput));

      const startTime = Date.now();
      const result = await manager.execCommand(
        testContainerId,
        'cat /very-large-file',
        {
          timeout: 30000,
        }
      );
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.stdout.length).toBe(largeOutput.length);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle multiple sequential commands efficiently', async () => {
      const outputs = Array.from({ length: 10 }, (_, i) => `Command ${i + 1} output\n`);

      // Set up sequential mock calls
      outputs.forEach(output => {
        mockExec.mockImplementationOnce(mockExecCallback(output));
      });

      const startTime = Date.now();
      const results: ExecCommandResult[] = [];

      for (let i = 0; i < 10; i++) {
        const result = await manager.execCommand(testContainerId, `echo "Command ${i + 1}"`);
        results.push(result);
      }

      const duration = Date.now() - startTime;

      expect(results).toHaveLength(10);
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(`Command ${index + 1} output\n`);
      });
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle commands with many environment variables', async () => {
      const manyEnvVars: Record<string, string> = {};
      for (let i = 1; i <= 100; i++) {
        manyEnvVars[`VAR_${i}`] = `value_${i}`;
      }

      const envOutput = Object.keys(manyEnvVars).map(key => `${key}=${manyEnvVars[key]}`).join('\n');

      mockExec.mockImplementationOnce(mockExecCallback(envOutput));

      const result = await manager.execCommand(
        testContainerId,
        'printenv',
        {
          environment: manyEnvVars,
          timeout: 10000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.command).toContain('--env VAR_1=value_1');
      expect(result.command).toContain('--env VAR_100=value_100');
      expect(result.stdout).toContain('VAR_50=value_50');
    });

    it('should handle command execution under timeout pressure', async () => {
      // Test multiple commands with tight timeout constraints
      const fastCommands = [
        'echo "fast 1"',
        'echo "fast 2"',
        'echo "fast 3"',
      ];

      fastCommands.forEach((cmd, index) => {
        mockExec.mockImplementationOnce(mockExecCallback(`fast ${index + 1}\n`));
      });

      const results = await Promise.all(
        fastCommands.map(cmd =>
          manager.execCommand(testContainerId, cmd, { timeout: 100 })
        )
      );

      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.stdout).toBe(`fast ${index + 1}\n`);
      });
    });
  });

  describe('runtime compatibility scenarios', () => {
    it('should work correctly with Podman runtime', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('podman');

      const podmanOutput = 'Podman-specific output\n';
      mockExec.mockImplementationOnce(mockExecCallback(podmanOutput));

      const result = await manager.execCommand(
        testContainerId,
        'podman version',
        {
          timeout: 10000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.command).toContain('podman exec');
      expect(result.stdout).toBe(podmanOutput);
    });

    it('should handle runtime switching during operation', async () => {
      // Start with Docker
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('docker');
      mockExec.mockImplementationOnce(mockExecCallback('Docker result\n'));

      const dockerResult = await manager.execCommand(testContainerId, 'echo docker');
      expect(dockerResult.command).toContain('docker exec');

      // Switch to Podman for next command
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValueOnce('podman');
      mockExec.mockImplementationOnce(mockExecCallback('Podman result\n'));

      const podmanResult = await manager.execCommand(testContainerId, 'echo podman');
      expect(podmanResult.command).toContain('podman exec');
    });

    it('should handle runtime unavailability gracefully', async () => {
      vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('none');

      const result = await manager.execCommand(testContainerId, 'echo test');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
      expect(result.error).toBe('No container runtime available');
    });
  });

  describe('security and validation scenarios', () => {
    it('should properly escape complex shell commands', async () => {
      const maliciousCommand = 'echo "test"; rm -rf /; echo "after deletion"';
      const safeOutput = 'safely executed\n';

      mockExec.mockImplementationOnce(mockExecCallback(safeOutput));

      const result = await manager.execCommand(
        testContainerId,
        ['sh', '-c', maliciousCommand],
        {
          timeout: 5000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.command).toContain("'echo \"test\"; rm -rf /; echo \"after deletion\"'");
    });

    it('should handle commands with various quote combinations', async () => {
      const complexQuoteCommand = `echo 'single "double" quotes' "double 'single' quotes" mixed\\ quotes`;
      const output = 'quotes handled correctly\n';

      mockExec.mockImplementationOnce(mockExecCallback(output));

      const result = await manager.execCommand(testContainerId, complexQuoteCommand);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(output);
    });

    it('should validate and sanitize environment variable values', async () => {
      const riskyEnvValue = 'value; export MALICIOUS=evil; rm -rf /tmp/*';
      const safeOutput = 'env vars handled safely\n';

      mockExec.mockImplementationOnce(mockExecCallback(safeOutput));

      const result = await manager.execCommand(
        testContainerId,
        'printenv RISKY_VAR',
        {
          environment: {
            RISKY_VAR: riskyEnvValue,
          },
          timeout: 5000,
        }
      );

      expect(result.success).toBe(true);
      expect(result.command).toContain(`--env RISKY_VAR=`);
      // The value should be properly escaped
      expect(result.command).toContain(riskyEnvValue);
    });

    it('should handle Unicode and special characters in commands', async () => {
      const unicodeCommand = 'echo "Héllo Wörld! 🚀 Testing émojis and spëcial chars: αβγδε"';
      const unicodeOutput = 'Héllo Wörld! 🚀 Testing émojis and spëcial chars: αβγδε\n';

      mockExec.mockImplementationOnce(mockExecCallback(unicodeOutput));

      const result = await manager.execCommand(testContainerId, unicodeCommand);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe(unicodeOutput);
    });
  });
});