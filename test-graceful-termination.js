#!/usr/bin/env node

/**
 * Quick test runner for graceful termination tests
 * This verifies the test environment and runs a subset of our tests
 */

const { spawn } = require('child_process');
const path = require('path');

async function runTest() {
    console.log('🧪 Testing graceful termination implementation...\n');

    // Change to the project directory
    process.chdir(path.dirname(__filename));

    try {
        console.log('📋 Running graceful termination tests...');

        const testProcess = spawn('npx', [
            'vitest',
            'run',
            'packages/orchestrator/src/__tests__/graceful-termination-in-flight-requests.test.ts',
            '--reporter=verbose'
        ], {
            stdio: 'pipe',
            shell: true
        });

        let output = '';
        let errorOutput = '';

        testProcess.stdout.on('data', (data) => {
            output += data.toString();
            process.stdout.write(data);
        });

        testProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            process.stderr.write(data);
        });

        testProcess.on('close', (code) => {
            console.log(`\n📊 Test execution completed with code: ${code}`);

            if (code === 0) {
                console.log('✅ All graceful termination tests passed!');
                console.log('\n🎯 Implementation summary:');
                console.log('   - In-flight Claude SDK requests terminate gracefully ✓');
                console.log('   - Proper cleanup occurs (no hanging connections) ✓');
                console.log('   - Termination emits appropriate events ✓');
            } else {
                console.log('❌ Some tests failed. Check output above for details.');

                if (errorOutput.includes('Cannot find module')) {
                    console.log('\n💡 Tip: Missing dependencies. Run "npm install" first.');
                }

                if (errorOutput.includes('Permission')) {
                    console.log('\n💡 Tip: Permission-related files might be missing or misnamed.');
                }
            }

            process.exit(code);
        });

    } catch (error) {
        console.error('❌ Failed to run tests:', error.message);
        process.exit(1);
    }
}

runTest();