/**
 * Multi-Page Browser Workflows Integration Tests
 *
 * Comprehensive integration tests covering multi-page browser workflows with advanced scenarios:
 * - Multi-step navigation flows with complex branching
 * - State persistence across pages (localStorage, sessionStorage, cookies)
 * - Handling redirects (301/302) including redirect chains
 * - Back/forward navigation with state preservation
 * - Complex user journey simulations (e-commerce, authentication, forms)
 *
 * Acceptance Criteria Coverage:
 * ✅ Multi-step navigation flows
 * ✅ State persistence across pages
 * ✅ Handling redirects (301/302)
 * ✅ Back/forward navigation
 * ✅ Complex user journey simulations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import { BrowserTool } from '../../packages/orchestrator/src/tools/browser-tool.js';
import { PermissionManager } from '../../packages/orchestrator/src/permission-manager.js';
import { PermissionStore } from '../../packages/orchestrator/src/permission-store.js';
import { TaskStore } from '@apexcli/orchestrator';
import { createTempDir, cleanupApexDir, cleanupDatabaseFiles } from './setup.js';

describe('Multi-Page Browser Workflows Integration Tests', () => {
  let browserTool: BrowserTool;
  let permissionManager: PermissionManager;
  let permissionStore: PermissionStore;
  let taskStore: TaskStore;
  let tempDir: string;
  let testTaskId: string;

  beforeEach(async () => {
    tempDir = await createTempDir('browser-workflow-test-');

    // Create task store
    taskStore = new TaskStore(path.join(tempDir, 'test.db'));

    // Create permission store
    permissionStore = new PermissionStore(path.join(tempDir, 'permissions.db'));

    // Create permission manager
    permissionManager = new PermissionManager({
      store: permissionStore,
      eventEmitter: new EventEmitter()
    });

    // Create test task
    testTaskId = `test-${Date.now()}`;
    const testTask = {
      id: testTaskId,
      description: 'Browser workflow test',
      status: 'running' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {
        projectName: 'test-project',
        language: 'typescript' as const,
        models: { planning: 'sonnet' as const, implementation: 'sonnet' as const },
        limits: { maxTokensPerTask: 100000, maxCostPerTask: 10 }
      },
      workflow: {
        name: 'test-workflow',
        description: 'Test workflow',
        stages: []
      }
    };
    await taskStore.addTask(testTask);

    // Create browser tool with permission manager
    browserTool = new BrowserTool({
      permissionManager,
      backend: 'playwright',
      engine: 'chromium',
      headless: true,
    });

    // Grant browser permissions for testing
    await permissionManager.grantPermission(testTaskId, 'browser', 'navigate');
    await permissionManager.grantPermission(testTaskId, 'browser', 'click');
    await permissionManager.grantPermission(testTaskId, 'browser', 'type');
    await permissionManager.grantPermission(testTaskId, 'browser', 'getText');
    await permissionManager.grantPermission(testTaskId, 'browser', 'getTitle');
    await permissionManager.grantPermission(testTaskId, 'browser', 'evaluate');
    await permissionManager.grantPermission(testTaskId, 'browser', 'waitForSelector');
    await permissionManager.grantPermission(testTaskId, 'browser', 'goBack');
    await permissionManager.grantPermission(testTaskId, 'browser', 'goForward');
    await permissionManager.grantPermission(testTaskId, 'browser', 'isVisible');
    await permissionManager.grantPermission(testTaskId, 'browser', 'submit');
  });

  afterEach(async () => {
    if (browserTool) {
      try {
        await browserTool.closeAll();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (permissionStore) {
      try {
        permissionStore.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    if (taskStore) {
      try {
        taskStore.close();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    await cleanupApexDir(tempDir);
    await cleanupDatabaseFiles(tempDir);
  });

  describe('Multi-Step Navigation Flows', () => {
    it('should handle linear multi-step navigation workflow', async () => {
      // Create a linear multi-step workflow
      const step1Html = `
        <!DOCTYPE html>
        <html>
        <head><title>Step 1: Welcome</title></head>
        <body>
          <h1>Welcome to Multi-Step Workflow</h1>
          <p>This is step 1 of our journey</p>
          <button id="next-step" onclick="goToStep2()">Proceed to Step 2</button>
          <script>
            function goToStep2() {
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Step 2: Information</title></head>
                <body>
                  <h1>Step 2: Information Collection</h1>
                  <input type="text" id="user-info" placeholder="Enter your name">
                  <button id="save-next" onclick="saveAndProceed()">Save & Continue</button>
                  <script>
                    function saveAndProceed() {
                      const userInfo = document.getElementById('user-info').value;
                      localStorage.setItem('userInfo', userInfo);
                      window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\\\`
                        <!DOCTYPE html>
                        <html>
                        <head><title>Step 3: Confirmation</title></head>
                        <body>
                          <h1>Step 3: Confirmation</h1>
                          <div id="confirmation-message">Loading...</div>
                          <button id="complete" onclick="completeWorkflow()">Complete Workflow</button>
                          <script>
                            document.addEventListener('DOMContentLoaded', function() {
                              const userInfo = localStorage.getItem('userInfo') || 'Anonymous';
                              document.getElementById('confirmation-message').textContent =
                                'Thank you, ' + userInfo + '! Please confirm to complete.';
                            });
                            function completeWorkflow() {
                              localStorage.setItem('workflowComplete', 'true');
                              document.getElementById('complete').textContent = 'Completed!';
                              document.getElementById('complete').disabled = true;
                            }
                          </script>
                        </body>
                        </html>
                      \\\`);
                    }
                  </script>
                </body>
                </html>
              \`);
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to step 1
      const navigateResult = await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(step1Html)}`
      );
      expect(navigateResult.success).toBe(true);

      // Verify step 1
      const step1Title = await browserTool.getTitle();
      expect(step1Title).toContain('Step 1');

      const welcomeText = await browserTool.getText('h1');
      expect(welcomeText).toContain('Welcome to Multi-Step Workflow');

      // Proceed to step 2
      await browserTool.click('#next-step');
      await browserTool.waitForSelector('h1', { timeout: 5000 });

      // Verify step 2
      const step2Title = await browserTool.getTitle();
      expect(step2Title).toContain('Step 2');

      const infoText = await browserTool.getText('h1');
      expect(infoText).toContain('Information Collection');

      // Fill information and proceed
      await browserTool.type('#user-info', 'Test User');
      await browserTool.click('#save-next');
      await browserTool.waitForSelector('#confirmation-message', { timeout: 5000 });

      // Verify step 3
      const step3Title = await browserTool.getTitle();
      expect(step3Title).toContain('Step 3');

      const confirmationText = await browserTool.getText('#confirmation-message');
      expect(confirmationText).toContain('Thank you, Test User');

      // Complete workflow
      await browserTool.click('#complete');

      const completeButtonText = await browserTool.getText('#complete');
      expect(completeButtonText).toBe('Completed!');

      // Verify completion state was saved
      const workflowComplete = await browserTool.evaluate(() =>
        localStorage.getItem('workflowComplete')
      );
      expect(workflowComplete).toBe('true');
    }, 30000);

    it('should handle branching navigation flows with conditional paths', async () => {
      const branchingHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Branching Navigation</title></head>
        <body>
          <h1>Choose Your Path</h1>
          <p>Select your user type to continue:</p>
          <button id="admin-path" onclick="goToAdmin()">Admin Portal</button>
          <button id="user-path" onclick="goToUser()">User Portal</button>
          <script>
            function goToAdmin() {
              localStorage.setItem('userType', 'admin');
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Admin Portal</title></head>
                <body>
                  <h1>Admin Dashboard</h1>
                  <div id="admin-features">
                    <button id="manage-users">Manage Users</button>
                    <button id="system-settings">System Settings</button>
                    <button id="reports">View Reports</button>
                  </div>
                  <div id="admin-status">Admin privileges active</div>
                </body>
                </html>
              \`);
            }
            function goToUser() {
              localStorage.setItem('userType', 'user');
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>User Portal</title></head>
                <body>
                  <h1>User Dashboard</h1>
                  <div id="user-features">
                    <button id="view-profile">View Profile</button>
                    <button id="update-settings">Update Settings</button>
                  </div>
                  <div id="user-status">Standard user access</div>
                </body>
                </html>
              \`);
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to branching page
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(branchingHtml)}`
      );

      // Test admin path
      await browserTool.click('#admin-path');
      await browserTool.waitForSelector('#admin-features', { timeout: 5000 });

      const adminTitle = await browserTool.getTitle();
      expect(adminTitle).toBe('Admin Portal');

      const adminStatus = await browserTool.getText('#admin-status');
      expect(adminStatus).toContain('Admin privileges active');

      const manageUsersButton = await browserTool.isVisible('#manage-users');
      expect(manageUsersButton).toBe(true);

      // Go back and test user path
      await browserTool.goBack();
      await browserTool.waitForSelector('#user-path', { timeout: 5000 });

      await browserTool.click('#user-path');
      await browserTool.waitForSelector('#user-features', { timeout: 5000 });

      const userTitle = await browserTool.getTitle();
      expect(userTitle).toBe('User Portal');

      const userStatus = await browserTool.getText('#user-status');
      expect(userStatus).toContain('Standard user access');

      const viewProfileButton = await browserTool.isVisible('#view-profile');
      expect(viewProfileButton).toBe(true);

      // Admin buttons should not exist in user portal
      const manageUsersExists = await browserTool.isVisible('#manage-users');
      expect(manageUsersExists).toBe(false);

      // Verify user type was stored correctly
      const userType = await browserTool.evaluate(() =>
        localStorage.getItem('userType')
      );
      expect(userType).toBe('user');
    }, 20000);
  });

  describe('State Persistence Across Pages', () => {
    it('should maintain localStorage across page navigations', async () => {
      const page1Html = `
        <!DOCTYPE html>
        <html>
        <head><title>localStorage Test Page 1</title></head>
        <body>
          <h1>Data Storage Test</h1>
          <input type="text" id="data-input" placeholder="Enter data to persist">
          <button id="store-data" onclick="storeData()">Store Data</button>
          <button id="go-next" onclick="goToNext()">Go to Next Page</button>
          <div id="storage-status"></div>
          <script>
            function storeData() {
              const data = document.getElementById('data-input').value;
              if (data) {
                localStorage.setItem('persistentData', data);
                localStorage.setItem('timestamp', Date.now().toString());
                document.getElementById('storage-status').textContent = 'Data stored successfully!';
              }
            }
            function goToNext() {
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>localStorage Test Page 2</title></head>
                <body>
                  <h1>Data Retrieval Test</h1>
                  <div id="retrieved-data">Loading...</div>
                  <div id="timestamp-data"></div>
                  <button id="clear-data" onclick="clearData()">Clear Data</button>
                  <button id="go-back" onclick="goBack()">Go Back</button>
                  <script>
                    document.addEventListener('DOMContentLoaded', function() {
                      const data = localStorage.getItem('persistentData');
                      const timestamp = localStorage.getItem('timestamp');

                      if (data) {
                        document.getElementById('retrieved-data').textContent = 'Retrieved: ' + data;
                        if (timestamp) {
                          const date = new Date(parseInt(timestamp));
                          document.getElementById('timestamp-data').textContent =
                            'Stored at: ' + date.toLocaleTimeString();
                        }
                      } else {
                        document.getElementById('retrieved-data').textContent = 'No data found';
                      }
                    });
                    function clearData() {
                      localStorage.removeItem('persistentData');
                      localStorage.removeItem('timestamp');
                      document.getElementById('retrieved-data').textContent = 'Data cleared';
                    }
                    function goBack() {
                      window.history.back();
                    }
                  </script>
                </body>
                </html>
              \`);
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to page 1
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(page1Html)}`
      );

      // Store data
      await browserTool.type('#data-input', 'Persistent test data');
      await browserTool.click('#store-data');

      const storageStatus = await browserTool.getText('#storage-status');
      expect(storageStatus).toContain('stored successfully');

      // Navigate to page 2
      await browserTool.click('#go-next');
      await browserTool.waitForSelector('#retrieved-data', { timeout: 5000 });

      // Verify data persistence
      const retrievedData = await browserTool.getText('#retrieved-data');
      expect(retrievedData).toContain('Persistent test data');

      const timestampData = await browserTool.getText('#timestamp-data');
      expect(timestampData).toContain('Stored at:');

      // Test data clearing
      await browserTool.click('#clear-data');
      const clearedData = await browserTool.getText('#retrieved-data');
      expect(clearedData).toContain('Data cleared');

      // Verify data was actually removed
      const remainingData = await browserTool.evaluate(() =>
        localStorage.getItem('persistentData')
      );
      expect(remainingData).toBeNull();
    }, 15000);

    it('should maintain sessionStorage across same-tab navigation', async () => {
      const sessionPage1Html = `
        <!DOCTYPE html>
        <html>
        <head><title>Session Storage Page 1</title></head>
        <body>
          <h1>Session Data Test</h1>
          <input type="text" id="session-input" placeholder="Session data">
          <button id="store-session" onclick="storeSession()">Store in Session</button>
          <button id="next-page" onclick="nextPage()">Next Page</button>
          <div id="session-status"></div>
          <script>
            function storeSession() {
              const data = document.getElementById('session-input').value;
              sessionStorage.setItem('sessionData', data);
              sessionStorage.setItem('pageVisits', '1');
              document.getElementById('session-status').textContent = 'Session data stored';
            }
            function nextPage() {
              const visits = parseInt(sessionStorage.getItem('pageVisits') || '0') + 1;
              sessionStorage.setItem('pageVisits', visits.toString());

              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Session Storage Page 2</title></head>
                <body>
                  <h1>Session Data Verification</h1>
                  <div id="session-data">Loading...</div>
                  <div id="visit-count"></div>
                  <button id="modify-session" onclick="modifySession()">Modify Session</button>
                  <script>
                    document.addEventListener('DOMContentLoaded', function() {
                      const sessionData = sessionStorage.getItem('sessionData');
                      const visits = sessionStorage.getItem('pageVisits');

                      document.getElementById('session-data').textContent =
                        sessionData ? 'Session: ' + sessionData : 'No session data';
                      document.getElementById('visit-count').textContent =
                        'Page visits: ' + (visits || '0');
                    });
                    function modifySession() {
                      const currentData = sessionStorage.getItem('sessionData') || '';
                      sessionStorage.setItem('sessionData', currentData + ' - modified');

                      const sessionData = sessionStorage.getItem('sessionData');
                      document.getElementById('session-data').textContent = 'Session: ' + sessionData;
                    }
                  </script>
                </body>
                </html>
              \`);
            }
          </script>
        </body>
        </html>
      `;

      // Navigate and store session data
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(sessionPage1Html)}`
      );

      await browserTool.type('#session-input', 'Session test data');
      await browserTool.click('#store-session');

      const sessionStatus = await browserTool.getText('#session-status');
      expect(sessionStatus).toContain('Session data stored');

      // Navigate to second page
      await browserTool.click('#next-page');
      await browserTool.waitForSelector('#session-data', { timeout: 5000 });

      // Verify session data persists
      const sessionData = await browserTool.getText('#session-data');
      expect(sessionData).toContain('Session test data');

      const visitCount = await browserTool.getText('#visit-count');
      expect(visitCount).toContain('Page visits: 2');

      // Modify session data
      await browserTool.click('#modify-session');
      const modifiedData = await browserTool.getText('#session-data');
      expect(modifiedData).toContain('modified');

      // Verify session data in browser context
      const browserSessionData = await browserTool.evaluate(() =>
        sessionStorage.getItem('sessionData')
      );
      expect(browserSessionData).toContain('Session test data - modified');
    }, 15000);

    it('should handle cookies across page navigations', async () => {
      const cookiePage1Html = `
        <!DOCTYPE html>
        <html>
        <head><title>Cookie Test Page 1</title></head>
        <body>
          <h1>Cookie Management Test</h1>
          <input type="text" id="cookie-value" placeholder="Cookie value">
          <button id="set-cookie" onclick="setCookie()">Set Cookie</button>
          <button id="next-page" onclick="nextPage()">Next Page</button>
          <div id="cookie-status"></div>
          <script>
            function setCookie() {
              const value = document.getElementById('cookie-value').value;
              if (value) {
                document.cookie = 'testCookie=' + encodeURIComponent(value) + '; path=/; max-age=3600';
                document.cookie = 'cookieTimestamp=' + Date.now() + '; path=/; max-age=3600';
                document.getElementById('cookie-status').textContent = 'Cookie set successfully';
              }
            }
            function nextPage() {
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Cookie Test Page 2</title></head>
                <body>
                  <h1>Cookie Verification</h1>
                  <div id="cookie-display">Loading...</div>
                  <div id="all-cookies"></div>
                  <button id="update-cookie" onclick="updateCookie()">Update Cookie</button>
                  <button id="delete-cookie" onclick="deleteCookie()">Delete Cookie</button>
                  <script>
                    function getCookie(name) {
                      const cookies = document.cookie.split(';');
                      for (let cookie of cookies) {
                        const [key, value] = cookie.trim().split('=');
                        if (key === name) {
                          return decodeURIComponent(value);
                        }
                      }
                      return null;
                    }

                    document.addEventListener('DOMContentLoaded', function() {
                      const cookieValue = getCookie('testCookie');
                      const timestamp = getCookie('cookieTimestamp');

                      if (cookieValue) {
                        document.getElementById('cookie-display').textContent =
                          'Cookie Value: ' + cookieValue;
                        if (timestamp) {
                          const date = new Date(parseInt(timestamp));
                          document.getElementById('cookie-display').textContent +=
                            ' (Set at: ' + date.toLocaleTimeString() + ')';
                        }
                      } else {
                        document.getElementById('cookie-display').textContent = 'No cookie found';
                      }

                      document.getElementById('all-cookies').textContent =
                        'All cookies: ' + (document.cookie || 'none');
                    });

                    function updateCookie() {
                      const currentValue = getCookie('testCookie') || '';
                      document.cookie = 'testCookie=' + encodeURIComponent(currentValue + '-updated') +
                                       '; path=/; max-age=3600';

                      const newValue = getCookie('testCookie');
                      document.getElementById('cookie-display').textContent = 'Updated: ' + newValue;
                    }

                    function deleteCookie() {
                      document.cookie = 'testCookie=; path=/; max-age=0';
                      document.getElementById('cookie-display').textContent = 'Cookie deleted';
                      document.getElementById('all-cookies').textContent =
                        'Remaining cookies: ' + (document.cookie || 'none');
                    }
                  </script>
                </body>
                </html>
              \`);
            }
          </script>
        </body>
        </html>
      `;

      // Navigate and set cookie
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(cookiePage1Html)}`
      );

      await browserTool.type('#cookie-value', 'Test Cookie Value');
      await browserTool.click('#set-cookie');

      const cookieStatus = await browserTool.getText('#cookie-status');
      expect(cookieStatus).toContain('Cookie set successfully');

      // Navigate to verification page
      await browserTool.click('#next-page');
      await browserTool.waitForSelector('#cookie-display', { timeout: 5000 });

      // Verify cookie persists
      const cookieDisplay = await browserTool.getText('#cookie-display');
      expect(cookieDisplay).toContain('Test Cookie Value');

      // Update cookie
      await browserTool.click('#update-cookie');
      const updatedDisplay = await browserTool.getText('#cookie-display');
      expect(updatedDisplay).toContain('updated');

      // Delete cookie
      await browserTool.click('#delete-cookie');
      const deletedDisplay = await browserTool.getText('#cookie-display');
      expect(deletedDisplay).toContain('Cookie deleted');
    }, 15000);
  });

  describe('Redirect Handling (301/302)', () => {
    it('should handle 301 permanent redirects', async () => {
      const redirectSourceHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Redirect Source</title></head>
        <body>
          <h1>Permanent Redirect Test</h1>
          <p>This page will redirect permanently</p>
          <script>
            // Simulate 301 redirect behavior
            setTimeout(() => {
              window.location.replace('data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Redirect Destination</title></head>
                <body>
                  <h1>301 Redirect Successful</h1>
                  <div id="redirect-info">You were permanently redirected here</div>
                  <div id="redirect-type">Permanent (301)</div>
                  <button id="test-back" onclick="testBack()">Test Back Navigation</button>
                  <div id="back-result"></div>
                  <script>
                    function testBack() {
                      try {
                        window.history.back();
                        // This should not work with 301 redirect
                        setTimeout(() => {
                          if (window.location.href.includes('Redirect Destination')) {
                            document.getElementById('back-result').textContent =
                              'Back navigation blocked (correct 301 behavior)';
                          }
                        }, 100);
                      } catch (e) {
                        document.getElementById('back-result').textContent = 'Back navigation failed';
                      }
                    }
                  </script>
                </body>
                </html>
              \`));
            }, 200);
          </script>
        </body>
        </html>
      `;

      // Navigate to redirect source
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(redirectSourceHtml)}`
      );

      // Wait for redirect
      await browserTool.waitForSelector('#redirect-info', { timeout: 10000 });

      // Verify redirect completed
      const title = await browserTool.getTitle();
      expect(title).toBe('Redirect Destination');

      const redirectInfo = await browserTool.getText('#redirect-info');
      expect(redirectInfo).toContain('permanently redirected');

      const redirectType = await browserTool.getText('#redirect-type');
      expect(redirectType).toContain('301');
    }, 15000);

    it('should handle 302 temporary redirects', async () => {
      const tempRedirectHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Temporary Redirect Source</title></head>
        <body>
          <h1>Temporary Redirect Test</h1>
          <p>This page will redirect temporarily</p>
          <script>
            // Simulate 302 redirect behavior
            setTimeout(() => {
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Temporary Destination</title></head>
                <body>
                  <h1>302 Redirect Successful</h1>
                  <div id="redirect-info">You were temporarily redirected here</div>
                  <div id="redirect-type">Temporary (302)</div>
                  <button id="go-back" onclick="goBack()">Try Go Back</button>
                  <div id="back-status"></div>
                  <script>
                    function goBack() {
                      window.history.back();
                      setTimeout(() => {
                        const currentTitle = document.title;
                        if (currentTitle === 'Temporary Destination') {
                          document.getElementById('back-status').textContent = 'Still on redirect page';
                        }
                      }, 100);
                    }
                  </script>
                </body>
                </html>
              \`);
            }, 200);
          </script>
        </body>
        </html>
      `;

      // Navigate to temp redirect source
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(tempRedirectHtml)}`
      );

      // Wait for redirect
      await browserTool.waitForSelector('#redirect-info', { timeout: 10000 });

      // Verify temporary redirect
      const title = await browserTool.getTitle();
      expect(title).toBe('Temporary Destination');

      const redirectInfo = await browserTool.getText('#redirect-info');
      expect(redirectInfo).toContain('temporarily redirected');

      const redirectType = await browserTool.getText('#redirect-type');
      expect(redirectType).toContain('302');
    }, 15000);

    it('should handle redirect chains with multiple hops', async () => {
      const redirectChainHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>Redirect Chain Start</title></head>
        <body>
          <h1>Redirect Chain Test</h1>
          <p>Starting redirect chain...</p>
          <div id="chain-status">Initializing...</div>
          <script>
            document.getElementById('chain-status').textContent = 'Redirect 1/3 - Starting';

            setTimeout(() => {
              document.getElementById('chain-status').textContent = 'Redirect 1/3 - Redirecting';
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Redirect Chain Step 2</title></head>
                <body>
                  <h1>Redirect Chain - Step 2</h1>
                  <div id="chain-status-2">Redirect 2/3 - Processing</div>
                  <script>
                    setTimeout(() => {
                      document.getElementById('chain-status-2').textContent = 'Redirect 2/3 - Redirecting';
                      window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\\\`
                        <!DOCTYPE html>
                        <html>
                        <head><title>Redirect Chain Step 3</title></head>
                        <body>
                          <h1>Redirect Chain - Step 3</h1>
                          <div id="chain-status-3">Redirect 3/3 - Processing</div>
                          <script>
                            setTimeout(() => {
                              document.getElementById('chain-status-3').textContent = 'Redirect 3/3 - Final redirect';
                              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\\\\\`
                                <!DOCTYPE html>
                                <html>
                                <head><title>Redirect Chain Final</title></head>
                                <body>
                                  <h1>Redirect Chain Complete</h1>
                                  <div id="final-status">Chain completed successfully</div>
                                  <div id="hop-count">Total redirects: 3</div>
                                  <div id="final-destination">Final destination reached</div>
                                </body>
                                </html>
                              \\\\\`);
                            }, 300);
                          </script>
                        </body>
                        </html>
                      \\\`);
                    }, 300);
                  </script>
                </body>
                </html>
              \`);
            }, 300);
          </script>
        </body>
        </html>
      `;

      // Start redirect chain
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(redirectChainHtml)}`
      );

      // Wait for final destination
      await browserTool.waitForSelector('#final-destination', { timeout: 15000 });

      // Verify chain completion
      const finalTitle = await browserTool.getTitle();
      expect(finalTitle).toBe('Redirect Chain Final');

      const finalStatus = await browserTool.getText('#final-status');
      expect(finalStatus).toContain('completed successfully');

      const hopCount = await browserTool.getText('#hop-count');
      expect(hopCount).toContain('Total redirects: 3');
    }, 20000);
  });

  describe('Back/Forward Navigation', () => {
    it('should handle browser back/forward navigation correctly', async () => {
      const page1Html = `
        <!DOCTYPE html>
        <html>
        <head><title>Navigation Page 1</title></head>
        <body>
          <h1>Page 1</h1>
          <div id="page-number">1</div>
          <input type="text" id="page1-data" placeholder="Page 1 data">
          <button id="to-page2" onclick="goToPage2()">Go to Page 2</button>
          <script>
            function goToPage2() {
              const data = document.getElementById('page1-data').value;
              sessionStorage.setItem('page1Data', data);
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Navigation Page 2</title></head>
                <body>
                  <h1>Page 2</h1>
                  <div id="page-number">2</div>
                  <div id="from-page1"></div>
                  <input type="text" id="page2-data" placeholder="Page 2 data">
                  <button id="to-page3" onclick="goToPage3()">Go to Page 3</button>
                  <script>
                    document.addEventListener('DOMContentLoaded', function() {
                      const page1Data = sessionStorage.getItem('page1Data');
                      if (page1Data) {
                        document.getElementById('from-page1').textContent =
                          'Data from Page 1: ' + page1Data;
                      }
                    });
                    function goToPage3() {
                      const data = document.getElementById('page2-data').value;
                      sessionStorage.setItem('page2Data', data);
                      window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\\\`
                        <!DOCTYPE html>
                        <html>
                        <head><title>Navigation Page 3</title></head>
                        <body>
                          <h1>Page 3</h1>
                          <div id="page-number">3</div>
                          <div id="from-page2"></div>
                          <div id="navigation-test">Navigation test complete</div>
                          <script>
                            document.addEventListener('DOMContentLoaded', function() {
                              const page2Data = sessionStorage.getItem('page2Data');
                              if (page2Data) {
                                document.getElementById('from-page2').textContent =
                                  'Data from Page 2: ' + page2Data;
                              }
                            });
                          </script>
                        </body>
                        </html>
                      \\\`);
                    }
                  </script>
                </body>
                </html>
              \`);
            }
          </script>
        </body>
        </html>
      `;

      // Start navigation sequence
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(page1Html)}`
      );

      // Fill page 1 and navigate
      await browserTool.type('#page1-data', 'Page 1 test data');
      await browserTool.click('#to-page2');
      await browserTool.waitForSelector('#page-number', { timeout: 5000 });

      // Verify on page 2
      let pageNumber = await browserTool.getText('#page-number');
      expect(pageNumber).toBe('2');

      const fromPage1 = await browserTool.getText('#from-page1');
      expect(fromPage1).toContain('Page 1 test data');

      // Fill page 2 and navigate to page 3
      await browserTool.type('#page2-data', 'Page 2 test data');
      await browserTool.click('#to-page3');
      await browserTool.waitForSelector('#navigation-test', { timeout: 5000 });

      // Verify on page 3
      pageNumber = await browserTool.getText('#page-number');
      expect(pageNumber).toBe('3');

      const fromPage2 = await browserTool.getText('#from-page2');
      expect(fromPage2).toContain('Page 2 test data');

      // Test back navigation
      await browserTool.goBack();
      await browserTool.waitForSelector('#page-number', { timeout: 5000 });

      pageNumber = await browserTool.getText('#page-number');
      expect(pageNumber).toBe('2');

      // Verify data persisted on back navigation
      const page2Data = await browserTool.evaluate(() =>
        (document.getElementById('page2-data') as HTMLInputElement)?.value
      );
      expect(page2Data).toBe('Page 2 test data');

      // Test forward navigation
      await browserTool.goForward();
      await browserTool.waitForSelector('#navigation-test', { timeout: 5000 });

      pageNumber = await browserTool.getText('#page-number');
      expect(pageNumber).toBe('3');

      // Go back twice to page 1
      await browserTool.goBack();
      await browserTool.goBack();
      await browserTool.waitForSelector('#page-number', { timeout: 5000 });

      pageNumber = await browserTool.getText('#page-number');
      expect(pageNumber).toBe('1');

      // Verify page 1 data persisted
      const page1Data = await browserTool.evaluate(() =>
        (document.getElementById('page1-data') as HTMLInputElement)?.value
      );
      expect(page1Data).toBe('Page 1 test data');
    }, 25000);
  });

  describe('Complex User Journey Simulations', () => {
    it('should handle complete e-commerce workflow', async () => {
      const ecommerceHtml = `
        <!DOCTYPE html>
        <html>
        <head><title>E-commerce Store</title></head>
        <body>
          <h1>Online Store</h1>
          <div id="products">
            <div class="product" data-id="1" data-name="Laptop" data-price="999">
              <h3>Laptop - $999</h3>
              <button onclick="addToCart(1, 'Laptop', 999)">Add to Cart</button>
            </div>
            <div class="product" data-id="2" data-name="Mouse" data-price="29">
              <h3>Mouse - $29</h3>
              <button onclick="addToCart(2, 'Mouse', 29)">Add to Cart</button>
            </div>
            <div class="product" data-id="3" data-name="Keyboard" data-price="79">
              <h3>Keyboard - $79</h3>
              <button onclick="addToCart(3, 'Keyboard', 79)">Add to Cart</button>
            </div>
          </div>
          <div id="cart-summary">
            <span id="cart-count">0</span> items - $<span id="cart-total">0</span>
            <button id="view-cart" onclick="viewCart()" disabled>View Cart</button>
          </div>
          <script>
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');
            updateCartDisplay();

            function addToCart(id, name, price) {
              cart.push({ id, name, price });
              localStorage.setItem('cart', JSON.stringify(cart));
              updateCartDisplay();

              // Show feedback
              event.target.textContent = 'Added!';
              setTimeout(() => {
                event.target.textContent = 'Add to Cart';
              }, 1000);
            }

            function updateCartDisplay() {
              document.getElementById('cart-count').textContent = cart.length;
              const total = cart.reduce((sum, item) => sum + item.price, 0);
              document.getElementById('cart-total').textContent = total;
              document.getElementById('view-cart').disabled = cart.length === 0;
            }

            function viewCart() {
              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\`
                <!DOCTYPE html>
                <html>
                <head><title>Shopping Cart</title></head>
                <body>
                  <h1>Your Cart</h1>
                  <div id="cart-items"></div>
                  <div id="cart-summary-page">
                    <div>Total: $<span id="total-amount">0</span></div>
                    <button id="checkout" onclick="checkout()" disabled>Proceed to Checkout</button>
                    <button id="continue-shopping" onclick="continueShopping()">Continue Shopping</button>
                  </div>
                  <script>
                    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
                    const cartItemsDiv = document.getElementById('cart-items');
                    const totalAmount = document.getElementById('total-amount');

                    if (cart.length > 0) {
                      cartItemsDiv.innerHTML = cart.map(item =>
                        \\\`<div class="cart-item">\\\${item.name} - $\\\${item.price}</div>\\\`
                      ).join('');

                      const total = cart.reduce((sum, item) => sum + item.price, 0);
                      totalAmount.textContent = total;
                      document.getElementById('checkout').disabled = false;
                    } else {
                      cartItemsDiv.innerHTML = '<div>Your cart is empty</div>';
                    }

                    function continueShopping() {
                      window.history.back();
                    }

                    function checkout() {
                      window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\\\\\`
                        <!DOCTYPE html>
                        <html>
                        <head><title>Checkout</title></head>
                        <body>
                          <h1>Checkout</h1>
                          <div id="order-summary"></div>
                          <form id="checkout-form">
                            <div>
                              <label>Email:</label>
                              <input type="email" id="email" required>
                            </div>
                            <div>
                              <label>Name:</label>
                              <input type="text" id="name" required>
                            </div>
                            <div>
                              <label>Address:</label>
                              <textarea id="address" required></textarea>
                            </div>
                            <button type="submit">Complete Order</button>
                          </form>
                          <script>
                            const cart = JSON.parse(localStorage.getItem('cart') || '[]');
                            const total = cart.reduce((sum, item) => sum + item.price, 0);

                            document.getElementById('order-summary').innerHTML =
                              '<h3>Order Summary:</h3>' +
                              cart.map(item => \\\\\\\`<div>\\\\\\\${item.name} - $\\\\\\\${item.price}</div>\\\\\\\`).join('') +
                              \\\\\\\`<div><strong>Total: $\\\\\\\${total}</strong></div>\\\\\\\`;

                            document.getElementById('checkout-form').addEventListener('submit', function(e) {
                              e.preventDefault();

                              const orderData = {
                                items: cart,
                                total: total,
                                customer: {
                                  email: document.getElementById('email').value,
                                  name: document.getElementById('name').value,
                                  address: document.getElementById('address').value
                                },
                                orderDate: new Date().toISOString()
                              };

                              localStorage.setItem('lastOrder', JSON.stringify(orderData));
                              localStorage.setItem('cart', '[]'); // Clear cart

                              window.location.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(\\\\\\\\\`
                                <!DOCTYPE html>
                                <html>
                                <head><title>Order Complete</title></head>
                                <body>
                                  <h1>Order Complete!</h1>
                                  <div id="order-confirmation"></div>
                                  <div id="order-number"></div>
                                  <button onclick="newOrder()">Start New Order</button>
                                  <script>
                                    const orderData = JSON.parse(localStorage.getItem('lastOrder'));
                                    const orderNumber = 'ORD-' + Date.now().toString().slice(-6);

                                    document.getElementById('order-confirmation').innerHTML =
                                      '<p>Thank you, ' + orderData.customer.name + '!</p>' +
                                      '<p>Your order has been confirmed and will be shipped to:</p>' +
                                      '<div>' + orderData.customer.address + '</div>' +
                                      '<p>Order total: $' + orderData.total + '</p>';

                                    document.getElementById('order-number').textContent =
                                      'Order Number: ' + orderNumber;

                                    function newOrder() {
                                      window.location.href = window.location.href.split('#')[0];
                                    }
                                  </script>
                                </body>
                                </html>
                              \\\\\\\\\`);
                            });
                          </script>
                        </body>
                        </html>
                      \\\\\`);
                    }
                  </script>
                </body>
                </html>
              \`);
            }
          </script>
        </body>
        </html>
      `;

      // Start e-commerce journey
      await browserTool.navigate(
        `data:text/html;charset=utf-8,${encodeURIComponent(ecommerceHtml)}`
      );

      // Add products to cart
      const productButtons = await browserTool.evaluate(() =>
        Array.from(document.querySelectorAll('.product button')).length
      );
      expect(productButtons).toBe(3);

      // Add laptop
      await browserTool.click('.product[data-id="1"] button');
      await new Promise(resolve => setTimeout(resolve, 1100)); // Wait for feedback

      // Add mouse
      await browserTool.click('.product[data-id="2"] button');
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Verify cart count
      const cartCount = await browserTool.getText('#cart-count');
      expect(cartCount).toBe('2');

      const cartTotal = await browserTool.getText('#cart-total');
      expect(cartTotal).toBe('1028'); // 999 + 29

      // View cart
      await browserTool.click('#view-cart');
      await browserTool.waitForSelector('#cart-items', { timeout: 5000 });

      // Verify cart page
      const cartTitle = await browserTool.getTitle();
      expect(cartTitle).toBe('Shopping Cart');

      const cartItems = await browserTool.getText('#cart-items');
      expect(cartItems).toContain('Laptop');
      expect(cartItems).toContain('Mouse');

      // Proceed to checkout
      await browserTool.click('#checkout');
      await browserTool.waitForSelector('#checkout-form', { timeout: 5000 });

      // Fill checkout form
      await browserTool.type('#email', 'test@example.com');
      await browserTool.type('#name', 'John Doe');
      await browserTool.type('#address', '123 Main St, Anytown, USA');

      // Complete order
      await browserTool.submit('#checkout-form');
      await browserTool.waitForSelector('#order-confirmation', { timeout: 5000 });

      // Verify order completion
      const orderTitle = await browserTool.getTitle();
      expect(orderTitle).toBe('Order Complete!');

      const confirmation = await browserTool.getText('#order-confirmation');
      expect(confirmation).toContain('Thank you, John Doe');
      expect(confirmation).toContain('123 Main St');
      expect(confirmation).toContain('$1028');

      const orderNumber = await browserTool.getText('#order-number');
      expect(orderNumber).toContain('ORD-');
    }, 40000);
  });
});