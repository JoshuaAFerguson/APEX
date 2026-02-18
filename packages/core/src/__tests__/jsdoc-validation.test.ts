/**
 * @fileoverview JSDoc Validation Tests for Tool Types
 *
 * Tests that verify the newly added JSDoc documentation exists and is accurate
 * for the tool-related type schemas that were documented as part of the
 * feature development task.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Tool Types JSDoc Documentation Validation', () => {
  const typesFilePath = path.join(__dirname, '..', 'types.ts');
  let sourceContent: string;

  beforeAll(() => {
    sourceContent = fs.readFileSync(typesFilePath, 'utf8');
  });

  describe('ToolConfigSchema Documentation', () => {
    it('should have JSDoc documentation', () => {
      const pattern = /\/\*\*[\s\S]*?\*\/\s*export const ToolConfigSchema/;
      expect(pattern.test(sourceContent)).toBe(true);
    });

    it('should have meaningful JSDoc content for ToolConfigSchema', () => {
      const match = sourceContent.match(/\/\*\*[\s\S]*?\*\/\s*export const ToolConfigSchema/);
      expect(match).toBeTruthy();

      if (match) {
        const jsdocContent = match[0];
        expect(jsdocContent).toMatch(/tool.*configuration|configuration.*tool/i);
        expect(jsdocContent).toMatch(/map|record|per-tool|config\.yaml/i);
      }
    });
  });

  describe('CustomToolOutputParserSchema Documentation', () => {
    it('should have JSDoc documentation', () => {
      const pattern = /\/\*\*[\s\S]*?\*\/\s*export const CustomToolOutputParserSchema/;
      expect(pattern.test(sourceContent)).toBe(true);
    });

    it('should have meaningful JSDoc content for CustomToolOutputParserSchema', () => {
      const match = sourceContent.match(/\/\*\*[\s\S]*?\*\/\s*export const CustomToolOutputParserSchema/);
      expect(match).toBeTruthy();

      if (match) {
        const jsdocContent = match[0];
        expect(jsdocContent).toMatch(/output.*parser|parser.*output/i);
        expect(jsdocContent).toMatch(/custom.*tool|tool.*custom/i);
        expect(jsdocContent).toMatch(/process|format/i);
      }
    });
  });

  describe('ToolRegistryStateSchema Documentation', () => {
    it('should have JSDoc documentation', () => {
      const pattern = /\/\*\*[\s\S]*?\*\/\s*export const ToolRegistryStateSchema/;
      expect(pattern.test(sourceContent)).toBe(true);
    });

    it('should have meaningful JSDoc content for ToolRegistryStateSchema', () => {
      const match = sourceContent.match(/\/\*\*[\s\S]*?\*\/\s*export const ToolRegistryStateSchema/);
      expect(match).toBeTruthy();

      if (match) {
        const jsdocContent = match[0];
        expect(jsdocContent).toMatch(/registry.*state|state.*registry/i);
        expect(jsdocContent).toMatch(/snapshot|complete.*state|registered.*tools/i);
      }
    });
  });

  describe('Documentation Completeness', () => {
    it('should have all required tool-related type schemas documented', () => {
      const requiredSchemas = [
        'ToolConfigSchema',
        'CustomToolOutputParserSchema',
        'ToolRegistryStateSchema'
      ];

      requiredSchemas.forEach(schemaName => {
        const pattern = new RegExp(`\\/\\*\\*[\\s\\S]*?\\*\\/\\s*export const ${schemaName}`);
        const hasDocumentation = pattern.test(sourceContent);
        expect(hasDocumentation).toBe(true);
      });
    });

    it('should not have TODO comments or placeholder documentation', () => {
      const todoPattern = /TODO:|FIXME:|XXX:/i;
      const jsdocBlocks = sourceContent.match(/\/\*\*[\s\S]*?\*\//g) || [];

      const toolRelatedJSDoc = jsdocBlocks.filter(block =>
        /ToolConfig|CustomToolOutput|ToolRegistry/i.test(block)
      );

      toolRelatedJSDoc.forEach(block => {
        expect(todoPattern.test(block)).toBe(false);
      });
    });
  });
});