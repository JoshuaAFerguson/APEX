import { describe, it, expect, beforeAll } from 'vitest';
import { promises as fs } from 'fs';
import * as glob from 'glob';
import * as ts from 'typescript';

/**
 * Interface representing a function's TypeScript signature
 */
interface FunctionSignature {
  /** Function name */
  name: string;
  /** File path where function is defined */
  filePath: string;
  /** Line number of function */
  lineNumber: number;
  /** Function parameters from TypeScript */
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
  }>;
  /** Return type from TypeScript */
  returnType: string;
  /** Whether function is async */
  isAsync: boolean;
  /** Whether function is exported */
  isExported: boolean;
}

/**
 * Interface representing JSDoc parameter documentation
 */
interface JSDocParameter {
  /** Parameter name */
  name: string;
  /** Type annotation in JSDoc */
  type?: string;
  /** Parameter description */
  description: string;
  /** Whether parameter is optional */
  optional: boolean;
}

/**
 * Interface representing a validation mismatch between JSDoc and TypeScript
 */
interface ValidationMismatch {
  /** Function name */
  functionName: string;
  /** File path */
  filePath: string;
  /** Line number */
  lineNumber: number;
  /** Type of mismatch */
  type: 'missing_param' | 'extra_param' | 'type_mismatch' | 'optional_mismatch' | 'return_type_mismatch';
  /** Expected value (from TypeScript) */
  expected: string;
  /** Actual value (from JSDoc) */
  actual: string;
  /** Detailed message */
  message: string;
}

/**
 * Test suite for validating JSDoc parameter and return type accuracy
 * Compares JSDoc documentation against actual TypeScript function signatures
 */
