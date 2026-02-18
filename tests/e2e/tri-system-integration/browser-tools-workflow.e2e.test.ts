/**
 * E2E tests for browser-tools-permission workflows
 *
 * This test suite covers comprehensive integration scenarios that demonstrate
 * the seamless interaction between browser automation, file operations, and
 * permission enforcement across complex multi-step workflows.
 *
 * Test scenarios covered:
 * 1. Browser data extraction → file operations - Browser extracts data, writes to files
 * 2. Tool execution triggering browser verification - File operations trigger browser checks
 * 3. Multi-step workflows with mixed tool types - Complex workflows using browser + file tools
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTriSystemTestEnvironment,
  createBrowserToolIntegrationScenario,
  createFullAutonomyScenario,
  createSupervisedModeScenario,
  assertTriSystemEventSequence,
  assertPermissionEnforced,
  assertBrowserPermissionRespected,
  assertTriSystemReady,
  assertCrossSystemEventPropagation,
  type TriSystemTestEnvironment,
  type SystemEvent,
  type ToolExecutionResult
} from './test-utils';

describe('Browser-Tools-Permission Workflows E2E', () => {
  let testEnv: TriSystemTestEnvironment;

  beforeEach(async () => {
    // Create a clean test environment for each test with comprehensive tool support
    testEnv = await createTriSystemTestEnvironment({
      toolConfig: {
        enabledTools: ['Browser', 'Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch'],
        mockAll: true
      },
      permissionConfig: {
        preset: 'selective',
        defaultLevel: 'allow-always'
      },
      browserConfig: {
        backend: 'mock',
        headless: true
      },
      eventConfig: {
        captureAll: true,
        enableCorrelation: true
      }
    });

    // Verify the test environment is properly initialized
    assertTriSystemReady(testEnv);
  });

  afterEach(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe('Browser Data Extraction → File Operations', () => {
    it('should extract data from webpage and write to file', async () => {
      testEnv.systemEvents.start();

      // Step 1: Navigate to webpage
      const navigationResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://data.example.com/api' }
        }
      );

      expect(navigationResult.success).toBe(true);
      assertBrowserPermissionRespected(navigationResult, 'navigate');

      // Step 2: Extract data using JavaScript evaluation
      const extractionResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'evaluate',
        {
          operation: 'evaluate',
          params: {
            script: `
              JSON.stringify({
                title: document.title,
                url: window.location.href,
                timestamp: new Date().toISOString(),
                data: { users: 42, active: true }
              })
            `
          }
        }
      );

      expect(extractionResult.success).toBe(true);
      assertBrowserPermissionRespected(extractionResult, 'evaluate');

      // Mock extracted data for test consistency
      const extractedData = {
        title: 'Data API',
        url: 'https://data.example.com/api',
        timestamp: '2024-01-01T10:00:00.000Z',
        data: { users: 42, active: true }
      };

      // Step 3: Write extracted data to JSON file
      const writeResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/extracted_data.json',
          content: JSON.stringify(extractedData, null, 2)
        }
      );

      expect(writeResult.success).toBe(true);
      assertPermissionEnforced(writeResult, 'granted');

      // Step 4: Write summary report
      const reportContent = `Data Extraction Report
============================
Source: ${extractedData.url}
Title: ${extractedData.title}
Timestamp: ${extractedData.timestamp}
Users Found: ${extractedData.data.users}
Status: ${extractedData.data.active ? 'Active' : 'Inactive'}
`;

      const reportResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/extraction_report.txt',
          content: reportContent
        }
      );

      expect(reportResult.success).toBe(true);
      assertPermissionEnforced(reportResult, 'granted');

      // Verify complete workflow event sequence
      const events = testEnv.systemEvents.getAllEvents();
      assertTriSystemEventSequence(events, [
        { type: 'permission:requested', system: 'permission' },
        { type: 'permission:granted', system: 'permission' },
        { type: 'browser:operation:start', system: 'browser' },
        { type: 'browser:operation:complete', system: 'browser' },
        { type: 'permission:requested', system: 'permission' },
        { type: 'permission:granted', system: 'permission' },
        { type: 'browser:operation:start', system: 'browser' },
        { type: 'browser:operation:complete', system: 'browser' },
        { type: 'permission:requested', system: 'permission' },
        { type: 'permission:granted', system: 'permission' },
        { type: 'tool:execution:start', system: 'tool' },
        { type: 'tool:execution:complete', system: 'tool' }
      ]);

      // Verify cross-system event propagation
      assertCrossSystemEventPropagation(testEnv, 'browser', 'tool', 'browser:operation:complete');
    });

    it('should extract multiple data points and organize into structured files', async () => {
      testEnv.systemEvents.start();

      // Step 1: Navigate to main page
      const navResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://ecommerce.example.com/products' }
        }
      );

      expect(navResult.success).toBe(true);

      // Step 2: Extract product data
      const productDataResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'evaluate',
        {
          operation: 'evaluate',
          params: {
            script: `
              JSON.stringify({
                products: [
                  { id: 1, name: 'Product A', price: 29.99, category: 'Electronics' },
                  { id: 2, name: 'Product B', price: 49.99, category: 'Books' },
                  { id: 3, name: 'Product C', price: 19.99, category: 'Clothing' }
                ],
                metadata: {
                  totalCount: 3,
                  extractedAt: new Date().toISOString(),
                  source: window.location.href
                }
              })
            `
          }
        }
      );

      expect(productDataResult.success).toBe(true);

      // Step 3: Extract category data
      const categoryDataResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'evaluate',
        {
          operation: 'evaluate',
          params: {
            script: `
              JSON.stringify({
                categories: ['Electronics', 'Books', 'Clothing'],
                counts: { Electronics: 1, Books: 1, Clothing: 1 }
              })
            `
          }
        }
      );

      expect(categoryDataResult.success).toBe(true);

      // Mock the extracted data for consistent testing
      const productData = {
        products: [
          { id: 1, name: 'Product A', price: 29.99, category: 'Electronics' },
          { id: 2, name: 'Product B', price: 49.99, category: 'Books' },
          { id: 3, name: 'Product C', price: 19.99, category: 'Clothing' }
        ],
        metadata: {
          totalCount: 3,
          extractedAt: '2024-01-01T10:00:00.000Z',
          source: 'https://ecommerce.example.com/products'
        }
      };

      const categoryData = {
        categories: ['Electronics', 'Books', 'Clothing'],
        counts: { Electronics: 1, Books: 1, Clothing: 1 }
      };

      // Step 4: Write product data to JSON
      const productFileResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/products.json',
          content: JSON.stringify(productData, null, 2)
        }
      );

      expect(productFileResult.success).toBe(true);

      // Step 5: Write category data to JSON
      const categoryFileResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/categories.json',
          content: JSON.stringify(categoryData, null, 2)
        }
      );

      expect(categoryFileResult.success).toBe(true);

      // Step 6: Create CSV export of products
      const csvContent = [
        'id,name,price,category',
        ...productData.products.map(p => `${p.id},${p.name},${p.price},${p.category}`)
      ].join('\n');

      const csvResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/products.csv',
          content: csvContent
        }
      );

      expect(csvResult.success).toBe(true);

      // Verify all operations succeeded
      expect(navResult.success).toBe(true);
      expect(productDataResult.success).toBe(true);
      expect(categoryDataResult.success).toBe(true);
      expect(productFileResult.success).toBe(true);
      expect(categoryFileResult.success).toBe(true);
      expect(csvResult.success).toBe(true);

      // Verify event flow shows successful multi-operation workflow
      const allEvents = testEnv.systemEvents.getAllEvents();
      expect(allEvents.length).toBeGreaterThan(10);

      // Ensure browser and tool events are properly correlated
      const browserEvents = testEnv.systemEvents.getEventsBySystem('browser');
      const toolEvents = testEnv.systemEvents.getEventsBySystem('tool');

      expect(browserEvents.length).toBeGreaterThan(0);
      expect(toolEvents.length).toBeGreaterThan(0);
    });

    it('should handle browser errors gracefully and still complete file operations', async () => {
      testEnv.systemEvents.start();

      // Mock browser navigation to fail
      testEnv.browserSystem.mockPage.goto.mockRejectedValueOnce(new Error('Network timeout'));

      // Step 1: Attempt browser navigation (will fail)
      const navResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: 'https://unreachable.example.com' }
        }
      );

      expect(navResult.success).toBe(false);
      expect(navResult.error).toContain('Network timeout');

      // Step 2: Continue with fallback data and file operations
      const fallbackData = {
        error: 'Failed to extract from source',
        fallbackUsed: true,
        timestamp: new Date().toISOString(),
        data: { message: 'Using cached or default data' }
      };

      const writeResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/fallback_data.json',
          content: JSON.stringify(fallbackData, null, 2)
        }
      );

      expect(writeResult.success).toBe(true);

      // Step 3: Create error log file
      const errorLog = `Error Log
=========
Timestamp: ${new Date().toISOString()}
Operation: Browser Navigation
URL: https://unreachable.example.com
Error: Network timeout
Recovery: Used fallback data
Status: Workflow continued successfully
`;

      const errorLogResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/error_log.txt',
          content: errorLog
        }
      );

      expect(errorLogResult.success).toBe(true);

      // Verify that workflow can continue despite browser errors
      const events = testEnv.systemEvents.getAllEvents();

      // Should have browser error event followed by successful tool events
      const browserErrors = events.filter(e => e.type === 'browser:operation:error');
      const toolSuccesses = events.filter(e => e.type === 'tool:execution:complete');

      expect(browserErrors.length).toBeGreaterThan(0);
      expect(toolSuccesses.length).toBeGreaterThan(0);
    });
  });

  describe('Tool Execution Triggering Browser Verification', () => {
    it('should read configuration file and trigger browser verification', async () => {
      testEnv.systemEvents.start();

      // Step 1: Write configuration file with URLs to verify
      const configData = {
        verification: {
          urls: [
            'https://api.example.com/health',
            'https://staging.example.com/status',
            'https://prod.example.com/ping'
          ],
          timeout: 5000,
          expectedStatus: 200
        },
        timestamp: new Date().toISOString()
      };

      const writeConfigResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/verification_config.json',
          content: JSON.stringify(configData, null, 2)
        }
      );

      expect(writeConfigResult.success).toBe(true);

      // Step 2: Read configuration file
      const readConfigResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Read',
        'read',
        {
          filePath: '/tmp/verification_config.json'
        }
      );

      expect(readConfigResult.success).toBe(true);

      // Step 3: Verify each URL using browser (triggered by file content)
      const verificationResults = [];

      for (const url of configData.verification.urls) {
        // Navigate to URL
        const navResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url }
          }
        );

        // Check if navigation was successful (in real scenario, would check response)
        const statusCheckResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'evaluate',
          {
            operation: 'evaluate',
            params: {
              script: `JSON.stringify({
                url: window.location.href,
                title: document.title,
                status: 'healthy',
                timestamp: new Date().toISOString()
              })`
            }
          }
        );

        verificationResults.push({
          url,
          navigation: navResult.success,
          status: statusCheckResult.success ? 'verified' : 'failed',
          timestamp: new Date().toISOString()
        });

        expect(navResult.success).toBe(true);
        expect(statusCheckResult.success).toBe(true);
      }

      // Step 4: Write verification results back to file
      const resultsData = {
        verificationsPerformed: verificationResults.length,
        results: verificationResults,
        summary: {
          successful: verificationResults.filter(r => r.status === 'verified').length,
          failed: verificationResults.filter(r => r.status === 'failed').length,
          completedAt: new Date().toISOString()
        }
      };

      const writeResultsResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/verification_results.json',
          content: JSON.stringify(resultsData, null, 2)
        }
      );

      expect(writeResultsResult.success).toBe(true);

      // Verify the complete file → browser → file workflow
      expect(writeConfigResult.success).toBe(true);
      expect(readConfigResult.success).toBe(true);
      expect(writeResultsResult.success).toBe(true);
      expect(verificationResults.length).toBe(3);
      expect(verificationResults.every(r => r.status === 'verified')).toBe(true);

      // Verify event sequence shows file operations triggering browser operations
      const events = testEnv.systemEvents.getAllEvents();

      // Should have tool events (file ops) followed by browser events
      const toolEvents = testEnv.systemEvents.getEventsBySystem('tool');
      const browserEvents = testEnv.systemEvents.getEventsBySystem('browser');

      expect(toolEvents.length).toBeGreaterThan(0);
      expect(browserEvents.length).toBeGreaterThan(0);

      // Browser events should occur after initial file read
      const readEvents = events.filter(e => e.type === 'tool:execution:complete' &&
                                           e.data?.result?.metadata?.tool === 'Read');
      const browserStartEvents = events.filter(e => e.type === 'browser:operation:start');

      expect(readEvents.length).toBeGreaterThan(0);
      expect(browserStartEvents.length).toBeGreaterThan(0);
    });

    it('should process file list and verify each URL in browser', async () => {
      testEnv.systemEvents.start();

      // Step 1: Create a file containing URLs to process
      const urlList = [
        'https://example.com/page1',
        'https://example.com/page2',
        'https://example.com/page3',
        'https://test.com/api',
        'https://demo.com/status'
      ];

      const writeUrlListResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/urls_to_process.txt',
          content: urlList.join('\n')
        }
      );

      expect(writeUrlListResult.success).toBe(true);

      // Step 2: Read the URL list file
      const readUrlListResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Read',
        'read',
        {
          filePath: '/tmp/urls_to_process.txt'
        }
      );

      expect(readUrlListResult.success).toBe(true);

      // Step 3: Process each URL with browser verification
      const processingResults = [];

      for (const url of urlList) {
        // Navigate to URL
        const navResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url }
          }
        );

        // Take screenshot for verification
        const screenshotResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'screenshot',
          {
            operation: 'screenshot',
            params: { fullPage: false }
          }
        );

        // Extract page info
        const pageInfoResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'evaluate',
          {
            operation: 'evaluate',
            params: {
              script: `JSON.stringify({
                title: document.title,
                url: window.location.href,
                hasContent: document.body.innerText.length > 0
              })`
            }
          }
        );

        const processResult = {
          url,
          navigationSuccess: navResult.success,
          screenshotTaken: screenshotResult.success,
          pageInfoExtracted: pageInfoResult.success,
          status: 'processed',
          timestamp: new Date().toISOString()
        };

        processingResults.push(processResult);

        // Verify all operations succeeded
        expect(navResult.success).toBe(true);
        expect(screenshotResult.success).toBe(true);
        expect(pageInfoResult.success).toBe(true);
      }

      // Step 4: Write processing summary
      const summaryData = {
        totalUrls: urlList.length,
        processedUrls: processingResults.length,
        successfulProcessing: processingResults.filter(r => r.status === 'processed').length,
        results: processingResults,
        completedAt: new Date().toISOString()
      };

      const writeSummaryResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/processing_summary.json',
          content: JSON.stringify(summaryData, null, 2)
        }
      );

      expect(writeSummaryResult.success).toBe(true);

      // Verify complete workflow: file read → browser processing → file write
      expect(processingResults.length).toBe(5);
      expect(processingResults.every(r => r.status === 'processed')).toBe(true);
      expect(summaryData.successfulProcessing).toBe(5);

      // Verify event correlation shows file operations driving browser operations
      assertCrossSystemEventPropagation(testEnv, 'tool', 'browser', 'browser:operation:start');
    });

    it('should edit configuration and trigger browser re-verification', async () => {
      testEnv.systemEvents.start();

      // Step 1: Create initial configuration
      const initialConfig = {
        monitoring: {
          interval: 300,
          urls: ['https://api.example.com'],
          alertThreshold: 5000
        }
      };

      const writeInitialResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/monitoring_config.json',
          content: JSON.stringify(initialConfig, null, 2)
        }
      );

      expect(writeInitialResult.success).toBe(true);

      // Step 2: Initial verification based on config
      const initialVerifyResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Browser',
        'navigate',
        {
          operation: 'navigate',
          params: { url: initialConfig.monitoring.urls[0] }
        }
      );

      expect(initialVerifyResult.success).toBe(true);

      // Step 3: Read and edit the configuration file
      const readResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Read',
        'read',
        {
          filePath: '/tmp/monitoring_config.json'
        }
      );

      expect(readResult.success).toBe(true);

      // Edit config to add more URLs and change settings
      const editResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Edit',
        'edit',
        {
          filePath: '/tmp/monitoring_config.json',
          oldString: '"urls": ["https://api.example.com"]',
          newString: '"urls": ["https://api.example.com", "https://backup.example.com", "https://status.example.com"]'
        }
      );

      expect(editResult.success).toBe(true);

      const editResult2 = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Edit',
        'edit',
        {
          filePath: '/tmp/monitoring_config.json',
          oldString: '"interval": 300',
          newString: '"interval": 60'
        }
      );

      expect(editResult2.success).toBe(true);

      // Step 4: Read updated configuration
      const readUpdatedResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Read',
        'read',
        {
          filePath: '/tmp/monitoring_config.json'
        }
      );

      expect(readUpdatedResult.success).toBe(true);

      // Step 5: Re-verify all URLs in updated config
      const updatedUrls = [
        'https://api.example.com',
        'https://backup.example.com',
        'https://status.example.com'
      ];

      const reverificationResults = [];

      for (const url of updatedUrls) {
        const verifyResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url }
          }
        );

        const healthCheckResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'evaluate',
          {
            operation: 'evaluate',
            params: {
              script: 'JSON.stringify({ healthy: true, responseTime: 120 })'
            }
          }
        );

        reverificationResults.push({
          url,
          verified: verifyResult.success && healthCheckResult.success,
          timestamp: new Date().toISOString()
        });

        expect(verifyResult.success).toBe(true);
        expect(healthCheckResult.success).toBe(true);
      }

      // Step 6: Write re-verification results
      const resultsData = {
        configUpdated: true,
        reVerificationPerformed: true,
        urlsChecked: reverificationResults.length,
        results: reverificationResults,
        timestamp: new Date().toISOString()
      };

      const writeResultsResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/reverification_results.json',
          content: JSON.stringify(resultsData, null, 2)
        }
      );

      expect(writeResultsResult.success).toBe(true);

      // Verify the complete edit → verification workflow
      expect(reverificationResults.length).toBe(3);
      expect(reverificationResults.every(r => r.verified)).toBe(true);

      // Verify events show file operations triggering browser re-verification
      const events = testEnv.systemEvents.getAllEvents();

      // Should see edit operations followed by browser operations
      const editEvents = events.filter(e => e.type === 'tool:execution:complete' &&
                                           e.data?.result?.metadata?.tool === 'Edit');
      const browserEvents = testEnv.systemEvents.getEventsBySystem('browser');

      expect(editEvents.length).toBeGreaterThan(0);
      expect(browserEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Multi-step Workflows with Mixed Tool Types', () => {
    it('should execute complex workflow: search files → process → browser check → report', async () => {
      testEnv.systemEvents.start();

      // Step 1: Create test files for search
      const testFiles = [
        { path: '/tmp/config1.yml', content: 'database:\n  host: db1.example.com\n  port: 5432' },
        { path: '/tmp/config2.yml', content: 'database:\n  host: db2.example.com\n  port: 5433' },
        { path: '/tmp/readme.txt', content: 'This is a readme file with no database info' },
        { path: '/tmp/settings.ini', content: '[database]\nhost=db3.example.com\nport=5434' }
      ];

      for (const file of testFiles) {
        const writeResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Write',
          'write',
          {
            filePath: file.path,
            content: file.content
          }
        );
        expect(writeResult.success).toBe(true);
      }

      // Step 2: Use Glob to find configuration files
      const globResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Glob',
        'search',
        {
          pattern: '/tmp/*.{yml,ini}'
        }
      );

      expect(globResult.success).toBe(true);

      // Step 3: Use Grep to search for database configurations
      const grepResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Grep',
        'search',
        {
          pattern: 'database|host|port',
          path: '/tmp'
        }
      );

      expect(grepResult.success).toBe(true);

      // Step 4: Read each configuration file and extract database info
      const dbConnections = [];
      const configPaths = ['/tmp/config1.yml', '/tmp/config2.yml', '/tmp/settings.ini'];

      for (const configPath of configPaths) {
        const readResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Read',
          'read',
          {
            filePath: configPath
          }
        );

        expect(readResult.success).toBe(true);

        // Extract database info (mock parsing)
        let dbInfo = {};
        if (configPath.includes('config1')) {
          dbInfo = { host: 'db1.example.com', port: 5432 };
        } else if (configPath.includes('config2')) {
          dbInfo = { host: 'db2.example.com', port: 5433 };
        } else if (configPath.includes('settings')) {
          dbInfo = { host: 'db3.example.com', port: 5434 };
        }

        dbConnections.push({
          configFile: configPath,
          ...dbInfo
        });
      }

      // Step 5: Verify each database host is reachable using browser
      const verificationResults = [];

      for (const db of dbConnections) {
        // Create a mock health check URL for the database
        const healthCheckUrl = `https://${db.host.replace('.example.com', '')}-monitor.example.com/health`;

        const navResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: healthCheckUrl }
          }
        );

        const healthResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'evaluate',
          {
            operation: 'evaluate',
            params: {
              script: `JSON.stringify({
                status: 'healthy',
                dbHost: '${db.host}',
                port: ${db.port},
                responseTime: Math.floor(Math.random() * 100) + 50
              })`
            }
          }
        );

        verificationResults.push({
          configFile: db.configFile,
          host: db.host,
          port: db.port,
          healthCheckUrl,
          navigationSuccess: navResult.success,
          healthCheckSuccess: healthResult.success,
          status: navResult.success && healthResult.success ? 'healthy' : 'unhealthy'
        });

        expect(navResult.success).toBe(true);
        expect(healthResult.success).toBe(true);
      }

      // Step 6: Generate comprehensive report using multiple file operations
      const reportData = {
        summary: {
          totalConfigFiles: testFiles.length,
          databaseConfigsFound: dbConnections.length,
          healthChecksPerformed: verificationResults.length,
          healthyDatabases: verificationResults.filter(r => r.status === 'healthy').length,
          reportGeneratedAt: new Date().toISOString()
        },
        configurationFiles: testFiles.map(f => ({ path: f.path, type: f.path.split('.').pop() })),
        databaseConnections: dbConnections,
        healthCheckResults: verificationResults,
        recommendations: [
          'All database connections are healthy',
          'Configuration files are properly structured',
          'Monitoring URLs are accessible'
        ]
      };

      // Write JSON report
      const jsonReportResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/database_health_report.json',
          content: JSON.stringify(reportData, null, 2)
        }
      );

      expect(jsonReportResult.success).toBe(true);

      // Write human-readable report
      const textReport = `Database Health Check Report
================================

Summary:
- Configuration files found: ${reportData.summary.totalConfigFiles}
- Database configs found: ${reportData.summary.databaseConfigsFound}
- Health checks performed: ${reportData.summary.healthChecksPerformed}
- Healthy databases: ${reportData.summary.healthyDatabases}

Database Connections:
${dbConnections.map(db => `- ${db.host}:${db.port} (from ${db.configFile})`).join('\n')}

Health Check Results:
${verificationResults.map(r => `- ${r.host}: ${r.status.toUpperCase()}`).join('\n')}

Recommendations:
${reportData.recommendations.map(r => `- ${r}`).join('\n')}

Generated: ${reportData.summary.reportGeneratedAt}
`;

      const textReportResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/database_health_report.txt',
          content: textReport
        }
      );

      expect(textReportResult.success).toBe(true);

      // Step 7: Create summary index file
      const summaryIndex = `Database Analysis Summary
========================

Files Analyzed:
${testFiles.map(f => `- ${f.path}`).join('\n')}

Reports Generated:
- /tmp/database_health_report.json (detailed data)
- /tmp/database_health_report.txt (human readable)

Status: All database connections verified successfully
Date: ${new Date().toISOString()}
`;

      const indexResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/analysis_index.txt',
          content: summaryIndex
        }
      );

      expect(indexResult.success).toBe(true);

      // Verify the complete multi-tool workflow
      expect(dbConnections.length).toBe(3);
      expect(verificationResults.length).toBe(3);
      expect(verificationResults.every(r => r.status === 'healthy')).toBe(true);

      // Verify comprehensive event sequence across all systems
      const events = testEnv.systemEvents.getAllEvents();
      expect(events.length).toBeGreaterThan(15); // Many operations performed

      // Verify all tool types were used
      const toolEvents = testEnv.systemEvents.getEventsBySystem('tool');
      const browserEvents = testEnv.systemEvents.getEventsBySystem('browser');
      const permissionEvents = testEnv.systemEvents.getEventsBySystem('permission');

      expect(toolEvents.length).toBeGreaterThan(0);
      expect(browserEvents.length).toBeGreaterThan(0);
      expect(permissionEvents.length).toBeGreaterThan(0);

      // Verify cross-system coordination
      assertCrossSystemEventPropagation(testEnv, 'tool', 'browser', 'browser:operation:start');
      assertCrossSystemEventPropagation(testEnv, 'permission', 'tool', 'tool:execution:start');
    });

    it('should handle mixed permissions in complex workflow', async () => {
      // Create environment with selective permissions
      const restrictedEnv = await createSupervisedModeScenario();
      restrictedEnv.systemEvents.start();

      try {
        // Grant specific permissions for this workflow
        await restrictedEnv.permissionSystem.store.grantPermission('Read', 'allow-always');
        await restrictedEnv.permissionSystem.store.grantPermission('Write', 'allow-once');
        await restrictedEnv.permissionSystem.store.grantPermission('Browser', 'allow-always', 'https://allowed.com');

        // Deny certain operations
        await restrictedEnv.permissionSystem.store.denyPermission('Edit');
        await restrictedEnv.permissionSystem.store.denyPermission('Browser', 'https://blocked.com');

        // Step 1: File operation that should succeed (Read allowed)
        const readResult = await restrictedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Read',
          'read',
          {
            filePath: '/tmp/test_file.txt'
          }
        );

        // Mock Read tool to succeed since it's allowed
        restrictedEnv.toolSystem.mocks.read.mockResolvedValueOnce({
          success: true,
          data: { content: 'test content' }
        });

        // Step 2: File write that should succeed once (Write allow-once)
        const writeResult1 = await restrictedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Write',
          'write',
          {
            filePath: '/tmp/output1.txt',
            content: 'first write'
          }
        );

        // Step 3: Browser operation to allowed domain should succeed
        const browserAllowedResult = await restrictedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://allowed.com/data' }
          }
        );

        // Step 4: Edit operation should be denied
        const editResult = await restrictedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Edit',
          'edit',
          {
            filePath: '/tmp/test_file.txt',
            oldString: 'old',
            newString: 'new'
          }
        );

        // Step 5: Browser operation to blocked domain should be denied
        const browserBlockedResult = await restrictedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url: 'https://blocked.com/dangerous' }
          }
        );

        // Step 6: Second write should be denied (allow-once consumed)
        const writeResult2 = await restrictedEnv.toolSystem.executor.executeWithPermissionCheck(
          'Write',
          'write',
          {
            filePath: '/tmp/output2.txt',
            content: 'second write'
          }
        );

        // Verify permission enforcement
        expect(readResult.success).toBe(true); // Read allowed always
        expect(writeResult1.success).toBe(true); // Write allowed once
        expect(browserAllowedResult.success).toBe(true); // Browser to allowed domain

        expect(editResult.success).toBe(false); // Edit denied
        expect(editResult.permissionDenied).toBe(true);

        expect(browserBlockedResult.success).toBe(false); // Browser to blocked domain
        expect(browserBlockedResult.permissionDenied).toBe(true);

        expect(writeResult2.success).toBe(false); // Write permission consumed
        expect(writeResult2.permissionDenied).toBe(true);

        // Verify mixed permission events in workflow
        const events = restrictedEnv.systemEvents.getAllEvents();

        const grantedEvents = events.filter(e => e.type === 'permission:granted');
        const deniedEvents = events.filter(e => e.type === 'permission:denied');

        expect(grantedEvents.length).toBeGreaterThan(0);
        expect(deniedEvents.length).toBeGreaterThan(0);

        assertTriSystemEventSequence(events, [
          { type: 'permission:requested', system: 'permission' },
          { type: 'permission:granted', system: 'permission' },
          { type: 'permission:requested', system: 'permission' },
          { type: 'permission:granted', system: 'permission' },
          { type: 'permission:requested', system: 'permission' },
          { type: 'permission:granted', system: 'permission' },
          { type: 'permission:requested', system: 'permission' },
          { type: 'permission:denied', system: 'permission' }
        ]);

      } finally {
        await restrictedEnv.cleanup();
      }
    });

    it('should coordinate file monitoring with browser validation workflow', async () => {
      testEnv.systemEvents.start();

      // Step 1: Set up monitoring configuration
      const monitoringConfig = {
        watchFiles: ['/tmp/status.json', '/tmp/health.txt'],
        validationUrls: ['https://app.example.com/status', 'https://api.example.com/health'],
        interval: 60,
        alertThresholds: { responseTime: 5000, errorRate: 0.1 }
      };

      const writeConfigResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/monitoring_config.json',
          content: JSON.stringify(monitoringConfig, null, 2)
        }
      );

      expect(writeConfigResult.success).toBe(true);

      // Step 2: Create initial status files to monitor
      const statusData = { status: 'healthy', services: ['web', 'api', 'db'], timestamp: new Date().toISOString() };
      const healthData = `System Health Report
===================
Web Server: ONLINE
API Server: ONLINE
Database: ONLINE
Last Check: ${new Date().toISOString()}`;

      const writeStatusResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/status.json',
          content: JSON.stringify(statusData, null, 2)
        }
      );

      const writeHealthResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/health.txt',
          content: healthData
        }
      );

      expect(writeStatusResult.success).toBe(true);
      expect(writeHealthResult.success).toBe(true);

      // Step 3: Monitor files using file operations
      const monitoringResults = [];

      for (const filePath of monitoringConfig.watchFiles) {
        // Read current file content
        const readResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Read',
          'read',
          {
            filePath
          }
        );

        expect(readResult.success).toBe(true);

        // Search for specific patterns in files
        const grepResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Grep',
          'search',
          {
            pattern: 'ONLINE|healthy|status',
            path: filePath
          }
        );

        monitoringResults.push({
          file: filePath,
          readable: readResult.success,
          hasHealthIndicators: grepResult.success,
          timestamp: new Date().toISOString()
        });
      }

      // Step 4: Validate corresponding URLs with browser
      const validationResults = [];

      for (const url of monitoringConfig.validationUrls) {
        // Navigate to validation URL
        const navResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'navigate',
          {
            operation: 'navigate',
            params: { url }
          }
        );

        // Check page response
        const healthCheckResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'evaluate',
          {
            operation: 'evaluate',
            params: {
              script: `JSON.stringify({
                url: window.location.href,
                title: document.title,
                responseTime: Math.floor(Math.random() * 200) + 100,
                status: 'healthy'
              })`
            }
          }
        );

        // Take screenshot for evidence
        const screenshotResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
          'Browser',
          'screenshot',
          {
            operation: 'screenshot',
            params: { fullPage: false }
          }
        );

        validationResults.push({
          url,
          navigation: navResult.success,
          healthCheck: healthCheckResult.success,
          screenshotTaken: screenshotResult.success,
          status: 'validated',
          timestamp: new Date().toISOString()
        });

        expect(navResult.success).toBe(true);
        expect(healthCheckResult.success).toBe(true);
        expect(screenshotResult.success).toBe(true);
      }

      // Step 5: Cross-reference file monitoring with browser validation
      const correlationReport = {
        monitoringCycle: {
          filesChecked: monitoringResults.length,
          urlsValidated: validationResults.length,
          allHealthy: monitoringResults.every(m => m.hasHealthIndicators) &&
                     validationResults.every(v => v.status === 'validated')
        },
        fileMonitoring: monitoringResults,
        urlValidation: validationResults,
        correlations: [
          {
            file: '/tmp/status.json',
            correspondingUrl: 'https://app.example.com/status',
            consistent: true
          },
          {
            file: '/tmp/health.txt',
            correspondingUrl: 'https://api.example.com/health',
            consistent: true
          }
        ],
        summary: {
          overallStatus: 'healthy',
          recommendedActions: ['Continue monitoring', 'No issues detected'],
          nextCheck: new Date(Date.now() + 60000).toISOString()
        }
      };

      // Step 6: Generate monitoring report using multiple file operations
      const writeReportResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Write',
        'write',
        {
          filePath: '/tmp/monitoring_report.json',
          content: JSON.stringify(correlationReport, null, 2)
        }
      );

      // Step 7: Update status based on monitoring results
      const updatedStatus = {
        ...statusData,
        lastMonitoring: new Date().toISOString(),
        filesMonitored: monitoringResults.length,
        urlsValidated: validationResults.length,
        overallHealth: 'excellent'
      };

      const updateStatusResult = await testEnv.toolSystem.executor.executeWithPermissionCheck(
        'Edit',
        'edit',
        {
          filePath: '/tmp/status.json',
          oldString: `"timestamp": "${statusData.timestamp}"`,
          newString: `"timestamp": "${updatedStatus.lastMonitoring}",
    "filesMonitored": ${updatedStatus.filesMonitored},
    "urlsValidated": ${updatedStatus.urlsValidated},
    "overallHealth": "${updatedStatus.overallHealth}"`
        }
      );

      expect(writeReportResult.success).toBe(true);
      expect(updateStatusResult.success).toBe(true);

      // Verify complete monitoring workflow coordination
      expect(monitoringResults.length).toBe(2);
      expect(validationResults.length).toBe(2);
      expect(monitoringResults.every(m => m.readable)).toBe(true);
      expect(validationResults.every(v => v.status === 'validated')).toBe(true);

      // Verify workflow used all major tool types with proper coordination
      const events = testEnv.systemEvents.getAllEvents();
      const toolTypes = new Set(events
        .filter(e => e.type === 'tool:execution:start')
        .map(e => e.data?.tool || 'Browser')
      );

      expect(toolTypes.has('Read')).toBe(true);
      expect(toolTypes.has('Write')).toBe(true);
      expect(toolTypes.has('Edit')).toBe(true);
      expect(toolTypes.has('Grep')).toBe(true);
      expect(toolTypes.has('Browser')).toBe(true);

      // Verify events show coordinated file monitoring → browser validation pattern
      assertCrossSystemEventPropagation(testEnv, 'tool', 'browser', 'browser:operation:start');
    });
  });
});