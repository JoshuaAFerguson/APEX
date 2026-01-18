/**
 * APEX Orchestrator Browser Integration Tests
 *
 * End-to-end integration tests that verify browser automation functionality
 * works correctly through the main APEX orchestrator system. These tests
 * validate the complete integration stack:
 *
 * - ApexOrchestrator with browser tool integration
 * - Task execution with browser automation
 * - Real browser operations through the orchestrator
 * - Event streaming and progress tracking
 * - Error handling and recovery
 * - Resource management across the full stack
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index.js';
import type { Task, TaskStatus, AutonomyLevel } from '@apex/core/types';
import { createTestTask } from './test-utils.js';

describe('APEX Orchestrator Browser Integration', () => {
  let orchestrator: ApexOrchestrator;
  let mockEvents: Array<{ type: string; data: any }> = [];

  const testBrowserConfig = {
    autonomyLevel: 'guided' as AutonomyLevel,
    permissions: {
      browser: {
        enabled: true,
        allowedDomains: ['*'],
        blockedDomains: [],
        requireConfirmation: false,
      },
    },
    limits: {
      maxConcurrentTasks: 1,
      maxExecutionTime: 60000,
    },
  };

  const testPageHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>APEX Orchestrator Browser Test</title>
      <style>
        body { font-family: sans-serif; padding: 20px; }
        .test-area { margin: 15px 0; padding: 10px; border: 1px solid #ddd; }
        .result { background: #f0f0f0; padding: 8px; margin: 5px 0; }
        #status { font-weight: bold; }
      </style>
    </head>
    <body>
      <h1 id="title">APEX Orchestrator Browser Test Page</h1>

      <div class="test-area">
        <h3>Data Collection</h3>
        <input id="name-input" type="text" placeholder="Enter name" />
        <input id="email-input" type="email" placeholder="Enter email" />
        <button id="collect-data" onclick="collectData()">Collect Data</button>
        <div id="collected-data" class="result">No data collected yet</div>
      </div>

      <div class="test-area">
        <h3>Process Control</h3>
        <button id="start-process" onclick="startProcess()">Start Process</button>
        <button id="stop-process" onclick="stopProcess()">Stop Process</button>
        <div id="process-status" class="result">Process not started</div>
      </div>

      <div class="test-area">
        <h3>Status Display</h3>
        <div id="status">Ready</div>
        <div id="timestamp"></div>
      </div>

      <div class="test-area">
        <h3>Testing Controls</h3>
        <button id="generate-logs" onclick="generateTestLogs()">Generate Test Logs</button>
        <button id="simulate-error" onclick="simulateError()">Simulate Error</button>
        <button id="test-performance" onclick="testPerformance()">Test Performance</button>
      </div>

      <script>
        console.log('APEX Orchestrator test page initialized');

        let processRunning = false;
        let processInterval;

        function collectData() {
          const name = document.getElementById('name-input').value;
          const email = document.getElementById('email-input').value;

          console.info('Data collection started', { name, email });

          if (!name || !email) {
            console.warn('Incomplete data provided');
            document.getElementById('collected-data').innerHTML =
              '<span style="color: orange;">Please fill in all fields</span>';
            return;
          }

          console.log('Data validation passed');

          const result = {
            name: name,
            email: email,
            timestamp: new Date().toISOString(),
            id: Math.random().toString(36).substr(2, 9)
          };

          document.getElementById('collected-data').innerHTML =
            '<span style="color: green;">Data collected: ' + JSON.stringify(result) + '</span>';

          console.info('Data collection completed', result);
        }

        function startProcess() {
          if (processRunning) {
            console.warn('Process already running');
            return;
          }

          console.log('Starting background process');
          processRunning = true;

          document.getElementById('process-status').innerHTML =
            '<span style="color: blue;">Process running...</span>';

          processInterval = setInterval(() => {
            const status = 'Process tick at ' + new Date().toLocaleTimeString();
            console.debug('Process update:', status);
            updateStatus('Processing...');
          }, 1000);

          console.info('Background process started');
        }

        function stopProcess() {
          if (!processRunning) {
            console.warn('No process to stop');
            return;
          }

          console.log('Stopping background process');
          processRunning = false;

          if (processInterval) {
            clearInterval(processInterval);
            processInterval = null;
          }

          document.getElementById('process-status').innerHTML =
            '<span style="color: red;">Process stopped</span>';

          updateStatus('Stopped');
          console.info('Background process stopped');
        }

        function updateStatus(status) {
          document.getElementById('status').textContent = status;
          document.getElementById('timestamp').textContent =
            'Last updated: ' + new Date().toLocaleString();
        }

        function generateTestLogs() {
          console.log('Test log message');
          console.info('Test info message with data', {
            test: true,
            timestamp: Date.now(),
            random: Math.random()
          });
          console.debug('Test debug message');
          console.warn('Test warning message');

          updateStatus('Logs generated');
          console.trace('Test trace for debugging');
        }

        function simulateError() {
          console.error('Simulating test error');

          try {
            // Intentionally cause an error
            nonExistentFunction();
          } catch (e) {
            console.error('Caught simulated error:', e.message);
            updateStatus('Error simulated');

            // Throw an error to test error handling
            setTimeout(() => {
              throw new Error('Simulated asynchronous error for testing');
            }, 10);
          }
        }

        function testPerformance() {
          console.time('Performance Test');
          console.log('Performance test started');

          const start = performance.now();
          updateStatus('Running performance test...');

          // Simulate CPU intensive work
          let result = 0;
          for (let i = 0; i < 500000; i++) {
            result += Math.sqrt(i);
          }

          const end = performance.now();
          const duration = end - start;

          console.timeEnd('Performance Test');
          console.log('Performance test completed', {
            duration: duration.toFixed(2) + 'ms',
            operations: 500000,
            result: result.toFixed(2)
          });

          updateStatus('Performance test completed: ' + duration.toFixed(2) + 'ms');
        }

        // Global error handlers
        window.onerror = function(message, source, lineno, colno, error) {
          console.error('Global error handler triggered:', {
            message,
            source,
            line: lineno,
            column: colno,
            stack: error?.stack
          });
        };

        window.addEventListener('unhandledrejection', function(event) {
          console.error('Unhandled promise rejection:', event.reason);
        });

        // Update initial status
        updateStatus('Ready');
      </script>
    </body>
    </html>
  `;

  beforeEach(async () => {
    mockEvents = [];

    orchestrator = new ApexOrchestrator(testBrowserConfig);

    // Set up event listeners to capture orchestrator events
    orchestrator.on('task:created', (data) => mockEvents.push({ type: 'task:created', data }));
    orchestrator.on('task:started', (data) => mockEvents.push({ type: 'task:started', data }));
    orchestrator.on('task:progress', (data) => mockEvents.push({ type: 'task:progress', data }));
    orchestrator.on('task:completed', (data) => mockEvents.push({ type: 'task:completed', data }));
    orchestrator.on('task:failed', (data) => mockEvents.push({ type: 'task:failed', data }));
    orchestrator.on('tool:executed', (data) => mockEvents.push({ type: 'tool:executed', data }));
    orchestrator.on('error', (data) => mockEvents.push({ type: 'error', data }));
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
  });

  describe('Basic Browser Automation through Orchestrator', () => {
    it('should execute browser navigation task successfully', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      const task = createTestTask({
        title: 'Navigate to test page',
        description: `Navigate to the test page and verify it loads correctly.`,
        requirements: [
          'Navigate to the specified URL',
          'Verify the page title is correct',
          'Take a screenshot for verification',
        ],
        acceptanceCriteria: [
          'Page loads successfully',
          'Title matches "APEX Orchestrator Browser Test"',
          'Screenshot captures the page content',
        ],
        workflow: {
          name: 'browser-navigation-test',
          stages: [
            {
              name: 'navigate',
              agent: 'browser',
              description: 'Navigate to test page',
              tools: ['browser'],
              inputs: { url: testUrl },
              outputs: ['screenshot', 'page_title'],
            },
          ],
        },
      });

      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');

      // Verify events were fired
      const createdEvents = mockEvents.filter(e => e.type === 'task:created');
      const startedEvents = mockEvents.filter(e => e.type === 'task:started');
      const completedEvents = mockEvents.filter(e => e.type === 'task:completed');

      expect(createdEvents).toHaveLength(1);
      expect(startedEvents).toHaveLength(1);
      expect(completedEvents).toHaveLength(1);

      // Verify tool execution
      const toolEvents = mockEvents.filter(e => e.type === 'tool:executed');
      expect(toolEvents.length).toBeGreaterThan(0);

      const browserToolEvents = toolEvents.filter(e =>
        e.data.toolName === 'browser' || e.data.tool === 'browser'
      );
      expect(browserToolEvents.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle browser form interaction task', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      const task = createTestTask({
        title: 'Browser form interaction test',
        description: 'Test form interactions through the orchestrator',
        requirements: [
          'Navigate to the test page',
          'Fill in the name and email fields',
          'Click the collect data button',
          'Verify the data was collected',
        ],
        acceptanceCriteria: [
          'Form fields are filled correctly',
          'Data collection button works',
          'Result displays collected data',
        ],
        workflow: {
          name: 'browser-form-test',
          stages: [
            {
              name: 'interact',
              agent: 'browser',
              description: 'Perform form interactions',
              tools: ['browser'],
              inputs: {
                url: testUrl,
                actions: [
                  { type: 'type', selector: '#name-input', text: 'Test User' },
                  { type: 'type', selector: '#email-input', text: 'test@example.com' },
                  { type: 'click', selector: '#collect-data' },
                ],
              },
              outputs: ['form_result', 'screenshot'],
            },
          ],
        },
      });

      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');

      // Verify multiple tool executions occurred
      const toolEvents = mockEvents.filter(e => e.type === 'tool:executed');
      expect(toolEvents.length).toBeGreaterThan(1);
    }, 25000);

    it('should capture console output during browser automation', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      const task = createTestTask({
        title: 'Console capture test',
        description: 'Test console output capture during browser automation',
        requirements: [
          'Navigate to test page',
          'Trigger console output generation',
          'Verify console messages are captured',
        ],
        acceptanceCriteria: [
          'Console logs are captured',
          'Different log levels are detected',
          'Console data is available in results',
        ],
        workflow: {
          name: 'browser-console-test',
          stages: [
            {
              name: 'console-test',
              agent: 'browser',
              description: 'Test console capture',
              tools: ['browser'],
              inputs: {
                url: testUrl,
                actions: [
                  { type: 'click', selector: '#generate-logs' },
                  { type: 'wait', duration: 500 },
                ],
              },
              outputs: ['console_logs', 'screenshot'],
            },
          ],
        },
      });

      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');

      // Check for console-related events or data
      const progressEvents = mockEvents.filter(e => e.type === 'task:progress');
      expect(progressEvents.length).toBeGreaterThan(0);
    }, 20000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle browser errors gracefully', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      const task = createTestTask({
        title: 'Error handling test',
        description: 'Test error handling in browser automation',
        requirements: [
          'Navigate to test page',
          'Trigger a JavaScript error',
          'Verify error is handled gracefully',
        ],
        acceptanceCriteria: [
          'Error is detected and captured',
          'Task continues or fails gracefully',
          'Error information is available',
        ],
        workflow: {
          name: 'browser-error-test',
          stages: [
            {
              name: 'error-test',
              agent: 'browser',
              description: 'Test error handling',
              tools: ['browser'],
              inputs: {
                url: testUrl,
                actions: [
                  { type: 'click', selector: '#simulate-error' },
                  { type: 'wait', duration: 200 },
                ],
              },
              outputs: ['error_details', 'screenshot'],
            },
          ],
        },
      });

      const result = await orchestrator.executeTask(task);

      // Task may succeed (error handled) or fail (error propagated)
      expect(['completed', 'failed']).toContain(result.status);

      // Check if error events were captured
      const errorEvents = mockEvents.filter(e => e.type === 'error');
      const toolEvents = mockEvents.filter(e => e.type === 'tool:executed');

      // Should have attempted tool execution
      expect(toolEvents.length).toBeGreaterThan(0);
    }, 20000);

    it('should handle invalid browser operations', async () => {
      const task = createTestTask({
        title: 'Invalid operation test',
        description: 'Test handling of invalid browser operations',
        requirements: [
          'Attempt to navigate to invalid URL',
          'Verify error handling',
        ],
        acceptanceCriteria: [
          'Invalid operation fails gracefully',
          'Error message is descriptive',
        ],
        workflow: {
          name: 'browser-invalid-test',
          stages: [
            {
              name: 'invalid-test',
              agent: 'browser',
              description: 'Test invalid operations',
              tools: ['browser'],
              inputs: {
                url: 'invalid://not-a-real-url',
              },
              outputs: ['error_result'],
            },
          ],
        },
      });

      const result = await orchestrator.executeTask(task);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();

      // Verify error events were generated
      const failedEvents = mockEvents.filter(e => e.type === 'task:failed');
      expect(failedEvents).toHaveLength(1);
    }, 15000);
  });

  describe('Performance and Concurrency', () => {
    it('should handle performance testing through orchestrator', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      const task = createTestTask({
        title: 'Performance test',
        description: 'Test performance monitoring in browser automation',
        requirements: [
          'Navigate to test page',
          'Trigger performance test',
          'Monitor execution time',
        ],
        acceptanceCriteria: [
          'Performance test completes',
          'Timing information is captured',
          'Task completes within time limits',
        ],
        workflow: {
          name: 'browser-performance-test',
          stages: [
            {
              name: 'performance',
              agent: 'browser',
              description: 'Run performance test',
              tools: ['browser'],
              inputs: {
                url: testUrl,
                actions: [
                  { type: 'click', selector: '#test-performance' },
                  { type: 'wait', duration: 1000 },
                ],
              },
              outputs: ['performance_data', 'console_logs'],
            },
          ],
        },
      });

      const startTime = Date.now();
      const result = await orchestrator.executeTask(task);
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds

      // Verify performance monitoring
      const progressEvents = mockEvents.filter(e => e.type === 'task:progress');
      expect(progressEvents.length).toBeGreaterThan(0);
    }, 35000);

    it('should manage browser resources properly', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      // Execute multiple tasks sequentially to test resource management
      const tasks = Array.from({ length: 3 }, (_, i) =>
        createTestTask({
          title: `Resource test ${i + 1}`,
          description: `Test resource management - iteration ${i + 1}`,
          requirements: [
            'Navigate to test page',
            'Perform basic interactions',
            'Clean up resources',
          ],
          acceptanceCriteria: [
            'Task completes successfully',
            'Resources are cleaned up',
          ],
          workflow: {
            name: `browser-resource-test-${i + 1}`,
            stages: [
              {
                name: 'resource-test',
                agent: 'browser',
                description: 'Test resource management',
                tools: ['browser'],
                inputs: {
                  url: testUrl,
                  actions: [
                    { type: 'click', selector: '#collect-data' },
                    { type: 'screenshot', fullPage: true },
                  ],
                },
                outputs: ['interaction_result'],
              },
            ],
          },
        })
      );

      // Execute tasks sequentially
      const results = [];
      for (const task of tasks) {
        const result = await orchestrator.executeTask(task);
        results.push(result);
        expect(result.success).toBe(true);
      }

      // Verify all tasks completed successfully
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.status).toBe('completed');
      });

      // Verify events were generated for all tasks
      const completedEvents = mockEvents.filter(e => e.type === 'task:completed');
      expect(completedEvents).toHaveLength(3);
    }, 45000);
  });

  describe('Integration with Orchestrator Features', () => {
    it('should integrate browser automation with task progress tracking', async () => {
      const testUrl = `data:text/html;charset=utf-8,${encodeURIComponent(testPageHtml)}`;

      const task = createTestTask({
        title: 'Progress tracking test',
        description: 'Test progress tracking during browser automation',
        requirements: [
          'Navigate to test page',
          'Perform multiple actions with progress updates',
          'Track progress throughout execution',
        ],
        acceptanceCriteria: [
          'Progress events are generated',
          'Progress percentages are accurate',
          'Task completion is tracked',
        ],
        workflow: {
          name: 'browser-progress-test',
          stages: [
            {
              name: 'step1',
              agent: 'browser',
              description: 'Navigation step',
              tools: ['browser'],
              inputs: { url: testUrl },
              outputs: ['navigation_result'],
            },
            {
              name: 'step2',
              agent: 'browser',
              description: 'Interaction step',
              tools: ['browser'],
              inputs: {
                actions: [
                  { type: 'type', selector: '#name-input', text: 'Progress Test' },
                  { type: 'type', selector: '#email-input', text: 'progress@test.com' },
                ],
              },
              outputs: ['form_data'],
            },
            {
              name: 'step3',
              agent: 'browser',
              description: 'Completion step',
              tools: ['browser'],
              inputs: {
                actions: [
                  { type: 'click', selector: '#collect-data' },
                  { type: 'screenshot', fullPage: true },
                ],
              },
              outputs: ['final_result'],
            },
          ],
        },
      });

      const result = await orchestrator.executeTask(task);

      expect(result.success).toBe(true);
      expect(result.status).toBe('completed');

      // Verify progress events were generated
      const progressEvents = mockEvents.filter(e => e.type === 'task:progress');
      expect(progressEvents.length).toBeGreaterThan(2); // Should have progress for each stage

      // Verify stage completion tracking
      const toolEvents = mockEvents.filter(e => e.type === 'tool:executed');
      expect(toolEvents.length).toBeGreaterThan(2); // Should have multiple tool executions
    }, 30000);

    it('should integrate browser automation with error reporting', async () => {
      const task = createTestTask({
        title: 'Error reporting integration test',
        description: 'Test error reporting integration with browser automation',
        requirements: [
          'Attempt invalid browser operations',
          'Verify error reporting works correctly',
        ],
        acceptanceCriteria: [
          'Errors are properly reported',
          'Error details are captured',
          'Error recovery is attempted',
        ],
        workflow: {
          name: 'browser-error-reporting-test',
          stages: [
            {
              name: 'error-stage',
              agent: 'browser',
              description: 'Intentionally cause error',
              tools: ['browser'],
              inputs: {
                url: 'invalid://url',
                actions: [
                  { type: 'click', selector: '#non-existent' },
                ],
              },
              outputs: ['error_data'],
            },
          ],
        },
      });

      const result = await orchestrator.executeTask(task);

      expect(result.status).toBe('failed');
      expect(result.error).toBeDefined();

      // Verify error reporting
      const errorEvents = mockEvents.filter(e => e.type === 'error');
      const failedEvents = mockEvents.filter(e => e.type === 'task:failed');

      expect(errorEvents.length + failedEvents.length).toBeGreaterThan(0);
    }, 15000);
  });
});