describe('JSDoc Parameter and Return Type Validation', () => {
  let functionSignatures: FunctionSignature[] = [];
  let jsDocComments: Map<string, any> = new Map();
  let validationMismatches: ValidationMismatch[] = [];

  /**
   * Parse TypeScript file and extract function signatures
   */
  function extractFunctionSignatures(filePath: string, sourceFile: ts.SourceFile): FunctionSignature[] {
    const signatures: FunctionSignature[] = [];

    function visit(node: ts.Node): void {
      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) {
        const signature = extractSignatureFromNode(node, filePath, sourceFile);
        if (signature) {
          signatures.push(signature);
        }
      }

      if (ts.isVariableDeclaration(node) && node.initializer) {
        // Check for arrow functions or function expressions
        if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
          const signature = extractSignatureFromVariable(node, filePath, sourceFile);
          if (signature) {
            signatures.push(signature);
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return signatures;
  }

  /**
   * Extract signature information from a function node
   */
  function extractSignatureFromNode(
    node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.ArrowFunction,
    filePath: string,
    sourceFile: ts.SourceFile
  ): FunctionSignature | null {
    const name = ts.isFunctionDeclaration(node) && node.name ? node.name.text : 'anonymous';
    if (name === 'anonymous') return null;

    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const typeChecker = ts.createProgram([filePath], {}).getTypeChecker();

    const parameters = node.parameters.map(param => ({
      name: param.name.kind === ts.SyntaxKind.Identifier ? (param.name as ts.Identifier).text : 'unknown',
      type: param.type ? param.type.getText() : 'any',
      optional: !!param.questionToken || !!param.initializer,
      defaultValue: param.initializer ? param.initializer.getText() : undefined
    }));

    const returnType = node.type ? node.type.getText() : 'void';
    const isAsync = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
    const isExported = node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name,
      filePath,
      lineNumber,
      parameters,
      returnType,
      isAsync,
      isExported
    };
  }

  /**
   * Extract signature from variable declaration (for arrow functions)
   */
  function extractSignatureFromVariable(
    node: ts.VariableDeclaration,
    filePath: string,
    sourceFile: ts.SourceFile
  ): FunctionSignature | null {
    if (!node.name || node.name.kind !== ts.SyntaxKind.Identifier) return null;

    const name = (node.name as ts.Identifier).text;
    const lineNumber = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    const initializer = node.initializer!;
    let parameters: any[] = [];
    let returnType = 'void';
    let isAsync = false;

    if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
      parameters = initializer.parameters.map(param => ({
        name: param.name.kind === ts.SyntaxKind.Identifier ? (param.name as ts.Identifier).text : 'unknown',
        type: param.type ? param.type.getText() : 'any',
        optional: !!param.questionToken || !!param.initializer,
        defaultValue: param.initializer ? param.initializer.getText() : undefined
      }));

      returnType = initializer.type ? initializer.type.getText() : 'void';
      isAsync = initializer.modifiers?.some(mod => mod.kind === ts.SyntaxKind.AsyncKeyword) || false;
    }

    // Check if variable is exported
    const statement = node.parent;
    const isExported = statement && ts.isVariableStatement(statement) &&
                      statement.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword) || false;

    return {
      name,
      filePath,
      lineNumber,
      parameters,
      returnType,
      isAsync,
      isExported
    };
  }

  /**
   * Extract JSDoc information from file
   */
  async function extractJSDocInfo(filePath: string): Promise<Map<string, any>> {
    const content = await fs.readFile(filePath, 'utf-8');
    const jsDocMap = new Map();

    // Match JSDoc comments with their associated functions
    const jsDocRegex = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|const\s+(\w+)|let\s+(\w+))/g;
    let match;

    while ((match = jsDocRegex.exec(content)) !== null) {
      const [fullMatch, jsDocContent, funcName1, funcName2, funcName3] = match;
      const functionName = funcName1 || funcName2 || funcName3;

      if (functionName && jsDocContent) {
        const jsDocInfo = parseJSDocContent(jsDocContent);
        jsDocMap.set(`${filePath}:${functionName}`, jsDocInfo);
      }
    }

    return jsDocMap;
  }

  /**
   * Parse JSDoc content into structured information
   */
  function parseJSDocContent(content: string): any {
    const params: JSDocParameter[] = [];
    let returnInfo: { type?: string; description: string } | undefined;

    // Extract @param tags
    const paramRegex = /@param\s+(?:\{([^}]+)\}\s+)?(?:(\[)?(\w+)(?:\])?(?:\s+-\s+)?\s*(.*))/g;
    let paramMatch;
    while ((paramMatch = paramRegex.exec(content)) !== null) {
      const [, type, optional, name, description] = paramMatch;
      params.push({
        name: name.trim(),
        type: type?.trim(),
        description: description.trim(),
        optional: !!optional
      });
    }

    // Extract @returns tag
    const returnsRegex = /@returns?\s+(?:\{([^}]+)\}\s+)?(.*)/;
    const returnsMatch = content.match(returnsRegex);
    if (returnsMatch) {
      const [, type, description] = returnsMatch;
      returnInfo = {
        type: type?.trim(),
        description: description.trim()
      };
    }

    return { params, returnInfo };
  }

  /**
   * Validate JSDoc parameters against TypeScript signature
   */
  function validateParameters(
    signature: FunctionSignature,
    jsDocInfo: any
  ): ValidationMismatch[] {
    const mismatches: ValidationMismatch[] = [];

    if (!jsDocInfo || !jsDocInfo.params) return mismatches;

    const tsParams = signature.parameters;
    const jsDocParams = jsDocInfo.params as JSDocParameter[];

    // Check for missing parameters in JSDoc
    for (const tsParam of tsParams) {
      const jsDocParam = jsDocParams.find(p => p.name === tsParam.name);
      if (!jsDocParam) {
        mismatches.push({
          functionName: signature.name,
          filePath: signature.filePath,
          lineNumber: signature.lineNumber,
          type: 'missing_param',
          expected: tsParam.name,
          actual: 'undefined',
          message: `Parameter '${tsParam.name}' is missing from JSDoc documentation`
        });
      } else {
        // Validate optional parameter consistency
        if (tsParam.optional !== jsDocParam.optional) {
          mismatches.push({
            functionName: signature.name,
            filePath: signature.filePath,
            lineNumber: signature.lineNumber,
            type: 'optional_mismatch',
            expected: tsParam.optional ? 'optional' : 'required',
            actual: jsDocParam.optional ? 'optional' : 'required',
            message: `Parameter '${tsParam.name}' optional status mismatch: TypeScript says ${tsParam.optional ? 'optional' : 'required'}, JSDoc says ${jsDocParam.optional ? 'optional' : 'required'}`
          });
        }

        // Validate type consistency (if JSDoc has type annotation)
        if (jsDocParam.type && tsParam.type !== 'any') {
          const normalizedTsType = normalizeType(tsParam.type);
          const normalizedJsDocType = normalizeType(jsDocParam.type);

          if (normalizedTsType !== normalizedJsDocType && !isCompatibleType(normalizedTsType, normalizedJsDocType)) {
            mismatches.push({
              functionName: signature.name,
              filePath: signature.filePath,
              lineNumber: signature.lineNumber,
              type: 'type_mismatch',
              expected: normalizedTsType,
              actual: normalizedJsDocType,
              message: `Parameter '${tsParam.name}' type mismatch: TypeScript says '${normalizedTsType}', JSDoc says '${normalizedJsDocType}'`
            });
          }
        }
      }
    }

    // Check for extra parameters in JSDoc
    for (const jsDocParam of jsDocParams) {
      const tsParam = tsParams.find(p => p.name === jsDocParam.name);
      if (!tsParam) {
        mismatches.push({
          functionName: signature.name,
          filePath: signature.filePath,
          lineNumber: signature.lineNumber,
          type: 'extra_param',
          expected: 'undefined',
          actual: jsDocParam.name,
          message: `JSDoc documents parameter '${jsDocParam.name}' which doesn't exist in function signature`
        });
      }
    }

    return mismatches;
  }

  /**
   * Validate JSDoc return type against TypeScript signature
   */
  function validateReturnType(
    signature: FunctionSignature,
    jsDocInfo: any
  ): ValidationMismatch[] {
    const mismatches: ValidationMismatch[] = [];

    const hasReturnValue = signature.returnType !== 'void' && signature.returnType !== 'undefined';
    const hasJSDocReturn = jsDocInfo && jsDocInfo.returnInfo;

    if (hasReturnValue && !hasJSDocReturn) {
      mismatches.push({
        functionName: signature.name,
        filePath: signature.filePath,
        lineNumber: signature.lineNumber,
        type: 'return_type_mismatch',
        expected: signature.returnType,
        actual: 'undefined',
        message: `Function returns '${signature.returnType}' but has no @returns documentation`
      });
    }

    if (!hasReturnValue && hasJSDocReturn) {
      mismatches.push({
        functionName: signature.name,
        filePath: signature.filePath,
        lineNumber: signature.lineNumber,
        type: 'return_type_mismatch',
        expected: 'void',
        actual: jsDocInfo.returnInfo.type || 'documented',
        message: `Function returns void but has @returns documentation`
      });
    }

    if (hasReturnValue && hasJSDocReturn && jsDocInfo.returnInfo.type) {
      const normalizedTsType = normalizeType(signature.returnType);
      const normalizedJsDocType = normalizeType(jsDocInfo.returnInfo.type);

      if (normalizedTsType !== normalizedJsDocType && !isCompatibleType(normalizedTsType, normalizedJsDocType)) {
        mismatches.push({
          functionName: signature.name,
          filePath: signature.filePath,
          lineNumber: signature.lineNumber,
          type: 'return_type_mismatch',
          expected: normalizedTsType,
          actual: normalizedJsDocType,
          message: `Return type mismatch: TypeScript says '${normalizedTsType}', JSDoc says '${normalizedJsDocType}'`
        });
      }
    }

    return mismatches;
  }

  /**
   * Normalize type names for comparison
   */
  function normalizeType(type: string): string {
    return type
      .replace(/\s+/g, '') // Remove whitespace
      .replace(/Promise<(.+)>/g, '$1') // Handle Promise types
      .replace(/Array<(.+)>/g, '$1[]') // Normalize array syntax
      .toLowerCase();
  }

  /**
   * Check if two types are compatible (allowing for some flexibility)
   */
  function isCompatibleType(tsType: string, jsDocType: string): boolean {
    const compatibilityMap: Record<string, string[]> = {
      'string': ['string'],
      'number': ['number'],
      'boolean': ['boolean', 'bool'],
      'object': ['object', 'record'],
      'any': ['any', '*'],
      'unknown': ['unknown', 'any'],
      'void': ['void', 'undefined'],
      'promise': ['promise'],
    };

    const normalizedTs = tsType.toLowerCase();
    const normalizedJsDoc = jsDocType.toLowerCase();

    // Direct match
    if (normalizedTs === normalizedJsDoc) return true;

    // Check compatibility map
    for (const [key, values] of Object.entries(compatibilityMap)) {
      if (normalizedTs.includes(key) && values.some(v => normalizedJsDoc.includes(v))) {
        return true;
      }
    }

    return false;
  }

  // Setup: analyze all TypeScript files
  beforeAll(async () => {
    const sourceFiles = glob.sync('packages/**/*.{ts,tsx}', {
      ignore: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts']
    });

    console.log(`Analyzing ${sourceFiles.length} TypeScript files for JSDoc parameter validation...`);

    for (const filePath of sourceFiles) {
      try {
        // Extract TypeScript signatures
        const content = await fs.readFile(filePath, 'utf-8');
        const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
        const signatures = extractFunctionSignatures(filePath, sourceFile);
        functionSignatures.push(...signatures);

        // Extract JSDoc information
        const jsDocInfo = await extractJSDocInfo(filePath);
        for (const [key, value] of jsDocInfo.entries()) {
          jsDocComments.set(key, value);
        }
      } catch (error) {
        console.warn(`Failed to process ${filePath}: ${error}`);
      }
    }

    // Validate all function signatures
    for (const signature of functionSignatures) {
      if (signature.isExported) { // Only validate exported functions
        const key = `${signature.filePath}:${signature.name}`;
        const jsDocInfo = jsDocComments.get(key);

        const paramMismatches = validateParameters(signature, jsDocInfo);
        const returnMismatches = validateReturnType(signature, jsDocInfo);

        validationMismatches.push(...paramMismatches, ...returnMismatches);
      }
    }

    console.log(`Found ${functionSignatures.length} functions, ${validationMismatches.length} validation mismatches`);
  }, 30000); // 30 second timeout for analysis

  describe('Parameter Documentation Accuracy', () => {
    it('should document all function parameters in JSDoc', () => {
      const missingParams = validationMismatches.filter(m => m.type === 'missing_param');

      if (missingParams.length > 0) {
        console.log(`Missing parameter documentation (${missingParams.length} issues):`);
        missingParams.slice(0, 10).forEach(mismatch => {
          console.log(`  ${mismatch.filePath}:${mismatch.lineNumber} - ${mismatch.message}`);
        });
      }

      // Allow some flexibility for complex cases
      expect(missingParams.length).toBeLessThan(functionSignatures.length * 0.05);
    });

    it('should not document parameters that do not exist', () => {
      const extraParams = validationMismatches.filter(m => m.type === 'extra_param');

      if (extraParams.length > 0) {
        console.log(`Extra parameter documentation (${extraParams.length} issues):`);
        extraParams.forEach(mismatch => {
          console.log(`  ${mismatch.filePath}:${mismatch.lineNumber} - ${mismatch.message}`);
        });
      }

      expect(extraParams).toHaveLength(0);
    });

    it('should correctly mark optional parameters', () => {
      const optionalMismatches = validationMismatches.filter(m => m.type === 'optional_mismatch');

      if (optionalMismatches.length > 0) {
        console.log(`Optional parameter mismatches (${optionalMismatches.length} issues):`);
        optionalMismatches.forEach(mismatch => {
          console.log(`  ${mismatch.filePath}:${mismatch.lineNumber} - ${mismatch.message}`);
        });
      }

      // Allow some flexibility for optional parameters
      expect(optionalMismatches.length).toBeLessThan(functionSignatures.length * 0.1);
    });
  });

  describe('Return Type Documentation Accuracy', () => {
    it('should document return types for functions that return values', () => {
      const missingReturns = validationMismatches.filter(m =>
        m.type === 'return_type_mismatch' && m.actual === 'undefined'
      );

      if (missingReturns.length > 0) {
        console.log(`Missing return type documentation (${missingReturns.length} issues):`);
        missingReturns.slice(0, 10).forEach(mismatch => {
          console.log(`  ${mismatch.filePath}:${mismatch.lineNumber} - ${mismatch.message}`);
        });
      }

      // Allow some flexibility for return type documentation
      expect(missingReturns.length).toBeLessThan(functionSignatures.length * 0.1);
    });

    it('should not document return types for void functions', () => {
      const extraReturns = validationMismatches.filter(m =>
        m.type === 'return_type_mismatch' && m.expected === 'void'
      );

      if (extraReturns.length > 0) {
        console.log(`Extra return type documentation (${extraReturns.length} issues):`);
        extraReturns.forEach(mismatch => {
          console.log(`  ${mismatch.filePath}:${mismatch.lineNumber} - ${mismatch.message}`);
        });
      }

      expect(extraReturns.length).toBeLessThan(5); // Allow very few extra returns
    });
  });

  describe('Type Annotation Consistency', () => {
    it('should have consistent type annotations between TypeScript and JSDoc', () => {
      const typeMismatches = validationMismatches.filter(m => m.type === 'type_mismatch');

      if (typeMismatches.length > 0) {
        console.log(`Type annotation mismatches (${typeMismatches.length} issues):`);
        typeMismatches.slice(0, 5).forEach(mismatch => {
          console.log(`  ${mismatch.filePath}:${mismatch.lineNumber} - ${mismatch.message}`);
        });
      }

      // Allow some type mismatches due to complex types
      expect(typeMismatches.length).toBeLessThan(validationMismatches.length * 0.1);
    });
  });

  describe('Validation Summary', () => {
    it('should provide comprehensive validation summary', () => {
      const summary = {
        totalFunctions: functionSignatures.length,
        exportedFunctions: functionSignatures.filter(f => f.isExported).length,
        functionsWithJSDoc: jsDocComments.size,
        validationMismatches: validationMismatches.length,
        missingParams: validationMismatches.filter(m => m.type === 'missing_param').length,
        extraParams: validationMismatches.filter(m => m.type === 'extra_param').length,
        optionalMismatches: validationMismatches.filter(m => m.type === 'optional_mismatch').length,
        returnTypeMismatches: validationMismatches.filter(m => m.type === 'return_type_mismatch').length,
        typeMismatches: validationMismatches.filter(m => m.type === 'type_mismatch').length
      };

      console.log('\n=== JSDoc Parameter Validation Summary ===');
      console.log(`🔍 Total functions analyzed: ${summary.totalFunctions}`);
      console.log(`📤 Exported functions: ${summary.exportedFunctions}`);
      console.log(`📝 Functions with JSDoc: ${summary.functionsWithJSDoc}`);
      console.log(`❌ Total validation mismatches: ${summary.validationMismatches}`);
      console.log(`   ├─ Missing parameters: ${summary.missingParams}`);
      console.log(`   ├─ Extra parameters: ${summary.extraParams}`);
      console.log(`   ├─ Optional mismatches: ${summary.optionalMismatches}`);
      console.log(`   ├─ Return type mismatches: ${summary.returnTypeMismatches}`);
      console.log(`   └─ Type mismatches: ${summary.typeMismatches}`);

      const accuracy = summary.exportedFunctions > 0 ?
        ((summary.exportedFunctions - summary.validationMismatches) / summary.exportedFunctions * 100).toFixed(1) :
        '100.0';

      console.log(`✅ Documentation accuracy: ${accuracy}%`);

      expect(summary.totalFunctions).toBeGreaterThan(0);
    });
  });
});