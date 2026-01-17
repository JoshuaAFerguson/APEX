import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'yaml';
import { MCPTemplateSchema, MCPTemplate } from './types';
import { normalizePath } from './path-utils';

/**
 * Load all MCP templates from the templates directory
 * @param templatesPath Optional path to templates directory. If not provided, uses the default templates directory.
 * @returns Promise<Record<string, MCPTemplate>> - Record of template IDs to templates
 * @throws Error if templates directory is not found or templates fail validation
 */
export async function loadMCPTemplates(templatesPath?: string): Promise<Record<string, MCPTemplate>> {
  const templatesDir = await getTemplatesDirectory(templatesPath);
  const mcpTemplatesDir = normalizePath(path.join(templatesDir, 'mcp'));
  const templates: Record<string, MCPTemplate> = {};

  try {
    const files = await fs.readdir(mcpTemplatesDir);

    for (const file of files) {
      if (!file.endsWith('.yaml') && !file.endsWith('.yml')) continue;

      const filePath = normalizePath(path.join(mcpTemplatesDir, file));
      const content = await fs.readFile(filePath, 'utf-8');

      try {
        const templateData = yaml.parse(content);
        const template = MCPTemplateSchema.parse(templateData);
        templates[template.id] = template;
      } catch (parseError) {
        throw new Error(`Failed to parse MCP template ${file}: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`MCP templates directory not found at ${mcpTemplatesDir}`);
    }
    throw error;
  }

  return templates;
}

/**
 * Get a specific MCP template by ID
 * @param templateId The ID of the template to retrieve
 * @param templatesPath Optional path to templates directory. If not provided, uses the default templates directory.
 * @returns Promise<MCPTemplate | null> - The template if found, null otherwise
 * @throws Error if templates directory is not found or template fails validation
 */
export async function getMCPTemplate(templateId: string, templatesPath?: string): Promise<MCPTemplate | null> {
  if (!templateId) {
    throw new Error('Template ID is required');
  }

  const templates = await loadMCPTemplates(templatesPath);
  return templates[templateId] || null;
}

/**
 * List all available MCP template IDs
 * @param templatesPath Optional path to templates directory. If not provided, uses the default templates directory.
 * @returns Promise<string[]> - Array of template IDs
 * @throws Error if templates directory is not found
 */
export async function listMCPTemplateIds(templatesPath?: string): Promise<string[]> {
  const templates = await loadMCPTemplates(templatesPath);
  return Object.keys(templates);
}

/**
 * Get the path to the templates directory
 * @param templatesPath Optional custom templates path
 * @returns Promise<string> - Resolved templates directory path
 * @throws Error if no valid templates directory is found
 */
async function getTemplatesDirectory(templatesPath?: string): Promise<string> {
  // If custom path provided, use it directly
  if (templatesPath) {
    try {
      await fs.access(templatesPath);
      return templatesPath;
    } catch {
      throw new Error(`Custom templates directory not found: ${templatesPath}`);
    }
  }

  // Look for templates directory in standard locations
  const possibleTemplatePaths = [
    path.resolve(__dirname, '..', 'templates'), // Local development (from src -> packages/core/templates)
    path.resolve(process.cwd(), 'node_modules', '@apex', 'core', 'templates'), // Installed package
    path.resolve(__dirname, 'templates'), // Built/distributed differently
    path.resolve(__dirname, '..', '..', 'templates'), // Alternative build structure
  ];

  for (const templatePath of possibleTemplatePaths) {
    try {
      await fs.access(templatePath);
      return templatePath;
    } catch {
      // Directory doesn't exist, try next one
    }
  }

  throw new Error('Templates directory not found in any of the expected locations');
}