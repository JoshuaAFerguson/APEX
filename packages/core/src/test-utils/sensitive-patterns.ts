/**
 * Shared test utilities for detecting sensitive information patterns in error messages
 *
 * This module provides regex patterns and helper functions to detect sensitive information
 * that should not appear in error messages or logs.
 */

/**
 * Regex patterns for detecting different categories of sensitive information
 */
export const SENSITIVE_PATTERNS = {
  /**
   * Patterns for absolute file paths across different operating systems
   * - Unix-like paths: /Users/*, /home/*, /var/*, /etc/*, /tmp/*
   * - Windows paths: C:\*, D:\*, etc.
   * - UNC paths: \\server\share\*
   */
  FILE_PATHS: {
    unix: /(?:\/(?:Users|home|var|etc|tmp|opt|usr)\/[^\s]*)/g,
    windows: /(?:[A-Za-z]:\\[^\s]*)/g,
    unc: /(?:\\\\[^\s\\]+\\[^\s]*)/g
  },

  /**
   * Patterns for API keys and authentication tokens
   * - OpenAI API keys: sk-*, pk-*
   * - Generic API keys: api_key=*, apikey=*, token=*
   * - Bearer tokens: Bearer *
   * - Authorization headers: Authorization: *
   */
  API_KEYS: {
    openai: /(?:sk-[A-Za-z0-9]{20,}|pk-[A-Za-z0-9]{20,})/g,
    generic: /(?:(?:api[_-]?key|apikey|token)(?:\s*[:=]\s*)["']?[A-Za-z0-9_-]{8,}["']?)/gi,
    bearer: /(?:Bearer\s+[A-Za-z0-9_-]{8,})/gi,
    auth_header: /(?:Authorization\s*:\s*["']?[A-Za-z0-9_=-]+["']?)/gi
  },

  /**
   * Patterns for database connection strings
   * - MongoDB: mongodb://*, mongodb+srv://*
   * - PostgreSQL: postgresql://*, postgres://*
   * - MySQL: mysql://*
   * - SQLite: sqlite://*
   * - Redis: redis://*
   * - Generic connection strings with credentials
   */
  DB_CONNECTION_STRINGS: {
    mongodb: /(?:mongodb(?:\+srv)?:\/\/[^\s]*)/g,
    postgresql: /(?:postgres(?:ql)?:\/\/[^\s]*)/g,
    mysql: /(?:mysql:\/\/[^\s]*)/g,
    sqlite: /(?:sqlite:\/\/[^\s]*)/g,
    redis: /(?:redis:\/\/[^\s]*)/g,
    generic: /(?:(?:jdbc|odbc):[^\s]*)/g,
    credentials: /(?:\/\/[^:\/\s]+:[^@\/\s]+@[^\s]*)/g
  },

  /**
   * Patterns for various token types
   * - JWT tokens (header.payload.signature format)
   * - Session tokens and IDs
   * - UUIDs that might be used as tokens
   * - Base64 encoded tokens
   * - Hex tokens
   */
  TOKEN_PATTERNS: {
    jwt: /(?:eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g,
    session: /(?:(?:session[_-]?(?:id|token)|sess[_-]?id)(?:\s*[:=]\s*)["']?[A-Za-z0-9_-]{16,}["']?)/gi,
    uuid: /(?:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/g,
    base64: /(?:[A-Za-z0-9+/]{32,}={0,2})/g,
    hex: /(?:0x[0-9a-fA-F]{16,}|[0-9a-fA-F]{32,})/g
  }
} as const;

/**
 * Helper function to check if a string contains any sensitive information
 * @param text - The text to check for sensitive patterns
 * @returns true if the text contains any sensitive information, false otherwise
 */
export function containsSensitiveInfo(text: string): boolean {
  return (
    containsFilePaths(text) ||
    containsApiKeys(text) ||
    containsDbConnectionStrings(text) ||
    containsTokenPatterns(text)
  );
}

/**
 * Helper function to check if a string contains file paths
 * @param text - The text to check for file path patterns
 * @returns true if the text contains file paths, false otherwise
 */
export function containsFilePaths(text: string): boolean {
  const { FILE_PATHS } = SENSITIVE_PATTERNS;
  return (
    FILE_PATHS.unix.test(text) ||
    FILE_PATHS.windows.test(text) ||
    FILE_PATHS.unc.test(text)
  );
}

/**
 * Helper function to check if a string contains API keys or authentication tokens
 * @param text - The text to check for API key patterns
 * @returns true if the text contains API keys, false otherwise
 */
export function containsApiKeys(text: string): boolean {
  const { API_KEYS } = SENSITIVE_PATTERNS;
  return (
    API_KEYS.openai.test(text) ||
    API_KEYS.generic.test(text) ||
    API_KEYS.bearer.test(text) ||
    API_KEYS.auth_header.test(text)
  );
}

/**
 * Helper function to check if a string contains database connection strings
 * @param text - The text to check for database connection string patterns
 * @returns true if the text contains database connection strings, false otherwise
 */
export function containsDbConnectionStrings(text: string): boolean {
  const { DB_CONNECTION_STRINGS } = SENSITIVE_PATTERNS;
  return (
    DB_CONNECTION_STRINGS.mongodb.test(text) ||
    DB_CONNECTION_STRINGS.postgresql.test(text) ||
    DB_CONNECTION_STRINGS.mysql.test(text) ||
    DB_CONNECTION_STRINGS.sqlite.test(text) ||
    DB_CONNECTION_STRINGS.redis.test(text) ||
    DB_CONNECTION_STRINGS.generic.test(text) ||
    DB_CONNECTION_STRINGS.credentials.test(text)
  );
}

/**
 * Helper function to check if a string contains token patterns
 * @param text - The text to check for token patterns
 * @returns true if the text contains tokens, false otherwise
 */
export function containsTokenPatterns(text: string): boolean {
  const { TOKEN_PATTERNS } = SENSITIVE_PATTERNS;

  // Be more selective with base64 and hex patterns to avoid false positives
  const hasJwt = TOKEN_PATTERNS.jwt.test(text);
  const hasSession = TOKEN_PATTERNS.session.test(text);
  const hasUuid = TOKEN_PATTERNS.uuid.test(text);

  // For base64 and hex, we check for longer patterns that are more likely to be tokens
  const hasLongBase64 = text.match(/[A-Za-z0-9+/]{48,}={0,2}/g);
  const hasLongHex = text.match(/(?:0x[0-9a-fA-F]{24,}|[0-9a-fA-F]{48,})/g);

  return hasJwt || hasSession || hasUuid || Boolean(hasLongBase64) || Boolean(hasLongHex);
}

/**
 * Get all detected sensitive patterns from a text with their categories
 * @param text - The text to analyze
 * @returns An object with detected patterns categorized by type
 */
export function detectSensitivePatterns(text: string): {
  filePaths: string[];
  apiKeys: string[];
  dbConnectionStrings: string[];
  tokens: string[];
} {
  const result = {
    filePaths: [] as string[],
    apiKeys: [] as string[],
    dbConnectionStrings: [] as string[],
    tokens: [] as string[]
  };

  // Extract file paths
  const filePathMatches = [
    ...(text.match(SENSITIVE_PATTERNS.FILE_PATHS.unix) || []),
    ...(text.match(SENSITIVE_PATTERNS.FILE_PATHS.windows) || []),
    ...(text.match(SENSITIVE_PATTERNS.FILE_PATHS.unc) || [])
  ];
  result.filePaths = [...new Set(filePathMatches)];

  // Extract API keys
  const apiKeyMatches = [
    ...(text.match(SENSITIVE_PATTERNS.API_KEYS.openai) || []),
    ...(text.match(SENSITIVE_PATTERNS.API_KEYS.generic) || []),
    ...(text.match(SENSITIVE_PATTERNS.API_KEYS.bearer) || []),
    ...(text.match(SENSITIVE_PATTERNS.API_KEYS.auth_header) || [])
  ];
  result.apiKeys = [...new Set(apiKeyMatches)];

  // Extract DB connection strings
  const dbMatches = [
    ...(text.match(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.mongodb) || []),
    ...(text.match(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.postgresql) || []),
    ...(text.match(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.mysql) || []),
    ...(text.match(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.sqlite) || []),
    ...(text.match(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.redis) || []),
    ...(text.match(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.generic) || []),
    ...(text.match(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.credentials) || [])
  ];
  result.dbConnectionStrings = [...new Set(dbMatches)];

  // Extract tokens
  const tokenMatches = [
    ...(text.match(SENSITIVE_PATTERNS.TOKEN_PATTERNS.jwt) || []),
    ...(text.match(SENSITIVE_PATTERNS.TOKEN_PATTERNS.session) || []),
    ...(text.match(SENSITIVE_PATTERNS.TOKEN_PATTERNS.uuid) || []),
    ...(text.match(/[A-Za-z0-9+/]{48,}={0,2}/g) || []),
    ...(text.match(/(?:0x[0-9a-fA-F]{24,}|[0-9a-fA-F]{48,})/g) || [])
  ];
  result.tokens = [...new Set(tokenMatches)];

  return result;
}