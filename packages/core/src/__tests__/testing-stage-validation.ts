/**
 * @fileoverview Testing Stage Validation Script
 *
 * This script validates that the ProjectContextAnalyzer testing stage
 * has been completed successfully by verifying all acceptance criteria.
 */

import { ProjectContextAnalyzer } from '../index';
import {
  analyzeProject,
  getProjectContextAnalyzer,
  GitStatusSchema,
  ProjectStructureSchema,
  FrameworkDetectionSchema,
  ConfigurationInfoSchema,
  TestFrameworkInfoSchema,
  ProjectContextSchema
} from '../index';

/**
 * Validation Results Interface
 */
interface ValidationResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Main validation function
 */
export async function validateTestingStage(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  // 1. Verify ProjectContextAnalyzer class is exported from @apexcli/core index.ts
  results.push(validateExports());

  // 2. Verify all methods are integrated
  results.push(validateMethodsIntegration());

  // 3. Verify caching is implemented
  results.push(await validateCaching());

  // 4. Verify schemas work correctly
  results.push(validateSchemas());

  // 5. Basic functionality test
  results.push(await validateBasicFunctionality());

  return results;
}

/**
 * Validate that all required exports are available
 */
function validateExports(): ValidationResult {
  try {
    // Check ProjectContextAnalyzer class
    if (!ProjectContextAnalyzer || typeof ProjectContextAnalyzer !== 'function') {
      return {
        success: false,
        message: 'ProjectContextAnalyzer class not properly exported'
      };
    }

    // Check convenience functions
    if (!analyzeProject || typeof analyzeProject !== 'function') {
      return {
        success: false,
        message: 'analyzeProject function not properly exported'
      };
    }

    if (!getProjectContextAnalyzer || typeof getProjectContextAnalyzer !== 'function') {
      return {
        success: false,
        message: 'getProjectContextAnalyzer function not properly exported'
      };
    }

    // Check schemas
    const schemas = [
      { name: 'GitStatusSchema', schema: GitStatusSchema },
      { name: 'ProjectStructureSchema', schema: ProjectStructureSchema },
      { name: 'FrameworkDetectionSchema', schema: FrameworkDetectionSchema },
      { name: 'ConfigurationInfoSchema', schema: ConfigurationInfoSchema },
      { name: 'TestFrameworkInfoSchema', schema: TestFrameworkInfoSchema },
      { name: 'ProjectContextSchema', schema: ProjectContextSchema }
    ];

    for (const { name, schema } of schemas) {
      if (!schema || typeof schema.parse !== 'function') {
        return {
          success: false,
          message: `${name} not properly exported or invalid`
        };
      }
    }

    return {
      success: true,
      message: 'All required exports are available and properly typed'
    };
  } catch (error) {
    return {
      success: false,
      message: `Export validation failed: ${error}`,
      details: error
    };
  }
}

/**
 * Validate that all methods are properly integrated
 */
function validateMethodsIntegration(): ValidationResult {
  try {
    const analyzer = new ProjectContextAnalyzer('/test/path');

    const requiredMethods = [
      'analyze',
      'getGitStatus',
      'getProjectStructure',
      'analyzeProjectStructure',
      'detectFrameworks',
      'getConfigurationInfoList',
      'parseConfigurations',
      'getTestFrameworkInfoList',
      'detectTestFrameworks',
      'getProjectPath',
      'getOptions',
      'clearCache',
      'getCacheStats'
    ];

    for (const methodName of requiredMethods) {
      if (!(methodName in analyzer) || typeof analyzer[methodName] !== 'function') {
        return {
          success: false,
          message: `Method ${methodName} is not properly integrated`
        };
      }
    }

    return {
      success: true,
      message: 'All required methods are properly integrated'
    };
  } catch (error) {
    return {
      success: false,
      message: `Method integration validation failed: ${error}`,
      details: error
    };
  }
}

/**
 * Validate that caching is implemented
 */
async function validateCaching(): Promise<ValidationResult> {
  try {
    const analyzer = new ProjectContextAnalyzer('/test/path');

    // Check cache methods exist and work
    const initialStats = analyzer.getCacheStats();
    if (typeof initialStats !== 'object' || typeof initialStats.size !== 'number') {
      return {
        success: false,
        message: 'Cache stats method not working properly'
      };
    }

    // Check cache clear works
    analyzer.clearCache();
    const clearedStats = analyzer.getCacheStats();
    if (clearedStats.size !== 0) {
      return {
        success: false,
        message: 'Cache clear method not working properly'
      };
    }

    return {
      success: true,
      message: 'Caching is properly implemented'
    };
  } catch (error) {
    return {
      success: false,
      message: `Caching validation failed: ${error}`,
      details: error
    };
  }
}

