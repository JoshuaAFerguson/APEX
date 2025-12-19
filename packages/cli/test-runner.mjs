import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runTest() {
  try {
    console.log('Running SessionAutoSaver integration tests...\n');

    const { stdout, stderr } = await execAsync('npx vitest run src/services/__tests__/SessionAutoSaver.integration.test.ts --reporter=verbose', {
      cwd: '/Users/s0v3r1gn/APEX/packages/cli'
    });

    console.log('STDOUT:', stdout);
    if (stderr) {
      console.log('STDERR:', stderr);
    }
  } catch (error) {
    console.error('Test execution error:', error);
  }
}

runTest();