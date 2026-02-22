#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function createTestProject() {
  const testDir = path.join(os.tmpdir(), `convention-test-${Date.now()}`);
  await fs.mkdir(testDir, { recursive: true });

  const srcDir = path.join(testDir, 'src');
  await fs.mkdir(srcDir, { recursive: true });

  // Create test files with different conventions
  const testFiles = [
    {
      name: 'userService.ts',
      content: `/**
 * User service for handling user operations
 * @example
 * const service = new UserService();
 * const user = await service.getUser(123);
 */
export class UserService {
  private readonly apiUrl = 'https://api.example.com';

  /**
   * Get user by ID
   * @param id - User ID
   * @returns User object
   */
  async getUser(id: number): Promise<User> {
    const response = await fetch(\`\${this.apiUrl}/users/\${id}\`);
    return response.json();
  }

  /**
   * Create new user
   * @param userData - User data
   * @returns Created user
   */
  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await fetch(\`\${this.apiUrl}/users\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return response.json();
  }
}

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}`
    },
    {
      name: 'helpers.ts',
      content: `// Utility helper functions
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return emailRegex.test(email);
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(7);
};`
    }
  ];

  for (const file of testFiles) {
    await fs.writeFile(path.join(srcDir, file.name), file.content);
  }

  // Create package.json
  await fs.writeFile(path.join(testDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    type: 'module'
  }, null, 2));

  return testDir;
}

async function testConventionAnalysis() {
  console.log('🧪 Testing ConventionAnalysis functionality...');

  try {
    // Import ConventionAnalyzer
    const analyzerModule = await import('./packages/orchestrator/dist/codebase-analyzer/analyzers/convention-analyzer.js');
    const ConventionAnalyzer = analyzerModule.ConventionAnalyzer;

    if (!ConventionAnalyzer) {
      throw new Error('ConventionAnalyzer not found in module');
    }

    // Import ConventionAnalysisSchema
    const coreModule = await import('./packages/core/dist/types.js');
    const ConventionAnalysisSchema = coreModule.ConventionAnalysisSchema;

    if (!ConventionAnalysisSchema) {
      throw new Error('ConventionAnalysisSchema not found in core module');
    }

    console.log('✅ Successfully imported ConventionAnalyzer and schema');

    // Create test project
    const testDir = await createTestProject();
    console.log(\`📁 Created test project at: \${testDir}\`);

    // Analyze the project
    const analyzer = new ConventionAnalyzer();
    const startTime = Date.now();
    const result = await analyzer.analyze(testDir);
    const duration = Date.now() - startTime;

    console.log(\`⏱️  Analysis completed in \${duration}ms\`);

    // Validate against schema
    const validationResult = ConventionAnalysisSchema.safeParse(result);

    if (!validationResult.success) {
      console.error('❌ Schema validation failed:', validationResult.error.issues);
      throw new Error('Schema validation failed');
    }

    console.log('✅ Schema validation passed');

    // Output results
    console.log('📊 Analysis Results:');
    console.log(\`  File Naming: \${result.fileNaming}\`);
    console.log(\`  Function Naming: \${result.functionNaming}\`);
    console.log(\`  Variable Naming: \${result.variableNaming}\`);
    console.log(\`  Class Naming: \${result.classNaming || 'N/A'}\`);
    console.log(\`  Indentation: \${result.indentation.type} (\${result.indentation.size || 'N/A'})\`);
    console.log(\`  Import Style: \${result.imports.style}\`);
    console.log(\`  Documentation Style: \${result.documentation.style}\`);
    console.log(\`  Documentation Coverage: \${result.documentation.coverage}%\`);

    if (result.formatting) {
      console.log(\`  Semicolons: \${result.formatting.semicolons || 'N/A'}\`);
      console.log(\`  Quotes: \${result.formatting.quotes || 'N/A'}\`);
      console.log(\`  Trailing Commas: \${result.formatting.trailingCommas || 'N/A'}\`);
      console.log(\`  Line Length: \${result.formatting.lineLength || 'N/A'}\`);
    }

    if (result.organization) {
      console.log(\`  Test Location: \${result.organization.testLocation}\`);
      console.log(\`  Test Naming: \${result.organization.testNaming}\`);
      console.log(\`  Source Structure: \${result.organization.sourceStructure}\`);
    }

    // Cleanup
    await fs.rm(testDir, { recursive: true, force: true });
    console.log('🧹 Test project cleaned up');

    console.log('🎉 All tests passed! ConventionAnalysis is working correctly.');
    return true;

  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
}

// Run the test
testConventionAnalysis().then(success => {
  process.exit(success ? 0 : 1);
});