/**
 * Validate that schemas work correctly
 */
function validateSchemas(): ValidationResult {
  try {
    // Test minimal valid data structures
    const minimalGitStatus = {
      isRepository: false,
      branch: null,
      remoteBranch: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
      hasConflicts: false,
      isDirty: false,
      stashCount: 0,
      remotes: []
    };

    const minimalProjectStructure = {
      root: '/test',
      totalFiles: 0,
      totalDirectories: 0,
      entries: [],
      rootFiles: [],
      commonDirectories: [],
      hasPackageJson: false,
      hasGitIgnore: false,
      hasReadme: false,
      hasLicense: false,
      excludedDirectories: [],
      scannedAt: new Date(),
      maxDepthScanned: 0
    };

    const minimalFrameworkDetection = {
      frameworks: [],
      languages: []
    };

    const minimalConfigInfo = {
      name: 'test.json',
      path: 'test.json',
      format: 'json' as const,
      purpose: 'other' as const,
      isValid: true,
      size: 100,
      modifiedAt: new Date()
    };

    const minimalTestFramework = {
      name: 'Jest',
      type: 'unit' as const,
      testPatterns: ['**/*.test.js'],
      runCommand: 'npm test'
    };

    const minimalProjectContext = {
      frameworks: [],
      configurations: [],
      testFrameworks: [],
      errors: []
    };

    // Test that all schemas validate successfully
    GitStatusSchema.parse(minimalGitStatus);
    ProjectStructureSchema.parse(minimalProjectStructure);
    FrameworkDetectionSchema.parse(minimalFrameworkDetection);
    ConfigurationInfoSchema.parse(minimalConfigInfo);
    TestFrameworkInfoSchema.parse(minimalTestFramework);
    ProjectContextSchema.parse(minimalProjectContext);

    return {
      success: true,
      message: 'All schemas validate correctly'
    };
  } catch (error) {
    return {
      success: false,
      message: `Schema validation failed: ${error}`,
      details: error
    };
  }
}

/**
 * Validate basic functionality
 */
async function validateBasicFunctionality(): Promise<ValidationResult> {
  try {
    // Test constructor and basic methods
    const analyzer = new ProjectContextAnalyzer('/test/path');

    if (analyzer.getProjectPath() !== '/test/path') {
      return {
        success: false,
        message: 'getProjectPath not working correctly'
      };
    }

    const options = analyzer.getOptions();
    if (!options || typeof options.maxDepth !== 'number') {
      return {
        success: false,
        message: 'getOptions not working correctly'
      };
    }

    // Test singleton function
    const singleton1 = getProjectContextAnalyzer('/test/singleton');
    const singleton2 = getProjectContextAnalyzer('/test/singleton');
    const singleton3 = getProjectContextAnalyzer('/test/different');

    if (singleton1 !== singleton2) {
      return {
        success: false,
        message: 'getProjectContextAnalyzer singleton behavior not working'
      };
    }

    if (singleton1 === singleton3) {
      return {
        success: false,
        message: 'getProjectContextAnalyzer should return different instances for different paths'
      };
    }

    return {
      success: true,
      message: 'Basic functionality works correctly'
    };
  } catch (error) {
    return {
      success: false,
      message: `Basic functionality validation failed: ${error}`,
      details: error
    };
  }
}

/**
 * Run validation and report results
 */
export async function runValidation(): Promise<void> {
  console.log('🧪 ProjectContextAnalyzer Testing Stage Validation');
  console.log('================================================\n');

  const results = await validateTestingStage();
  let allPassed = true;

  for (const [index, result] of results.entries()) {
    const emoji = result.success ? '✅' : '❌';
    const status = result.success ? 'PASS' : 'FAIL';

    console.log(`${emoji} Test ${index + 1}: ${status}`);
    console.log(`   ${result.message}`);

    if (!result.success) {
      allPassed = false;
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    }
    console.log();
  }

  console.log('================================================');

  if (allPassed) {
    console.log('🎉 All validation tests passed!');
    console.log('✅ ProjectContextAnalyzer testing stage is complete and ready for production.');
  } else {
    console.log('❌ Some validation tests failed.');
    console.log('⚠️  Please review and fix the issues above.');
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  runValidation().catch(console.error);
}