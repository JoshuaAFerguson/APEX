/**
 * @fileoverview Page Load Test Scenarios
 *
 * Provides HTML page generators for testing various page loading and waiting scenarios.
 * Each generator creates HTML content for specific wait condition testing.
 */

/**
 * Collection of test page generators for different page load waiting scenarios
 */
export const PageLoadTestPages = {
  /**
   * Creates a page that loads immediately without any delays
   */
  immediateLoad: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Immediate Load</title></head>
    <body>
      <div id="content" class="loaded">Content loaded immediately</div>
    </body>
    </html>
  `,

  /**
   * Creates a page that tests DOM content loaded state
   * Script runs after DOM is ready
   */
  domContentPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>DOM Content Test</title></head>
    <body>
      <div id="dom-indicator">DOM Ready</div>
      <script>
        document.getElementById('dom-indicator').dataset.loaded = 'true';
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page that simulates full page load with resources and delay
   * @param loadDelay - Delay in ms before marking content as loaded
   */
  fullLoadPage: (loadDelay: number = 100): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Full Load Test</title>
      <style>
        .loaded { color: green; }
      </style>
    </head>
    <body>
      <div id="content">Loading...</div>
      <img id="test-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
      <script>
        setTimeout(() => {
          document.getElementById('content').textContent = 'Fully Loaded';
          document.getElementById('content').classList.add('loaded');
        }, ${loadDelay});
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page that simulates network activity to test networkidle state
   * @param requestCount - Number of simulated requests
   * @param requestDelay - Delay between each request in ms
   */
  networkIdlePage: (requestCount: number = 3, requestDelay: number = 50): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Network Idle Test</title></head>
    <body>
      <div id="status">Pending</div>
      <div id="request-count">0</div>
      <script>
        let completed = 0;
        const total = ${requestCount};

        function simulateRequest(delay) {
          return new Promise(resolve => setTimeout(resolve, delay));
        }

        async function loadData() {
          document.getElementById('status').textContent = 'Loading';

          for (let i = 0; i < total; i++) {
            await simulateRequest(${requestDelay});
            completed++;
            document.getElementById('request-count').textContent = completed.toString();
          }

          document.getElementById('status').textContent = 'Complete';
        }

        loadData();
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page where an element appears after a delay
   * @param selector - ID selector for the delayed element (without #)
   * @param delay - Delay in ms before element appears
   */
  delayedElementPage: (selector: string, delay: number): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Delayed Element Test</title></head>
    <body>
      <div id="container">
        <p>Waiting for element...</p>
      </div>
      <script>
        setTimeout(() => {
          const el = document.createElement('div');
          el.id = '${selector.replace('#', '')}';
          el.className = '${selector.replace('.', '')}';
          el.textContent = 'Element appeared!';
          el.dataset.loaded = 'true';
          document.getElementById('container').appendChild(el);
        }, ${delay});
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page with an element that changes visibility state
   * @param initialState - Initial visibility state
   * @param changeDelay - Delay before state change in ms
   */
  elementStateChangePage: (initialState: 'visible' | 'hidden', changeDelay: number): string => `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Element State Test</title>
      <style>
        .hidden { display: none; }
        .visible { display: block; }
      </style>
    </head>
    <body>
      <div id="toggle-element" class="${initialState}">
        Toggle Content
      </div>
      <script>
        setTimeout(() => {
          const el = document.getElementById('toggle-element');
          el.className = el.className === 'visible' ? 'hidden' : 'visible';
        }, ${changeDelay});
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a single-page application (SPA) style navigation page
   */
  spaNavigationPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>SPA Navigation Test</title></head>
    <body>
      <div id="app">
        <nav>
          <a href="#page1" id="link1">Page 1</a>
          <a href="#page2" id="link2">Page 2</a>
        </nav>
        <main id="main-content">Home Content</main>
      </div>
      <script>
        window.addEventListener('hashchange', () => {
          const hash = window.location.hash;
          const content = document.getElementById('main-content');

          setTimeout(() => {
            if (hash === '#page1') {
              content.innerHTML = '<div id="page1-content">Page 1 Loaded</div>';
            } else if (hash === '#page2') {
              content.innerHTML = '<div id="page2-content">Page 2 Loaded</div>';
            }
          }, 100);
        });
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page for testing custom wait conditions
   */
  customConditionPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Custom Condition Test</title></head>
    <body>
      <div id="data-container" data-ready="false">
        <span id="loading-indicator">Loading...</span>
      </div>
      <script>
        window.appState = { initialized: false, dataLoaded: false };

        setTimeout(() => {
          window.appState.initialized = true;
        }, 50);

        setTimeout(() => {
          window.appState.dataLoaded = true;
          document.getElementById('data-container').dataset.ready = 'true';
          document.getElementById('loading-indicator').textContent = 'Ready';
        }, 150);
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page for timeout testing (element never appears)
   */
  timeoutTestPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Timeout Test</title></head>
    <body>
      <div id="existing-element">This element exists</div>
      <!-- No #missing-element will be created -->
    </body>
    </html>
  `,

  /**
   * Creates a page with multiple elements appearing in sequence
   * @param elementCount - Number of elements to create
   * @param delayBetween - Delay between each element in ms
   */
  sequentialElementsPage: (elementCount: number, delayBetween: number): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Sequential Elements Test</title></head>
    <body>
      <ul id="list"></ul>
      <script>
        let count = 0;
        const interval = setInterval(() => {
          const li = document.createElement('li');
          li.className = 'list-item';
          li.textContent = 'Item ' + (++count);
          li.dataset.itemNumber = count.toString();
          document.getElementById('list').appendChild(li);
          if (count >= ${elementCount}) {
            clearInterval(interval);
          }
        }, ${delayBetween});
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page that simulates element removal
   * @param removeDelay - Delay before element removal in ms
   */
  elementRemovalPage: (removeDelay: number): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Element Removal Test</title></head>
    <body>
      <div id="removable">Will be removed</div>
      <div id="status">Element present</div>
      <script>
        setTimeout(() => {
          document.getElementById('removable').remove();
          document.getElementById('status').textContent = 'Element removed';
        }, ${removeDelay});
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page that never reaches network idle (for timeout testing)
   */
  neverIdlePage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Never Idle Test</title></head>
    <body>
      <div id="status">Continuous activity</div>
      <script>
        // Create continuous network activity
        setInterval(() => {
          fetch('data:text/plain,ping').catch(() => {});
        }, 100);
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page with parallel element appearance for race condition testing
   */
  parallelElementsPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Parallel Elements Test</title></head>
    <body>
      <div id="elem1" style="display:none">Element 1</div>
      <div id="elem2" style="display:none">Element 2</div>
      <div id="success" style="display:none">Success!</div>
      <div id="error" style="display:none">Error!</div>
      <script>
        // Show elements at different times
        setTimeout(() => document.getElementById('elem1').style.display = 'block', 100);
        setTimeout(() => document.getElementById('elem2').style.display = 'block', 150);
        // For Promise.race testing - always show success
        setTimeout(() => document.getElementById('success').style.display = 'block', 100);
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page for testing programmatic navigation
   */
  programmaticNavigationPage: (): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Programmatic Navigation Test</title></head>
    <body>
      <button id="nav-btn">Navigate</button>
      <div id="status">Ready</div>
      <script>
        document.getElementById('nav-btn').addEventListener('click', () => {
          document.getElementById('status').textContent = 'Navigating...';
          setTimeout(() => {
            window.location.hash = 'target';
            document.getElementById('status').textContent = 'Navigated';
          }, 50);
        });
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page that tests wait strategies under stress conditions
   * @param elementCount - Number of elements to create
   * @param staggerDelay - Delay between element appearances
   */
  stressTestPage: (elementCount: number = 100, staggerDelay: number = 10): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Stress Test Page</title></head>
    <body>
      <div id="stress-container"></div>
      <div id="stress-indicator">Loading stress test...</div>
      <script>
        let created = 0;
        const total = ${elementCount};

        const createElements = () => {
          const batch = Math.min(5, total - created);
          for (let i = 0; i < batch; i++) {
            const div = document.createElement('div');
            div.className = 'stress-element';
            div.id = 'stress-element-' + (created + i);
            div.textContent = 'Element ' + (created + i);
            document.getElementById('stress-container').appendChild(div);
          }
          created += batch;

          if (created >= total) {
            document.getElementById('stress-indicator').textContent = 'Stress test complete';
            document.getElementById('stress-indicator').dataset.complete = 'true';
          } else {
            setTimeout(createElements, ${staggerDelay});
          }
        };

        setTimeout(createElements, 50);
      </script>
    </body>
    </html>
  `,

  /**
   * Creates a page that simulates network-dependent loading states
   * @param networkDelays - Array of delays for simulated network requests
   */
  networkDependentPage: (networkDelays: number[] = [100, 200, 300]): string => `
    <!DOCTYPE html>
    <html>
    <head><title>Network Dependent Loading</title></head>
    <body>
      <div id="network-status">Initializing...</div>
      <div id="network-progress">0/${networkDelays.length}</div>
      <div id="network-result" style="display:none">All resources loaded</div>
      <script>
        const delays = ${JSON.stringify(networkDelays)};
        let completed = 0;

        const updateProgress = () => {
          document.getElementById('network-progress').textContent = completed + '/' + delays.length;
          if (completed === delays.length) {
            document.getElementById('network-status').textContent = 'Complete';
            document.getElementById('network-result').style.display = 'block';
            document.getElementById('network-result').dataset.loaded = 'true';
          }
        };

        delays.forEach((delay, index) => {
          setTimeout(() => {
            completed++;
            updateProgress();
          }, delay);
        });

        document.getElementById('network-status').textContent = 'Loading resources...';
        updateProgress();
      </script>
    </body>
    </html>
  `
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