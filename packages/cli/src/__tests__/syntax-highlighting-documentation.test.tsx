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

/**
 * Test suite for syntax highlighting documentation examples
 * Validates that all code examples in the v030-features.md documentation work correctly
 */
describe('Syntax Highlighting Documentation Examples', () => {
  beforeEach(() => {
    mockUseStdoutDimensions.mockReturnValue({
      width: 120,
      height: 30,
      breakpoint: 'wide',
      isNarrow: false,
      isCompact: false,
      isNormal: false,
      isWide: true,
      isAvailable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('TypeScript Examples', () => {
    it('renders AuthService.ts example correctly', () => {
      const authServiceCode = `import { sign, verify } from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  email: string;
  role: 'admin' | 'user';
}

export class AuthService {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  generateToken(payload: TokenPayload): string {
    return sign(payload, this.secret, { expiresIn: '24h' });
  }

  verifyToken(token: string): TokenPayload | null {
    try {
      return verify(token, this.secret) as TokenPayload;
    } catch {
      return null;
    }
  }
}`;

      render(
        <SyntaxHighlighter
          code={authServiceCode}
          language="typescript"
          showLineNumbers={true}
        />
      );

      // Check that TypeScript-specific elements are present
      expect(screen.getByText('typescript')).toBeInTheDocument();
      expect(screen.getByText(/interface TokenPayload/)).toBeInTheDocument();
      expect(screen.getByText(/export class AuthService/)).toBeInTheDocument();
      expect(screen.getByText(/24 lines/)).toBeInTheDocument();
    });

    it('renders UserProfile.tsx component example correctly', () => {
      const userProfileCode = `import React, { useState, useEffect } from 'react';
import { User, UserService } from '../services/UserService';

interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await UserService.getUser(userId);
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div>
      <h1>{user.name}</h1>
      <p>{user.email}</p>
    </div>
  );
};`;

      render(
        <SyntaxHighlighter
          code={userProfileCode}
          language="typescript"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText(/React\.FC/)).toBeInTheDocument();
      expect(screen.getByText(/useState/)).toBeInTheDocument();
      expect(screen.getByText(/useEffect/)).toBeInTheDocument();
    });
  });

  describe('Python Examples', () => {
    it('renders data_processor.py example correctly', () => {
      const pythonCode = `from typing import List, Dict, Optional
from dataclasses import dataclass
import asyncio

@dataclass
class ProcessingResult:
    """Result of data processing operation."""
    success: bool
    data: Optional[Dict] = None
    error: Optional[str] = None

async def process_batch(items: List[str]) -> List[ProcessingResult]:
    """Process a batch of items asynchronously."""
    tasks = [process_item(item) for item in items]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    return [
        ProcessingResult(success=True, data=r) if not isinstance(r, Exception)
        else ProcessingResult(success=False, error=str(r))
        for r in results
    ]

async def process_item(item: str) -> Dict:
    """Process a single item."""
    # Simulate some async processing
    await asyncio.sleep(0.1)
    return {"item": item, "processed": True}`;

      render(
        <SyntaxHighlighter
          code={pythonCode}
          language="python"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('python')).toBeInTheDocument();
      expect(screen.getByText(/dataclass/)).toBeInTheDocument();
      expect(screen.getByText(/async def/)).toBeInTheDocument();
      expect(screen.getByText(/await asyncio/)).toBeInTheDocument();
    });
  });

  describe('JSON Examples', () => {
    it('renders package.json configuration correctly', () => {
      const packageJson = `{
  "name": "@apexcli/cli",
  "version": "0.3.0",
  "description": "APEX Command Line Interface",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "lint": "eslint src/"
  },
  "dependencies": {
    "ink": "^4.4.1",
    "react": "^18.2.0",
    "chalk": "^5.3.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "@types/node": "^20.10.0"
  }
}`;

      render(
        <SyntaxHighlighter
          code={packageJson}
          language="json"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('json')).toBeInTheDocument();
      expect(screen.getByText(/dependencies/)).toBeInTheDocument();
      expect(screen.getByText(/scripts/)).toBeInTheDocument();
    });
  });

  describe('YAML Examples', () => {
    it('renders .apex/config.yaml correctly', () => {
      const configYaml = `# APEX Project Configuration
project:
  name: my-application
  version: 1.0.0

agents:
  planner:
    enabled: true
    model: claude-sonnet-4-20250514
    maxTokens: 4096

  developer:
    enabled: true
    model: claude-sonnet-4-20250514
    tools:
      - read_file
      - write_file
      - execute_command

limits:
  maxConcurrentTasks: 5
  costLimit: 10.00  # USD per session
  tokenLimit: 100000`;

      render(
        <SyntaxHighlighter
          code={configYaml}
          language="yaml"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('yaml')).toBeInTheDocument();
      expect(screen.getByText(/project:/)).toBeInTheDocument();
      expect(screen.getByText(/agents:/)).toBeInTheDocument();
    });
  });

  describe('Bash/Shell Examples', () => {
    it('renders deploy.sh script correctly', () => {
      const bashCode = `#!/bin/bash
set -euo pipefail

# Configuration
DEPLOY_ENV="\${1:-production}"
BUILD_DIR="./dist"
REMOTE_HOST="deploy@example.com"

echo "🚀 Deploying to \${DEPLOY_ENV}..."

# Build the project
npm run build

# Run tests before deployment
if [[ "$DEPLOY_ENV" == "production" ]]; then
    npm run test:e2e
fi

# Deploy to remote server
rsync -avz --delete "$BUILD_DIR/" "$REMOTE_HOST:/var/www/app/"

echo "✅ Deployment complete!"`;

      render(
        <SyntaxHighlighter
          code={bashCode}
          language="bash"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('bash')).toBeInTheDocument();
      expect(screen.getByText(/#!/bin\/bash/)).toBeInTheDocument();
      expect(screen.getByText(/rsync/)).toBeInTheDocument();
    });
  });

  describe('SQL Examples', () => {
    it('renders analytics query correctly', () => {
      const sqlCode = `-- Get user activity analytics for the past 30 days
SELECT
    u.id,
    u.email,
    COUNT(DISTINCT s.id) AS session_count,
    SUM(s.duration_seconds) / 3600.0 AS total_hours,
    AVG(s.actions_count) AS avg_actions_per_session
FROM users u
LEFT JOIN sessions s ON s.user_id = u.id
    AND s.created_at >= CURRENT_DATE - INTERVAL '30 days'
WHERE u.is_active = TRUE
GROUP BY u.id, u.email
HAVING COUNT(DISTINCT s.id) > 0
ORDER BY total_hours DESC
LIMIT 100;`;

      render(
        <SyntaxHighlighter
          code={sqlCode}
          language="sql"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('sql')).toBeInTheDocument();
      expect(screen.getByText(/SELECT/)).toBeInTheDocument();
      expect(screen.getByText(/LEFT JOIN/)).toBeInTheDocument();
    });
  });

  describe('Dockerfile Examples', () => {
    it('renders multi-stage Dockerfile correctly', () => {
      const dockerfileCode = `# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app

ENV NODE_ENV=production
EXPOSE 3000

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "dist/index.js"]`;

      render(
        <SyntaxHighlighter
          code={dockerfileCode}
          language="dockerfile"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('dockerfile')).toBeInTheDocument();
      expect(screen.getByText(/FROM node:20-alpine/)).toBeInTheDocument();
      expect(screen.getByText(/COPY --from=builder/)).toBeInTheDocument();
    });
  });

  describe('Go Examples', () => {
    it('renders server.go example correctly', () => {
      const goCode = `package main

import (
    "fmt"
    "log"
    "net/http"
    "time"
)

type Server struct {
    Port    string
    Timeout time.Duration
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    fmt.Fprintf(w, \`{"status": "healthy", "timestamp": "%s"}\`,
        time.Now().Format(time.RFC3339))
}

func (s *Server) Start() error {
    mux := http.NewServeMux()
    mux.HandleFunc("/health", s.handleHealth)

    server := &http.Server{
        Addr:         ":" + s.Port,
        Handler:      mux,
        ReadTimeout:  s.Timeout,
        WriteTimeout: s.Timeout,
    }

    log.Printf("Server starting on port %s", s.Port)
    return server.ListenAndServe()
}

func main() {
    server := &Server{
        Port:    "8080",
        Timeout: 30 * time.Second,
    }

    if err := server.Start(); err != nil {
        log.Fatal("Server failed:", err)
    }
}`;

      render(
        <SyntaxHighlighter
          code={goCode}
          language="go"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('go')).toBeInTheDocument();
      expect(screen.getByText(/package main/)).toBeInTheDocument();
      expect(screen.getByText(/func main()/)).toBeInTheDocument();
    });
  });

  describe('Rust Examples', () => {
    it('renders auth.rs example correctly', () => {
      const rustCode = `use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AuthError {
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("Token expired")]
    TokenExpired,
    #[error("Database error: {0}")]
    DatabaseError(String),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct User {
    pub id: u64,
    pub email: String,
    pub name: String,
    pub roles: Vec<String>,
}

pub struct AuthService {
    users: HashMap<String, User>,
    secret_key: String,
}

impl AuthService {
    pub fn new(secret_key: String) -> Self {
        Self {
            users: HashMap::new(),
            secret_key,
        }
    }

    pub async fn authenticate(
        &self,
        email: &str,
        password: &str,
    ) -> Result<String, AuthError> {
        // Authentication logic here
        todo!("Implement authentication")
    }
}`;

      render(
        <SyntaxHighlighter
          code={rustCode}
          language="rust"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('rust')).toBeInTheDocument();
      expect(screen.getByText(/use serde/)).toBeInTheDocument();
      expect(screen.getByText(/#\[derive/)).toBeInTheDocument();
    });
  });

  describe('Markdown Examples', () => {
    it('renders README.md example correctly', () => {
      const markdownCode = `# APEX Authentication Module

A secure, JWT-based authentication system for modern web applications.

## Features

- **Secure JWT tokens** with configurable expiration
- **Role-based access control** with flexible permissions
- **Password hashing** using bcrypt with salt rounds
- **Rate limiting** to prevent brute force attacks
- **Session management** with automatic cleanup

## Quick Start

\`\`\`typescript
import { AuthService } from '@apexcli/auth';

const auth = new AuthService({
  jwtSecret: process.env.JWT_SECRET,
  tokenExpiry: '24h'
});

// Authenticate user
const token = await auth.login(email, password);
\`\`\`

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| \`jwtSecret\` | string | - | Secret key for JWT signing |
| \`tokenExpiry\` | string | '1h' | Token expiration time |
| \`hashRounds\` | number | 12 | bcrypt salt rounds |

> **Security Note**: Always use environment variables for sensitive
> configuration like JWT secrets in production environments.`;

      render(
        <SyntaxHighlighter
          code={markdownCode}
          language="markdown"
          showLineNumbers={true}
        />
      );

      expect(screen.getByText('markdown')).toBeInTheDocument();
      expect(screen.getByText(/# APEX Authentication/)).toBeInTheDocument();
      expect(screen.getByText(/## Features/)).toBeInTheDocument();
    });
  });
});