/**
 * EnvironmentDetector Pattern Detection Tests
 *
 * Comprehensive tests for environment variable pattern detection,
 * sensitivity analysis, and pattern priority handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { EnvironmentDetector } from '../environment-detector.js';

vi.mock('fs/promises');

describe('EnvironmentDetector Pattern Detection', () => {
  let detector: EnvironmentDetector;
  const mockProjectPath = '/test/project';

  beforeEach(() => {
    detector = new EnvironmentDetector(mockProjectPath);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('API Key Patterns', () => {
    it('should detect various API key naming patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# API Key variations
STRIPE_API_KEY=test_value
GITHUB_API_KEY=test_value
OPENAI_API_KEY=test_value
GOOGLE_CLOUD_API_KEY=test_value
FACEBOOK_API_KEY=test_value
TWITTER_API_KEY=test_value
SLACK_API_KEY=test_value
API_KEY=test_value
SERVICE_API_KEY=test_value
EXTERNAL_API_KEY=test_value`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const apiKeyVariables = variables.filter(v => v.pattern === 'api-key');
      expect(apiKeyVariables).toHaveLength(10);

      // All should be marked as sensitive
      apiKeyVariables.forEach(variable => {
        expect(variable.sensitive).toBe(true);
      });

      // Verify specific names
      const expectedNames = [
        'STRIPE_API_KEY', 'GITHUB_API_KEY', 'OPENAI_API_KEY',
        'GOOGLE_CLOUD_API_KEY', 'FACEBOOK_API_KEY', 'TWITTER_API_KEY',
        'SLACK_API_KEY', 'API_KEY', 'SERVICE_API_KEY', 'EXTERNAL_API_KEY'
      ];

      expectedNames.forEach(name => {
        expect(variables.find(v => v.name === name)?.pattern).toBe('api-key');
      });
    });
  });

  describe('Token Patterns', () => {
    it('should detect token patterns correctly', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Token variations
GITHUB_ACCESS_TOKEN=test_value
GITLAB_ACCESS_TOKEN=test_value
BITBUCKET_ACCESS_TOKEN=test_value
JWT_TOKEN=test_value
AUTH_TOKEN=test_value
BEARER_TOKEN=test_value
REFRESH_TOKEN=test_value
TOKEN=test_value
API_TOKEN=test_value
SESSION_TOKEN=test_value`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // Should detect access tokens and regular tokens
      const accessTokens = variables.filter(v => v.pattern === 'access-token');
      const regularTokens = variables.filter(v => v.pattern === 'token');

      expect(accessTokens).toHaveLength(3); // ACCESS_TOKEN variants
      expect(regularTokens).toHaveLength(7); // TOKEN variants

      // All should be sensitive
      [...accessTokens, ...regularTokens].forEach(variable => {
        expect(variable.sensitive).toBe(true);
      });
    });
  });

  describe('Secret Patterns', () => {
    it('should detect secret patterns with correct precedence', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Secret variations
JWT_SECRET_KEY=test_value
APP_SECRET_KEY=test_value
ENCRYPTION_SECRET_KEY=test_value
SESSION_SECRET=test_value
APP_SECRET=test_value
CLIENT_SECRET=test_value
WEBHOOK_SECRET=test_value
SECRET=test_value
DATABASE_SECRET=test_value
CRYPTO_SECRET=test_value`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const secretKeys = variables.filter(v => v.pattern === 'secret-key');
      const regularSecrets = variables.filter(v => v.pattern === 'secret');

      expect(secretKeys).toHaveLength(3); // SECRET_KEY variants
      expect(regularSecrets).toHaveLength(7); // SECRET variants

      // All should be sensitive
      [...secretKeys, ...regularSecrets].forEach(variable => {
        expect(variable.sensitive).toBe(true);
      });
    });
  });

  describe('Database URL Patterns', () => {
    it('should detect database URL patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Database URL variations
DATABASE_URL=postgresql://localhost/test
POSTGRES_DATABASE_URL=postgresql://localhost/test
MYSQL_DATABASE_URL=mysql://localhost/test
MONGODB_DATABASE_URL=mongodb://localhost/test
DB_URL=redis://localhost
REDIS_DB_URL=redis://localhost
ELASTICSEARCH_DB_URL=elasticsearch://localhost
PRIMARY_DATABASE_URL=postgresql://localhost/test
SECONDARY_DATABASE_URL=postgresql://localhost/test
CACHE_DB_URL=redis://localhost`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const databaseUrls = variables.filter(v => v.pattern === 'database-url');
      expect(databaseUrls).toHaveLength(10);

      // All should be sensitive
      databaseUrls.forEach(variable => {
        expect(variable.sensitive).toBe(true);
      });
    });
  });

  describe('Service URL Patterns', () => {
    it('should detect service URL patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Service URL variations
API_URL=https://api.example.com
SERVICE_URL=https://service.example.com
WEBHOOK_URL=https://webhook.example.com
CALLBACK_URL=https://callback.example.com
FRONTEND_URL=https://frontend.example.com
BACKEND_URL=https://backend.example.com
URL=https://example.com
BASE_URL=https://base.example.com
API_ENDPOINT=https://api.example.com/v1
WEBHOOK_ENDPOINT=https://webhook.example.com/hook
ENDPOINT=https://example.com/api
GRAPHQL_ENDPOINT=https://graphql.example.com`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const serviceUrls = variables.filter(v => v.pattern === 'url');
      const endpoints = variables.filter(v => v.pattern === 'endpoint');

      expect(serviceUrls).toHaveLength(8); // URL variants
      expect(endpoints).toHaveLength(4); // ENDPOINT variants

      // URLs and endpoints should not be sensitive by default
      [...serviceUrls, ...endpoints].forEach(variable => {
        expect(variable.sensitive).toBe(false);
      });
    });
  });

  describe('Environment and Mode Patterns', () => {
    it('should detect environment and mode patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Environment and mode variations
NODE_ENV=development
APP_ENV=production
RAILS_ENV=test
ENVIRONMENT=staging
DEPLOYMENT_ENV=prod
SERVICE_ENV=dev
ENV=local
BUILD_MODE=debug
DEBUG_MODE=true
DEVELOPMENT_MODE=false
PRODUCTION_MODE=true
MODE=release
COMPILE_MODE=debug
RUN_MODE=development`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const environments = variables.filter(v => v.pattern === 'environment');
      const modes = variables.filter(v => v.pattern === 'mode');

      expect(environments).toHaveLength(7); // ENV variants
      expect(modes).toHaveLength(7); // MODE variants

      // Environment and mode variables should not be sensitive
      [...environments, ...modes].forEach(variable => {
        expect(variable.sensitive).toBe(false);
      });
    });
  });

  describe('Port and Host Patterns', () => {
    it('should detect port and host patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Port and host variations
PORT=3000
SERVER_PORT=8080
API_PORT=4000
DATABASE_PORT=5432
REDIS_PORT=6379
FRONTEND_PORT=3001
BACKEND_PORT=8000
HOST=localhost
SERVER_HOST=0.0.0.0
API_HOST=api.example.com
DATABASE_HOST=db.example.com
REDIS_HOST=cache.example.com
FRONTEND_HOST=frontend.example.com
BACKEND_HOST=backend.example.com`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      const ports = variables.filter(v => v.pattern === 'port');
      const hosts = variables.filter(v => v.pattern === 'host');

      expect(ports).toHaveLength(7); // PORT variants
      expect(hosts).toHaveLength(7); // HOST variants

      // Ports and hosts should not be sensitive
      [...ports, ...hosts].forEach(variable => {
        expect(variable.sensitive).toBe(false);
      });
    });
  });

  describe('Pattern Priority and Conflicts', () => {
    it('should handle pattern conflicts with correct precedence', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Pattern conflict tests
API_KEY_URL=test_value
DATABASE_URL_SECRET=test_value
PORT_SECRET=test_value
SECRET_PORT=test_value
TOKEN_HOST=test_value
HOST_TOKEN=test_value
SECRET_KEY_URL=test_value
API_KEY_PORT=test_value`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // Test that earlier patterns in the list take precedence
      expect(variables.find(v => v.name === 'API_KEY_URL')?.pattern).toBe('api-key');
      expect(variables.find(v => v.name === 'DATABASE_URL_SECRET')?.pattern).toBe('secret'); // SECRET comes before DATABASE_URL
      expect(variables.find(v => v.name === 'PORT_SECRET')?.pattern).toBe('secret');
      expect(variables.find(v => v.name === 'SECRET_PORT')?.pattern).toBe('secret');
      expect(variables.find(v => v.name === 'TOKEN_HOST')?.pattern).toBe('token');
      expect(variables.find(v => v.name === 'HOST_TOKEN')?.pattern).toBe('token');
      expect(variables.find(v => v.name === 'SECRET_KEY_URL')?.pattern).toBe('secret-key');
      expect(variables.find(v => v.name === 'API_KEY_PORT')?.pattern).toBe('api-key');

      // Verify sensitivity follows pattern rules
      expect(variables.find(v => v.name === 'API_KEY_URL')?.sensitive).toBe(true);
      expect(variables.find(v => v.name === 'DATABASE_URL_SECRET')?.sensitive).toBe(true);
      expect(variables.find(v => v.name === 'PORT_SECRET')?.sensitive).toBe(true);
      expect(variables.find(v => v.name === 'SECRET_PORT')?.sensitive).toBe(true);
      expect(variables.find(v => v.name === 'TOKEN_HOST')?.sensitive).toBe(true);
      expect(variables.find(v => v.name === 'HOST_TOKEN')?.sensitive).toBe(true);
      expect(variables.find(v => v.name === 'SECRET_KEY_URL')?.sensitive).toBe(true);
      expect(variables.find(v => v.name === 'API_KEY_PORT')?.sensitive).toBe(true);
    });

    it('should detect patterns case-insensitively', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Case sensitivity test
api_key=test_value
API_KEY=test_value
Api_Key=test_value
database_url=test_value
DATABASE_URL=test_value
Database_Url=test_value
secret=test_value
SECRET=test_value
Secret=test_value`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // All variations should be detected with the same pattern
      expect(variables.find(v => v.name === 'api_key')?.pattern).toBe('api-key');
      expect(variables.find(v => v.name === 'API_KEY')?.pattern).toBe('api-key');
      expect(variables.find(v => v.name === 'Api_Key')?.pattern).toBe('api-key');

      expect(variables.find(v => v.name === 'database_url')?.pattern).toBe('database-url');
      expect(variables.find(v => v.name === 'DATABASE_URL')?.pattern).toBe('database-url');
      expect(variables.find(v => v.name === 'Database_Url')?.pattern).toBe('database-url');

      expect(variables.find(v => v.name === 'secret')?.pattern).toBe('secret');
      expect(variables.find(v => v.name === 'SECRET')?.pattern).toBe('secret');
      expect(variables.find(v => v.name === 'Secret')?.pattern).toBe('secret');
    });
  });

  describe('Unmatched Patterns', () => {
    it('should handle variables with no matching patterns', async () => {
      const mockReadFile = vi.mocked(fs.readFile);
      mockReadFile.mockResolvedValue(`# Variables without patterns
CUSTOM_VAR=test_value
MY_SETTING=test_value
APP_NAME=test_value
VERSION=1.0.0
DEBUG=true
TIMEOUT=5000
MAX_CONNECTIONS=100
FEATURE_FLAG=enabled
CUSTOM_CONFIG=custom_value
UNKNOWN_SETTING=unknown_value`);

      const filePath = path.join(mockProjectPath, '.env');
      const variables = await detector.parseEnvFile(filePath);

      // All variables should have undefined pattern
      variables.forEach(variable => {
        expect(variable.pattern).toBeUndefined();
      });

      // Sensitivity should be determined by value content
      variables.forEach(variable => {
        // These test values don't contain sensitive patterns
        expect(variable.sensitive).toBe(false);
      });
    });
  });

  describe('Value-based Sensitivity Detection', () => {
    it('should detect sensitivity based on value content when no pattern matches', () => {
      const detector = new EnvironmentDetector('/test');

      // Test different value sensitivity patterns
      expect((detector as any).isSensitiveValue('example_value')).toBe(false);
      expect((detector as any).isSensitiveValue('true')).toBe(false);
      expect((detector as any).isSensitiveValue('3000')).toBe(false);
      expect((detector as any).isSensitiveValue('development')).toBe(false);
      expect((detector as any).isSensitiveValue('https://example.com')).toBe(false);

      // Long alphanumeric strings should be considered sensitive
      expect((detector as any).isSensitiveValue('a'.repeat(32))).toBe(true);
      expect((detector as any).isSensitiveValue('1234567890abcdef1234567890abcdef')).toBe(true);

      // Base64-like patterns should be considered sensitive
      expect((detector as any).isSensitiveValue('SGVsbG8gV29ybGQgVGhpcyBpcyBhIHRlc3Q=')).toBe(true);

      // Hex patterns should be considered sensitive
      expect((detector as any).isSensitiveValue('deadbeef1234567890abcdef1234567890abcdef')).toBe(true);

      // Values containing sensitive keywords should be detected
      expect((detector as any).isSensitiveValue('my_test_password_123')).toBe(true);
      expect((detector as any).isSensitiveValue('bearer_token_example')).toBe(true);
      expect((detector as any).isSensitiveValue('my_secret_example')).toBe(true);
      expect((detector as any).isSensitiveValue('encryption_key_example')).toBe(true);
    });
  });
});