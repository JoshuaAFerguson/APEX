/**
 * Integration Test: End-to-End Error Display Flow
 *
 * This test verifies the complete error handling flow from error creation
 * through formatting to final display output across all APEX packages.
 *
 * Test Coverage:
 * - ApexError creation and context handling
 * - Error formatting with different verbosity levels
 * - Core ErrorFormatter functionality
 * - CLI ErrorFormatter integration
 * - Real-world error scenarios
 * - Cross-package error propagation
 *
 * @module error-display-flow-integration-test
 */

import { describe, it, expect, beforeEach } from 'vitest';

// Utility function to strip ANSI escape codes for testing
function stripAnsi(str: string): string {
  return str.replace(/\u001b\[[0-9;]*m/g, '');
}

// Core error handling imports
import { ApexError, ApexErrorCode, ApexErrorContext } from '@apexcli/core';
import {
  ErrorFormatter as CoreErrorFormatter,
  StructuredError,
  FormattedErrorGroup,
  ErrorSeverity,
  ErrorCategory,
  createStructuredError,
  generateErrorId
} from '@apexcli/core';

// CLI error formatting imports
import {
  ErrorFormatter as CliErrorFormatter,
  ErrorVerbosity,
  ErrorType,
  ErrorContext,
  ErrorSuggestion,
  FormattedError,
  defaultErrorFormatter,
  formatError,
} from '@apexcli/cli/src/utils/ErrorFormatter.js';

describe('Error Display Flow Integration', () => {
  let coreFormatter: CoreErrorFormatter;
  let cliFormatter: CliErrorFormatter;

  beforeEach(() => {
    coreFormatter = new CoreErrorFormatter();
    cliFormatter = new CliErrorFormatter();
  });

  describe('Basic Error Flow', () => {
    it('should create and format a simple error without external dependencies', () => {
      // Create a basic ApexError without complex dependencies
      const simpleError = new ApexError(
        'Simple test error',
        ApexErrorCode.VALIDATION,
        { stage: 'testing' }
      );

      // Verify basic properties
      expect(simpleError.message).toBe('Simple test error');
      expect(simpleError.code).toBe(ApexErrorCode.VALIDATION);
      expect(simpleError.context.stage).toBe('testing');
      expect(simpleError.errorId).toBeDefined();
      expect(simpleError.timestamp).toBeInstanceOf(Date);

      // Test string representation
      const errorString = simpleError.toString(false);
      expect(errorString).toContain('ApexError [APEX_1002]');
      expect(errorString).toContain('Simple test error');
      expect(errorString).toContain('(Stage: testing)');
    });

    it('should format errors with CLI formatter', () => {
      // Create a basic FormattedError for CLI display
      const formattedError: FormattedError = {
        type: ErrorType.VALIDATION,
        message: 'CLI formatting test error',
        context: {
          file: 'test.ts',
          line: 10,
          function: 'testFunction',
          description: 'This is a test error for CLI formatting',
        },
        suggestions: [
          {
            title: 'Fix the test',
            description: 'This is a test suggestion',
          },
        ],
      };

      // Format with CLI formatter
      const output = cliFormatter.format(formattedError);
      const strippedOutput = stripAnsi(output);

      // Verify output contains expected elements
      expect(strippedOutput).toContain('VALIDATION');
      expect(strippedOutput).toContain('CLI formatting test error');
      expect(strippedOutput).toContain('test.ts:10');
      expect(strippedOutput).toContain('testFunction');
      expect(strippedOutput).toContain('Fix the test');
    });
  });

  describe('End-to-End Error Flow', () => {
    it('should handle complete error lifecycle from creation to display', () => {
      // Step 1: Create an ApexError with full context
      const errorContext: ApexErrorContext = {
        taskId: 'task-123',
        agentId: 'developer',
        stage: 'implementation',
        operation: 'codeGeneration',
        timestamp: new Date(),
        metadata: {
          fileName: 'src/utils/helper.ts',
          lineNumber: 42,
          columnNumber: 15,
        },
        userId: 'user-456',
        sessionId: 'session-789',
      };

      const originalError = new Error('TypeScript compilation failed');
      const apexError = new ApexError(
        'Code generation failed due to TypeScript errors',
        ApexErrorCode.TASK_EXECUTION_FAILED,
        errorContext,
        originalError
      );

      // Step 2: Verify ApexError properties are correctly set
      expect(apexError).toBeInstanceOf(ApexError);
      expect(apexError).toBeInstanceOf(Error);
      expect(apexError.code).toBe(ApexErrorCode.TASK_EXECUTION_FAILED);
      expect(apexError.context.taskId).toBe('task-123');
      expect(apexError.context.agentId).toBe('developer');
      expect(apexError.context.stage).toBe('implementation');
      expect(apexError.context.operation).toBe('codeGeneration');
      expect(apexError.context.metadata?.fileName).toBe('src/utils/helper.ts');
      expect(apexError.cause).toBe(originalError);
      expect(apexError.errorId).toMatch(/^apex_err_[a-z0-9]+_[a-z0-9]+$/);
      expect(apexError.timestamp).toBeInstanceOf(Date);

      // Step 3: Test error categorization and type guards
      expect(apexError.isCode(ApexErrorCode.TASK_EXECUTION_FAILED)).toBe(true);
      expect(apexError.isCode(ApexErrorCode.AGENT_NOT_FOUND)).toBe(false);
      expect(apexError.isCategory('APEX_11')).toBe(true); // Task errors
      expect(apexError.isCategory('APEX_12')).toBe(false); // Agent errors

      // Step 4: Test detailed error representation
      const errorDetails = apexError.getDetails();
      expect(errorDetails).toEqual({
        errorId: apexError.errorId,
        name: 'ApexError',
        message: 'Code generation failed due to TypeScript errors',
        code: ApexErrorCode.TASK_EXECUTION_FAILED,
        context: errorContext,
        timestamp: apexError.timestamp,
        stack: apexError.stack,
        cause: {
          name: 'Error',
          message: 'TypeScript compilation failed',
          stack: originalError.stack,
        },
      });

      // Step 5: Test string representation with context
      const errorString = apexError.toString(false);
      expect(errorString).toContain('ApexError [APEX_1101]');
      expect(errorString).toContain('Code generation failed due to TypeScript errors');
      expect(errorString).toContain('(Task: task-123)');
      expect(errorString).toContain('(Agent: developer)');
      expect(errorString).toContain('(Stage: implementation)');
      expect(errorString).toContain('Caused by: Error: TypeScript compilation failed');

      // Step 6: Test JSON serialization
      const jsonRepresentation = apexError.toJSON();
      expect(jsonRepresentation).toEqual(errorDetails);
    });

    it('should transform ApexError to StructuredError and format for display', () => {
      // Step 1: Create ApexError
      const apexError = new ApexError(
        'Agent execution timeout',
        ApexErrorCode.AGENT_EXECUTION_FAILED,
        {
          taskId: 'task-abc',
          agentId: 'tester',
          stage: 'testing',
          operation: 'runTests',
          metadata: { testFile: 'user.test.ts', timeout: 30000 },
        }
      );

      // Step 2: Convert to StructuredError for core formatting
      const structuredError = createStructuredError(
        apexError.message,
        {
          severity: 'error' as ErrorSeverity,
          category: 'runtime' as ErrorCategory,
          location: {
            file: apexError.context.metadata?.testFile as string,
            line: 1,
          },
          context: {
            tool: 'vitest',
            stage: apexError.context.stage,
            agent: apexError.context.agentId,
            taskId: apexError.context.taskId,
            timestamp: apexError.timestamp,
            command: 'npm test',
            exitCode: 1,
          },
          code: apexError.code,
          rawText: apexError.toString(),
          stack: apexError.stack,
          suggestion: 'Increase test timeout or optimize test performance',
        }
      );

      expect(structuredError.id).toMatch(/^err_[a-z0-9]+_[a-z0-9]+$/);
      expect(structuredError.message).toBe('Agent execution timeout');
      expect(structuredError.severity).toBe('error');
      expect(structuredError.category).toBe('runtime');
      expect(structuredError.location?.file).toBe('user.test.ts');
      expect(structuredError.context?.stage).toBe('testing');
      expect(structuredError.context?.agent).toBe('tester');

      // Step 3: Convert to CLI FormattedError for terminal display
      const cliContext: ErrorContext = {
        file: structuredError.location?.file,
        line: structuredError.location?.line,
        column: structuredError.location?.column,
        function: structuredError.context?.operation || 'runTests',
        description: `Test execution failed in ${structuredError.context?.stage} stage`,
        stack: structuredError.stack,
      };

      const cliSuggestions: ErrorSuggestion[] = [
        {
          title: 'Increase test timeout',
          description: 'Configure longer timeout for slow tests',
          command: 'vitest --testTimeout=60000',
        },
        {
          title: 'Optimize test performance',
          description: 'Review test logic for performance bottlenecks',
        },
        {
          title: 'Check system resources',
          description: 'Verify sufficient memory and CPU for test execution',
          command: 'htop',
        },
      ];

      const formattedError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: structuredError.message,
        context: cliContext,
        suggestions: cliSuggestions,
        originalError: apexError,
      };

      // Step 4: Format for display with different verbosity levels
      const minimalOutput = new CliErrorFormatter(ErrorVerbosity.MINIMAL).format(formattedError);
      const normalOutput = new CliErrorFormatter(ErrorVerbosity.NORMAL).format(formattedError);
      const verboseOutput = new CliErrorFormatter(ErrorVerbosity.VERBOSE).format(formattedError);

      // Verify minimal output (error message only)
      const strippedMinimal = stripAnsi(minimalOutput);
      expect(strippedMinimal).toContain('APPLICATION');
      expect(strippedMinimal).toContain('Agent execution timeout');
      expect(strippedMinimal).not.toContain('user.test.ts'); // No context
      expect(strippedMinimal).not.toContain('Increase test timeout'); // No suggestions
      expect(strippedMinimal).not.toContain('at Agent'); // No stack trace

      // Verify normal output (error + context + suggestions)
      const strippedNormal = stripAnsi(normalOutput);
      expect(strippedNormal).toContain('APPLICATION');
      expect(strippedNormal).toContain('Agent execution timeout');
      expect(strippedNormal).toContain('user.test.ts:1'); // Context included
      expect(strippedNormal).toContain('runTests'); // Function context
      expect(strippedNormal).toContain('Increase test timeout'); // Suggestions included
      expect(strippedNormal).toContain('vitest --testTimeout=60000'); // Command suggestions
      expect(strippedNormal).not.toContain('AgentExecutor.execute'); // No stack trace

      // Verify verbose output (everything including stack trace)
      const strippedVerbose = stripAnsi(verboseOutput);
      expect(strippedVerbose).toContain('APPLICATION');
      expect(strippedVerbose).toContain('Agent execution timeout');
      expect(strippedVerbose).toContain('user.test.ts:1'); // Context included
      expect(strippedVerbose).toContain('Increase test timeout'); // Suggestions included
      expect(strippedVerbose).toContain('Stack Trace:'); // Stack trace included

      // Verify output lengths align with verbosity
      expect(minimalOutput.length).toBeLessThan(normalOutput.length);
      expect(normalOutput.length).toBeLessThan(verboseOutput.length);
    });

    it('should handle realistic error scenarios with complete error propagation', () => {
      // Scenario: Database connection error during agent execution
      const scenarios = [
        {
          name: 'Database Connection Failure',
          originalError: new Error('ECONNREFUSED 127.0.0.1:5432'),
          apexErrorCode: ApexErrorCode.DATABASE_CONNECTION_FAILED,
          context: {
            taskId: 'task-db-001',
            agentId: 'data-processor',
            stage: 'data-processing',
            operation: 'queryUserData',
            metadata: {
              database: 'postgres',
              host: '127.0.0.1',
              port: 5432,
              query: 'SELECT * FROM users WHERE active = true',
            },
          },
          expectedCliType: ErrorType.NETWORK,
          expectedSuggestions: [
            'Check database server status',
            'Verify connection parameters',
            'Implement connection retry logic',
          ],
        },
        {
          name: 'File Permission Error',
          originalError: new Error("EACCES: permission denied, open '/var/log/apex.log'"),
          apexErrorCode: ApexErrorCode.FILE_ACCESS_DENIED,
          context: {
            taskId: 'task-log-001',
            agentId: 'logger',
            stage: 'logging',
            operation: 'writeLogEntry',
            metadata: {
              filePath: '/var/log/apex.log',
              operation: 'write',
              userId: 1000,
            },
          },
          expectedCliType: ErrorType.FILESYSTEM,
          expectedSuggestions: [
            'Fix file permissions',
            'Change log directory',
            'Run with elevated privileges',
          ],
        },
        {
          name: 'API Rate Limit Exceeded',
          originalError: new Error('Rate limit exceeded: 429 Too Many Requests'),
          apexErrorCode: ApexErrorCode.RATE_LIMIT_EXCEEDED,
          context: {
            taskId: 'task-api-001',
            agentId: 'api-client',
            stage: 'data-fetching',
            operation: 'fetchExternalData',
            metadata: {
              endpoint: 'https://api.github.com/repos/owner/repo',
              method: 'GET',
              rateLimitReset: new Date(Date.now() + 3600000).toISOString(),
              requestsRemaining: 0,
            },
          },
          expectedCliType: ErrorType.NETWORK,
          expectedSuggestions: [
            'Wait for rate limit reset',
            'Implement exponential backoff',
            'Use multiple API keys',
          ],
        },
        {
          name: 'Claude SDK Integration Error',
          originalError: new Error('Claude Agent SDK connection failed: Invalid API key'),
          apexErrorCode: ApexErrorCode.CLAUDE_SDK_ERROR,
          context: {
            taskId: 'task-claude-001',
            agentId: 'developer',
            stage: 'implementation',
            operation: 'queryClaudeAgent',
            metadata: {
              sdkVersion: '1.2.0',
              apiKeyLength: 32,
              endpoint: 'https://api.anthropic.com',
            },
          },
          expectedCliType: ErrorType.SYSTEM,
          expectedSuggestions: [
            'Check API key configuration',
            'Verify network connectivity',
            'Update Claude SDK version',
          ],
        },
        {
          name: 'Tool Integration Failure',
          originalError: new Error('Tool registration failed: Invalid tool definition'),
          apexErrorCode: ApexErrorCode.TOOL_INTEGRATION_FAILED,
          context: {
            taskId: 'task-tool-001',
            agentId: 'architect',
            stage: 'initialization',
            operation: 'registerTools',
            metadata: {
              toolName: 'CustomTool',
              toolVersion: '2.1.0',
              missingFields: ['name', 'schema'],
            },
          },
          expectedCliType: ErrorType.CONFIG,
          expectedSuggestions: [
            'Validate tool definition schema',
            'Check required tool fields',
            'Review tool registration docs',
          ],
        },
        {
          name: 'Dependency Resolution Error',
          originalError: new Error('npm ERR! Could not resolve dependency tree'),
          apexErrorCode: ApexErrorCode.DEPENDENCY_ERROR,
          context: {
            taskId: 'task-deps-001',
            agentId: 'devops',
            stage: 'build',
            operation: 'installDependencies',
            metadata: {
              packageManager: 'npm',
              nodeVersion: '18.17.0',
              conflictingDependencies: ['@types/node@18.0.0', '@types/node@20.0.0'],
            },
          },
          expectedCliType: ErrorType.FILESYSTEM,
          expectedSuggestions: [
            'Resolve dependency conflicts',
            'Update package.json',
            'Clear node_modules and reinstall',
          ],
        },
        {
          name: 'Configuration Validation Error',
          originalError: new Error('Invalid configuration: missing required field "agentConfig"'),
          apexErrorCode: ApexErrorCode.CONFIGURATION,
          context: {
            taskId: 'task-config-001',
            agentId: 'system',
            stage: 'initialization',
            operation: 'loadConfiguration',
            metadata: {
              configFile: '.apex/config.yaml',
              missingFields: ['agentConfig', 'workflowDefinitions'],
              currentSchema: 'v2.0',
            },
          },
          expectedCliType: ErrorType.CONFIG,
          expectedSuggestions: [
            'Update configuration file',
            'Run apex init to regenerate config',
            'Check configuration schema',
          ],
        },
        {
          name: 'Agent Initialization Failure',
          originalError: new Error('Failed to initialize agent: Module not found'),
          apexErrorCode: ApexErrorCode.AGENT_INITIALIZATION_FAILED,
          context: {
            taskId: 'task-agent-001',
            agentId: 'custom-agent',
            stage: 'agent-setup',
            operation: 'initializeAgent',
            metadata: {
              agentType: 'custom',
              modulePath: './agents/custom-agent.js',
              availableAgents: ['planner', 'developer', 'tester'],
            },
          },
          expectedCliType: ErrorType.SYSTEM,
          expectedSuggestions: [
            'Check agent module path',
            'Verify agent implementation',
            'Use built-in agent types',
          ],
        },
      ];

      scenarios.forEach((scenario) => {
        // Step 1: Create ApexError with realistic context
        const apexError = new ApexError(
          `${scenario.name}: ${scenario.originalError.message}`,
          scenario.apexErrorCode,
          scenario.context,
          scenario.originalError
        );

        // Step 2: Verify error classification
        expect(apexError.code).toBe(scenario.apexErrorCode);
        expect(apexError.context.taskId).toBe(scenario.context.taskId);
        expect(apexError.context.agentId).toBe(scenario.context.agentId);
        expect(apexError.context.stage).toBe(scenario.context.stage);

        // Step 3: Convert to CLI format with appropriate suggestions
        const cliSuggestions: ErrorSuggestion[] = scenario.expectedSuggestions.map((title) => ({
          title,
          description: `Resolution strategy for ${scenario.name.toLowerCase()}`,
        }));

        const formattedError: FormattedError = {
          type: scenario.expectedCliType,
          message: apexError.message,
          context: {
            file: scenario.context.metadata?.filePath as string,
            function: scenario.context.operation,
            description: `Error occurred in ${scenario.context.stage} stage during ${scenario.context.operation}`,
          },
          suggestions: cliSuggestions,
          originalError: apexError,
        };

        // Step 4: Format for display and verify output contains expected elements
        const output = cliFormatter.format(formattedError);
        const strippedOutput = stripAnsi(output);

        // Verify error type and message
        expect(strippedOutput).toContain(scenario.expectedCliType.toUpperCase());
        expect(strippedOutput).toContain(scenario.originalError.message);

        // Verify context information is included
        if (formattedError.context?.file) {
          expect(strippedOutput).toContain(formattedError.context.file);
        }
        expect(strippedOutput).toContain(scenario.context.operation);

        // Verify suggestions are included
        scenario.expectedSuggestions.forEach((suggestion) => {
          expect(strippedOutput).toContain(suggestion);
        });

        // Verify output structure has proper icons and formatting
        expect(output).toMatch(/[🔥💥⚠️⚙️🌐📁❌]/); // Should contain appropriate emoji icon
        expect(strippedOutput).toContain('Suggestions:');
      });
    });

    it('should handle multiple errors with grouping and aggregation', () => {
      // Create multiple related errors
      const errors: ApexError[] = [
        new ApexError(
          'TypeScript type error in User model',
          ApexErrorCode.VALIDATION,
          {
            taskId: 'task-multi-001',
            agentId: 'developer',
            stage: 'implementation',
            metadata: { file: 'src/models/User.ts', line: 15, column: 8 },
          }
        ),
        new ApexError(
          'ESLint error: unused variable',
          ApexErrorCode.VALIDATION,
          {
            taskId: 'task-multi-001',
            agentId: 'developer',
            stage: 'implementation',
            metadata: { file: 'src/models/User.ts', line: 23, column: 12 },
          }
        ),
        new ApexError(
          'Jest test failure in UserService',
          ApexErrorCode.TASK_EXECUTION_FAILED,
          {
            taskId: 'task-multi-001',
            agentId: 'tester',
            stage: 'testing',
            metadata: { file: 'src/services/UserService.test.ts', line: 42, column: 1 },
          }
        ),
      ];

      // Convert to CLI format for multiple error display
      const formattedErrors: FormattedError[] = errors.map((error, index) => ({
        type: index < 2 ? ErrorType.VALIDATION : ErrorType.APPLICATION,
        message: error.message,
        context: {
          file: error.context.metadata?.file as string,
          line: error.context.metadata?.line as number,
          column: error.context.metadata?.column as number,
          description: `Error in ${error.context.stage} stage by ${error.context.agentId} agent`,
        },
        originalError: error,
      }));

      // Format multiple errors
      const multipleErrorsOutput = cliFormatter.formatMultiple(formattedErrors);
      const strippedOutput = stripAnsi(multipleErrorsOutput);

      // Verify aggregation header
      expect(strippedOutput).toContain('3 errors found');

      // Verify each error is included with proper numbering
      expect(strippedOutput).toContain('--- Error 1 ---');
      expect(strippedOutput).toContain('--- Error 2 ---');
      expect(strippedOutput).toContain('--- Error 3 ---');

      // Verify all error messages are present
      expect(strippedOutput).toContain('TypeScript type error');
      expect(strippedOutput).toContain('ESLint error');
      expect(strippedOutput).toContain('Jest test failure');

      // Verify file references are included
      expect(strippedOutput).toContain('src/models/User.ts');
      expect(strippedOutput).toContain('src/services/UserService.test.ts');

      // Verify proper error type icons
      expect(multipleErrorsOutput).toContain('⚠️'); // Validation errors
      expect(multipleErrorsOutput).toContain('❌'); // Application error
    });

    it('should demonstrate complete error workflow from orchestrator through CLI display', () => {
      // Simulate a complete workflow error that would occur in real APEX usage

      // Step 1: Workflow execution fails at agent level
      const workflowError = new ApexError(
        'Workflow execution failed in implementation stage',
        ApexErrorCode.WORKFLOW_STAGE_FAILED,
        {
          taskId: 'task-wf-001',
          agentId: 'developer',
          stage: 'implementation',
          operation: 'generateComponent',
          timestamp: new Date(),
          metadata: {
            workflowId: 'feature-development',
            stageIndex: 2,
            totalStages: 5,
            failedAttempts: 1,
            maxAttempts: 3,
            componentName: 'UserProfile',
            targetFile: 'src/components/UserProfile.tsx',
          },
          sessionId: 'session-abc123',
        }
      );

      // Step 2: Error propagates with additional context
      const propagatedError = new ApexError(
        'Task execution halted due to stage failure',
        ApexErrorCode.TASK_EXECUTION_FAILED,
        {
          ...workflowError.context,
          operation: 'executeWorkflow',
          metadata: {
            ...workflowError.context.metadata,
            halted: true,
            nextAction: 'retry-stage',
          },
        },
        workflowError
      );

      // Step 3: Convert to display-ready format
      const displayContext: ErrorContext = {
        file: propagatedError.context.metadata?.targetFile as string,
        function: propagatedError.context.operation,
        description: `Workflow "${propagatedError.context.metadata?.workflowId}" failed at stage ${propagatedError.context.metadata?.stageIndex}/${propagatedError.context.metadata?.totalStages}`,
      };

      const suggestions: ErrorSuggestion[] = [
        {
          title: 'Retry failed stage',
          description: 'Attempt to re-execute the implementation stage',
          command: 'apex retry --task-id task-wf-001 --stage implementation',
        },
        {
          title: 'Check agent logs',
          description: 'Review detailed logs for the developer agent',
          command: 'apex logs --agent developer --task-id task-wf-001',
        },
        {
          title: 'Manual intervention',
          description: 'Switch to manual mode for this stage',
          command: 'apex manual --stage implementation',
        },
        {
          title: 'Adjust workflow parameters',
          description: 'Modify workflow configuration to avoid the issue',
        },
      ];

      const finalFormattedError: FormattedError = {
        type: ErrorType.SYSTEM,
        message: propagatedError.message,
        context: displayContext,
        suggestions,
        originalError: propagatedError,
      };

      // Step 4: Format for different contexts (production vs development)

      // Production format (minimal, user-friendly)
      const productionFormatter = new CliErrorFormatter(ErrorVerbosity.MINIMAL);
      const productionOutput = productionFormatter.format(finalFormattedError);
      const strippedProduction = stripAnsi(productionOutput);

      expect(strippedProduction).toContain('SYSTEM');
      expect(strippedProduction).toContain('Task execution halted');
      expect(strippedProduction).not.toContain('src/components/UserProfile.tsx'); // No file details
      expect(strippedProduction).not.toContain('apex retry'); // No technical commands

      // Development format (verbose, with full context)
      const developmentFormatter = new CliErrorFormatter(ErrorVerbosity.VERBOSE);
      const developmentOutput = developmentFormatter.format(finalFormattedError);
      const strippedDevelopment = stripAnsi(developmentOutput);

      expect(strippedDevelopment).toContain('SYSTEM');
      expect(strippedDevelopment).toContain('Task execution halted');
      expect(strippedDevelopment).toContain('src/components/UserProfile.tsx'); // File details included
      expect(strippedDevelopment).toContain('executeWorkflow'); // Function context
      expect(strippedDevelopment).toContain('Workflow "feature-development" failed at stage 2/5'); // Full description
      expect(strippedDevelopment).toContain('apex retry --task-id task-wf-001'); // Technical commands
      expect(strippedDevelopment).toContain('Manual intervention'); // All suggestions
      expect(strippedDevelopment).toContain('Stack Trace:'); // Stack trace in verbose mode

      // Verify convenience function works consistently
      const convenienceOutput = formatError.system(
        propagatedError.message,
        displayContext,
        suggestions
      );

      // Should match normal verbosity output
      const normalFormatter = new CliErrorFormatter(ErrorVerbosity.NORMAL);
      const normalOutput = normalFormatter.format(finalFormattedError);
      expect(stripAnsi(convenienceOutput)).toBe(stripAnsi(normalOutput));

      // Step 5: Verify error propagation chain is preserved
      expect(propagatedError.cause).toBe(workflowError);
      expect(propagatedError.getDetails().cause?.message).toBe(workflowError.message);

      const errorChainString = propagatedError.toString(false);
      expect(errorChainString).toContain('Task execution halted due to stage failure');
      expect(errorChainString).toContain('Caused by: ApexError: Workflow execution failed in implementation stage');
    });
  });

  describe('Edge Cases and Error Boundaries', () => {
    it('should handle malformed or incomplete error information gracefully', () => {
      // Test with minimal ApexError
      const minimalError = new ApexError('Something went wrong');
      expect(minimalError.code).toBe(ApexErrorCode.UNKNOWN);
      expect(minimalError.context).toEqual({ timestamp: expect.any(Date) });
      expect(minimalError.cause).toBeUndefined();

      // Test CLI formatting with missing context
      const minimalFormattedError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: minimalError.message,
      };

      const output = cliFormatter.format(minimalFormattedError);
      expect(stripAnsi(output)).toContain('Something went wrong');
      expect(stripAnsi(output)).toContain('APPLICATION');

      // Test with null/undefined values
      const robustError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: 'Robust error handling test',
        context: {
          file: undefined,
          line: undefined,
          function: '',
          description: undefined,
        },
        suggestions: [],
      };

      const robustOutput = cliFormatter.format(robustError);
      expect(stripAnsi(robustOutput)).toContain('Robust error handling test');
      expect(stripAnsi(robustOutput)).not.toContain('Location:'); // No location section
      expect(stripAnsi(robustOutput)).not.toContain('Suggestions:'); // No suggestions section
    });

    it('should handle very large error messages and context appropriately', () => {
      const largeMessage = 'Error: '.repeat(100) + 'This is a very long error message that could potentially break formatting';
      const largeStackTrace = Array.from({ length: 50 }, (_, i) => `    at function${i} (file${i}.js:${i + 1}:${i + 10})`).join('\n');

      const largeError = new Error(largeMessage);
      largeError.stack = largeStackTrace;

      const formattedError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: largeMessage,
        context: {
          function: 'veryLongFunctionNameThatCouldPotentiallyBreakFormattingIfNotHandledProperly',
          description: 'A very long description '.repeat(20),
        },
        originalError: largeError,
      };

      const verboseFormatter = new CliErrorFormatter(ErrorVerbosity.VERBOSE);
      const output = verboseFormatter.format(formattedError);

      // Should not throw and should contain the message
      expect(output).toBeDefined();
      expect(stripAnsi(output)).toContain('This is a very long error message');
      expect(stripAnsi(output)).toContain('Stack Trace:');
    });

    it('should maintain consistent formatting across different terminal widths', () => {
      const testError: FormattedError = {
        type: ErrorType.CONFIG,
        message: 'Configuration validation failed for multiple parameters',
        context: {
          file: 'config/very-long-configuration-file-name-that-might-wrap.yaml',
          line: 123,
          column: 45,
          function: 'validateConfigurationParameters',
          description: 'Multiple configuration validation errors occurred during startup process',
        },
        suggestions: [
          {
            title: 'Fix configuration syntax',
            description: 'Review the YAML syntax and fix any formatting issues',
            command: 'yamllint config/very-long-configuration-file-name-that-might-wrap.yaml',
          },
          {
            title: 'Use configuration template',
            description: 'Copy from the default configuration template and modify as needed',
            command: 'cp config/default.yaml config/very-long-configuration-file-name-that-might-wrap.yaml',
          },
        ],
      };

      // Test formatting - should work regardless of terminal width
      const output = cliFormatter.format(testError);
      const lines = stripAnsi(output).split('\n');

      // Verify structure is preserved
      expect(lines.some(line => line.includes('CONFIG'))).toBe(true);
      expect(lines.some(line => line.includes('very-long-configuration-file-name'))).toBe(true);
      expect(lines.some(line => line.includes('Suggestions:'))).toBe(true);
      expect(lines.some(line => line.includes('yamllint'))).toBe(true);
    });
  });

  describe('Performance and Resource Usage', () => {
    it('should handle error formatting efficiently for large error volumes', () => {
      // Create a realistic set of errors that might occur during a large build
      const errors: FormattedError[] = Array.from({ length: 100 }, (_, i) => ({
        type: i % 2 === 0 ? ErrorType.VALIDATION : ErrorType.APPLICATION,
        message: `Error ${i + 1}: ${i % 3 === 0 ? 'TypeScript' : i % 3 === 1 ? 'ESLint' : 'Test'} error in file ${i + 1}`,
        context: {
          file: `src/components/Component${i + 1}.tsx`,
          line: Math.floor(Math.random() * 100) + 1,
          column: Math.floor(Math.random() * 50) + 1,
          function: `function${i + 1}`,
        },
        suggestions: [
          {
            title: `Fix issue in Component${i + 1}`,
            description: 'Review and fix the reported issue',
          },
        ],
      }));

      const startTime = Date.now();

      // Test formatting multiple errors
      const output = cliFormatter.formatMultiple(errors);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete in reasonable time (less than 1 second for 100 errors)
      expect(executionTime).toBeLessThan(1000);

      // Output should be properly structured
      expect(stripAnsi(output)).toContain('100 errors found');
      expect(output.split('--- Error').length).toBe(101); // Header + 100 errors
    });
  });

  describe('Enhanced Error Scenarios', () => {
    it('should handle APEX-specific integration errors with detailed context', () => {
      // Test Claude SDK integration error
      const claudeError = new ApexError(
        'Claude Agent SDK timeout during query execution',
        ApexErrorCode.CLAUDE_SDK_ERROR,
        {
          taskId: 'task-claude-integration',
          agentId: 'developer',
          stage: 'implementation',
          operation: 'queryClaudeAgent',
          metadata: {
            sdkVersion: '1.2.0',
            timeoutMs: 30000,
            endpoint: 'https://api.anthropic.com',
            retryAttempts: 3,
          },
        }
      );

      // Verify Claude SDK error properties
      expect(claudeError.code).toBe(ApexErrorCode.CLAUDE_SDK_ERROR);
      expect(claudeError.isCategory('APEX_17')).toBe(true); // Integration errors
      expect(claudeError.context.metadata?.sdkVersion).toBe('1.2.0');
      expect(claudeError.context.metadata?.timeoutMs).toBe(30000);

      // Test tool integration error with detailed context
      const toolError = new ApexError(
        'Custom tool registration failed: schema validation error',
        ApexErrorCode.TOOL_INTEGRATION_FAILED,
        {
          taskId: 'task-tool-integration',
          agentId: 'architect',
          stage: 'initialization',
          operation: 'registerCustomTool',
          metadata: {
            toolName: 'DatabaseQueryTool',
            schemaErrors: ['Missing required field: connectionString', 'Invalid type for field: timeout'],
            providedSchema: { name: 'DatabaseQueryTool', timeout: 'invalid-type' },
          },
        }
      );

      expect(toolError.code).toBe(ApexErrorCode.TOOL_INTEGRATION_FAILED);
      expect(toolError.context.metadata?.schemaErrors).toHaveLength(2);
      expect(toolError.context.metadata?.toolName).toBe('DatabaseQueryTool');

      // Test dependency error with package resolution details
      const depError = new ApexError(
        'Package dependency conflict detected',
        ApexErrorCode.DEPENDENCY_ERROR,
        {
          taskId: 'task-dep-resolution',
          agentId: 'devops',
          stage: 'build',
          operation: 'resolveDependencies',
          metadata: {
            packageManager: 'npm',
            conflictingPackages: {
              '@types/node': ['18.17.0', '20.10.0'],
              'typescript': ['5.0.0', '5.3.0'],
            },
            resolutionStrategy: 'highest-version',
          },
        }
      );

      expect(depError.code).toBe(ApexErrorCode.DEPENDENCY_ERROR);
      expect(depError.context.metadata?.packageManager).toBe('npm');
      expect(depError.context.metadata?.conflictingPackages).toBeDefined();

      // Test that all errors can be converted to CLI format properly
      const errors = [claudeError, toolError, depError];

      errors.forEach((error) => {
        const cliFormattedError: FormattedError = {
          type: ErrorType.SYSTEM,
          message: error.message,
          context: {
            function: error.context.operation,
            description: `Error in ${error.context.stage} stage by ${error.context.agentId} agent`,
          },
          originalError: error,
        };

        const output = cliFormatter.format(cliFormattedError);
        const strippedOutput = stripAnsi(output);

        expect(strippedOutput).toContain('SYSTEM');
        expect(strippedOutput).toContain(error.message);
        expect(strippedOutput).toContain(error.context.operation);
      });
    });

    it('should handle error chain propagation with multiple cause levels', () => {
      // Create a chain of errors to test proper propagation
      const rootCause = new Error('Network timeout');
      const level1Error = new ApexError(
        'Database connection failed',
        ApexErrorCode.DATABASE_CONNECTION_FAILED,
        {
          taskId: 'task-chain-001',
          agentId: 'data-processor',
          stage: 'data-processing',
          operation: 'connectToDatabase',
        },
        rootCause
      );

      const level2Error = new ApexError(
        'User data query failed',
        ApexErrorCode.DATABASE_QUERY_FAILED,
        {
          taskId: 'task-chain-001',
          agentId: 'data-processor',
          stage: 'data-processing',
          operation: 'queryUserData',
        },
        level1Error
      );

      const finalError = new ApexError(
        'Task execution failed due to data access error',
        ApexErrorCode.TASK_EXECUTION_FAILED,
        {
          taskId: 'task-chain-001',
          agentId: 'data-processor',
          stage: 'data-processing',
          operation: 'executeTask',
        },
        level2Error
      );

      // Verify error chain preservation
      expect(finalError.cause).toBe(level2Error);
      expect(level2Error.cause).toBe(level1Error);
      expect(level1Error.cause).toBe(rootCause);

      // Verify error details include the full chain
      const errorDetails = finalError.getDetails();
      expect(errorDetails.cause?.message).toBe('User data query failed');
      expect(errorDetails.cause?.cause?.message).toBe('Database connection failed');
      expect(errorDetails.cause?.cause?.cause?.message).toBe('Network timeout');

      // Test string representation includes chain
      const errorString = finalError.toString(false);
      expect(errorString).toContain('Task execution failed due to data access error');
      expect(errorString).toContain('Caused by: ApexError: User data query failed');
      expect(errorString).toContain('Caused by: ApexError: Database connection failed');
      expect(errorString).toContain('Caused by: Error: Network timeout');
    });

    it('should validate error context schema and handle invalid data gracefully', () => {
      // Test with valid context
      const validError = new ApexError(
        'Valid error with proper context',
        ApexErrorCode.VALIDATION,
        {
          taskId: 'task-valid-001',
          agentId: 'tester',
          stage: 'validation',
          metadata: { testFile: 'example.test.ts' },
          timestamp: new Date(),
        }
      );

      expect(validError.context.taskId).toBe('task-valid-001');
      expect(validError.context.agentId).toBe('tester');
      expect(validError.context.timestamp).toBeInstanceOf(Date);

      // Test that context schema validation allows additional metadata
      const flexibleError = new ApexError(
        'Error with flexible metadata',
        ApexErrorCode.INTERNAL,
        {
          taskId: 'task-flexible-001',
          metadata: {
            customField: 'custom value',
            numericField: 42,
            arrayField: ['item1', 'item2'],
            objectField: { nested: { value: true } },
          },
        }
      );

      expect(flexibleError.context.metadata?.customField).toBe('custom value');
      expect(flexibleError.context.metadata?.numericField).toBe(42);
      expect(flexibleError.context.metadata?.arrayField).toEqual(['item1', 'item2']);

      // Test serialization preserves all data
      const serialized = flexibleError.toJSON();
      expect(serialized.context.metadata?.customField).toBe('custom value');
      expect(serialized.context.metadata?.objectField).toEqual({ nested: { value: true } });
    });

    it('should handle concurrent error formatting without interference', () => {
      // Create multiple errors to test concurrent formatting
      const errors: ApexError[] = Array.from({ length: 10 }, (_, i) => {
        return new ApexError(
          `Concurrent error ${i + 1}`,
          i % 2 === 0 ? ApexErrorCode.VALIDATION : ApexErrorCode.TASK_EXECUTION_FAILED,
          {
            taskId: `task-concurrent-${i + 1}`,
            agentId: `agent-${i + 1}`,
            stage: 'testing',
            operation: `operation-${i + 1}`,
            metadata: { index: i, timestamp: Date.now() },
          }
        );
      });

      // Format all errors concurrently using Promise.all
      const formatPromises = errors.map((error) => {
        return Promise.resolve().then(() => {
          const formattedError: FormattedError = {
            type: ErrorType.APPLICATION,
            message: error.message,
            context: {
              function: error.context.operation,
              description: `Concurrent error formatting test ${error.context.metadata?.index}`,
            },
            originalError: error,
          };
          return cliFormatter.format(formattedError);
        });
      });

      return Promise.all(formatPromises).then((outputs) => {
        // Verify all outputs are unique and properly formatted
        expect(outputs).toHaveLength(10);
        outputs.forEach((output, index) => {
          const strippedOutput = stripAnsi(output);
          expect(strippedOutput).toContain(`Concurrent error ${index + 1}`);
          expect(strippedOutput).toContain(`operation-${index + 1}`);
        });

        // Verify no interference between concurrent operations
        const uniqueMessages = new Set(outputs.map(output => stripAnsi(output)));
        expect(uniqueMessages.size).toBe(10); // All outputs should be unique
      });
    });
  });

  describe('Cross-Package Integration', () => {
    it('should demonstrate seamless integration between core and CLI packages', () => {
      // This test verifies that errors can flow from core -> orchestrator -> CLI
      // without losing context or formatting capabilities

      // Step 1: Create error in core format
      const coreStructuredError = createStructuredError(
        'Cross-package integration test error',
        {
          severity: 'error' as ErrorSeverity,
          category: 'test' as ErrorCategory,
          location: {
            file: 'tests/integration/error-display-flow.integration.test.ts',
            line: 1,
          },
          context: {
            tool: 'vitest',
            stage: 'testing',
            timestamp: new Date(),
          },
          code: 'TEST_001',
          suggestion: 'This is a test error for integration validation',
        }
      );

      // Step 2: Convert to ApexError format (as would happen in orchestrator)
      const apexError = new ApexError(
        coreStructuredError.message,
        ApexErrorCode.VALIDATION,
        {
          stage: coreStructuredError.context?.stage,
          operation: 'runIntegrationTest',
          metadata: {
            file: coreStructuredError.location?.file,
            line: coreStructuredError.location?.line,
            errorCode: coreStructuredError.code,
          },
        }
      );

      // Step 3: Convert to CLI format for final display
      const cliFormattedError: FormattedError = {
        type: ErrorType.APPLICATION,
        message: apexError.message,
        context: {
          file: apexError.context.metadata?.file as string,
          line: apexError.context.metadata?.line as number,
          function: apexError.context.operation,
          description: `Integration test error in ${apexError.context.stage} stage`,
        },
        suggestions: [
          {
            title: 'Review test logic',
            description: coreStructuredError.suggestion || 'Check the test implementation',
          },
        ],
        originalError: apexError,
      };

      // Step 4: Verify all information is preserved through the transformation chain
      const finalOutput = cliFormatter.format(cliFormattedError);
      const strippedOutput = stripAnsi(finalOutput);

      // Original message preserved
      expect(strippedOutput).toContain('Cross-package integration test error');

      // File location preserved
      expect(strippedOutput).toContain('error-display-flow.integration.test.ts:1');

      // Stage information preserved
      expect(strippedOutput).toContain('Integration test error in testing stage');

      // Operation preserved
      expect(strippedOutput).toContain('runIntegrationTest');

      // Suggestion preserved
      expect(strippedOutput).toContain('Review test logic');

      // Error ID generation works correctly
      expect(coreStructuredError.id).toMatch(/^err_[a-z0-9]+_[a-z0-9]+$/);
      expect(apexError.errorId).toMatch(/^apex_err_[a-z0-9]+_[a-z0-9]+$/);

      // Type information is properly maintained
      expect(apexError.code).toBe(ApexErrorCode.VALIDATION);
      expect(cliFormattedError.type).toBe(ErrorType.APPLICATION);
    });
  });
});