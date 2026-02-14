/**
 * @fileoverview Integration Scenarios Tests for Tool Mocking Utilities
 *
 * This test suite validates the tool mocking utilities in realistic integration
 * scenarios that mirror how they would be used in actual APEX agent testing.
 * Tests cover multi-step workflows, agent orchestration patterns, and complex
 * tool interaction scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  MockToolExecution,
  MockToolScenarioBuilder,
  createMockToolExecution,
  createMockToolScenario,
  createFileSystemMockTools,
  createShellMockTools,
  createWebMockTools,
  createComprehensiveMockTools,
} from '../test-utils/claude-sdk-mock';

import {
  MockToolsExecutor,
  createDefaultMockTools,
  createMockToolsExecutor,
} from '../test-utils/mock-tools-executor';

import type { MockTool, MockToolResponse } from '../test-utils/mock-tool-types';

describe('Tool Mocking Integration Scenarios', () => {
  describe('APEX Agent Workflow Simulations', () => {
    it('should simulate complete feature development workflow', async () => {
      // Create specialized mock environments for different stages
      const plannerMocks = createMockToolScenario()
        .withSuccessTool('Read', { content: 'User requirements document' })
        .withSuccessTool('Grep', { matches: ['authentication', 'database', 'API'] })
        .withDynamicTool('TodoWrite', (params) => ({
          success: true,
          output: { todosCreated: (params.todos as any[]).length }
        }))
        .build();

      const architectMocks = createMockToolScenario()
        .withSuccessTool('Glob', { matches: ['src/auth/*.ts', 'src/db/*.ts', 'src/api/*.ts'] })
        .withSuccessTool('Read', { content: 'Existing architecture patterns' })
        .withDynamicTool('Write', (params) => ({
          success: true,
          output: { file: params.file_path, size: (params.content as string).length }
        }))
        .build();

      const developerMocks = createMockToolScenario()
        .withSuccessTool('Read', { content: 'Architecture plan content' })
        .withSuccessTool('Edit', { changes: 15, linesAdded: 50, linesRemoved: 5 })
        .withSuccessTool('Write', { written: true, bytesWritten: 2048 })
        .withRetryTool('Bash', 1, { stdout: 'Tests passed', stderr: '', exitCode: 0 }, 'npm test failed')
        .build();

      const testerMocks = createMockToolScenario()
        .withDelayedTool('Bash', { stdout: 'Running tests...', stderr: '', exitCode: 0 }, 1000)
        .withSuccessTool('Read', { content: 'Test results: 25 passed, 0 failed' })
        .withDynamicTool('Write', (params) => ({
          success: true,
          output: { testReport: 'generated', coverage: '95%' }
        }))
        .build();

      // Simulate planner stage
      await plannerMocks.executeTool('Read', { file_path: 'requirements.md' });
      await plannerMocks.executeTool('Grep', { pattern: 'features', path: 'requirements.md' });
      await plannerMocks.executeTool('TodoWrite', {
        todos: [
          { content: 'Design authentication system', status: 'pending' },
          { content: 'Implement database layer', status: 'pending' },
          { content: 'Create API endpoints', status: 'pending' }
        ]
      });

      // Simulate architect stage
      await architectMocks.executeTool('Glob', { pattern: 'src/**/*.ts' });
      await architectMocks.executeTool('Read', { file_path: 'ARCHITECTURE.md' });
      await architectMocks.executeTool('Write', {
        file_path: 'docs/api-design.md',
        content: 'API design documentation with endpoints and schemas'
      });

      // Simulate developer stage
      await developerMocks.executeTool('Read', { file_path: 'docs/api-design.md' });
      await developerMocks.executeTool('Edit', {
        file_path: 'src/api/routes.ts',
        old_string: 'placeholder',
        new_string: 'implemented routes'
      });
      await developerMocks.executeTool('Write', {
        file_path: 'src/auth/middleware.ts',
        content: 'Authentication middleware implementation'
      });

      // First test run fails, second succeeds (retry behavior)
      await developerMocks.executeTool('Bash', { command: 'npm test' });
      await developerMocks.executeTool('Bash', { command: 'npm test' });

      // Simulate tester stage
      await testerMocks.executeTool('Bash', { command: 'npm run test:integration' });
      await testerMocks.executeTool('Read', { file_path: 'test-results.json' });
      await testerMocks.executeTool('Write', {
        file_path: 'reports/test-report.html',
        content: 'HTML test report'
      });

      // Verify the complete workflow
      plannerMocks.assertToolsCalledInOrder(['Read', 'Grep', 'TodoWrite']);
      architectMocks.assertToolsCalledInOrder(['Glob', 'Read', 'Write']);
      developerMocks.assertToolsCalledInOrder(['Read', 'Edit', 'Write', 'Bash']);
      testerMocks.assertToolsCalledInOrder(['Bash', 'Read', 'Write']);

      // Verify tool usage patterns
      expect(plannerMocks.getTotalCallCount()).toBe(3);
      expect(architectMocks.getTotalCallCount()).toBe(3);
      expect(developerMocks.getTotalCallCount()).toBe(4);
      expect(testerMocks.getTotalCallCount()).toBe(3);
      expect(developerMocks.getCallCount('Bash')).toBe(2); // Retry behavior
    });

    it('should simulate DevOps deployment pipeline', async () => {
      const devopsMocks = createMockToolScenario()
        .withSuccessTool('Read', { content: 'Dockerfile contents' })
        .withDynamicTool('Bash', (params) => {
          const command = params.command as string;

          if (command.includes('docker build')) {
            return { success: true, output: { stdout: 'Image built successfully', exitCode: 0 } };
          } else if (command.includes('docker push')) {
            return { success: true, output: { stdout: 'Image pushed to registry', exitCode: 0 } };
          } else if (command.includes('kubectl apply')) {
            return { success: true, output: { stdout: 'Deployment updated', exitCode: 0 } };
          } else if (command.includes('kubectl get pods')) {
            return { success: true, output: { stdout: 'pod/app-12345 Running', exitCode: 0 } };
          }

          return { success: false, error: `Unknown command: ${command}` };
        })
        .withRetryTool('WebFetch', 3,
          { content: '{"status":"healthy","version":"1.2.0"}', statusCode: 200 },
          'Health check endpoint not ready'
        )
        .withDelayedTool('WebSearch',
          { results: [{ title: 'Deployment Status', url: 'https://status.example.com' }] },
          2000
        )
        .build();

      // Build and push Docker image
      await devopsMocks.executeTool('Read', { file_path: 'Dockerfile' });
      await devopsMocks.executeTool('Bash', { command: 'docker build -t myapp:1.2.0 .' });
      await devopsMocks.executeTool('Bash', { command: 'docker push myapp:1.2.0' });

      // Deploy to Kubernetes
      await devopsMocks.executeTool('Bash', { command: 'kubectl apply -f k8s/deployment.yaml' });
      await devopsMocks.executeTool('Bash', { command: 'kubectl get pods -l app=myapp' });

      // Health check with retries (should fail 3 times then succeed)
      const healthCheckResults = [];
      for (let i = 0; i < 4; i++) {
        const result = await devopsMocks.executeTool('WebFetch', {
          url: 'https://myapp.example.com/health'
        });
        healthCheckResults.push(result.result.success);
      }

      expect(healthCheckResults).toEqual([false, false, false, true]);

      // Monitor deployment status
      const startTime = Date.now();
      await devopsMocks.executeTool('WebSearch', { query: 'deployment status monitoring' });
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(2000);

      // Verify deployment workflow
      devopsMocks.assertToolsCalledInOrder(['Read', 'Bash', 'WebFetch']);
      expect(devopsMocks.getCallCount('Bash')).toBe(4);
      expect(devopsMocks.getCallCount('WebFetch')).toBe(4);
    });

    it('should simulate database migration and rollback scenario', async () => {
      const dbMocks = createMockToolScenario()
        .withSuccessTool('Read', { content: 'CREATE TABLE users (id INT PRIMARY KEY);' })
        .withDynamicTool('Bash', (params) => {
          const command = params.command as string;

          if (command.includes('backup')) {
            return { success: true, output: { stdout: 'Backup created: db_backup_20240101.sql' } };
          } else if (command.includes('migrate')) {
            // Simulate migration failure on first attempt
            if (!dbMocks.wasToolCalledWith('Bash', { command: 'psql -f backup.sql' })) {
              return { success: false, error: 'Migration failed: constraint violation' };
            }
            return { success: true, output: { stdout: 'Migration completed successfully' } };
          } else if (command.includes('rollback') || command.includes('psql -f backup.sql')) {
            return { success: true, output: { stdout: 'Database restored from backup' } };
          }

          return { success: true, output: { stdout: 'Command executed' } };
        })
        .withDynamicTool('WebFetch', (params) => {
          const url = params.url as string;
          if (url.includes('/api/health')) {
            // Simulate service being down during migration
            const migrationInProgress = dbMocks.wasToolCalledWith('Bash', { command: 'npm run migrate' });
            const rollbackCompleted = dbMocks.wasToolCalledWith('Bash', { command: 'psql -f backup.sql' });

            if (migrationInProgress && !rollbackCompleted) {
              return { success: false, error: 'Service unavailable during migration' };
            }
            return { success: true, output: { content: '{"status":"ok"}', statusCode: 200 } };
          }
          return { success: true, output: { content: 'OK', statusCode: 200 } };
        })
        .build();

      // Pre-migration backup
      await dbMocks.executeTool('Bash', { command: 'pg_dump mydb > backup.sql' });

      // Read migration script
      await dbMocks.executeTool('Read', { file_path: 'migrations/001_add_users_table.sql' });

      // Attempt migration (fails)
      await dbMocks.executeTool('Bash', { command: 'npm run migrate' });

      // Check service health (fails due to migration)
      await dbMocks.executeTool('WebFetch', { url: 'https://api.example.com/health' });

      // Rollback due to failure
      await dbMocks.executeTool('Bash', { command: 'psql -f backup.sql' });

      // Verify service health after rollback (succeeds)
      await dbMocks.executeTool('WebFetch', { url: 'https://api.example.com/health' });

      // Attempt migration again (succeeds after rollback)
      await dbMocks.executeTool('Bash', { command: 'npm run migrate' });

      // Final health check (succeeds)
      await dbMocks.executeTool('WebFetch', { url: 'https://api.example.com/health' });

      // Verify the migration recovery workflow
      expect(dbMocks.getCallCount('Bash')).toBe(4); // backup, migrate (fail), rollback, migrate (success)
      expect(dbMocks.getCallCount('WebFetch')).toBe(3); // health checks

      const bashCalls = dbMocks.getCallsForTool('Bash');
      expect(bashCalls[0].parameters.command).toContain('backup');
      expect(bashCalls[1].parameters.command).toContain('migrate');
      expect(bashCalls[2].parameters.command).toContain('backup.sql'); // rollback
      expect(bashCalls[3].parameters.command).toContain('migrate');
    });
  });

  describe('Multi-Agent Coordination', () => {
    it('should simulate coordinated agent handoffs', async () => {
      // Create separate mock environments for different agents
      const plannerAgent = createMockToolExecution();
      const implementerAgent = createMockToolExecution();
      const reviewerAgent = createMockToolExecution();

      // Configure planner behaviors
      plannerAgent
        .mockToolSuccess('Read', { content: 'Feature requirements' })
        .mockToolDynamic('TodoWrite', (params) => ({
          success: true,
          output: {
            todos: params.todos,
            planId: 'plan-123',
            estimatedHours: 8
          }
        }));

      // Configure implementer behaviors
      implementerAgent
        .mockToolSuccess('Read', { content: 'Implementation plan from planner' })
        .mockToolRetry('Edit', 2, { changes: 10, success: true }, 'Merge conflict')
        .mockToolSuccess('Bash', { stdout: 'Tests passed', exitCode: 0 });

      // Configure reviewer behaviors
      reviewerAgent
        .mockToolSuccess('Read', { content: 'Implementation code' })
        .mockToolDynamic('Grep', (params) => {
          const pattern = params.pattern as string;
          if (pattern.includes('TODO')) {
            return { success: true, output: { matches: ['// TODO: Add error handling'] } };
          } else if (pattern.includes('console.log')) {
            return { success: true, output: { matches: ['console.log("debug")'] } };
          }
          return { success: true, output: { matches: [] } };
        })
        .mockToolSuccess('Write', { written: true });

      // Simulate planner phase
      const plannerContext = { agentName: 'planner', stageName: 'planning', taskId: 'task-456' };
      await plannerAgent.executeTool('Read', { file_path: 'requirements.md' }, plannerContext);
      const planResult = await plannerAgent.executeTool('TodoWrite', {
        todos: [
          { content: 'Implement user authentication', status: 'pending' },
          { content: 'Add input validation', status: 'pending' }
        ]
      }, plannerContext);

      // Extract plan ID for handoff
      const planId = planResult.result.output.planId;

      // Simulate implementer phase (receives plan ID from planner)
      const implementerContext = {
        agentName: 'implementer',
        stageName: 'implementation',
        taskId: 'task-456',
        previousAgent: 'planner',
        planId: planId
      };

      await implementerAgent.executeTool('Read', { file_path: `plans/${planId}.md` }, implementerContext);

      // Implementation with retry due to merge conflict
      await implementerAgent.executeTool('Edit', {
        file_path: 'src/auth.ts',
        old_string: 'placeholder',
        new_string: 'auth implementation'
      }, implementerContext);

      // Retry succeeds
      await implementerAgent.executeTool('Edit', {
        file_path: 'src/auth.ts',
        old_string: 'conflict',
        new_string: 'resolved'
      }, implementerContext);

      await implementerAgent.executeTool('Bash', { command: 'npm test' }, implementerContext);

      // Simulate reviewer phase
      const reviewerContext = {
        agentName: 'reviewer',
        stageName: 'review',
        taskId: 'task-456',
        previousAgent: 'implementer'
      };

      await reviewerAgent.executeTool('Read', { file_path: 'src/auth.ts' }, reviewerContext);
      await reviewerAgent.executeTool('Grep', {
        pattern: 'TODO',
        path: 'src/'
      }, reviewerContext);
      await reviewerAgent.executeTool('Grep', {
        pattern: 'console.log',
        path: 'src/'
      }, reviewerContext);
      await reviewerAgent.executeTool('Write', {
        file_path: 'REVIEW.md',
        content: 'Code review feedback'
      }, reviewerContext);

      // Verify agent coordination
      const plannerCalls = plannerAgent.getCapturedCalls();
      const implementerCalls = implementerAgent.getCapturedCalls();
      const reviewerCalls = reviewerAgent.getCapturedCalls();

      expect(plannerCalls.every(call => call.agentName === 'planner')).toBe(true);
      expect(implementerCalls.every(call => call.agentName === 'implementer')).toBe(true);
      expect(reviewerCalls.every(call => call.agentName === 'reviewer')).toBe(true);

      expect(plannerAgent.getTotalCallCount()).toBe(2);
      expect(implementerAgent.getTotalCallCount()).toBe(4); // Including retry
      expect(reviewerAgent.getTotalCallCount()).toBe(4);

      // Verify handoff data
      expect(planResult.result.output.planId).toBe('plan-123');
      expect(implementerAgent.getCallCount('Edit')).toBe(2); // Original + retry
    });

    it('should simulate error propagation between agents', async () => {
      const agent1 = createMockToolExecution();
      const agent2 = createMockToolExecution();
      const agent3 = createMockToolExecution();

      // Agent 1: Fails to complete task
      agent1.mockToolFailure('Bash', 'Build failed - missing dependencies');

      // Agent 2: Handles the error and attempts recovery
      agent2
        .mockToolSuccess('Read', { content: 'Error log from agent 1' })
        .mockToolSuccess('Bash', { stdout: 'Dependencies installed', exitCode: 0 });

      // Agent 3: Continues with recovered state
      agent3.mockToolSuccess('Bash', { stdout: 'Build successful', exitCode: 0 });

      // Agent 1 encounters failure
      const failure = await agent1.executeTool('Bash', { command: 'npm run build' });
      expect(failure.result.success).toBe(false);

      // Agent 2 analyzes and recovers
      await agent2.executeTool('Read', { file_path: 'build.log' });
      const recovery = await agent2.executeTool('Bash', { command: 'npm install' });
      expect(recovery.result.success).toBe(true);

      // Agent 3 completes the task
      const completion = await agent3.executeTool('Bash', { command: 'npm run build' });
      expect(completion.result.success).toBe(true);

      // Verify error handling chain
      expect(agent1.getTotalCallCount()).toBe(1);
      expect(agent2.getTotalCallCount()).toBe(2);
      expect(agent3.getTotalCallCount()).toBe(1);
    });
  });

  describe('Real-world Tool Integration Patterns', () => {
    it('should simulate file system operations with dependencies', async () => {
      const fsMocks = createFileSystemMockTools();

      // Override with more realistic behaviors
      fsMocks.resetBehaviors();
      fsMocks
        .mockToolDynamic('Read', (params) => {
          const filePath = params.file_path as string;
          if (filePath.endsWith('.json')) {
            return { success: true, output: { content: '{"version": "1.0.0"}' } };
          } else if (filePath.endsWith('.ts')) {
            return { success: true, output: { content: 'export default class Auth {}' } };
          }
          return { success: true, output: { content: 'file content' } };
        })
        .mockToolDynamic('Write', (params) => {
          const content = params.content as string;
          return {
            success: true,
            output: {
              bytesWritten: content.length,
              file: params.file_path,
              timestamp: new Date().toISOString()
            }
          };
        })
        .mockToolDynamic('Edit', (params) => {
          const oldStr = params.old_string as string;
          const newStr = params.new_string as string;
          return {
            success: oldStr !== newStr,
            output: {
              changes: oldStr !== newStr ? 1 : 0,
              file: params.file_path
            },
            error: oldStr === newStr ? 'No changes needed' : undefined
          };
        });

      // Simulate realistic file operations
      const packageJson = await fsMocks.executeTool('Read', { file_path: 'package.json' });
      expect(packageJson.result.output.content).toContain('version');

      const authClass = await fsMocks.executeTool('Read', { file_path: 'src/auth.ts' });
      expect(authClass.result.output.content).toContain('class Auth');

      const writeResult = await fsMocks.executeTool('Write', {
        file_path: 'dist/app.js',
        content: 'compiled JavaScript code with 150 characters'
      });
      expect(writeResult.result.output.bytesWritten).toBe(42); // Length of the content

      const editResult = await fsMocks.executeTool('Edit', {
        file_path: 'src/config.ts',
        old_string: 'development',
        new_string: 'production'
      });
      expect(editResult.result.success).toBe(true);
      expect(editResult.result.output.changes).toBe(1);

      // Verify realistic workflow
      fsMocks.assertToolsCalledInOrder(['Read', 'Read', 'Write', 'Edit']);
    });

    it('should simulate web API integration with rate limiting', async () => {
      let requestCount = 0;
      const rateLimitThreshold = 3;

      const webMocks = createWebMockTools();
      webMocks.resetBehaviors();
      webMocks
        .mockToolDynamic('WebFetch', (params) => {
          requestCount++;

          if (requestCount > rateLimitThreshold) {
            return {
              success: false,
              error: 'Rate limit exceeded',
              output: { statusCode: 429, retryAfter: '60s' }
            };
          }

          const url = params.url as string;
          if (url.includes('/api/users')) {
            return {
              success: true,
              output: {
                content: JSON.stringify({ users: [`user${requestCount}`] }),
                statusCode: 200,
                headers: { 'X-RateLimit-Remaining': String(rateLimitThreshold - requestCount) }
              }
            };
          }

          return { success: true, output: { content: 'OK', statusCode: 200 } };
        })
        .mockToolDynamic('WebSearch', (params) => {
          const query = params.query as string;
          return {
            success: true,
            output: {
              results: [
                { title: `Result for ${query}`, url: `https://example.com/search?q=${query}` }
              ],
              totalResults: 1,
              searchTime: '0.15s'
            }
          };
        });

      // Make API requests within rate limit
      const requests = [];
      for (let i = 1; i <= rateLimitThreshold; i++) {
        const result = await webMocks.executeTool('WebFetch', {
          url: `https://api.example.com/users?page=${i}`
        });
        requests.push(result);
        expect(result.result.success).toBe(true);
      }

      // Next request should hit rate limit
      const rateLimitedRequest = await webMocks.executeTool('WebFetch', {
        url: 'https://api.example.com/users?page=4'
      });
      expect(rateLimitedRequest.result.success).toBe(false);
      expect(rateLimitedRequest.result.error).toBe('Rate limit exceeded');

      // Search should still work (different endpoint)
      const searchResult = await webMocks.executeTool('WebSearch', {
        query: 'API documentation'
      });
      expect(searchResult.result.success).toBe(true);

      // Verify request patterns
      expect(webMocks.getCallCount('WebFetch')).toBe(4);
      expect(webMocks.getCallCount('WebSearch')).toBe(1);

      const fetchCalls = webMocks.getCallsForTool('WebFetch');
      expect(fetchCalls.slice(0, 3).every(call =>
        (call as any).response?.result?.success === true
      )).toBe(true);
    });

    it('should simulate shell operations with environment dependencies', async () => {
      const shellMocks = createShellMockTools();
      let environmentReady = false;

      shellMocks.resetBehaviors();
      shellMocks.mockToolDynamic('Bash', (params) => {
        const command = params.command as string;

        if (command.includes('which node')) {
          return {
            success: true,
            output: {
              stdout: environmentReady ? '/usr/bin/node' : '',
              stderr: environmentReady ? '' : 'node: command not found',
              exitCode: environmentReady ? 0 : 1
            }
          };
        }

        if (command.includes('node --version')) {
          return {
            success: environmentReady,
            output: {
              stdout: environmentReady ? 'v18.16.0' : '',
              stderr: environmentReady ? '' : 'node: command not found',
              exitCode: environmentReady ? 0 : 127
            }
          };
        }

        if (command.includes('npm install')) {
          environmentReady = true;
          return {
            success: true,
            output: {
              stdout: 'Node.js environment setup complete\nPackages installed successfully',
              stderr: '',
              exitCode: 0
            }
          };
        }

        if (command.includes('npm test')) {
          return {
            success: environmentReady,
            output: {
              stdout: environmentReady ? 'Tests passed: 15/15' : '',
              stderr: environmentReady ? '' : 'npm: command not found',
              exitCode: environmentReady ? 0 : 127
            }
          };
        }

        return { success: true, output: { stdout: 'Command executed', stderr: '', exitCode: 0 } };
      });

      // Check environment (not ready)
      const nodeCheck1 = await shellMocks.executeTool('Bash', { command: 'which node' });
      expect(nodeCheck1.result.success).toBe(true);
      expect(nodeCheck1.result.output.exitCode).toBe(1);

      // Try to run node (should fail)
      const nodeVersion1 = await shellMocks.executeTool('Bash', { command: 'node --version' });
      expect(nodeVersion1.result.success).toBe(false);

      // Setup environment
      const setupResult = await shellMocks.executeTool('Bash', { command: 'npm install -g npm@latest && npm install' });
      expect(setupResult.result.success).toBe(true);

      // Check environment again (now ready)
      const nodeCheck2 = await shellMocks.executeTool('Bash', { command: 'which node' });
      expect(nodeCheck2.result.success).toBe(true);
      expect(nodeCheck2.result.output.exitCode).toBe(0);

      // Run tests (should work now)
      const testResult = await shellMocks.executeTool('Bash', { command: 'npm test' });
      expect(testResult.result.success).toBe(true);
      expect(testResult.result.output.stdout).toContain('Tests passed');

      // Verify environment setup workflow
      shellMocks.assertToolsCalledInOrder(['Bash']); // All are Bash calls
      expect(shellMocks.getTotalCallCount()).toBe(5);
    });
  });
});