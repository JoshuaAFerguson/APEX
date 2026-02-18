/**
 * @fileoverview Test page generators for waitForLoadState integration tests
 *
 * Provides HTML page generators that simulate various page loading patterns
 * for testing the three load states: 'load', 'domcontentloaded', 'networkidle'
 */

/**
 * Collection of test page generators for waitForLoadState functionality
 *
 * Each generator creates HTML content designed to test specific load state behaviors:
 * - domcontentloaded: Tests DOM parsing completion
 * - load: Tests full resource loading completion
 * - networkidle: Tests network activity settling
 */
export const LoadStateTestPages = {
  /**
   * DOMContentLoaded Test Page
   * - DOM tree parsed immediately
   * - Script runs synchronously to mark DOM ready
   */
  domContentLoadedPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DOMContentLoaded Test</title>
    </head>
    <body>
      <div id="dom-indicator" data-status="loading">Loading...</div>
      <script>
        // Synchronous script - runs when DOM is parsed
        document.getElementById('dom-indicator').dataset.status = 'dom-ready';
        document.getElementById('dom-indicator').textContent = 'DOM Ready';
      </script>
    </body>
    </html>
  `,

  /**
   * DOMContentLoaded Edge Case: Deferred script execution
   * - Tests that domcontentloaded waits for deferred scripts
   */
  domContentLoadedDeferredPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>DOMContentLoaded Deferred Test</title>
      <script defer>
        document.addEventListener('DOMContentLoaded', () => {
          document.getElementById('deferred-indicator').dataset.loaded = 'true';
        });
      </script>
    </head>
    <body>
      <div id="deferred-indicator" data-loaded="false">Waiting for deferred script</div>
    </body>
    </html>
  `,

  /**
   * Full Load Test Page
   * - Includes inline base64 image (loads instantly, still triggers load event)
   * - Includes stylesheet that must load
   * - Simulates waiting for all resources
   */
  fullLoadPage: (resourceLoadDelay: number = 0): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Full Load Test</title>
      <style>
        .loading { color: #999; }
        .loaded { color: green; font-weight: bold; }
      </style>
    </head>
    <body>
      <div id="content" class="loading">Loading resources...</div>
      <img id="test-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
      <script>
        window.addEventListener('load', function() {
          ${resourceLoadDelay > 0 ? `setTimeout(function() {` : ''}
          document.getElementById('content').className = 'loaded';
          document.getElementById('content').textContent = 'All Resources Loaded';
          document.getElementById('content').dataset.status = 'complete';
          ${resourceLoadDelay > 0 ? `}, ${resourceLoadDelay});` : ''}
        });
      </script>
    </body>
    </html>
  `,

  /**
   * Full Load Edge Case: Multiple resources
   * - Tests that load waits for ALL resources, not just the first
   */
  fullLoadMultiResourcePage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Multi-Resource Load Test</title>
      <style>
        #counter { font-size: 24px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div id="counter" data-count="0">0</div>
      <div id="status">Loading resources...</div>
      <!-- Multiple inline images simulate multiple resources -->
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" />
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFfwJ/A3q1EwAAAABJRU5ErkJggg==" />
      <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAfWCKGAAAAABJRU5ErkJggg==" />
      <script>
        window.addEventListener('load', function() {
          const images = document.querySelectorAll('img');
          document.getElementById('counter').dataset.count = images.length.toString();
          document.getElementById('counter').textContent = images.length.toString();
          document.getElementById('status').textContent = 'All ' + images.length + ' resources loaded';
        });
      </script>
    </body>
    </html>
  `,

  /**
   * Network Idle Test Page
   * - Simulates async operations that complete before network idle
   * - Uses setTimeout to simulate network activity duration
   */
  networkIdlePage: (activityDurationMs: number = 200): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Network Idle Test</title>
    </head>
    <body>
      <div id="status" data-phase="initializing">Initializing...</div>
      <div id="activity-count">0</div>
      <script>
        const startTime = Date.now();
        let activityCount = 0;

        // Simulate network activity with promise chain
        function simulateActivity() {
          return new Promise(resolve => {
            activityCount++;
            document.getElementById('activity-count').textContent = activityCount.toString();
            document.getElementById('status').dataset.phase = 'active';
            document.getElementById('status').textContent = 'Network Active';
            setTimeout(resolve, ${activityDurationMs});
          });
        }

        // Chain activities, then mark idle
        simulateActivity()
          .then(() => {
            document.getElementById('status').dataset.phase = 'idle';
            document.getElementById('status').textContent = 'Network Idle';
            document.getElementById('status').dataset.completedAt = Date.now().toString();
          });
      </script>
    </body>
    </html>
  `,

  /**
   * Network Idle Edge Case: Multiple sequential async operations
   * - Tests that networkidle waits for ALL async activity to settle
   */
  networkIdleSequentialPage: (operationCount: number = 3, intervalMs: number = 100): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Network Idle Sequential Test</title>
    </head>
    <body>
      <div id="status" data-phase="pending">Pending</div>
      <div id="operations-complete">0</div>
      <script>
        let completed = 0;
        const total = ${operationCount};

        function runOperation(n) {
          return new Promise(resolve => {
            setTimeout(() => {
              completed++;
              document.getElementById('operations-complete').textContent = completed.toString();
              resolve();
            }, ${intervalMs});
          });
        }

        async function runAllOperations() {
          document.getElementById('status').dataset.phase = 'running';
          document.getElementById('status').textContent = 'Running operations...';

          for (let i = 0; i < total; i++) {
            await runOperation(i + 1);
          }

          document.getElementById('status').dataset.phase = 'complete';
          document.getElementById('status').textContent = 'All operations complete';
        }

        runAllOperations();
      </script>
    </body>
    </html>
  `,

  /**
   * Edge Case: Page that never reaches networkidle (for timeout testing)
   */
  neverIdlePage: (): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Never Idle Test</title>
    </head>
    <body>
      <div id="status">Continuous activity</div>
      <script>
        // Continuous polling - page never reaches networkidle
        setInterval(() => {
          fetch('data:text/plain,ping').catch(() => {});
        }, 100);
      </script>
    </body>
    </html>
  `,
};

/**
 * Helper function to encode HTML content for data URL
 */
export function encodePageContent(htmlContent: string): string {
  return `data:text/html,${encodeURIComponent(htmlContent)}`;
}

/**
 * Creates a data URL from page content for navigation testing
 */
export function createDataUrl(pageContent: string): string {
  return encodePageContent(pageContent);
}