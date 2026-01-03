/**
 * Simple validation script to test error display flow integration
 * without requiring the full test runner setup
 */

// Core error handling imports
import { ApexError, ApexErrorCode, ApexErrorContext } from '@apexcli/core';
import { createStructuredError, generateErrorId } from '@apexcli/core';

// CLI error formatting imports
import {
  ErrorFormatter as CliErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
} from '@apexcli/cli/src/utils/ErrorFormatter.js';

// Utility function to strip ANSI escape codes
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

// Test the error flow
function testErrorFlow() {
  console.log('Testing Error Display Flow Integration...');

  try {
    // Step 1: Create ApexError
    const apexError = new ApexError(
      'Test integration error',
      ApexErrorCode.TASK_EXECUTION_FAILED,
      {
        taskId: 'test-task',
        agentId: 'tester',
        stage: 'validation',
        operation: 'testErrorFlow',
      }
    );

    console.log('✓ ApexError created successfully');
    console.log(`  - Error ID: ${apexError.errorId}`);
    console.log(`  - Code: ${apexError.code}`);
    console.log(`  - Context: ${JSON.stringify(apexError.context, null, 2)}`);

    // Step 2: Create StructuredError
    const structuredError = createStructuredError(
      'Structured error test',
      {
        severity: 'error' as const,
        category: 'test' as const,
        location: { file: 'test.ts', line: 1 },
      }
    );

    console.log('✓ StructuredError created successfully');
    console.log(`  - Error ID: ${structuredError.id}`);
    console.log(`  - Severity: ${structuredError.severity}`);

    // Step 3: Create CLI FormattedError
    const formattedError: FormattedError = {
      type: ErrorType.APPLICATION,
      message: apexError.message,
      context: {
        file: 'integration-test.ts',
        line: 42,
        function: 'testErrorFlow',
        description: 'Testing error formatting integration',
      },
      suggestions: [
        {
          title: 'Review error handling',
          description: 'Check the error handling implementation',
        },
      ],
      originalError: apexError,
    };

    console.log('✓ FormattedError created successfully');

    // Step 4: Format with CLI formatter
    const cliFormatter = new CliErrorFormatter(ErrorVerbosity.NORMAL);
    const output = cliFormatter.format(formattedError);
    const strippedOutput = stripAnsi(output);

    console.log('✓ CLI formatting completed successfully');
    console.log('\nFormatted Output (stripped):');
    console.log('---');
    console.log(strippedOutput);
    console.log('---');

    // Step 5: Validate output contains expected elements
    const expectedElements = [
      'APPLICATION',
      'Test integration error',
      'integration-test.ts:42',
      'testErrorFlow',
      'Review error handling',
    ];

    let allFound = true;
    for (const element of expectedElements) {
      if (!strippedOutput.includes(element)) {
        console.log(`✗ Missing expected element: "${element}"`);
        allFound = false;
      } else {
        console.log(`✓ Found expected element: "${element}"`);
      }
    }

    if (allFound) {
      console.log('\n🎉 All integration tests passed!');
      return true;
    } else {
      console.log('\n❌ Some integration tests failed');
      return false;
    }

  } catch (error) {
    console.error('❌ Error during integration test:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    return false;
  }
}

// Run the test
if (require.main === module) {
  const success = testErrorFlow();
  process.exit(success ? 0 : 1);
}

export { testErrorFlow };