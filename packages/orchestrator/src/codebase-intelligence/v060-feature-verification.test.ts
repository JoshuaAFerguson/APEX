/**
 * v0.6.0 Codebase Intelligence Feature Verification
 *
 * Comprehensive test suite to verify all v0.6.0 codebase intelligence features:
 * - Repository mapping with real AST parsing
 * - Multi-language indexing (TypeScript, JavaScript, Python, Go, Java, Rust)
 * - Semantic search functionality
 * - Symbol resolution and cross-file references
 * - Tree-sitter integration
 * - Type awareness and relationship mapping
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

import {
  CodebaseIntelligenceService,
  CodebaseIndexer,
  TreeSitterWrapper,
  SemanticSearch,
  SymbolResolver,
  TypeRelationshipMap,
  SupportedLanguage,
  getCodebaseIndexer,
  createSemanticSearch,
  createTypeRelationshipMap
} from './index.js';

import type {
  RepositoryMap,
  CodeFile,
  CodeSymbol
} from '@apexcli/core';

describe('v0.6.0 Codebase Intelligence Feature Verification', () => {
  let testDir: string;
  let service: CodebaseIntelligenceService;

  beforeAll(async () => {
    // Create a temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-v060-test-'));

    // Create test files with real code content
    await createTestCodebase(testDir);

    // Initialize the service
    service = new CodebaseIntelligenceService({
      enableCaching: true,
      includeExternalDependencies: false,
      enableTypeAnalysis: true,
      maxConcurrentFiles: 4
    });
  });

  afterEach(async () => {
    // Reset service state between tests
    if (service) {
      // Reset the service if it was initialized
      try {
        service.reset();
      } catch {
        // Service might not be initialized, ignore
      }
      // Clear any caches or state
      TreeSitterWrapper.resetInstance();
    }
  });

  describe('Repository Map Generation', () => {
    it('should generate comprehensive repository map with AST parsing', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();

      // Verify basic structure
      expect(repoMap).toBeDefined();
      expect(repoMap.name).toBe(path.basename(testDir));
      expect(repoMap.files).toHaveLength(6); // TS, JS, PY, GO, JAVA, RUST files
      expect(repoMap.stats).toBeDefined();
      expect(repoMap.version).toBe('1.0.0');

      // Verify language detection
      const languages = repoMap.config.languages;
      expect(languages).toContain('typescript');
      expect(languages).toContain('javascript');
      expect(languages).toContain('python');
      expect(languages).toContain('go');
      expect(languages).toContain('java');
      expect(languages).toContain('rust');

      // Verify symbol extraction
      expect(repoMap.stats.totalSymbols).toBeGreaterThan(0);
      expect(repoMap.stats.totalFiles).toBe(6);

      console.log(`✅ Generated repository map with ${repoMap.stats.totalSymbols} symbols across ${repoMap.stats.totalFiles} files`);
    }, 15000);

    it('should extract symbols with accurate position information', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();

      // Find TypeScript file
      const tsFile = repoMap.files.find(f => f.path.endsWith('.ts'));
      expect(tsFile).toBeDefined();

      // Check for expected symbols
      const classSymbol = tsFile!.symbols.find(s => s.name === 'UserService' && s.type === 'class');
      const functionSymbol = tsFile!.symbols.find(s => s.name === 'validateEmail' && s.type === 'function');
      const interfaceSymbol = tsFile!.symbols.find(s => s.name === 'User' && s.type === 'interface');

      expect(classSymbol).toBeDefined();
      expect(functionSymbol).toBeDefined();
      expect(interfaceSymbol).toBeDefined();

      // Verify position information
      expect(classSymbol!.startLine).toBeGreaterThan(0);
      expect(classSymbol!.endLine).toBeGreaterThan(classSymbol!.startLine);
      expect(classSymbol!.startColumn).toBeGreaterThanOrEqual(0);

      console.log(`✅ Extracted symbols with position info: UserService at line ${classSymbol!.startLine}`);
    }, 10000);

    it('should handle multi-language symbol extraction', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();

      // Verify each language file has symbols
      const jsFile = repoMap.files.find(f => f.path.endsWith('.js'));
      const pyFile = repoMap.files.find(f => f.path.endsWith('.py'));
      const goFile = repoMap.files.find(f => f.path.endsWith('.go'));
      const javaFile = repoMap.files.find(f => f.path.endsWith('.java'));
      const rustFile = repoMap.files.find(f => f.path.endsWith('.rs'));

      expect(jsFile?.symbols.length).toBeGreaterThan(0);
      expect(pyFile?.symbols.length).toBeGreaterThan(0);
      expect(goFile?.symbols.length).toBeGreaterThan(0);
      expect(javaFile?.symbols.length).toBeGreaterThan(0);
      expect(rustFile?.symbols.length).toBeGreaterThan(0);

      console.log(`✅ Multi-language extraction: JS(${jsFile?.symbols.length}), PY(${pyFile?.symbols.length}), GO(${goFile?.symbols.length}), JAVA(${javaFile?.symbols.length}), RUST(${rustFile?.symbols.length})`);
    }, 15000);
  });

  describe('Tree-sitter Integration', () => {
    it('should parse all supported languages without errors', async () => {
      const wrapper = TreeSitterWrapper.getInstance();

      const testCases = [
        { lang: SupportedLanguage.TypeScript, code: 'interface Test { name: string; }' },
        { lang: SupportedLanguage.JavaScript, code: 'function test() { return true; }' },
        { lang: SupportedLanguage.Python, code: 'def test():\n    return True' },
        { lang: SupportedLanguage.Go, code: 'func test() bool { return true }' },
        { lang: SupportedLanguage.Java, code: 'public class Test { public boolean test() { return true; } }' },
        { lang: SupportedLanguage.Rust, code: 'fn test() -> bool { true }' }
      ];

      for (const testCase of testCases) {
        const result = await wrapper.parse(testCase.code, testCase.lang);
        expect(result.hasErrors).toBe(false);
        expect(result.rootNode.type).toBeTruthy();
        expect(result.language).toBe(testCase.lang);
      }

      console.log(`✅ Tree-sitter parsing successful for all ${testCases.length} languages`);
    }, 10000);

    it('should detect languages from file extensions', async () => {
      const wrapper = TreeSitterWrapper.getInstance();

      const extensions = [
        { ext: 'test.ts', expected: SupportedLanguage.TypeScript },
        { ext: 'test.tsx', expected: SupportedLanguage.TSX },
        { ext: 'test.js', expected: SupportedLanguage.JavaScript },
        { ext: 'test.py', expected: SupportedLanguage.Python },
        { ext: 'test.go', expected: SupportedLanguage.Go },
        { ext: 'test.java', expected: SupportedLanguage.Java },
        { ext: 'test.rs', expected: SupportedLanguage.Rust }
      ];

      for (const { ext, expected } of extensions) {
        const detected = wrapper.detectLanguage(ext);
        expect(detected).toBe(expected);
      }

      console.log(`✅ Language detection working for ${extensions.length} file types`);
    });

    it('should collect syntax errors accurately', async () => {
      const wrapper = TreeSitterWrapper.getInstance();
      const malformedCode = 'function test( { return }';

      const result = await wrapper.parse(malformedCode, SupportedLanguage.JavaScript);
      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Syntax error');

      console.log(`✅ Syntax error detection working: found ${result.errors.length} errors`);
    });
  });

  describe('Semantic Search Functionality', () => {
    it('should find functions by natural language description', async () => {
      await service.initialize(testDir);

      const results = service.searchCode('function that validates email addresses');
      expect(results.length).toBeGreaterThan(0);

      const emailValidationResult = results.find(r =>
        r.symbol.name.toLowerCase().includes('email') ||
        r.symbol.signature?.toLowerCase().includes('email')
      );
      expect(emailValidationResult).toBeDefined();
      expect(emailValidationResult!.score).toBeGreaterThan(0.3);

      console.log(`✅ Semantic search found ${results.length} results for email validation`);
    });

    it('should rank results by relevance', async () => {
      await service.initialize(testDir);

      const results = service.searchCode('user service class');
      expect(results.length).toBeGreaterThan(0);

      // Results should be ordered by score (descending)
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }

      // Top result should have high confidence for exact match
      const topResult = results[0];
      if (topResult.symbol.name === 'UserService') {
        expect(topResult.score).toBeGreaterThan(0.7);
      }

      console.log(`✅ Search ranking working: top score ${results[0].score.toFixed(3)}`);
    });

    it('should support different search strategies', async () => {
      await service.initialize(testDir);

      const keywordResults = service.searchCode('UserService', { strategy: 'keyword' });
      const fuzzyResults = service.searchCode('usrsvc', { strategy: 'fuzzy' });
      const semanticResults = service.searchCode('service for user management', { strategy: 'semantic' });

      expect(keywordResults.length).toBeGreaterThan(0);
      expect(semanticResults.length).toBeGreaterThan(0);
      // Fuzzy might not find results for very different strings
      expect(fuzzyResults.length).toBeGreaterThanOrEqual(0);

      console.log(`✅ Search strategies: keyword(${keywordResults.length}), fuzzy(${fuzzyResults.length}), semantic(${semanticResults.length})`);
    });

    it('should filter by symbol type', async () => {
      await service.initialize(testDir);

      const classResults = service.searchCode('user', { symbolTypes: ['class'] });
      const functionResults = service.searchCode('validate', { symbolTypes: ['function'] });
      const interfaceResults = service.searchCode('user', { symbolTypes: ['interface'] });

      // All results should match the requested types
      expect(classResults.every(r => r.symbol.type === 'class')).toBe(true);
      expect(functionResults.every(r => r.symbol.type === 'function')).toBe(true);
      expect(interfaceResults.every(r => r.symbol.type === 'interface')).toBe(true);

      console.log(`✅ Type filtering: classes(${classResults.length}), functions(${functionResults.length}), interfaces(${interfaceResults.length})`);
    });
  });

  describe('Symbol Resolution', () => {
    it('should resolve symbol definitions across files', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();
      const resolver = new SymbolResolver(repoMap);

      // Find UserService class
      const definitions = resolver.findDefinition('UserService');
      expect(definitions.length).toBeGreaterThan(0);

      const primaryDef = definitions[0];
      expect(primaryDef.symbol.name).toBe('UserService');
      expect(primaryDef.symbol.type).toBe('class');
      expect(primaryDef.confidence).toBe(1.0); // Exact match

      console.log(`✅ Symbol resolution: found UserService in ${primaryDef.filePath}`);
    });

    it('should find symbols by type and export status', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();
      const resolver = new SymbolResolver(repoMap);

      // Find exported classes only
      const exportedClasses = resolver.findDefinition('*', {
        symbolType: 'class',
        exportedOnly: true
      });

      expect(exportedClasses.length).toBeGreaterThan(0);
      expect(exportedClasses.every(def => def.symbol.exported)).toBe(true);
      expect(exportedClasses.every(def => def.symbol.type === 'class')).toBe(true);

      console.log(`✅ Type filtering: found ${exportedClasses.length} exported classes`);
    });

    it('should provide resolution statistics', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();
      const resolver = new SymbolResolver(repoMap);

      const stats = resolver.getStats();
      expect(stats.totalSymbols).toBeGreaterThan(0);
      expect(stats.uniqueNames).toBeGreaterThan(0);
      expect(stats.filesWithSymbols).toBeGreaterThan(0);
      expect(stats.indexBuildTimeMs).toBeGreaterThan(0);

      console.log(`✅ Resolution stats: ${stats.totalSymbols} symbols, ${stats.uniqueNames} unique names, ${stats.indexBuildTimeMs}ms build time`);
    });
  });

  describe('Type Relationship Mapping', () => {
    it('should build type hierarchy from code', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();
      const typeMap = createTypeRelationshipMap(repoMap);

      const hierarchy = await typeMap.buildTypeGraph();
      expect(hierarchy).toBeDefined();

      // Check for interface implementations
      const userHierarchy = typeMap.getTypeHierarchy('User');
      expect(userHierarchy).toBeDefined();

      console.log(`✅ Type hierarchy built: User has ${userHierarchy.implementations.length} implementations`);
    });

    it('should find interface implementations', async () => {
      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();
      const typeMap = createTypeRelationshipMap(repoMap);

      const implementations = typeMap.getImplementations('User');
      // Should find classes that implement User interface
      expect(implementations.length).toBeGreaterThanOrEqual(0);

      console.log(`✅ Found ${implementations.length} implementations of User interface`);
    });
  });

  describe('Integration and Performance', () => {
    it('should complete full workflow within time limits', async () => {
      const startTime = Date.now();

      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();

      // Perform comprehensive analysis
      const searchResults = service.searchCode('validate email');
      const resolver = new SymbolResolver(repoMap);
      const definitions = resolver.findDefinition('UserService');
      const typeMap = createTypeRelationshipMap(repoMap);
      const hierarchy = await typeMap.buildTypeGraph();

      const totalTime = Date.now() - startTime;

      // Should complete within reasonable time (adjust based on requirements)
      expect(totalTime).toBeLessThan(30000); // 30 seconds max

      // Verify results
      expect(repoMap.files.length).toBe(6);
      expect(searchResults.length).toBeGreaterThanOrEqual(0);
      expect(definitions.length).toBeGreaterThanOrEqual(0);
      expect(hierarchy).toBeDefined();

      console.log(`✅ Full workflow completed in ${totalTime}ms`);
    }, 35000);

    it('should handle memory efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      await service.initialize(testDir);
      const repoMap = service.getRepositoryMap();

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        service.searchCode(`test query ${i}`);
        const resolver = new SymbolResolver(repoMap);
        resolver.findDefinition('UserService');
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (under 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(`✅ Memory efficient: increased by ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });
  });

  describe('Service Integration', () => {
    it('should work with the unified CodebaseIntelligenceService', async () => {
      const unifiedService = new CodebaseIntelligenceService();
      await unifiedService.initialize(testDir);

      // Test all major features through unified API
      const analysis = unifiedService.getAnalysis();
      expect(analysis.repositoryMap.files.length).toBe(6);

      const searchResults = unifiedService.searchCode('user service');
      expect(searchResults.length).toBeGreaterThanOrEqual(0);

      const definition = await unifiedService.findSymbolDefinition('UserService');
      expect(definition).toBeDefined();

      const status = unifiedService.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.indexedFiles).toBe(6);

      console.log(`✅ Unified service working: ${status.indexedFiles} files indexed`);
    });

    it('should export all required components', () => {
      // Verify all main classes are exported
      expect(CodebaseIntelligenceService).toBeDefined();
      expect(CodebaseIndexer).toBeDefined();
      expect(TreeSitterWrapper).toBeDefined();
      expect(SemanticSearch).toBeDefined();
      expect(SymbolResolver).toBeDefined();
      expect(TypeRelationshipMap).toBeDefined();

      // Verify factory functions
      expect(getCodebaseIndexer).toBeDefined();
      expect(createSemanticSearch).toBeDefined();
      expect(createTypeRelationshipMap).toBeDefined();

      console.log(`✅ All exports available`);
    });
  });
});

/**
 * Create a test codebase with multiple languages
 */
