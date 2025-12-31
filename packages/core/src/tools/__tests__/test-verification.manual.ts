/**
 * Manual test verification script
 * This file verifies that our test implementations are correctly structured
 * and can be imported without issues.
 */

import type { ToolInterface, ToolExecutionContext, ValidationResult } from '../base-tool.js';
import type { ToolDefinition, ToolCategory } from '../../types.js';
import {
  ToolRegistry,
  DuplicateToolError,
  ToolNotFoundError,
  ToolValidationError,
  getToolRegistry,
  registerTool,
  unregisterTool,
} from '../tool-registry.js';

/**
 * Simple mock tool for verification
 */
class VerificationTool implements ToolInterface<{ message: string }, string> {
  getDefinition(): ToolDefinition {
    return {
      name: 'VerificationTool',
      description: 'Tool for verification testing',
      category: 'custom',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'Message to process',
          },
        },
        required: ['message'],
        additionalProperties: false,
      },
      version: '1.0.0',
    };
  }

  validate(params: { message: string }): ValidationResult {
    return {
      valid: !!params.message,
      errors: params.message ? undefined : ['Message is required'],
    };
  }

  async execute(params: { message: string }): Promise<any> {
    return {
      success: true,
      output: `Verified: ${params.message}`,
      toolName: 'VerificationTool',
      invokedAt: new Date(),
      completedAt: new Date(),
    };
  }
}

/**
 * Manual verification function
 */
async function verifyToolRegistry(): Promise<boolean> {
  try {
    console.log('🧪 Starting ToolRegistry verification...');

    // Reset singleton
    ToolRegistry.resetInstance();
    const registry = ToolRegistry.getInstance();

    console.log('✅ Singleton pattern working');

    // Test tool registration
    const tool = new VerificationTool();
    registry.register(tool);

    if (!registry.has('VerificationTool')) {
      throw new Error('Tool registration failed');
    }

    console.log('✅ Tool registration working');

    // Test tool retrieval
    const entry = registry.get('VerificationTool');
    if (entry.definition.name !== 'VerificationTool') {
      throw new Error('Tool retrieval failed');
    }

    console.log('✅ Tool retrieval working');

    // Test tool interface retrieval
    const toolInterface = registry.getToolInterface('VerificationTool');
    if (toolInterface !== tool) {
      throw new Error('Tool interface retrieval failed');
    }

    console.log('✅ Tool interface retrieval working');

    // Test categories
    const customTools = registry.getByCategory('custom');
    if (customTools.length !== 1) {
      throw new Error('Category filtering failed');
    }

    console.log('✅ Category filtering working');

    // Test error handling
    try {
      registry.register(new VerificationTool()); // Duplicate
      throw new Error('Expected DuplicateToolError');
    } catch (error) {
      if (!(error instanceof DuplicateToolError)) {
        throw new Error('Wrong error type for duplicate registration');
      }
    }

    console.log('✅ Error handling working');

    // Test unregistration
    registry.unregister('VerificationTool');
    if (registry.has('VerificationTool')) {
      throw new Error('Tool unregistration failed');
    }

    console.log('✅ Tool unregistration working');

    // Test convenience functions
    registerTool(tool);
    if (!getToolRegistry().has('VerificationTool')) {
      throw new Error('Convenience functions failed');
    }

    unregisterTool('VerificationTool');
    if (getToolRegistry().has('VerificationTool')) {
      throw new Error('Convenience unregister failed');
    }

    console.log('✅ Convenience functions working');

    console.log('🎉 All verifications passed!');
    return true;

  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

// Export for potential use
export { verifyToolRegistry, VerificationTool };

// Auto-run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyToolRegistry().then(success => {
    process.exit(success ? 0 : 1);
  });
}