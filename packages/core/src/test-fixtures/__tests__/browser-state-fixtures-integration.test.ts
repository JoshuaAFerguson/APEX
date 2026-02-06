/**
 * @fileoverview Integration Tests for Browser State Fixtures
 *
 * This test suite demonstrates real-world usage patterns and integration scenarios
 * for the browser state fixtures API. It validates that the API works correctly
 * for complex, multi-step testing scenarios that developers would actually use.
 *
 * Test Scenarios:
 * - Complete user authentication flows
 * - Error recovery and retry scenarios
 * - Progressive web app state transitions
 * - Complex form interaction flows
 * - Multi-tab/multi-window scenarios
 * - Performance optimization testing
 * - Browser compatibility testing
 * - Security and privacy testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  browserFixtures,
  browserHelpers,
  BrowserStateBuilder,
  createBrowserState,
} from '../browser-fixtures.js';
import type { BrowserState, TestScenario } from '../types.js';

describe('Browser State Fixtures - Integration Tests', () => {
  describe('User Authentication Flow Integration', () => {
    it('should support complete login-to-logout workflow', () => {
      // 1. Start at login page
      let state = browserFixtures.cleanState({
        url: 'https://app.apex.dev/login',
        title: 'Login - APEX'
      });

      expect(state.isAuthenticated).toBe(false);
      expect(state.url).toBe('https://app.apex.dev/login');

      // 2. User enters credentials and submits
      state = browserHelpers.addConsoleMessage(state, 'info', 'User attempting login...');
      state = browserHelpers.startLoading(state);

      // 3. Login API request
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/auth/login',
        'POST',
        200,
        {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      );

      // 4. Success response, store auth token
      state = browserHelpers.setLocalStorage(state, 'auth-token', 'jwt-abc123def456');
      state = browserHelpers.setLocalStorage(state, 'refresh-token', 'refresh-xyz789');
      state = browserHelpers.setAuthenticated(state, true);

      // 5. Add session cookie
      state = browserHelpers.addCookie(
        state,
        'session-id',
        'sess-890123',
        { domain: 'apex.dev', path: '/' }
      );

      // 6. Redirect to dashboard
      state = browserHelpers.navigateTo(
        state,
        'https://app.apex.dev/dashboard',
        'APEX Dashboard'
      );
      state = browserHelpers.finishLoading(state);

      // 7. Load user profile
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/user/profile',
        'GET',
        200,
        { 'Authorization': 'Bearer jwt-abc123def456' }
      );

      // 8. Success console message
      state = browserHelpers.addConsoleMessage(state, 'info', 'Successfully logged in as user@example.com');

      // Verify final authenticated state
      expect(state.isAuthenticated).toBe(true);
      expect(state.url).toBe('https://app.apex.dev/dashboard');
      expect(state.title).toBe('APEX Dashboard');
      expect(state.isLoading).toBe(false);
      expect(state.localStorage['auth-token']).toBe('jwt-abc123def456');
      expect(state.cookies.find(c => c.name === 'session-id')?.value).toBe('sess-890123');
      expect(state.networkRequests).toHaveLength(2); // login + profile
      expect(state.consoleMessages).toHaveLength(2); // attempt + success

      // 9. Now test logout flow
      state = browserHelpers.addConsoleMessage(state, 'info', 'User logging out...');

      // 10. Logout API request
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/auth/logout',
        'POST',
        200,
        { 'Authorization': 'Bearer jwt-abc123def456' }
      );

      // 11. Clear auth data and redirect
      state = browserHelpers.clearBrowserData(state);
      state = browserHelpers.setAuthenticated(state, false);
      state = browserHelpers.navigateTo(
        state,
        'https://app.apex.dev/login',
        'Login - APEX'
      );

      state = browserHelpers.addConsoleMessage(state, 'info', 'Successfully logged out');

      // Verify final logged-out state
      expect(state.isAuthenticated).toBe(false);
      expect(state.url).toBe('https://app.apex.dev/login');
      expect(state.localStorage).toEqual({});
      expect(state.cookies).toEqual([]);
      expect(state.consoleMessages).toHaveLength(1); // Only logout message (others cleared)
    });

    it('should handle failed authentication gracefully', () => {
      let state = browserFixtures.cleanState({
        url: 'https://app.apex.dev/login'
      });

      // 1. Failed login attempt
      state = browserHelpers.startLoading(state);
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/auth/login',
        'POST',
        401,
        { 'Content-Type': 'application/json' }
      );

      // 2. Handle error response
      state = browserHelpers.finishLoading(state);
      state = browserHelpers.addConsoleMessage(state, 'error', 'Authentication failed: Invalid credentials');
      state = browserHelpers.setLocalStorage(
        state,
        'login-errors',
        JSON.stringify({
          attempts: 1,
          lastError: 'Invalid credentials',
          timestamp: new Date().toISOString()
        })
      );

      // Verify error state
      expect(state.isAuthenticated).toBe(false);
      expect(state.url).toBe('https://app.apex.dev/login');
      expect(state.networkRequests[0].status).toBe(401);
      expect(state.consoleMessages[0].type).toBe('error');
      expect(state.localStorage['login-errors']).toContain('Invalid credentials');
    });

    it('should handle token refresh workflow', () => {
      // Start with authenticated state but expired token
      let state = browserFixtures.loggedInPage();

      // 1. API request fails with 401 (token expired)
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/projects',
        'GET',
        401,
        { 'Authorization': 'Bearer expired-token' }
      );

      // 2. Attempt token refresh
      state = browserHelpers.addConsoleMessage(state, 'info', 'Token expired, refreshing...');
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/auth/refresh',
        'POST',
        200,
        {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer refresh-token-123'
        }
      );

      // 3. Update with new token
      state = browserHelpers.setLocalStorage(state, 'auth-token', 'jwt-new-token-456');

      // 4. Retry original request
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/projects',
        'GET',
        200,
        { 'Authorization': 'Bearer jwt-new-token-456' }
      );

      state = browserHelpers.addConsoleMessage(state, 'info', 'Token refreshed successfully');

      // Verify successful refresh
      expect(state.isAuthenticated).toBe(true);
      expect(state.localStorage['auth-token']).toBe('jwt-new-token-456');
      expect(state.networkRequests).toHaveLength(5); // original 2 + failed + refresh + retry
      expect(state.networkRequests[4].status).toBe(200); // Successful retry
    });
  });

  describe('Progressive Web App State Transitions', () => {
    it('should simulate complete PWA installation flow', () => {
      // 1. Start with basic web page
      let state = browserFixtures.cleanState({
        url: 'https://pwa.apex.dev',
        title: 'APEX PWA'
      });

      // 2. Load service worker
      state = browserHelpers.addNetworkRequest(
        state,
        'https://pwa.apex.dev/sw.js',
        'GET',
        200,
        { 'Content-Type': 'application/javascript' }
      );

      state = browserHelpers.addConsoleMessage(state, 'info', 'Service worker registered');

      // 3. Cache app shell
      const appShellResources = [
        'https://pwa.apex.dev/app.css',
        'https://pwa.apex.dev/app.js',
        'https://pwa.apex.dev/manifest.json'
      ];

      appShellResources.forEach(url => {
        state = browserHelpers.addNetworkRequest(state, url, 'GET', 200);
      });

      // 4. Store app shell in cache (simulate with localStorage)
      state = browserHelpers.setLocalStorage(
        state,
        'pwa-cache',
        JSON.stringify({
          version: 'v1',
          resources: appShellResources,
          timestamp: new Date().toISOString()
        })
      );

      // 5. Show install prompt
      state = browserHelpers.addConsoleMessage(state, 'info', 'PWA install prompt shown');
      state = browserHelpers.setSessionStorage(state, 'install-prompt-shown', 'true');

      // 6. User accepts installation
      state = browserHelpers.addConsoleMessage(state, 'info', 'PWA installation accepted');
      state = browserHelpers.setLocalStorage(state, 'pwa-installed', 'true');

      // Verify PWA state
      expect(state.networkRequests).toHaveLength(4); // sw.js + 3 app shell resources
      expect(state.localStorage['pwa-cache']).toContain('"version":"v1"');
      expect(state.localStorage['pwa-installed']).toBe('true');
      expect(state.sessionStorage['install-prompt-shown']).toBe('true');
    });

    it('should handle offline-first functionality', () => {
      // Start with PWA installed and go offline
      let state = browserFixtures.cleanState({
        url: 'https://pwa.apex.dev/app',
        localStorage: {
          'pwa-installed': 'true',
          'pwa-cache': JSON.stringify({
            version: 'v1',
            resources: ['app.css', 'app.js'],
            data: { 'projects': [{ id: 1, name: 'Cached Project' }] }
          })
        }
      });

      // 1. Network request fails (offline)
      state = browserHelpers.addConsoleMessage(state, 'warn', 'Network request failed, using cache');

      // 2. Serve from cache (no network request added, data from localStorage)
      const cachedData = JSON.parse(state.localStorage['pwa-cache']);
      state = browserHelpers.addConsoleMessage(
        state,
        'info',
        `Loaded ${cachedData.data.projects.length} projects from cache`
      );

      // 3. Mark as offline mode
      state = browserHelpers.setSessionStorage(state, 'offline-mode', 'true');

      // 4. Show offline indicator
      state = browserHelpers.addConsoleMessage(state, 'warn', 'App is in offline mode');

      // Verify offline functionality
      expect(state.networkRequests).toHaveLength(0); // No network requests when offline
      expect(state.sessionStorage['offline-mode']).toBe('true');
      expect(state.consoleMessages.some(msg => msg.message.includes('cache'))).toBe(true);
    });
  });

  describe('Error Recovery and Retry Scenarios', () => {
    it('should handle network retry with exponential backoff', () => {
      let state = browserFixtures.cleanState();

      const maxRetries = 3;
      const baseDelay = 1000;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        // Calculate backoff delay
        const delay = baseDelay * Math.pow(2, attempt - 1);

        // Log retry attempt
        state = browserHelpers.addConsoleMessage(
          state,
          'info',
          `Network request attempt ${attempt} (delay: ${delay}ms)`
        );

        // Simulate failed request
        state = browserHelpers.addNetworkRequest(
          state,
          'https://api.apex.dev/data',
          'GET',
          attempt < maxRetries ? 500 : 200 // Succeed on last attempt
        );

        // Store retry metadata
        state = browserHelpers.setSessionStorage(
          state,
          'retry-attempts',
          JSON.stringify({
            count: attempt,
            lastDelay: delay,
            maxRetries
          })
        );
      }

      // Final success message
      state = browserHelpers.addConsoleMessage(state, 'info', 'Request succeeded after retries');

      // Verify retry behavior
      expect(state.networkRequests).toHaveLength(maxRetries);
      expect(state.networkRequests[maxRetries - 1].status).toBe(200); // Final success
      expect(state.consoleMessages).toHaveLength(maxRetries + 1); // Attempts + success

      const retryData = JSON.parse(state.sessionStorage['retry-attempts']);
      expect(retryData.count).toBe(maxRetries);
      expect(retryData.lastDelay).toBe(baseDelay * Math.pow(2, maxRetries - 1));
    });

    it('should handle graceful degradation for feature failures', () => {
      let state = browserFixtures.loggedInPage();

      // 1. Advanced feature fails
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/ai/suggestions',
        'GET',
        503 // Service unavailable
      );

      // 2. Log degradation
      state = browserHelpers.addConsoleMessage(
        state,
        'warn',
        'AI suggestions unavailable, using basic recommendations'
      );

      // 3. Fall back to basic feature
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/recommendations/basic',
        'GET',
        200
      );

      // 4. Store degradation state
      state = browserHelpers.setLocalStorage(
        state,
        'feature-flags',
        JSON.stringify({
          aiSuggestions: false,
          basicRecommendations: true,
          degradationReason: 'Service unavailable'
        })
      );

      // 5. Success with degraded features
      state = browserHelpers.addConsoleMessage(
        state,
        'info',
        'Basic recommendations loaded successfully'
      );

      // Verify graceful degradation
      expect(state.networkRequests.some(req => req.status === 503)).toBe(true);
      expect(state.networkRequests.some(req => req.status === 200 && req.url.includes('basic'))).toBe(true);
      expect(state.localStorage['feature-flags']).toContain('"aiSuggestions":false');
      expect(state.consoleMessages.some(msg => msg.type === 'warn')).toBe(true);
    });
  });

  describe('Complex Form Interaction Flows', () => {
    it('should simulate multi-step form with validation', () => {
      let state = browserFixtures.cleanState({
        url: 'https://app.apex.dev/create-project',
        title: 'Create Project - APEX'
      });

      // Step 1: Project details
      state = browserHelpers.addConsoleMessage(state, 'info', 'Started project creation form');
      state = browserHelpers.setSessionStorage(
        state,
        'form-step',
        JSON.stringify({
          current: 1,
          total: 3,
          data: { projectName: '', description: '', template: '' }
        })
      );

      // Step 1 validation - empty project name
      state = browserHelpers.addConsoleMessage(state, 'warn', 'Validation error: Project name is required');
      state = browserHelpers.setSessionStorage(
        state,
        'form-errors',
        JSON.stringify({ projectName: 'Project name is required' })
      );

      // Step 1 correction
      const step1Data = {
        current: 1,
        total: 3,
        data: {
          projectName: 'My Awesome Project',
          description: 'A test project',
          template: 'react-typescript'
        }
      };
      state = browserHelpers.setSessionStorage(state, 'form-step', JSON.stringify(step1Data));
      state = browserHelpers.setSessionStorage(state, 'form-errors', '{}');

      // Step 2: Configuration
      const step2Data = {
        current: 2,
        total: 3,
        data: {
          ...step1Data.data,
          gitRepo: 'https://github.com/user/my-awesome-project',
          deploymentTarget: 'vercel',
          environment: 'staging'
        }
      };
      state = browserHelpers.setSessionStorage(state, 'form-step', JSON.stringify(step2Data));

      // Step 3: Review and submit
      state = browserHelpers.setSessionStorage(
        state,
        'form-step',
        JSON.stringify({ ...step2Data, current: 3 })
      );

      // Submit form
      state = browserHelpers.startLoading(state);
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/projects',
        'POST',
        201,
        { 'Content-Type': 'application/json' }
      );

      // Success
      state = browserHelpers.finishLoading(state);
      state = browserHelpers.addConsoleMessage(state, 'info', 'Project created successfully');
      state = browserHelpers.navigateTo(
        state,
        'https://app.apex.dev/projects/my-awesome-project',
        'My Awesome Project - APEX'
      );

      // Clear form data
      state = browserHelpers.setSessionStorage(state, 'form-step', '{}');
      state = browserHelpers.setSessionStorage(state, 'form-errors', '{}');

      // Verify form flow
      expect(state.url).toBe('https://app.apex.dev/projects/my-awesome-project');
      expect(state.networkRequests[0].status).toBe(201);
      expect(state.consoleMessages.some(msg => msg.message.includes('successfully'))).toBe(true);
      expect(state.sessionStorage['form-step']).toBe('{}');
    });

    it('should handle file upload with progress tracking', () => {
      let state = browserFixtures.loggedInPage();

      // 1. Start file upload
      state = browserHelpers.addConsoleMessage(state, 'info', 'Starting file upload: document.pdf');
      state = browserHelpers.setSessionStorage(
        state,
        'upload-progress',
        JSON.stringify({
          fileName: 'document.pdf',
          fileSize: 2048576, // 2MB
          uploaded: 0,
          percentage: 0,
          status: 'uploading'
        })
      );

      // 2. Simulate upload progress
      const progressSteps = [25, 50, 75, 100];
      progressSteps.forEach(percentage => {
        const uploaded = Math.floor((2048576 * percentage) / 100);
        state = browserHelpers.setSessionStorage(
          state,
          'upload-progress',
          JSON.stringify({
            fileName: 'document.pdf',
            fileSize: 2048576,
            uploaded,
            percentage,
            status: percentage === 100 ? 'processing' : 'uploading'
          })
        );

        state = browserHelpers.addConsoleMessage(
          state,
          'info',
          `Upload progress: ${percentage}% (${uploaded} bytes)`
        );
      });

      // 3. Upload complete, processing
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/files/upload',
        'POST',
        200,
        { 'Content-Type': 'multipart/form-data' }
      );

      // 4. Processing complete
      state = browserHelpers.setSessionStorage(
        state,
        'upload-progress',
        JSON.stringify({
          fileName: 'document.pdf',
          fileSize: 2048576,
          uploaded: 2048576,
          percentage: 100,
          status: 'complete',
          fileId: 'file_abc123'
        })
      );

      state = browserHelpers.addConsoleMessage(state, 'info', 'File upload completed successfully');

      // Verify upload flow
      expect(state.networkRequests.some(req => req.url.includes('upload'))).toBe(true);
      expect(state.consoleMessages.some(msg => msg.message.includes('100%'))).toBe(true);

      const finalProgress = JSON.parse(state.sessionStorage['upload-progress']);
      expect(finalProgress.status).toBe('complete');
      expect(finalProgress.fileId).toBe('file_abc123');
    });
  });

  describe('Multi-Tab/Multi-Window Scenarios', () => {
    it('should simulate cross-tab state synchronization', () => {
      // Tab 1: Login and make changes
      let tab1State = browserFixtures.cleanState({
        url: 'https://app.apex.dev/projects'
      });

      // Login in tab 1
      tab1State = browserHelpers.setAuthenticated(tab1State, true);
      tab1State = browserHelpers.setLocalStorage(tab1State, 'auth-token', 'jwt-token-123');
      tab1State = browserHelpers.setLocalStorage(tab1State, 'user-id', 'user_456');

      // Make project changes in tab 1
      tab1State = browserHelpers.setLocalStorage(
        tab1State,
        'project-changes',
        JSON.stringify({
          projectId: 'proj_789',
          lastModified: new Date().toISOString(),
          changes: { name: 'Updated Project Name' }
        })
      );

      tab1State = browserHelpers.addConsoleMessage(
        tab1State,
        'info',
        'Project changes saved locally'
      );

      // Tab 2: Simulate opening same app in new tab
      let tab2State = browserFixtures.cleanState({
        url: 'https://app.apex.dev/dashboard'
      });

      // Tab 2 should inherit auth state from localStorage
      tab2State = browserHelpers.setLocalStorage(tab2State, 'auth-token', 'jwt-token-123');
      tab2State = browserHelpers.setLocalStorage(tab2State, 'user-id', 'user_456');
      tab2State = browserHelpers.setAuthenticated(tab2State, true);

      // Tab 2 detects changes from tab 1
      tab2State = browserHelpers.setLocalStorage(
        tab2State,
        'project-changes',
        tab1State.localStorage['project-changes'] // Sync from tab 1
      );

      tab2State = browserHelpers.addConsoleMessage(
        tab2State,
        'info',
        'Detected changes from another tab, syncing...'
      );

      // Both tabs now have synchronized state
      expect(tab1State.localStorage['auth-token']).toBe(tab2State.localStorage['auth-token']);
      expect(tab1State.localStorage['project-changes']).toBe(tab2State.localStorage['project-changes']);
      expect(tab1State.isAuthenticated).toBe(tab2State.isAuthenticated);

      // Simulate logout in tab 1 affects tab 2
      tab1State = browserHelpers.setAuthenticated(tab1State, false);
      tab1State = browserHelpers.clearBrowserData(tab1State);

      // Tab 2 detects logout
      tab2State = browserHelpers.clearBrowserData(tab2State);
      tab2State = browserHelpers.setAuthenticated(tab2State, false);
      tab2State = browserHelpers.addConsoleMessage(
        tab2State,
        'info',
        'Logged out due to action in another tab'
      );

      expect(tab1State.isAuthenticated).toBe(false);
      expect(tab2State.isAuthenticated).toBe(false);
      expect(tab2State.localStorage).toEqual({});
    });
  });

  describe('Security and Privacy Testing', () => {
    it('should simulate security token expiration and cleanup', () => {
      let state = browserFixtures.loggedInPage();

      // 1. Normal authenticated state with tokens
      expect(state.localStorage['auth-token']).toBe('mock-jwt-token');
      expect(state.isAuthenticated).toBe(true);

      // 2. Simulate token expiration detection
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/user/profile',
        'GET',
        401,
        { 'Authorization': 'Bearer mock-jwt-token' }
      );

      state = browserHelpers.addConsoleMessage(state, 'warn', 'Token expired, securing session...');

      // 3. Security cleanup - remove all sensitive data
      const sensitiveKeys = ['auth-token', 'refresh-token', 'user-preferences', 'session-id'];
      const cleanedLocalStorage: Record<string, string> = {};

      // Keep only non-sensitive data
      Object.entries(state.localStorage).forEach(([key, value]) => {
        if (!sensitiveKeys.includes(key)) {
          cleanedLocalStorage[key] = value;
        }
      });

      state = {
        ...state,
        localStorage: cleanedLocalStorage,
        sessionStorage: {}, // Clear all session data
        cookies: [], // Clear all cookies
        isAuthenticated: false
      };

      // 4. Add security event log
      state = browserHelpers.addConsoleMessage(
        state,
        'info',
        'Security cleanup completed - session terminated'
      );

      // 5. Redirect to login with security message
      state = browserHelpers.navigateTo(
        state,
        'https://app.apex.dev/login?reason=token_expired',
        'Login Required - APEX'
      );

      // Verify security cleanup
      expect(state.isAuthenticated).toBe(false);
      expect(state.localStorage['auth-token']).toBeUndefined();
      expect(state.localStorage['refresh-token']).toBeUndefined();
      expect(state.sessionStorage).toEqual({});
      expect(state.cookies).toEqual([]);
      expect(state.url).toContain('reason=token_expired');
    });

    it('should handle privacy mode and data isolation', () => {
      // Simulate private browsing mode
      let state = browserFixtures.cleanState({
        url: 'https://app.apex.dev?private=true'
      });

      // 1. Detect private mode
      state = browserHelpers.addConsoleMessage(
        state,
        'info',
        'Private browsing mode detected'
      );

      // 2. Limited data storage (simulate restrictions)
      state = browserHelpers.setSessionStorage(state, 'privacy-mode', 'true');
      state = browserHelpers.setSessionStorage(
        state,
        'session-data-only',
        JSON.stringify({ tempId: 'temp_123' })
      );

      // 3. No persistent storage (localStorage would be disabled)
      // Only session storage and in-memory state

      // 4. Additional privacy measures
      state = browserHelpers.addConsoleMessage(
        state,
        'info',
        'Enhanced privacy measures enabled'
      );

      // 5. Disable tracking and analytics
      state = browserHelpers.setSessionStorage(
        state,
        'privacy-settings',
        JSON.stringify({
          tracking: false,
          analytics: false,
          cookies: 'session-only',
          dataRetention: 'none'
        })
      );

      // Verify privacy mode
      expect(state.localStorage).toEqual({}); // No persistent data
      expect(state.sessionStorage['privacy-mode']).toBe('true');
      expect(state.consoleMessages.some(msg => msg.message.includes('privacy'))).toBe(true);

      const privacySettings = JSON.parse(state.sessionStorage['privacy-settings']);
      expect(privacySettings.tracking).toBe(false);
      expect(privacySettings.analytics).toBe(false);
    });
  });

  describe('Performance Optimization Testing', () => {
    it('should simulate lazy loading and code splitting', () => {
      let state = browserFixtures.cleanState({
        url: 'https://app.apex.dev/dashboard'
      });

      // 1. Load initial bundle (small)
      state = browserHelpers.addNetworkRequest(
        state,
        'https://app.apex.dev/js/main.bundle.js',
        'GET',
        200,
        { 'Content-Type': 'application/javascript' }
      );

      state = browserHelpers.addConsoleMessage(state, 'info', 'Initial bundle loaded');

      // 2. User navigates to heavy feature
      state = browserHelpers.navigateTo(state, 'https://app.apex.dev/analytics');

      // 3. Lazy load analytics module
      state = browserHelpers.addConsoleMessage(state, 'info', 'Loading analytics module...');
      state = browserHelpers.startLoading(state);

      state = browserHelpers.addNetworkRequest(
        state,
        'https://app.apex.dev/js/chunks/analytics.chunk.js',
        'GET',
        200,
        { 'Content-Type': 'application/javascript' }
      );

      // 4. Load supporting resources
      const analyticsResources = [
        'https://app.apex.dev/js/chunks/charts.chunk.js',
        'https://app.apex.dev/css/chunks/analytics.chunk.css',
        'https://app.apex.dev/js/chunks/vendors.charts.chunk.js'
      ];

      analyticsResources.forEach(url => {
        state = browserHelpers.addNetworkRequest(state, url, 'GET', 200);
      });

      // 5. Cache loaded modules
      state = browserHelpers.setLocalStorage(
        state,
        'loaded-chunks',
        JSON.stringify({
          analytics: { loaded: true, timestamp: new Date().toISOString() },
          charts: { loaded: true, timestamp: new Date().toISOString() }
        })
      );

      state = browserHelpers.finishLoading(state);
      state = browserHelpers.addConsoleMessage(state, 'info', 'Analytics module loaded successfully');

      // Verify lazy loading
      expect(state.networkRequests).toHaveLength(5); // main + analytics + 3 supporting
      expect(state.networkRequests.some(req => req.url.includes('analytics.chunk.js'))).toBe(true);
      expect(state.localStorage['loaded-chunks']).toContain('"analytics":{"loaded":true}');
      expect(state.isLoading).toBe(false);
    });

    it('should simulate caching and cache invalidation', () => {
      let state = browserFixtures.cleanState();

      // 1. First load with cache miss
      state = browserHelpers.addConsoleMessage(state, 'info', 'Cache miss - loading from server');
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/data?v=1.0',
        'GET',
        200,
        {
          'Cache-Control': 'max-age=3600',
          'ETag': '"abc123"'
        }
      );

      // 2. Store in cache
      state = browserHelpers.setLocalStorage(
        state,
        'api-cache',
        JSON.stringify({
          'data-v1.0': {
            data: { message: 'Cached data' },
            etag: 'abc123',
            expires: new Date(Date.now() + 3600000).toISOString() // 1 hour
          }
        })
      );

      // 3. Second request - cache hit
      state = browserHelpers.addConsoleMessage(state, 'info', 'Cache hit - serving from local cache');

      // 4. Cache invalidation - new version available
      state = browserHelpers.addNetworkRequest(
        state,
        'https://api.apex.dev/data?v=1.1',
        'GET',
        200,
        {
          'Cache-Control': 'max-age=3600',
          'ETag': '"def456"'
        }
      );

      // 5. Update cache
      const updatedCache = JSON.parse(state.localStorage['api-cache']);
      updatedCache['data-v1.1'] = {
        data: { message: 'Updated cached data' },
        etag: 'def456',
        expires: new Date(Date.now() + 3600000).toISOString()
      };

      state = browserHelpers.setLocalStorage(state, 'api-cache', JSON.stringify(updatedCache));
      state = browserHelpers.addConsoleMessage(state, 'info', 'Cache updated with new version');

      // Verify caching behavior
      expect(state.networkRequests).toHaveLength(2); // First load + invalidation
      expect(state.localStorage['api-cache']).toContain('"data-v1.0"');
      expect(state.localStorage['api-cache']).toContain('"data-v1.1"');
      expect(state.consoleMessages.some(msg => msg.message.includes('Cache hit'))).toBe(true);
    });
  });
});