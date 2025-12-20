import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from './test-utils';
import { SyntaxHighlighter } from '../ui/components/SyntaxHighlighter';
import { CodeBlock } from '../ui/components/CodeBlock';

// Mock the useStdoutDimensions hook
const mockUseStdoutDimensions = vi.fn();
vi.mock('../ui/hooks/index.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock ink-syntax-highlight for CodeBlock tests
vi.mock('ink-syntax-highlight', () => ({
  default: ({ language, code }: { language: string; code: string }) =>
    React.createElement('span', { 'data-testid': `highlighted-${language}` }, code)
}));

/**
 * Test suite for syntax highlighting language detection and mapping
 * Tests language-specific syntax highlighting and language alias mapping
 */
describe('Syntax Highlighting Languages', () => {
  beforeEach(() => {
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'normal',
      isNarrow: false,
      isCompact: false,
      isNormal: true,
      isWide: false,
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Language Support Coverage', () => {
    const supportedLanguages = [
      'typescript',
      'javascript',
      'python',
      'rust',
      'go',
      'java',
      'csharp',
      'cpp',
      'c',
      'json',
      'yaml',
      'toml',
      'ini',
      'env',
      'bash',
      'shell',
      'powershell',
      'zsh',
      'markdown',
      'xml',
      'sql',
      'graphql',
      'dockerfile',
      'makefile',
      'diff',
      'regex',
      'html',
      'css',
      'scss',
      'sass',
      'less'
    ];

    supportedLanguages.forEach(language => {
      it(`supports ${language} syntax highlighting`, () => {
        const testCode = getTestCodeForLanguage(language);

        render(
          <SyntaxHighlighter
            code={testCode}
            language={language}
          />
        );

        expect(screen.getByText(language)).toBeInTheDocument();
        expect(screen.getByText(testCode)).toBeInTheDocument();
      });
    });
  });

  describe('Language Alias Mapping (CodeBlock)', () => {
    const languageAliases = [
      { alias: 'ts', canonical: 'typescript' },
      { alias: 'js', canonical: 'javascript' },
      { alias: 'py', canonical: 'python' },
      { alias: 'rb', canonical: 'ruby' },
      { alias: 'sh', canonical: 'bash' },
      { alias: 'shell', canonical: 'bash' },
      { alias: 'yml', canonical: 'yaml' },
      { alias: 'md', canonical: 'markdown' },
    ];

    languageAliases.forEach(({ alias, canonical }) => {
      it(`maps ${alias} to ${canonical}`, () => {
        render(
          <CodeBlock
            code="test code"
            language={alias}
          />
        );

        expect(screen.getByText(canonical)).toBeInTheDocument();
        expect(screen.getByTestId(`highlighted-${canonical}`)).toBeInTheDocument();
      });
    });

    it('handles case-insensitive language mapping', () => {
      render(
        <CodeBlock
          code="test code"
          language="TypeScript"
        />
      );

      expect(screen.getByText('typescript')).toBeInTheDocument();
    });

    it('preserves unmapped languages as-is', () => {
      render(
        <CodeBlock
          code="test code"
          language="customlang"
        />
      );

      expect(screen.getByText('customlang')).toBeInTheDocument();
    });
  });

  describe('Language-Specific Code Examples', () => {
    describe('Web Development Languages', () => {
      it('renders TypeScript with interfaces and generics', () => {
        const tsCode = `interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

type UserRole = 'admin' | 'user' | 'guest';

class UserService {
  async getUser<T extends User>(id: string): Promise<ApiResponse<T>> {
    const response = await fetch(\`/api/users/\${id}\`);
    return response.json();
  }
}`;

        render(
          <SyntaxHighlighter
            code={tsCode}
            language="typescript"
          />
        );

        expect(screen.getByText('typescript')).toBeInTheDocument();
        expect(screen.getByText(/interface ApiResponse/)).toBeInTheDocument();
        expect(screen.getByText(/type UserRole/)).toBeInTheDocument();
      });

      it('renders JavaScript with modern syntax', () => {
        const jsCode = `const userService = {
  async fetchUsers() {
    try {
      const response = await fetch('/api/users');
      const users = await response.json();
      return users.map(user => ({ ...user, isActive: true }));
    } catch (error) {
      console.error('Failed to fetch users:', error);
      throw new Error('User fetch failed');
    }
  }
};

export default userService;`;

        render(
          <SyntaxHighlighter
            code={jsCode}
            language="javascript"
          />
        );

        expect(screen.getByText('javascript')).toBeInTheDocument();
        expect(screen.getByText(/async fetchUsers/)).toBeInTheDocument();
        expect(screen.getByText(/export default/)).toBeInTheDocument();
      });

      it('renders HTML with attributes', () => {
        const htmlCode = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APEX Authentication</title>
</head>
<body>
    <div class="container">
        <form id="loginForm" action="/auth/login" method="post">
            <input type="email" name="email" required>
            <input type="password" name="password" required>
            <button type="submit">Login</button>
        </form>
    </div>
</body>
</html>`;

        render(
          <SyntaxHighlighter
            code={htmlCode}
            language="html"
          />
        );

        expect(screen.getByText('html')).toBeInTheDocument();
        expect(screen.getByText(/<!DOCTYPE html>/)).toBeInTheDocument();
      });

      it('renders CSS with modern features', () => {
        const cssCode = `.auth-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-form {
  background: rgba(255, 255, 255, 0.95);
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

@media (max-width: 768px) {
  .login-form {
    margin: 1rem;
    padding: 1.5rem;
  }
}`;

        render(
          <SyntaxHighlighter
            code={cssCode}
            language="css"
          />
        );

        expect(screen.getByText('css')).toBeInTheDocument();
        expect(screen.getByText(/backdrop-filter/)).toBeInTheDocument();
      });
    });

    describe('Backend Languages', () => {
      it('renders Python with async/await and type hints', () => {
        const pythonCode = `from typing import List, Optional, Dict, Any
import asyncio
import aiohttp
from dataclasses import dataclass

@dataclass
class User:
    id: int
    email: str
    name: str
    is_active: bool = True

class UserRepository:
    def __init__(self, database_url: str):
        self.db_url = database_url

    async def find_by_email(self, email: str) -> Optional[User]:
        """Find user by email address."""
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.db_url}/users?email={email}") as response:
                if response.status == 200:
                    data = await response.json()
                    return User(**data) if data else None
                return None

    async def create_user(self, user_data: Dict[str, Any]) -> User:
        """Create a new user."""
        # Implementation here
        pass`;

        render(
          <SyntaxHighlighter
            code={pythonCode}
            language="python"
          />
        );

        expect(screen.getByText('python')).toBeInTheDocument();
        expect(screen.getByText(/async def/)).toBeInTheDocument();
        expect(screen.getByText(/@dataclass/)).toBeInTheDocument();
      });

      it('renders Go with structs and interfaces', () => {
        const goCode = `package auth

import (
    "context"
    "errors"
    "time"
    "github.com/golang-jwt/jwt/v5"
)

type User struct {
    ID       int64     \`json:"id" db:"id"\`
    Email    string    \`json:"email" db:"email"\`
    Name     string    \`json:"name" db:"name"\`
    IsActive bool      \`json:"is_active" db:"is_active"\`
    CreatedAt time.Time \`json:"created_at" db:"created_at"\`
}

type UserRepository interface {
    FindByEmail(ctx context.Context, email string) (*User, error)
    Create(ctx context.Context, user *User) error
}

type AuthService struct {
    userRepo UserRepository
    jwtSecret []byte
}

func NewAuthService(userRepo UserRepository, secret string) *AuthService {
    return &AuthService{
        userRepo: userRepo,
        jwtSecret: []byte(secret),
    }
}

func (s *AuthService) Authenticate(ctx context.Context, email, password string) (*User, string, error) {
    user, err := s.userRepo.FindByEmail(ctx, email)
    if err != nil {
        return nil, "", err
    }

    if user == nil {
        return nil, "", errors.New("user not found")
    }

    // Generate JWT token
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
        "user_id": user.ID,
        "email":   user.Email,
        "exp":     time.Now().Add(24 * time.Hour).Unix(),
    })

    tokenString, err := token.SignedString(s.jwtSecret)
    if err != nil {
        return nil, "", err
    }

    return user, tokenString, nil
}`;

        render(
          <SyntaxHighlighter
            code={goCode}
            language="go"
          />
        );

        expect(screen.getByText('go')).toBeInTheDocument();
        expect(screen.getByText(/package auth/)).toBeInTheDocument();
        expect(screen.getByText(/type User struct/)).toBeInTheDocument();
      });

      it('renders Rust with ownership and error handling', () => {
        const rustCode = `use serde::{Deserialize, Serialize};
use sqlx::{PgPool, FromRow};
use thiserror::Error;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Error, Debug)]
pub enum AuthError {
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("User not found")]
    UserNotFound,
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    #[error("JWT error: {0}")]
    JwtError(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    pub name: String,
    pub password_hash: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

pub struct AuthService {
    db_pool: PgPool,
    jwt_secret: String,
}

impl AuthService {
    pub fn new(db_pool: PgPool, jwt_secret: String) -> Self {
        Self { db_pool, jwt_secret }
    }

    pub async fn authenticate(&self, email: &str, password: &str) -> Result<(User, String), AuthError> {
        let user = sqlx::query_as::<_, User>(
            "SELECT * FROM users WHERE email = $1 AND is_active = true"
        )
        .bind(email)
        .fetch_optional(&self.db_pool)
        .await?
        .ok_or(AuthError::UserNotFound)?;

        if !self.verify_password(password, &user.password_hash)? {
            return Err(AuthError::InvalidCredentials);
        }

        let token = self.generate_jwt(&user)?;
        Ok((user, token))
    }

    fn verify_password(&self, password: &str, hash: &str) -> Result<bool, AuthError> {
        // Password verification logic
        Ok(bcrypt::verify(password, hash).unwrap_or(false))
    }

    fn generate_jwt(&self, user: &User) -> Result<String, AuthError> {
        // JWT generation logic
        todo!("Implement JWT generation")
    }
}`;

        render(
          <SyntaxHighlighter
            code={rustCode}
            language="rust"
          />
        );

        expect(screen.getByText('rust')).toBeInTheDocument();
        expect(screen.getByText(/use serde/)).toBeInTheDocument();
        expect(screen.getByText(/#\[derive/)).toBeInTheDocument();
      });
    });

    describe('Configuration Languages', () => {
      it('renders JSON with complex structures', () => {
        const jsonCode = `{
  "name": "@apex/authentication",
  "version": "1.0.0",
  "description": "APEX authentication module with JWT support",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc && rollup -c",
    "test": "vitest run --coverage",
    "lint": "eslint src/ --ext .ts,.tsx",
    "format": "prettier --write 'src/**/*.{ts,tsx,json}'"
  },
  "dependencies": {
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "express-rate-limit": "^6.7.0",
    "helmet": "^6.1.5",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.2",
    "typescript": "^5.0.0",
    "vitest": "^0.32.0",
    "rollup": "^3.25.0"
  },
  "auth": {
    "jwt": {
      "algorithm": "HS256",
      "expiresIn": "24h",
      "issuer": "apex-auth",
      "audience": "apex-users"
    },
    "password": {
      "minLength": 8,
      "requireSpecialChars": true,
      "requireNumbers": true,
      "saltRounds": 12
    },
    "rateLimit": {
      "windowMs": 900000,
      "maxAttempts": 5,
      "blockDuration": 1800000
    }
  }
}`;

        render(
          <SyntaxHighlighter
            code={jsonCode}
            language="json"
          />
        );

        expect(screen.getByText('json')).toBeInTheDocument();
        expect(screen.getByText(/dependencies/)).toBeInTheDocument();
        expect(screen.getByText(/rateLimit/)).toBeInTheDocument();
      });

      it('renders YAML with complex configurations', () => {
        const yamlCode = `# APEX Authentication Service Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: apex-auth-service
  namespace: apex
  labels:
    app: apex-auth
    component: authentication
    version: v1.0.0
spec:
  replicas: 3
  selector:
    matchLabels:
      app: apex-auth
  template:
    metadata:
      labels:
        app: apex-auth
    spec:
      containers:
      - name: auth-service
        image: apex/auth:1.0.0
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: auth-secrets
              key: jwt-secret
        - name: DB_CONNECTION_STRING
          valueFrom:
            secretKeyRef:
              name: db-secrets
              key: connection-string
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: apex-auth-service
spec:
  selector:
    app: apex-auth
  ports:
  - port: 80
    targetPort: 3000
    name: http
  type: ClusterIP`;

        render(
          <SyntaxHighlighter
            code={yamlCode}
            language="yaml"
          />
        );

        expect(screen.getByText('yaml')).toBeInTheDocument();
        expect(screen.getByText(/apiVersion/)).toBeInTheDocument();
        expect(screen.getByText(/containers:/)).toBeInTheDocument();
      });
    });

    describe('Shell and Scripting Languages', () => {
      it('renders Bash with complex script logic', () => {
        const bashCode = `#!/bin/bash
set -euo pipefail

# APEX Authentication Service Deployment Script
# This script deploys the authentication service with proper configuration

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly ENV_FILE="$PROJECT_ROOT/.env"
readonly DOCKER_COMPOSE_FILE="$PROJECT_ROOT/docker-compose.auth.yml"

# Colors for output
readonly RED='\\033[0;31m'
readonly GREEN='\\033[0;32m'
readonly YELLOW='\\033[1;33m'
readonly NC='\\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "\${GREEN}[INFO]\${NC} $1"
}

log_warn() {
    echo -e "\${YELLOW}[WARN]\${NC} $1"
}

log_error() {
    echo -e "\${RED}[ERROR]\${NC} $1"
}

# Check if required tools are installed
check_dependencies() {
    local deps=("docker" "docker-compose" "curl" "jq")
    for dep in "\${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Required dependency '$dep' is not installed"
            exit 1
        fi
    done
}

# Generate JWT secret if not exists
generate_jwt_secret() {
    if [[ ! -f "$ENV_FILE" ]] || ! grep -q "JWT_SECRET" "$ENV_FILE"; then
        log_info "Generating JWT secret..."
        local jwt_secret
        jwt_secret=$(openssl rand -hex 64)
        echo "JWT_SECRET=$jwt_secret" >> "$ENV_FILE"
        log_info "JWT secret generated and saved to $ENV_FILE"
    fi
}

# Deploy the authentication service
deploy_auth_service() {
    log_info "Building and deploying authentication service..."

    if docker-compose -f "$DOCKER_COMPOSE_FILE" up -d --build; then
        log_info "Authentication service deployed successfully"

        # Wait for service to be ready
        log_info "Waiting for service to be ready..."
        local max_attempts=30
        local attempt=0

        while [[ $attempt -lt $max_attempts ]]; do
            if curl -s http://localhost:3000/health > /dev/null; then
                log_info "Service is ready!"
                break
            fi

            ((attempt++))
            sleep 2
        done

        if [[ $attempt -eq $max_attempts ]]; then
            log_error "Service did not become ready within expected time"
            return 1
        fi
    else
        log_error "Failed to deploy authentication service"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting APEX Authentication Service deployment..."

    check_dependencies
    generate_jwt_secret
    deploy_auth_service

    log_info "Deployment completed successfully!"
    log_info "Authentication service is available at: http://localhost:3000"
    log_info "Health check endpoint: http://localhost:3000/health"
}

# Run main function if script is executed directly
if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
    main "$@"
fi`;

        render(
          <SyntaxHighlighter
            code={bashCode}
            language="bash"
          />
        );

        expect(screen.getByText('bash')).toBeInTheDocument();
        expect(screen.getByText(/#!/bin\/bash/)).toBeInTheDocument();
        expect(screen.getByText(/readonly SCRIPT_DIR/)).toBeInTheDocument();
      });
    });

    describe('Database Languages', () => {
      it('renders SQL with complex queries', () => {
        const sqlCode = `-- APEX Authentication Database Schema and Queries
-- Creates tables and provides sample queries for user authentication

-- Create users table with proper constraints
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,

    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
);

-- Create user sessions table for JWT token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true,

    INDEX idx_user_sessions_user_id (user_id),
    INDEX idx_user_sessions_token_hash (token_hash),
    INDEX idx_user_sessions_expires_at (expires_at)
);

-- Create roles and permissions tables
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),

    PRIMARY KEY (user_id, role_id)
);

-- Insert default roles
INSERT INTO roles (name, description) VALUES
    ('admin', 'Administrator with full access'),
    ('user', 'Regular user with standard permissions'),
    ('guest', 'Guest user with limited access');

-- Complex query: Get user authentication data with session info
SELECT
    u.id,
    u.email,
    u.name,
    u.is_active,
    u.email_verified,
    u.last_login_at,
    COUNT(s.id) AS active_sessions,
    MAX(s.last_used_at) AS last_session_activity,
    ARRAY_AGG(r.name ORDER BY r.name) AS roles
FROM users u
LEFT JOIN user_sessions s ON s.user_id = u.id
    AND s.is_active = true
    AND s.expires_at > NOW()
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r ON r.id = ur.role_id
WHERE u.is_active = true
GROUP BY u.id, u.email, u.name, u.is_active, u.email_verified, u.last_login_at
ORDER BY u.last_login_at DESC NULLS LAST;

-- Cleanup expired sessions (should be run periodically)
DELETE FROM user_sessions
WHERE expires_at < NOW() - INTERVAL '7 days';

-- Update user last login time and cleanup old sessions
WITH session_cleanup AS (
    DELETE FROM user_sessions
    WHERE user_id = $1
      AND (expires_at < NOW() OR NOT is_active)
    RETURNING user_id
)
UPDATE users
SET last_login_at = NOW()
WHERE id = $1
  AND is_active = true
RETURNING id, email, name, last_login_at;`;

        render(
          <SyntaxHighlighter
            code={sqlCode}
            language="sql"
          />
        );

        expect(screen.getByText('sql')).toBeInTheDocument();
        expect(screen.getByText(/CREATE TABLE users/)).toBeInTheDocument();
        expect(screen.getByText(/WITH session_cleanup/)).toBeInTheDocument();
      });
    });
  });

  describe('File Extension to Language Detection', () => {
    it('detects language from common file extensions', () => {
      const extensionTests = [
        { extension: '.ts', expectedLanguage: 'typescript' },
        { extension: '.tsx', expectedLanguage: 'typescript' },
        { extension: '.js', expectedLanguage: 'javascript' },
        { extension: '.jsx', expectedLanguage: 'javascript' },
        { extension: '.py', expectedLanguage: 'python' },
        { extension: '.rs', expectedLanguage: 'rust' },
        { extension: '.go', expectedLanguage: 'go' },
        { extension: '.sql', expectedLanguage: 'sql' },
        { extension: '.yml', expectedLanguage: 'yaml' },
        { extension: '.yaml', expectedLanguage: 'yaml' },
        { extension: '.json', expectedLanguage: 'json' },
        { extension: '.md', expectedLanguage: 'markdown' },
        { extension: '.sh', expectedLanguage: 'bash' },
        { extension: '.dockerfile', expectedLanguage: 'dockerfile' },
        { extension: '.env', expectedLanguage: 'bash' },
      ];

      extensionTests.forEach(({ extension, expectedLanguage }) => {
        const filename = `test${extension}`;

        render(
          <CodeBlock
            code="test code"
            filename={filename}
          />
        );

        expect(screen.getByText(filename)).toBeInTheDocument();
        // Language should be auto-detected or explicitly set
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('handles unknown languages gracefully', () => {
      render(
        <SyntaxHighlighter
          code="custom syntax code"
          language="unknownlang"
        />
      );

      expect(screen.getByText('unknownlang')).toBeInTheDocument();
      expect(screen.getByText('custom syntax code')).toBeInTheDocument();
    });

    it('handles empty language string', () => {
      render(
        <SyntaxHighlighter
          code="test code"
          language=""
        />
      );

      // Should fallback to default or handle empty string
      expect(screen.getByText('test code')).toBeInTheDocument();
    });

    it('handles special characters in code', () => {
      const specialCode = 'const symbols = "!@#$%^&*()[]{}|\\:;\'\\",.<>?/`~";';

      render(
        <SyntaxHighlighter
          code={specialCode}
          language="javascript"
        />
      );

      expect(screen.getByText('javascript')).toBeInTheDocument();
      expect(screen.getByText(/symbols/)).toBeInTheDocument();
    });

    it('handles very long language names', () => {
      const longLanguageName = 'verylonglanguagenamethatexceedsnormallimits';

      render(
        <SyntaxHighlighter
          code="test"
          language={longLanguageName}
        />
      );

      expect(screen.getByText(longLanguageName)).toBeInTheDocument();
    });
  });
});

/**
 * Helper function to get appropriate test code for each language
 */
function getTestCodeForLanguage(language: string): string {
  const codeExamples: Record<string, string> = {
    typescript: 'interface User { id: string; name: string; }',
    javascript: 'const user = { id: "123", name: "John" };',
    python: 'def hello_world(): print("Hello, World!")',
    rust: 'fn main() { println!("Hello, World!"); }',
    go: 'func main() { fmt.Println("Hello, World!") }',
    java: 'public class Main { public static void main(String[] args) {} }',
    csharp: 'public class Program { static void Main() {} }',
    cpp: '#include <iostream>\nint main() { return 0; }',
    c: '#include <stdio.h>\nint main() { return 0; }',
    json: '{ "name": "test", "version": "1.0.0" }',
    yaml: 'name: test\nversion: 1.0.0',
    toml: '[package]\nname = "test"\nversion = "1.0.0"',
    ini: '[section]\nkey=value',
    env: 'NODE_ENV=production\nPORT=3000',
    bash: '#!/bin/bash\necho "Hello, World!"',
    shell: 'echo "Hello, World!"',
    powershell: 'Write-Output "Hello, World!"',
    zsh: 'echo "Hello from Zsh!"',
    markdown: '# Hello World\nThis is a **test**.',
    xml: '<?xml version="1.0"?><root><item>test</item></root>',
    sql: 'SELECT * FROM users WHERE active = true;',
    graphql: 'query { users { id name email } }',
    dockerfile: 'FROM node:18\nCOPY . .\nRUN npm install',
    makefile: 'all:\n\techo "Building..."',
    diff: '+added line\n-removed line',
    regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
    html: '<!DOCTYPE html><html><body><h1>Test</h1></body></html>',
    css: '.container { display: flex; justify-content: center; }',
    scss: '$primary-color: #007acc; .btn { color: $primary-color; }',
    sass: '$primary-color: #007acc\n.btn\n  color: $primary-color',
    less: '@primary-color: #007acc; .btn { color: @primary-color; }',
  };

  return codeExamples[language] || `// ${language} code example`;
}