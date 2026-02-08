#!/usr/bin/env node
/**
 * Simple validation script to test JSDoc documentation presence
 * This script can be run independently to validate JSDoc coverage
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class JSDocValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.successes = [];
  }

  async validateFile(filename) {
    console.log(`\n🔍 Validating ${filename}...`);

    try {
      const filePath = join(__dirname, '..', filename);
      const sourceCode = await readFile(filePath, 'utf-8');

      await this.validateClasses(sourceCode, filename);
      await this.validateInterfaces(sourceCode, filename);
      await this.validateExamples(sourceCode, filename);
      await this.validateMethodDocumentation(sourceCode, filename);

    } catch (error) {
      this.errors.push(`Failed to read ${filename}: ${error.message}`);
    }
  }

  async validateClasses(sourceCode, filename) {
    const exportedClasses = sourceCode.match(/export class \w+/g) || [];

    for (const exportedClass of exportedClasses) {
      const className = exportedClass.replace('export class ', '');
      const classRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export class ${className}`);
      const hasJSDoc = classRegex.test(sourceCode);

      if (hasJSDoc) {
        const jsdocMatch = sourceCode.match(classRegex);
        const hasExample = jsdocMatch[0].includes('@example');

        if (hasExample) {
          this.successes.push(`✅ ${filename}: Class ${className} has JSDoc with @example`);
        } else {
          this.warnings.push(`⚠️  ${filename}: Class ${className} has JSDoc but missing @example`);
        }
      } else {
        this.errors.push(`❌ ${filename}: Class ${className} missing JSDoc documentation`);
      }
    }
  }

  async validateInterfaces(sourceCode, filename) {
    const exportedInterfaces = sourceCode.match(/export interface \w+/g) || [];

    for (const exportedInterface of exportedInterfaces) {
      const interfaceName = exportedInterface.replace('export interface ', '');
      const interfaceRegex = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export interface ${interfaceName}`);
      const hasJSDoc = interfaceRegex.test(sourceCode);

      if (hasJSDoc) {
        const jsdocMatch = sourceCode.match(interfaceRegex);
        const hasInterfaceTag = jsdocMatch[0].includes(`@interface ${interfaceName}`);
        const hasExample = jsdocMatch[0].includes('@example');

        if (hasInterfaceTag && hasExample) {
          this.successes.push(`✅ ${filename}: Interface ${interfaceName} has complete JSDoc`);
        } else {
          this.warnings.push(`⚠️  ${filename}: Interface ${interfaceName} JSDoc missing @interface or @example`);
        }
      } else {
        this.errors.push(`❌ ${filename}: Interface ${interfaceName} missing JSDoc documentation`);
      }
    }
  }

  async validateExamples(sourceCode, filename) {
    const exampleMatches = sourceCode.match(/@example\s*\n\s*\*\s*```typescript[\s\S]*?```/g) || [];

    if (exampleMatches.length > 0) {
      this.successes.push(`✅ ${filename}: Found ${exampleMatches.length} TypeScript examples`);

      // Validate example quality
      for (const example of exampleMatches) {
        const codeMatch = example.match(/```typescript\s*([\s\S]*?)```/);
        if (codeMatch) {
          const code = codeMatch[1].trim();

          if (code.includes('TODO') || code.includes('...')) {
            this.warnings.push(`⚠️  ${filename}: Example contains placeholder content`);
          }

          if (code.length < 20) {
            this.warnings.push(`⚠️  ${filename}: Example is very short, might not be helpful`);
          }
        }
      }
    } else {
      this.errors.push(`❌ ${filename}: No TypeScript @example blocks found`);
    }
  }

  async validateMethodDocumentation(sourceCode, filename) {
    // Find methods with parameters that should have @param documentation
    const methodsWithParams = sourceCode.match(/\/\*\*[\s\S]*?\*\/\s*(async\s+)?\w+\s*\([^)]+\):\s*(?!void)/g) || [];

    let documentedMethods = 0;
    for (const method of methodsWithParams) {
      if (method.includes('@param')) {
        documentedMethods++;
      }
    }

    if (documentedMethods > 0) {
      this.successes.push(`✅ ${filename}: Found ${documentedMethods} methods with @param documentation`);
    }

    // Find methods with return types that should have @returns documentation
    const methodsWithReturns = sourceCode.match(/\/\*\*[\s\S]*?@returns[\s\S]*?\*\/\s*(async\s+)?\w+\s*\([^)]*\)\s*:/g) || [];

    if (methodsWithReturns.length > 0) {
      this.successes.push(`✅ ${filename}: Found ${methodsWithReturns.length} methods with @returns documentation`);
    }
  }

  printReport() {
    console.log('\n📊 JSDoc Validation Report');
    console.log('='.repeat(50));

    if (this.successes.length > 0) {
      console.log('\n✅ Successes:');
      this.successes.forEach(success => console.log(`  ${success}`));
    }

    if (this.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      this.warnings.forEach(warning => console.log(`  ${warning}`));
    }

    if (this.errors.length > 0) {
      console.log('\n❌ Errors:');
      this.errors.forEach(error => console.log(`  ${error}`));
    }

    console.log('\n📈 Summary:');
    console.log(`  Successes: ${this.successes.length}`);
    console.log(`  Warnings: ${this.warnings.length}`);
    console.log(`  Errors: ${this.errors.length}`);

    const totalIssues = this.errors.length + this.warnings.length;
    const totalChecks = this.successes.length + totalIssues;
    const successRate = totalChecks > 0 ? (this.successes.length / totalChecks * 100).toFixed(1) : 0;

    console.log(`  Success Rate: ${successRate}%`);

    return this.errors.length === 0;
  }
}

async function main() {
  console.log('🚀 Starting JSDoc validation for orchestrator service classes...');

  const validator = new JSDocValidator();
  const filesToValidate = [
    'workspace-manager.ts',
    'idle-processor.ts',
    'hook-manager.ts'
  ];

  for (const filename of filesToValidate) {
    await validator.validateFile(filename);
  }

  const isValid = validator.printReport();

  if (isValid) {
    console.log('\n🎉 All JSDoc validation checks passed!');
    process.exit(0);
  } else {
    console.log('\n💥 Some JSDoc validation checks failed. Please review the documentation.');
    process.exit(1);
  }
}

main().catch(console.error);