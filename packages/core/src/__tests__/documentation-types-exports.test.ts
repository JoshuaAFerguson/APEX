import { describe, it, expect } from 'vitest';
import {
  OutdatedDocsConfig,
  OutdatedDocsConfigSchema,
  DocumentationAnalysisConfig,
  DocumentationAnalysisConfigSchema,
  ApexConfig,
  ApexConfigSchema,
} from '../types';
import {
  OutdatedDocsConfig as ExportedOutdatedDocsConfig,
  OutdatedDocsConfigSchema as ExportedOutdatedDocsConfigSchema,
  DocumentationAnalysisConfig as ExportedDocumentationAnalysisConfig,
  DocumentationAnalysisConfigSchema as ExportedDocumentationAnalysisConfigSchema,
  ApexConfig as ExportedApexConfig,
  ApexConfigSchema as ExportedApexConfigSchema,
} from '../index';

describe('Documentation Types and Schema Exports', () => {
  describe('Type Exports from @apexcli/core', () => {
    it('should export OutdatedDocsConfig type correctly', () => {
      // Test that the type can be used
      const config: OutdatedDocsConfig = {
        todoAgeThresholdDays: 30,
        versionCheckPatterns: ['v\\d+\\.\\d+\\.\\d+'],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      expect(config.todoAgeThresholdDays).toBe(30);
      expect(config.versionCheckPatterns).toEqual(['v\\d+\\.\\d+\\.\\d+']);
      expect(config.deprecationRequiresMigration).toBe(true);
      expect(config.crossReferenceEnabled).toBe(true);
    });

    it('should export DocumentationAnalysisConfig type correctly', () => {
      const config: DocumentationAnalysisConfig = {
        enabled: true,
        outdatedDocs: {
          todoAgeThresholdDays: 21,
          versionCheckPatterns: ['custom-pattern'],
          deprecationRequiresMigration: false,
          crossReferenceEnabled: true,
        },
        jsdocAnalysis: {
          enabled: true,
          requirePublicExports: false,
          checkReturnTypes: true,
          checkParameterTypes: false,
        },
      };

      expect(config.enabled).toBe(true);
      expect(config.outdatedDocs?.todoAgeThresholdDays).toBe(21);
      expect(config.jsdocAnalysis?.enabled).toBe(true);
    });

    it('should export ApexConfig type with documentation field correctly', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 14,
          },
        },
      };

      expect(config.version).toBe('1.0');
      expect(config.project.name).toBe('test-project');
      expect(config.documentation?.enabled).toBe(true);
      expect(config.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(14);
    });
  });

  describe('Schema Exports from @apexcli/core', () => {
    it('should export OutdatedDocsConfigSchema correctly', () => {
      const validConfig = {
        todoAgeThresholdDays: 45,
        versionCheckPatterns: ['test-pattern'],
        deprecationRequiresMigration: false,
        crossReferenceEnabled: true,
      };

      const parsed = OutdatedDocsConfigSchema.parse(validConfig);
      expect(parsed.todoAgeThresholdDays).toBe(45);
      expect(parsed.versionCheckPatterns).toEqual(['test-pattern']);
      expect(parsed.deprecationRequiresMigration).toBe(false);
      expect(parsed.crossReferenceEnabled).toBe(true);
    });

    it('should export DocumentationAnalysisConfigSchema correctly', () => {
      const validConfig = {
        enabled: false,
        outdatedDocs: {
          todoAgeThresholdDays: 60,
        },
        jsdocAnalysis: {
          enabled: true,
          checkReturnTypes: false,
        },
      };

      const parsed = DocumentationAnalysisConfigSchema.parse(validConfig);
      expect(parsed.enabled).toBe(false);
      expect(parsed.outdatedDocs?.todoAgeThresholdDays).toBe(60);
      expect(parsed.jsdocAnalysis?.enabled).toBe(true);
      expect(parsed.jsdocAnalysis?.checkReturnTypes).toBe(false);
    });

    it('should export ApexConfigSchema with documentation validation correctly', () => {
      const validConfig = {
        version: '1.0',
        project: {
          name: 'schema-test-project',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 28,
          },
        },
      };

      const parsed = ApexConfigSchema.parse(validConfig);
      expect(parsed.version).toBe('1.0');
      expect(parsed.project.name).toBe('schema-test-project');
      expect(parsed.documentation?.enabled).toBe(true);
      expect(parsed.documentation?.outdatedDocs?.todoAgeThresholdDays).toBe(28);
    });
  });

  describe('Re-export Validation', () => {
    it('should re-export OutdatedDocsConfig and schema through index', () => {
      // Test that types are properly re-exported
      const config: ExportedOutdatedDocsConfig = {
        todoAgeThresholdDays: 30,
        versionCheckPatterns: ['v\\d+\\.\\d+\\.\\d+'],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      const parsed = ExportedOutdatedDocsConfigSchema.parse(config);
      expect(parsed).toEqual(config);
    });

    it('should re-export DocumentationAnalysisConfig and schema through index', () => {
      const config: ExportedDocumentationAnalysisConfig = {
        enabled: true,
        outdatedDocs: {
          todoAgeThresholdDays: 15,
        },
      };

      const parsed = ExportedDocumentationAnalysisConfigSchema.parse(config);
      expect(parsed.enabled).toBe(true);
      expect(parsed.outdatedDocs?.todoAgeThresholdDays).toBe(15);
    });

    it('should re-export ApexConfig and schema through index', () => {
      const config: ExportedApexConfig = {
        version: '1.0',
        project: {
          name: 'index-export-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: false,
        },
      };

      const parsed = ExportedApexConfigSchema.parse(config);
      expect(parsed.project.name).toBe('index-export-test');
      expect(parsed.documentation?.enabled).toBe(false);
    });
  });

  describe('Type Compatibility', () => {
    it('should ensure OutdatedDocsConfig type matches schema inference', () => {
      type SchemaInferred = typeof OutdatedDocsConfigSchema._output;

      // This test ensures the manual type definition matches the schema
      const config: OutdatedDocsConfig = {
        todoAgeThresholdDays: 30,
        versionCheckPatterns: ['pattern'],
        deprecationRequiresMigration: true,
        crossReferenceEnabled: true,
      };

      // If types don't match, this assignment would fail at compile time
      const schemaConfig: SchemaInferred = config;
      expect(schemaConfig.todoAgeThresholdDays).toBe(30);
    });

    it('should ensure DocumentationAnalysisConfig type matches schema inference', () => {
      type SchemaInferred = typeof DocumentationAnalysisConfigSchema._output;

      const config: DocumentationAnalysisConfig = {
        enabled: true,
        outdatedDocs: {
          todoAgeThresholdDays: 21,
        },
        jsdocAnalysis: {
          enabled: false,
        },
      };

      // If types don't match, this assignment would fail at compile time
      const schemaConfig: SchemaInferred = config;
      expect(schemaConfig.enabled).toBe(true);
    });

    it('should ensure ApexConfig documentation field matches schema inference', () => {
      type SchemaInferred = typeof ApexConfigSchema._output;

      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'compatibility-test',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
        documentation: {
          enabled: true,
          outdatedDocs: {
            todoAgeThresholdDays: 7,
          },
        },
      };

      // If types don't match, this assignment would fail at compile time
      const schemaConfig: SchemaInferred = config;
      expect(schemaConfig.project.name).toBe('compatibility-test');
      expect(schemaConfig.documentation?.enabled).toBe(true);
    });
  });

  describe('Documentation Field Optionality', () => {
    it('should allow ApexConfig without documentation field', () => {
      const config: ApexConfig = {
        version: '1.0',
        project: {
          name: 'no-doc-field',
          testCommand: 'npm test',
          lintCommand: 'npm run lint',
          buildCommand: 'npm run build',
        },
      };

      const parsed = ApexConfigSchema.parse(config);
      expect(parsed.project.name).toBe('no-doc-field');
      expect(parsed.documentation).toBeUndefined();
    });

    it('should allow DocumentationAnalysisConfig with only enabled field', () => {
      const config: DocumentationAnalysisConfig = {
        enabled: false,
      };

      const parsed = DocumentationAnalysisConfigSchema.parse(config);
      expect(parsed.enabled).toBe(false);
      expect(parsed.outdatedDocs).toBeUndefined();
      expect(parsed.jsdocAnalysis).toBeUndefined();
    });

    it('should allow OutdatedDocsConfig with all default values', () => {
      const config = {};

      const parsed = OutdatedDocsConfigSchema.parse(config);
      expect(parsed.todoAgeThresholdDays).toBe(30);
      expect(parsed.versionCheckPatterns).toEqual([
        'v\\d+\\.\\d+\\.\\d+',
        'version\\s+\\d+\\.\\d+',
        '\\d+\\.\\d+\\s+release',
        'npm\\s+install.*@\\d+\\.\\d+\\.\\d+',
      ]);
      expect(parsed.deprecationRequiresMigration).toBe(true);
      expect(parsed.crossReferenceEnabled).toBe(true);
    });
  });

  describe('Runtime Type Validation', () => {
    it('should catch type mismatches at runtime through schema', () => {
      expect(() => {
        OutdatedDocsConfigSchema.parse({
          todoAgeThresholdDays: 'invalid-number',
        });
      }).toThrow();

      expect(() => {
        DocumentationAnalysisConfigSchema.parse({
          enabled: 'not-boolean',
        });
      }).toThrow();

      expect(() => {
        ApexConfigSchema.parse({
          project: { name: 'test' },
          documentation: {
            outdatedDocs: {
              todoAgeThresholdDays: -1,
            },
          },
        });
      }).toThrow();
    });

    it('should validate nested structure constraints', () => {
      expect(() => {
        DocumentationAnalysisConfigSchema.parse({
          outdatedDocs: {
            versionCheckPatterns: 'should-be-array',
          },
        });
      }).toThrow();

      expect(() => {
        DocumentationAnalysisConfigSchema.parse({
          jsdocAnalysis: {
            enabled: true,
            requirePublicExports: 'should-be-boolean',
          },
        });
      }).toThrow();
    });
  });
});