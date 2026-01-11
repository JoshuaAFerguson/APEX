/**
 * Tool Alias Resolver
 *
 * Resolves tool aliases defined in config to full tool invocations with parameter substitution.
 * Supports {{param}} syntax for parameter substitution and validates required vs optional parameters.
 *
 * @module orchestrator/alias-resolver
 */

import { ToolAlias, ExpandedToolAlias } from '@apexcli/core';

/**
 * Error thrown when alias resolution fails
 */
export class AliasResolutionError extends Error {
  constructor(message: string, public readonly aliasName?: string, public readonly missingParams?: string[]) {
    super(message);
    this.name = 'AliasResolutionError';
  }
}

/**
 * Tool Alias Resolver
 *
 * Resolves tool aliases to full tool invocations with parameter substitution.
 *
 * @example
 * ```typescript
 * const aliases = [
 *   {
 *     name: 'search-files',
 *     description: 'Search for files with pattern',
 *     tool: 'grep',
 *     parameters: { pattern: '{{pattern}}', path: '{{path}}' },
 *     aliasParameters: [
 *       { name: 'pattern', description: 'Search pattern', type: 'string', required: true },
 *       { name: 'path', description: 'Search path', type: 'string', required: false, defaultValue: '.' }
 *     ]
 *   }
 * ];
 *
 * const resolver = new AliasResolver(aliases);
 * const result = await resolver.resolve('search-files', { pattern: 'function', path: 'src/' });
 * // Returns: { aliasName: 'search-files', tool: 'grep', parameters: { pattern: 'function', path: 'src/' }, alias: ... }
 * ```
 */
export class AliasResolver {
  private aliasMap: Map<string, ToolAlias> = new Map();

  /**
   * Create a new AliasResolver with the given alias definitions
   *
   * @param aliases - Array of tool alias definitions
   */
  constructor(aliases: ToolAlias[]) {
    this.setAliases(aliases);
  }

  /**
   * Update the alias definitions
   *
   * @param aliases - Array of tool alias definitions
   */
  setAliases(aliases: ToolAlias[]): void {
    this.aliasMap.clear();
    for (const alias of aliases) {
      this.aliasMap.set(alias.name, alias);
    }
  }

  /**
   * Get all available alias names
   *
   * @returns Array of alias names
   */
  getAvailableAliases(): string[] {
    return Array.from(this.aliasMap.keys());
  }

  /**
   * Check if an alias exists
   *
   * @param aliasName - The alias name to check
   * @returns True if the alias exists
   */
  hasAlias(aliasName: string): boolean {
    return this.aliasMap.has(aliasName);
  }

  /**
   * Get an alias definition by name
   *
   * @param aliasName - The alias name
   * @returns The alias definition or undefined if not found
   */
  getAlias(aliasName: string): ToolAlias | undefined {
    return this.aliasMap.get(aliasName);
  }

  /**
   * Resolve an alias with parameters to a full tool invocation
   *
   * @param aliasName - The name of the alias to resolve
   * @param params - Parameters to substitute in the alias
   * @returns Resolved tool invocation
   * @throws {AliasResolutionError} If alias is not found or required parameters are missing
   */
  resolve(aliasName: string, params: Record<string, any> = {}): ExpandedToolAlias {
    // Check if alias exists
    const alias = this.aliasMap.get(aliasName);
    if (!alias) {
      throw new AliasResolutionError(
        `Unknown alias '${aliasName}'. Available aliases: ${this.getAvailableAliases().join(', ')}`,
        aliasName
      );
    }

    // Validate parameters
    const validationResult = this.validateParameters(alias, params);
    if (!validationResult.valid) {
      const missingParams = validationResult.missingRequired || [];
      const extraParams = validationResult.extraParameters || [];

      let errorMessage = `Invalid parameters for alias '${aliasName}'.`;

      if (missingParams.length > 0) {
        errorMessage += ` Missing required parameters: ${missingParams.join(', ')}.`;
      }

      if (extraParams.length > 0) {
        errorMessage += ` Unknown parameters: ${extraParams.join(', ')}.`;
      }

      if (alias.aliasParameters) {
        const requiredParams = alias.aliasParameters.filter(p => p.required).map(p => p.name);
        const optionalParams = alias.aliasParameters.filter(p => !p.required).map(p => p.name);

        if (requiredParams.length > 0) {
          errorMessage += ` Required parameters: ${requiredParams.join(', ')}.`;
        }
        if (optionalParams.length > 0) {
          errorMessage += ` Optional parameters: ${optionalParams.join(', ')}.`;
        }
      }

      throw new AliasResolutionError(errorMessage, aliasName, missingParams);
    }

    // Merge parameters with defaults
    const resolvedParams = this.mergeWithDefaults(alias, params);

    // Perform parameter substitution in the tool parameters
    const substitutedParameters = this.substituteParameters(alias.parameters, resolvedParams);

    return {
      aliasName,
      tool: alias.tool,
      parameters: substitutedParameters,
      alias
    };
  }

