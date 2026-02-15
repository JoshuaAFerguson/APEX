/**
 * Redirect Test Scenarios and Fixtures
 *
 * Test scenarios for redirect handling integration tests.
 * Used by both WebFetch and browser redirect tests.
 */

export interface RedirectScenario {
  name: string;
  path: string;
  expectedFinalPath: string;
  type: 'http' | 'javascript' | 'meta-refresh' | 'mixed';
  description: string;
  timeout?: number;
}

/**
 * HTTP Redirect Test Scenarios
 */
export const HTTP_REDIRECT_SCENARIOS: RedirectScenario[] = [
  {
    name: '301-simple',
    path: '/redirect/301/ping',
    expectedFinalPath: '/ping',
    type: 'http',
    description: 'Simple 301 permanent redirect'
  },
  {
    name: '302-simple',
    path: '/redirect/302/health',
    expectedFinalPath: '/health',
    type: 'http',
    description: 'Simple 302 temporary redirect'
  },
  {
    name: '307-method-preservation',
    path: '/redirect/307/api',
    expectedFinalPath: '/api',
    type: 'http',
    description: '307 redirect preserving HTTP method'
  },
  {
    name: '308-method-preservation',
    path: '/redirect/308/api',
    expectedFinalPath: '/api',
    type: 'http',
    description: '308 permanent redirect preserving method'
  },
  {
    name: 'redirect-chain-3',
    path: '/redirect-chain/3',
    expectedFinalPath: '/redirect-chain/0',
    type: 'http',
    description: 'Three-hop redirect chain'
  }
];

/**
 * JavaScript Redirect Test Scenarios
 */
export const JS_REDIRECT_SCENARIOS: RedirectScenario[] = [
  {
    name: 'js-href',
    path: '/js-redirect/href/ping',
    expectedFinalPath: '/ping',
    type: 'javascript',
    description: 'JavaScript window.location.href redirect'
  },
  {
    name: 'js-assign',
    path: '/js-redirect/assign/health',
    expectedFinalPath: '/health',
    type: 'javascript',
    description: 'JavaScript window.location.assign redirect'
  },
  {
    name: 'js-replace',
    path: '/js-redirect/replace/ping',
    expectedFinalPath: '/ping',
    type: 'javascript',
    description: 'JavaScript window.location.replace redirect'
  }
];

/**
 * Meta Refresh Redirect Test Scenarios
 */
export const META_REFRESH_SCENARIOS: RedirectScenario[] = [
  {
    name: 'meta-immediate',
    path: '/meta-redirect/0/ping',
    expectedFinalPath: '/ping',
    type: 'meta-refresh',
    description: 'Immediate meta refresh redirect'
  },
  {
    name: 'meta-delayed-1s',
    path: '/meta-redirect/1/health',
    expectedFinalPath: '/health',
    type: 'meta-refresh',
    description: 'Meta refresh with 1 second delay',
    timeout: 3000
  }
];

/**
 * Default timeout for redirect tests
 */
export const DEFAULT_REDIRECT_TIMEOUT = 5000;