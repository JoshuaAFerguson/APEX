/**
 * Runtime configuration for the Web UI
 *
 * This allows the Web UI to be configured at runtime rather than build time.
 * The API URL can be set via:
 * 1. Window.__APEX_CONFIG__ (injected by server)
 * 2. localStorage (for user overrides)
 * 3. Environment variable (build time fallback)
 * 4. Default value
 */

export interface WebUIConfig {
  apiUrl: string
  wsUrl: string
}

declare global {
  interface Window {
    __APEX_CONFIG__?: Partial<WebUIConfig>
  }
}

const DEFAULT_API_URL = 'http://localhost:3000'

/**
 * Get the runtime configuration
 */
export function getConfig(): WebUIConfig {
  // Check for injected config (from server)
  const injectedConfig = typeof window !== 'undefined' ? window.__APEX_CONFIG__ : undefined

  // Check localStorage for user overrides
  const storedApiUrl = typeof window !== 'undefined'
    ? localStorage.getItem('apex_api_url')
    : null

  // Determine API URL with priority: localStorage > injected > env > default
  const apiUrl = storedApiUrl
    || injectedConfig?.apiUrl
    || process.env.NEXT_PUBLIC_APEX_API_URL
    || DEFAULT_API_URL

  // Derive WebSocket URL from API URL
  const wsUrl = injectedConfig?.wsUrl || apiUrl.replace(/^http/, 'ws')

  return {
    apiUrl,
    wsUrl,
  }
}

/**
 * Set the API URL (persists to localStorage)
 */
export function setApiUrl(url: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('apex_api_url', url)
    // Reload to apply changes
    window.location.reload()
  }
}

/**
 * Clear the custom API URL (revert to default)
 */
export function clearApiUrl(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('apex_api_url')
    window.location.reload()
  }
}

/**
 * Get the current API URL
 */
export function getApiUrl(): string {
  return getConfig().apiUrl
}

/**
 * Get the current WebSocket URL
 */
export function getWsUrl(): string {
  return getConfig().wsUrl
}
