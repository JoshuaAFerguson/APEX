/**
 * Integration tests for TreeSitterWrapper class
 *
 * Tests real-world scenarios and integration with the file system
 * for comprehensive validation of the TreeSitterWrapper functionality.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { TreeSitterWrapper, SupportedLanguage } from './tree-sitter-wrapper.js';

describe('TreeSitterWrapper Integration Tests', () => {
  let wrapper: TreeSitterWrapper;
  const tempDir = path.join(__dirname, '__temp_integration_test__');

  beforeEach(async () => {
    TreeSitterWrapper.resetInstance();
    wrapper = TreeSitterWrapper.getInstance();

    // Create temp directory for test files
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    TreeSitterWrapper.resetInstance();

    // Clean up temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('Real-world Code Parsing', () => {
    it('should parse a complete TypeScript React component', async () => {
      const componentCode = `
import React, { useState, useEffect } from 'react';
import { User, ApiResponse } from '../types';

interface UserProfileProps {
  userId: string;
  onUserUpdate: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ userId, onUserUpdate }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await fetch(\`/api/users/\${userId}\`);

        if (!response.ok) {
          throw new Error(\`Failed to fetch user: \${response.status}\`);
        }

        const data: ApiResponse<User> = await response.json();
        setUser(data.user);
        onUserUpdate(data.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [userId, onUserUpdate]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!user) return <div>User not found</div>;

  return (
    <div className="user-profile">
      <h1>{user.name}</h1>
      <p>Email: {user.email}</p>
      <p>Last login: {new Date(user.lastLogin).toLocaleDateString()}</p>
    </div>
  );
};
`;

      const result = await wrapper.parse(componentCode, SupportedLanguage.TSX);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('program');
      expect(result.language).toBe(SupportedLanguage.TSX);

      // Verify we can traverse the AST
      const importNodes = [];
      const cursor = result.rootNode.walk();

      const visitNode = () => {
        if (cursor.currentNode.type === 'import_statement') {
          importNodes.push(cursor.currentNode.text);
        }

        if (cursor.gotoFirstChild()) {
          do {
            visitNode();
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      };

      visitNode();
      expect(importNodes.length).toBeGreaterThan(0);
    });

    it('should parse a Python class with async methods and decorators', async () => {
      const pythonCode = `
import asyncio
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

@dataclass
class UserSession:
    user_id: str
    session_token: str
    created_at: datetime = field(default_factory=datetime.now)
    last_activity: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self, timeout_minutes: int = 30) -> bool:
        """Check if the session has expired."""
        delta = datetime.now() - self.last_activity
        return delta.total_seconds() > (timeout_minutes * 60)

class SessionManager:
    """Manages user sessions with async operations."""

    def __init__(self, redis_client):
        self.redis = redis_client
        self.sessions: Dict[str, UserSession] = {}
        self._cleanup_task = None

    async def __aenter__(self):
        """Async context manager entry."""
        await self.start_cleanup_task()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.stop_cleanup_task()

    @property
    def active_sessions(self) -> List[UserSession]:
        """Get all active sessions."""
        return [s for s in self.sessions.values() if not s.is_expired()]

    async def create_session(self, user_id: str, metadata: Optional[Dict[str, Any]] = None) -> UserSession:
        """Create a new user session."""
        try:
            session = UserSession(
                user_id=user_id,
                session_token=await self._generate_token(),
                metadata=metadata or {}
            )

            self.sessions[session.session_token] = session
            await self._persist_session(session)

            logger.info(f"Created session for user {user_id}")
            return session

        except Exception as e:
            logger.error(f"Failed to create session for user {user_id}: {e}")
            raise

    async def _generate_token(self) -> str:
        """Generate a secure session token."""
        import secrets
        return secrets.token_urlsafe(32)

    async def _persist_session(self, session: UserSession) -> None:
        """Persist session to Redis."""
        key = f"session:{session.session_token}"
        data = {
            'user_id': session.user_id,
            'created_at': session.created_at.isoformat(),
            'last_activity': session.last_activity.isoformat(),
            'metadata': session.metadata
        }
        await self.redis.hset(key, mapping=data)
        await self.redis.expire(key, 1800)  # 30 minutes
`;

      const result = await wrapper.parse(pythonCode, SupportedLanguage.Python);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('module');
      expect(result.language).toBe(SupportedLanguage.Python);

      // Verify we can find class definitions
      let classCount = 0;
      const cursor = result.rootNode.walk();

      const visitNode = () => {
        if (cursor.currentNode.type === 'class_definition') {
          classCount++;
        }

        if (cursor.gotoFirstChild()) {
          do {
            visitNode();
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      };

      visitNode();
      expect(classCount).toBeGreaterThan(0);
    });

    it('should parse a complex Go application with goroutines', async () => {
      const goCode = `
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "net/http"
    "sync"
    "time"
)

type User struct {
    ID        int64     \`json:"id" db:"id"\`
    Name      string    \`json:"name" db:"name"\`
    Email     string    \`json:"email" db:"email"\`
    CreatedAt time.Time \`json:"created_at" db:"created_at"\`
}

type UserService struct {
    mu    sync.RWMutex
    users map[int64]*User
    nextID int64
}

func NewUserService() *UserService {
    return &UserService{
        users: make(map[int64]*User),
        nextID: 1,
    }
}

func (s *UserService) CreateUser(ctx context.Context, name, email string) (*User, error) {
    s.mu.Lock()
    defer s.mu.Unlock()

    user := &User{
        ID:        s.nextID,
        Name:      name,
        Email:     email,
        CreatedAt: time.Now(),
    }

    s.users[s.nextID] = user
    s.nextID++

    return user, nil
}

func (s *UserService) GetUser(ctx context.Context, id int64) (*User, error) {
    s.mu.RLock()
    defer s.mu.RUnlock()

    user, exists := s.users[id]
    if !exists {
        return nil, fmt.Errorf("user with id %d not found", id)
    }

    return user, nil
}

func (s *UserService) HandleUserRequest(w http.ResponseWriter, r *http.Request) {
    ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
    defer cancel()

    switch r.Method {
    case http.MethodPost:
        var req struct {
            Name  string \`json:"name"\`
            Email string \`json:"email"\`
        }

        if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
            http.Error(w, "Invalid JSON", http.StatusBadRequest)
            return
        }

        user, err := s.CreateUser(ctx, req.Name, req.Email)
        if err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }

        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(user)

    default:
        http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
    }
}

func main() {
    service := NewUserService()

    http.HandleFunc("/users", service.HandleUserRequest)

    server := &http.Server{
        Addr:    ":8080",
        Handler: nil,
    }

    go func() {
        log.Println("Server starting on :8080")
        if err := server.ListenAndServe(); err != http.ErrServerClosed {
            log.Fatalf("Server failed: %v", err)
        }
    }()

    // Graceful shutdown logic would go here
    select {}
}
`;

      const result = await wrapper.parse(goCode, SupportedLanguage.Go);

      expect(result.hasErrors).toBe(false);
      expect(result.errors).toHaveLength(0);
      expect(result.rootNode.type).toBe('source_file');
      expect(result.language).toBe(SupportedLanguage.Go);
    });
  });

  describe('Multi-file Project Parsing', () => {
    it('should parse multiple files with different languages', async () => {
      const files = [
        { name: 'main.ts', code: 'export class Calculator { add(a: number, b: number) { return a + b; } }' },
        { name: 'utils.js', code: 'export function formatNumber(num) { return num.toLocaleString(); }' },
        { name: 'config.py', code: 'DATABASE_URL = "postgresql://localhost/mydb"\nDEBUG = True' },
        { name: 'server.go', code: 'package main\n\nfunc main() {\n\tprintln("Hello, Go!")\n}' },
        { name: 'Model.java', code: 'public class Model { private String name; public String getName() { return name; } }' },
        { name: 'lib.rs', code: 'pub fn greet(name: &str) -> String { format!("Hello, {}!", name) }' }
      ];

      // Write all files
      for (const file of files) {
        await fs.writeFile(path.join(tempDir, file.name), file.code);
      }

      // Parse all files
      const results = await Promise.all(
        files.map(file => wrapper.parseFile(path.join(tempDir, file.name)))
      );

      // Verify all parsed successfully
      expect(results).toHaveLength(6);
      results.forEach((result, index) => {
        expect(result.hasErrors).toBe(false);
        expect(result.errors).toHaveLength(0);
        expect(result.sourceCode).toBe(files[index].code);
      });

      // Verify correct language detection
      expect(results[0].language).toBe(SupportedLanguage.TypeScript);
      expect(results[1].language).toBe(SupportedLanguage.JavaScript);
      expect(results[2].language).toBe(SupportedLanguage.Python);
      expect(results[3].language).toBe(SupportedLanguage.Go);
      expect(results[4].language).toBe(SupportedLanguage.Java);
      expect(results[5].language).toBe(SupportedLanguage.Rust);

      // Verify cache was populated
      const cacheStats = wrapper.getCacheStats();
      expect(cacheStats.size).toBe(6);
      expect(cacheStats.loadedLanguages).toContain(SupportedLanguage.TypeScript);
      expect(cacheStats.loadedLanguages).toContain(SupportedLanguage.JavaScript);
      expect(cacheStats.loadedLanguages).toContain(SupportedLanguage.Python);
      expect(cacheStats.loadedLanguages).toContain(SupportedLanguage.Go);
      expect(cacheStats.loadedLanguages).toContain(SupportedLanguage.Java);
      expect(cacheStats.loadedLanguages).toContain(SupportedLanguage.Rust);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle partial syntax errors gracefully', async () => {
      const brokenTypeScriptCode = `
        interface User {
          id: number;
          name: string
          // Missing semicolon above
        }

        class UserManager {
          private users: User[] = [];

          addUser(user: User) {
            this.users.push(user;
            // Missing closing parenthesis above
          }

          getUser(id: number): User | undefined {
            return this.users.find(u => u.id === id);
          }
        }

        // Valid code after errors
        const manager = new UserManager();
      `;

      const result = await wrapper.parse(brokenTypeScriptCode, SupportedLanguage.TypeScript);

      // Should have detected errors but still produce a usable AST
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.rootNode.type).toBe('program');

      // Should be able to traverse the AST despite errors
      let classCount = 0;
      const cursor = result.rootNode.walk();

      const visitNode = () => {
        if (cursor.currentNode.type === 'class_declaration') {
          classCount++;
        }

        if (cursor.gotoFirstChild()) {
          do {
            visitNode();
          } while (cursor.gotoNextSibling());
          cursor.gotoParent();
        }
      };

      visitNode();
      expect(classCount).toBeGreaterThan(0);
    });

    it('should handle concurrent parsing requests', async () => {
      const codes = [
        { code: 'const a = 1;', lang: SupportedLanguage.JavaScript },
        { code: 'const b: number = 2;', lang: SupportedLanguage.TypeScript },
        { code: 'def func(): pass', lang: SupportedLanguage.Python },
        { code: 'package main; func main() {}', lang: SupportedLanguage.Go },
        { code: 'public class Test {}', lang: SupportedLanguage.Java },
        { code: 'fn main() {}', lang: SupportedLanguage.Rust }
      ];

      // Parse all concurrently
      const startTime = Date.now();
      const results = await Promise.all(
        codes.map(({ code, lang }) => wrapper.parse(code, lang))
      );
      const endTime = Date.now();

      // All should succeed
      expect(results).toHaveLength(6);
      results.forEach((result, index) => {
        expect(result.hasErrors).toBe(false);
        expect(result.language).toBe(codes[index].lang);
      });

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000);

      // Cache should contain all languages
      const cacheStats = wrapper.getCacheStats();
      expect(cacheStats.size).toBe(6);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle large files efficiently', async () => {
      // Generate a large TypeScript file
      const generateLargeTypeScript = () => {
        let code = 'export namespace LargeModule {\n';

        for (let i = 0; i < 1000; i++) {
          code += `
  export interface Interface${i} {
    id: number;
    name: string;
    value${i}: boolean;
    data: Record<string, any>;
  }

  export class Class${i} implements Interface${i} {
    constructor(
      public id: number,
      public name: string,
      public value${i}: boolean,
      public data: Record<string, any> = {}
    ) {}

    process(): Interface${i} {
      return {
        id: this.id,
        name: this.name,
        value${i}: this.value${i},
        data: { ...this.data, processed: true }
      };
    }
  }
`;
        }

        code += '}';
        return code;
      };

      const largeCode = generateLargeTypeScript();
      const startTime = Date.now();
      const result = await wrapper.parse(largeCode, SupportedLanguage.TypeScript);
      const endTime = Date.now();

      expect(result.hasErrors).toBe(false);
      expect(result.rootNode.type).toBe('program');

      // Should complete within reasonable time (less than 5 seconds for 1000 interfaces)
      expect(endTime - startTime).toBeLessThan(5000);

      // Verify the AST is properly structured
      expect(result.rootNode.childCount).toBeGreaterThan(0);
    });

    it('should clean up resources properly', async () => {
      // Parse several files to populate cache
      await wrapper.parse('const x = 1;', SupportedLanguage.JavaScript);
      await wrapper.parse('const y: number = 2;', SupportedLanguage.TypeScript);
      await wrapper.parse('def func(): pass', SupportedLanguage.Python);

      expect(wrapper.getCacheStats().size).toBe(3);

      // Clear cache
      wrapper.clearCache();

      expect(wrapper.getCacheStats().size).toBe(0);
      expect(wrapper.getCacheStats().loadedLanguages).toHaveLength(0);

      // Should still work after clearing cache
      const result = await wrapper.parse('const z = 3;', SupportedLanguage.JavaScript);
      expect(result.hasErrors).toBe(false);
      expect(wrapper.getCacheStats().size).toBe(1);
    });
  });
});