  /**
   * Validate parameters against alias definition
   *
   * @private
   * @param alias - The alias definition
   * @param params - The provided parameters
   * @returns Validation result
   */
  private validateParameters(alias: ToolAlias, params: Record<string, any>) {
    const result = {
      valid: true,
      missingRequired: [] as string[],
      extraParameters: [] as string[],
      invalidTypes: [] as string[]
    };

    // If no parameter definitions, allow any parameters
    if (!alias.aliasParameters || alias.aliasParameters.length === 0) {
      return result;
    }

    const paramDefs = alias.aliasParameters;
    const definedParamNames = new Set(paramDefs.map(p => p.name));
    const providedParamNames = Object.keys(params);

    // Check for required parameters
    for (const paramDef of paramDefs) {
      if (paramDef.required && !(paramDef.name in params)) {
        // Check if there's a default value
        if (paramDef.default === undefined) {
          result.missingRequired.push(paramDef.name);
        }
      }
    }

    // Check for extra parameters
    for (const paramName of providedParamNames) {
      if (!definedParamNames.has(paramName)) {
        result.extraParameters.push(paramName);
      }
    }

    // Check parameter types
    for (const paramDef of paramDefs) {
      if (paramDef.name in params) {
        const value = params[paramDef.name];
        const actualType = this.getJavaScriptType(value);

        if (actualType !== paramDef.type) {
          result.invalidTypes.push(
            `${paramDef.name} (expected ${paramDef.type}, got ${actualType})`
          );
        }
      }
    }

    result.valid = result.missingRequired.length === 0 &&
                   result.extraParameters.length === 0 &&
                   result.invalidTypes.length === 0;

    return result;
  }

  /**
   * Merge provided parameters with default values
   *
   * @private
   * @param alias - The alias definition
   * @param params - The provided parameters
   * @returns Merged parameters
   */
  private mergeWithDefaults(alias: ToolAlias, params: Record<string, any>): Record<string, any> {
    const result = { ...params };

    if (alias.aliasParameters) {
      for (const paramDef of alias.aliasParameters) {
        if (!(paramDef.name in result) && paramDef.default !== undefined) {
          result[paramDef.name] = paramDef.default;
        }
      }
    }

    return result;
  }

  /**
   * Substitute parameters in the tool parameters using {{param}} syntax
   *
   * @private
   * @param toolParameters - The tool parameters with placeholders
   * @param resolvedParams - The resolved parameter values
   * @returns Parameters with substitutions applied
   */
  private substituteParameters(
    toolParameters: Record<string, any>,
    resolvedParams: Record<string, any>
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(toolParameters)) {
      result[key] = this.substituteValue(value, resolvedParams);
    }

    return result;
  }

  /**
   * Substitute a single value, handling strings, objects, and arrays recursively
   *
   * @private
   * @param value - The value to substitute
   * @param params - The parameter values
   * @returns Value with substitutions applied
   */
  private substituteValue(value: any, params: Record<string, any>): any {
    if (typeof value === 'string') {
      return this.substituteInString(value, params);
    } else if (Array.isArray(value)) {
      return value.map(item => this.substituteValue(item, params));
    } else if (value && typeof value === 'object') {
      const result: Record<string, any> = {};
      for (const [key, val] of Object.entries(value)) {
        result[key] = this.substituteValue(val, params);
      }
      return result;
    }

    return value;
  }

  /**
   * Substitute parameters in a string using {{param}} syntax
   *
   * @private
   * @param template - The template string with {{param}} placeholders
   * @param params - The parameter values
   * @returns String with substitutions applied
   */
  private substituteInString(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, paramName) => {
      if (paramName in params) {
        const value = params[paramName];
        // Convert to string if not already
        return typeof value === 'string' ? value : String(value);
      }
      // Leave placeholder as-is if parameter not found
      return match;
    });
  }

  /**
   * Get JavaScript type name for a value
   *
   * @private
   * @param value - The value to check
   * @returns Type name ('string', 'number', 'boolean')
   */
  private getJavaScriptType(value: any): string {
    const type = typeof value;
    if (type === 'string' || type === 'number' || type === 'boolean') {
      return type;
    }
    return 'unknown';
  }
}