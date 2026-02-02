/**
 * @fileoverview Comprehensive tests for sensitive information pattern detection
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  SENSITIVE_PATTERNS,
  containsSensitiveInfo,
  containsFilePaths,
  containsApiKeys,
  containsDbConnectionStrings,
  containsTokenPatterns,
  detectSensitivePatterns
} from '../sensitive-patterns.js';

describe('SENSITIVE_PATTERNS', () => {
  describe('FILE_PATHS', () => {
    describe('Unix paths', () => {
      it('should detect common Unix absolute paths', () => {
        const unixPaths = [
          '/Users/john/documents/secret.txt',
          '/home/user/.ssh/id_rsa',
          '/var/log/application.log',
          '/etc/passwd',
          '/tmp/upload_file.txt',
          '/opt/app/config.json',
          '/usr/local/bin/script.sh'
        ];

        unixPaths.forEach(path => {
          expect(SENSITIVE_PATTERNS.FILE_PATHS.unix.test(path)).toBe(true);
          // Reset regex state
          SENSITIVE_PATTERNS.FILE_PATHS.unix.lastIndex = 0;
        });
      });

      it('should not detect relative Unix paths', () => {
        const relativePaths = [
          './config/settings.json',
          '../src/components/Button.tsx',
          'src/utils/helpers.ts',
          'package.json',
          'docs/README.md'
        ];

        relativePaths.forEach(path => {
          expect(SENSITIVE_PATTERNS.FILE_PATHS.unix.test(path)).toBe(false);
          SENSITIVE_PATTERNS.FILE_PATHS.unix.lastIndex = 0;
        });
      });
    });

    describe('Windows paths', () => {
      it('should detect Windows absolute paths', () => {
        const windowsPaths = [
          'C:\\Users\\John\\Documents\\secret.docx',
          'D:\\Projects\\MyApp\\config.ini',
          'E:\\Backup\\database.backup',
          'F:\\temp\\upload.zip',
          'C:\\Program Files\\App\\settings.xml'
        ];

        windowsPaths.forEach(path => {
          expect(SENSITIVE_PATTERNS.FILE_PATHS.windows.test(path)).toBe(true);
          SENSITIVE_PATTERNS.FILE_PATHS.windows.lastIndex = 0;
        });
      });

      it('should not detect relative Windows paths', () => {
        const relativePaths = [
          '.\\config\\settings.ini',
          '..\\src\\main.cpp',
          'bin\\debug\\app.exe'
        ];

        relativePaths.forEach(path => {
          expect(SENSITIVE_PATTERNS.FILE_PATHS.windows.test(path)).toBe(false);
          SENSITIVE_PATTERNS.FILE_PATHS.windows.lastIndex = 0;
        });
      });
    });

    describe('UNC paths', () => {
      it('should detect UNC network paths', () => {
        const uncPaths = [
          '\\\\server\\share\\folder\\file.txt',
          '\\\\192.168.1.100\\shared\\documents\\report.pdf',
          '\\\\fileserver\\backup\\database.bak'
        ];

        uncPaths.forEach(path => {
          expect(SENSITIVE_PATTERNS.FILE_PATHS.unc.test(path)).toBe(true);
          SENSITIVE_PATTERNS.FILE_PATHS.unc.lastIndex = 0;
        });
      });
    });
  });

  describe('API_KEYS', () => {
    describe('OpenAI keys', () => {
      it('should detect OpenAI API keys', () => {
        const openaiKeys = [
          'sk-1234567890abcdef1234567890abcdef12345678',
          'pk-1234567890abcdef1234567890abcdef12345678'
        ];

        openaiKeys.forEach(key => {
          expect(SENSITIVE_PATTERNS.API_KEYS.openai.test(key)).toBe(true);
          SENSITIVE_PATTERNS.API_KEYS.openai.lastIndex = 0;
        });
      });

      it('should not detect short or invalid OpenAI key patterns', () => {
        const invalidKeys = [
          'sk-short',
          'pk-123',
          'ak-1234567890abcdef1234567890abcdef12345678'
        ];

        invalidKeys.forEach(key => {
          expect(SENSITIVE_PATTERNS.API_KEYS.openai.test(key)).toBe(false);
          SENSITIVE_PATTERNS.API_KEYS.openai.lastIndex = 0;
        });
      });
    });

    describe('Generic API keys', () => {
      it('should detect generic API key patterns', () => {
        const genericKeys = [
          'api_key=abcd1234567890',
          'apikey: "xyz789012345"',
          'api-key=secret123456',
          'token=bearer_token_12345'
        ];

        genericKeys.forEach(key => {
          expect(SENSITIVE_PATTERNS.API_KEYS.generic.test(key)).toBe(true);
          SENSITIVE_PATTERNS.API_KEYS.generic.lastIndex = 0;
        });
      });

      it('should not detect short generic patterns', () => {
        const shortKeys = [
          'api_key=short',
          'token=123',
          'key=abc'
        ];

        shortKeys.forEach(key => {
          expect(SENSITIVE_PATTERNS.API_KEYS.generic.test(key)).toBe(false);
          SENSITIVE_PATTERNS.API_KEYS.generic.lastIndex = 0;
        });
      });
    });

    describe('Bearer tokens', () => {
      it('should detect Bearer token patterns', () => {
        const bearerTokens = [
          'Bearer abcd1234567890xyz',
          'Bearer eyJhbGciOiJIUzI1NiJ9',
          'bearer long_token_value_123456'
        ];

        bearerTokens.forEach(token => {
          expect(SENSITIVE_PATTERNS.API_KEYS.bearer.test(token)).toBe(true);
          SENSITIVE_PATTERNS.API_KEYS.bearer.lastIndex = 0;
        });
      });
    });

    describe('Authorization headers', () => {
      it('should detect Authorization header patterns', () => {
        const authHeaders = [
          'Authorization: Basic dXNlcjpwYXNzd29yZA==',
          'Authorization: "Bearer abc123def456"',
          'authorization: token_value_123456'
        ];

        authHeaders.forEach(header => {
          expect(SENSITIVE_PATTERNS.API_KEYS.auth_header.test(header)).toBe(true);
          SENSITIVE_PATTERNS.API_KEYS.auth_header.lastIndex = 0;
        });
      });
    });
  });

  describe('DB_CONNECTION_STRINGS', () => {
    describe('MongoDB connections', () => {
      it('should detect MongoDB connection strings', () => {
        const mongoConnections = [
          'mongodb://localhost:27017/mydb',
          'mongodb+srv://user:pass@cluster.mongodb.net/database',
          'mongodb://user:password@host:port/database?options=value'
        ];

        mongoConnections.forEach(conn => {
          expect(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.mongodb.test(conn)).toBe(true);
          SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.mongodb.lastIndex = 0;
        });
      });
    });

    describe('PostgreSQL connections', () => {
      it('should detect PostgreSQL connection strings', () => {
        const pgConnections = [
          'postgresql://user:password@localhost:5432/database',
          'postgres://admin:secret@db.example.com:5432/myapp',
          'postgresql://localhost/mydb'
        ];

        pgConnections.forEach(conn => {
          expect(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.postgresql.test(conn)).toBe(true);
          SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.postgresql.lastIndex = 0;
        });
      });
    });

    describe('MySQL connections', () => {
      it('should detect MySQL connection strings', () => {
        const mysqlConnections = [
          'mysql://user:password@localhost:3306/database',
          'mysql://root:secret@db.example.com/app_db'
        ];

        mysqlConnections.forEach(conn => {
          expect(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.mysql.test(conn)).toBe(true);
          SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.mysql.lastIndex = 0;
        });
      });
    });

    describe('Other database connections', () => {
      it('should detect SQLite connection strings', () => {
        const sqliteConnections = [
          'sqlite://./database.db',
          'sqlite:///absolute/path/to/db.sqlite'
        ];

        sqliteConnections.forEach(conn => {
          expect(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.sqlite.test(conn)).toBe(true);
          SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.sqlite.lastIndex = 0;
        });
      });

      it('should detect Redis connection strings', () => {
        const redisConnections = [
          'redis://localhost:6379',
          'redis://user:password@redis.example.com:6379/0'
        ];

        redisConnections.forEach(conn => {
          expect(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.redis.test(conn)).toBe(true);
          SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.redis.lastIndex = 0;
        });
      });

      it('should detect generic JDBC/ODBC connections', () => {
        const genericConnections = [
          'jdbc:postgresql://localhost:5432/database',
          'odbc:Driver={SQL Server};Server=localhost;Database=mydb'
        ];

        genericConnections.forEach(conn => {
          expect(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.generic.test(conn)).toBe(true);
          SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.generic.lastIndex = 0;
        });
      });

      it('should detect connection strings with credentials', () => {
        const credentialConnections = [
          '//user:password@host:port/database',
          '//admin:secret123@database.example.com:5432/app'
        ];

        credentialConnections.forEach(conn => {
          expect(SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.credentials.test(conn)).toBe(true);
          SENSITIVE_PATTERNS.DB_CONNECTION_STRINGS.credentials.lastIndex = 0;
        });
      });
    });
  });

  describe('TOKEN_PATTERNS', () => {
    describe('JWT tokens', () => {
      it('should detect JWT token patterns', () => {
        const jwtTokens = [
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIzIn0.signature_here'
        ];

        jwtTokens.forEach(token => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.jwt.test(token)).toBe(true);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.jwt.lastIndex = 0;
        });
      });

      it('should not detect invalid JWT patterns', () => {
        const invalidJwts = [
          'eyJ.incomplete',
          'notjwt.header.payload.signature.extra',
          'random.text.here'
        ];

        invalidJwts.forEach(token => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.jwt.test(token)).toBe(false);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.jwt.lastIndex = 0;
        });
      });
    });

    describe('Session tokens', () => {
      it('should detect session token patterns', () => {
        const sessionTokens = [
          'session_id=abcd1234567890efgh',
          'sessiontoken: "xyz789012345abcdef"',
          'sess_id=long_session_identifier_here',
          'session-token=another_session_token_123'
        ];

        sessionTokens.forEach(token => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.session.test(token)).toBe(true);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.session.lastIndex = 0;
        });
      });
    });

    describe('UUID patterns', () => {
      it('should detect UUID patterns', () => {
        const uuids = [
          '123e4567-e89b-12d3-a456-426614174000',
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479'
        ];

        uuids.forEach(uuid => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.uuid.test(uuid)).toBe(true);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.uuid.lastIndex = 0;
        });
      });

      it('should not detect invalid UUID patterns', () => {
        const invalidUuids = [
          '123e4567-e89b-12d3-a456-42661417400',  // too short
          '123e4567-e89b-12d3-a456-426614174000-extra',  // too long
          'not-a-uuid-pattern-at-all-here'
        ];

        invalidUuids.forEach(uuid => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.uuid.test(uuid)).toBe(false);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.uuid.lastIndex = 0;
        });
      });
    });

    describe('Base64 patterns', () => {
      it('should detect long base64 patterns', () => {
        const base64Tokens = [
          'dGhpcyBpcyBhIGxvbmcgYmFzZTY0IGVuY29kZWQgc3RyaW5nIHRoYXQgY291bGQgYmUgYSB0b2tlbg==',
          'YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwQUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVo=',
          'VGhpcyBpcyBhbm90aGVyIGxvbmcgYmFzZTY0IGVuY29kZWQgc3RyaW5nIGZvciB0ZXN0aW5nIHB1cnBvc2Vz'
        ];

        base64Tokens.forEach(token => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.base64.test(token)).toBe(true);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.base64.lastIndex = 0;
        });
      });

      it('should not detect short base64 patterns', () => {
        const shortBase64 = [
          'dGVzdA==',  // "test" in base64
          'aGVsbG8=',  // "hello" in base64
          'c2hvcnQ='   // "short" in base64
        ];

        shortBase64.forEach(token => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.base64.test(token)).toBe(false);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.base64.lastIndex = 0;
        });
      });
    });

    describe('Hex patterns', () => {
      it('should detect long hex patterns', () => {
        const hexTokens = [
          '0x1234567890abcdef1234567890abcdef12345678',
          'abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          '0xdeadbeefcafebabe1234567890abcdef'
        ];

        hexTokens.forEach(token => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.hex.test(token)).toBe(true);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.hex.lastIndex = 0;
        });
      });

      it('should not detect short hex patterns', () => {
        const shortHex = [
          '0x123',
          'abc123',
          'deadbeef'
        ];

        shortHex.forEach(token => {
          expect(SENSITIVE_PATTERNS.TOKEN_PATTERNS.hex.test(token)).toBe(false);
          SENSITIVE_PATTERNS.TOKEN_PATTERNS.hex.lastIndex = 0;
        });
      });
    });
  });
});