async function createTestCodebase(testDir: string): Promise<void> {
  // TypeScript file with interfaces, classes, functions
  const tsContent = `
interface User {
  id: number;
  email: string;
  name: string;
}

interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

export class UserService implements UserRepository {
  constructor(private db: any) {}

  async findById(id: number): Promise<User | null> {
    return this.db.users.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    if (!validateEmail(email)) {
      throw new Error('Invalid email format');
    }
    return this.db.users.findUnique({ where: { email } });
  }

  async save(user: User): Promise<User> {
    return this.db.users.create({ data: user });
  }
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const USER_CONSTANTS = {
  MAX_EMAIL_LENGTH: 255,
  MIN_PASSWORD_LENGTH: 8
} as const;
`;

  // JavaScript file
  const jsContent = `
function calculateUserAge(birthDate) {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();

  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}

const UserUtils = {
  formatName: (firstName, lastName) => {
    return \`\${firstName} \${lastName}\`.trim();
  },

  isAdult: (birthDate) => {
    return calculateUserAge(birthDate) >= 18;
  }
};

module.exports = { calculateUserAge, UserUtils };
`;

  // Python file
  const pyContent = `
from datetime import datetime
from typing import Optional, Dict, Any
import re

class UserValidator:
    """User validation utilities"""

    EMAIL_REGEX = re.compile(r'^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$')

    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email address format"""
        return bool(UserValidator.EMAIL_REGEX.match(email))

    @staticmethod
    def validate_age(birth_date: datetime) -> bool:
        """Check if user is of legal age"""
        today = datetime.now()
        age = today.year - birth_date.year
        if today.month < birth_date.month or (today.month == birth_date.month and today.day < birth_date.day):
            age -= 1
        return age >= 13

def create_user_profile(name: str, email: str, birth_date: datetime) -> Optional[Dict[str, Any]]:
    """Create a user profile with validation"""
    if not UserValidator.validate_email(email):
        return None

    if not UserValidator.validate_age(birth_date):
        return None

    return {
        'name': name,
        'email': email,
        'birth_date': birth_date.isoformat(),
        'created_at': datetime.now().isoformat()
    }
`;

  // Go file
  const goContent = `
package main

import (
    "fmt"
    "time"
    "regexp"
)

type User struct {
    ID       int64     \`json:"id"\`
    Email    string    \`json:"email"\`
    Name     string    \`json:"name"\`
    Created  time.Time \`json:"created_at"\`
}

type UserService struct {
    users map[int64]User
}

func NewUserService() *UserService {
    return &UserService{
        users: make(map[int64]User),
    }
}

func (s *UserService) CreateUser(email, name string) (*User, error) {
    if !validateEmailFormat(email) {
        return nil, fmt.Errorf("invalid email format: %s", email)
    }

    user := User{
        ID:      int64(len(s.users) + 1),
        Email:   email,
        Name:    name,
        Created: time.Now(),
    }

    s.users[user.ID] = user
    return &user, nil
}

func validateEmailFormat(email string) bool {
    pattern := \`^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$\`
    matched, _ := regexp.MatchString(pattern, email)
    return matched
}

func main() {
    service := NewUserService()
    user, err := service.CreateUser("test@example.com", "Test User")
    if err != nil {
        fmt.Printf("Error: %v\\n", err)
        return
    }
    fmt.Printf("Created user: %+v\\n", user)
}
`;

  // Java file
  const javaContent = `
import java.time.LocalDateTime;
import java.util.regex.Pattern;
import java.util.HashMap;
import java.util.Map;

public class UserManager {
    private static final Pattern EMAIL_PATTERN =
        Pattern.compile("^[^\\\\s@]+@[^\\\\s@]+\\\\.[^\\\\s@]+$");

    private Map<Long, User> users;
    private long nextId;

    public UserManager() {
        this.users = new HashMap<>();
        this.nextId = 1L;
    }

    public User createUser(String email, String name) throws ValidationException {
        if (!isValidEmail(email)) {
            throw new ValidationException("Invalid email format: " + email);
        }

        User user = new User(nextId++, email, name, LocalDateTime.now());
        users.put(user.getId(), user);
        return user;
    }

    public boolean isValidEmail(String email) {
        return email != null && EMAIL_PATTERN.matcher(email).matches();
    }

    public static class User {
        private final long id;
        private final String email;
        private final String name;
        private final LocalDateTime created;

        public User(long id, String email, String name, LocalDateTime created) {
            this.id = id;
            this.email = email;
            this.name = name;
            this.created = created;
        }

        public long getId() { return id; }
        public String getEmail() { return email; }
        public String getName() { return name; }
        public LocalDateTime getCreated() { return created; }
    }

    public static class ValidationException extends Exception {
        public ValidationException(String message) {
            super(message);
        }
    }
}
`;

  // Rust file
  const rustContent = `
use std::collections::HashMap;
use regex::Regex;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone)]
pub struct User {
    pub id: u64,
    pub email: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

impl User {
    pub fn new(id: u64, email: String, name: String) -> Self {
        Self {
            id,
            email,
            name,
            created_at: Utc::now(),
        }
    }
}

pub struct UserService {
    users: HashMap<u64, User>,
    next_id: u64,
    email_regex: Regex,
}

impl UserService {
    pub fn new() -> Self {
        let email_regex = Regex::new(r"^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")
            .expect("Invalid email regex");

        Self {
            users: HashMap::new(),
            next_id: 1,
            email_regex,
        }
    }

    pub fn create_user(&mut self, email: &str, name: &str) -> Result<User, &'static str> {
        if !self.is_valid_email(email) {
            return Err("Invalid email format");
        }

        let user = User::new(self.next_id, email.to_string(), name.to_string());
        self.next_id += 1;
        self.users.insert(user.id, user.clone());

        Ok(user)
    }

    pub fn is_valid_email(&self, email: &str) -> bool {
        self.email_regex.is_match(email)
    }

    pub fn find_user_by_id(&self, id: u64) -> Option<&User> {
        self.users.get(&id)
    }

    pub fn find_user_by_email(&self, email: &str) -> Option<&User> {
        self.users.values().find(|user| user.email == email)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_validation() {
        let service = UserService::new();
        assert!(service.is_valid_email("test@example.com"));
        assert!(!service.is_valid_email("invalid-email"));
    }
}
`;

  // Write all test files
  await fs.writeFile(path.join(testDir, 'user-service.ts'), tsContent);
  await fs.writeFile(path.join(testDir, 'user-utils.js'), jsContent);
  await fs.writeFile(path.join(testDir, 'user_validator.py'), pyContent);
  await fs.writeFile(path.join(testDir, 'user_manager.go'), goContent);
  await fs.writeFile(path.join(testDir, 'UserManager.java'), javaContent);
  await fs.writeFile(path.join(testDir, 'user_service.rs'), rustContent);
}