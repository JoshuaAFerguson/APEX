/**
 * Template CRUD Implementation Verification Script
 *
 * This file provides a comprehensive verification of the template CRUD implementation.
 * It can be run independently to verify all functionality works as expected.
 */

import { ApexOrchestrator } from '../index';
import type { TaskTemplate } from '@apexcli/core';

/**
 * Comprehensive verification of template CRUD operations
 */
export async function verifyTemplateCRUDImplementation(orchestrator: ApexOrchestrator): Promise<{
  success: boolean;
  results: string[];
  errors: string[];
}> {
  const results: string[] = [];
  const errors: string[] = [];

  try {
    // Test 1: Create Template
    results.push('🔍 Testing createTemplate()...');
    const templateData = {
      name: 'Verification Template',
      description: 'Template for verification testing',
      workflow: 'feature' as const,
      priority: 'high' as const,
      effort: 'medium' as const,
      acceptanceCriteria: 'Should work correctly',
      tags: ['verification', 'test'],
    };

    const createdTemplate = await orchestrator.createTemplate(templateData);

    if (!createdTemplate.id || !createdTemplate.id.startsWith('template_')) {
      errors.push('❌ createTemplate: Invalid ID generation');
    } else {
      results.push('✅ createTemplate: Template created successfully with ID: ' + createdTemplate.id);
    }

    if (createdTemplate.name !== templateData.name) {
      errors.push('❌ createTemplate: Name not preserved');
    } else {
      results.push('✅ createTemplate: Name preserved correctly');
    }

    // Test 2: Get Template
    results.push('🔍 Testing getTemplate()...');
    const retrievedTemplate = await orchestrator.getTemplate(createdTemplate.id);

    if (!retrievedTemplate) {
      errors.push('❌ getTemplate: Template not found');
    } else if (retrievedTemplate.id !== createdTemplate.id) {
      errors.push('❌ getTemplate: Retrieved template has different ID');
    } else {
      results.push('✅ getTemplate: Template retrieved successfully');
    }

    // Test 3: Get Non-existent Template
    results.push('🔍 Testing getTemplate() with non-existent ID...');
    const nonExistentTemplate = await orchestrator.getTemplate('non-existent-template');

    if (nonExistentTemplate !== null) {
      errors.push('❌ getTemplate: Should return null for non-existent template');
    } else {
      results.push('✅ getTemplate: Correctly returns null for non-existent template');
    }

    // Test 4: Update Template
    results.push('🔍 Testing updateTemplate()...');
    const updates = {
      name: 'Updated Verification Template',
      priority: 'urgent' as const,
      tags: ['verification', 'test', 'updated'],
    };

    const updatedTemplate = await orchestrator.updateTemplate(createdTemplate.id, updates);

    if (updatedTemplate.name !== updates.name) {
      errors.push('❌ updateTemplate: Name not updated correctly');
    } else {
      results.push('✅ updateTemplate: Name updated correctly');
    }

    if (updatedTemplate.priority !== updates.priority) {
      errors.push('❌ updateTemplate: Priority not updated correctly');
    } else {
      results.push('✅ updateTemplate: Priority updated correctly');
    }

    if (!updatedTemplate.tags.includes('updated')) {
      errors.push('❌ updateTemplate: Tags not updated correctly');
    } else {
      results.push('✅ updateTemplate: Tags updated correctly');
    }

    // Test 5: Update Non-existent Template
    results.push('🔍 Testing updateTemplate() with non-existent ID...');
    try {
      await orchestrator.updateTemplate('non-existent-template', { name: 'Should Fail' });
      errors.push('❌ updateTemplate: Should throw error for non-existent template');
    } catch (error) {
      if (error instanceof Error && error.message.includes('Template not found')) {
        results.push('✅ updateTemplate: Correctly throws error for non-existent template');
      } else {
        errors.push('❌ updateTemplate: Unexpected error: ' + error);
      }
    }

    // Test 6: Event Emission
    results.push('🔍 Testing event emission...');
    let createdEventReceived = false;
    let updatedEventReceived = false;

    const createdEventListener = (template: TaskTemplate) => {
      createdEventReceived = true;
      results.push('✅ Events: template:created event received');
    };

    const updatedEventListener = (template: TaskTemplate) => {
      updatedEventReceived = true;
      results.push('✅ Events: template:updated event received');
    };

    orchestrator.on('template:created', createdEventListener);
    orchestrator.on('template:updated', updatedEventListener);

    // Create a new template to test events
    const eventTestTemplate = await orchestrator.createTemplate({
      name: 'Event Test Template',
      description: 'Testing events',
      workflow: 'feature',
      priority: 'normal',
      effort: 'medium',
      tags: [],
    });

    // Update the template to test update events
    await orchestrator.updateTemplate(eventTestTemplate.id, { name: 'Updated Event Test' });

    // Small delay to ensure events are processed
    await new Promise(resolve => setTimeout(resolve, 10));

    if (!createdEventReceived) {
      errors.push('❌ Events: template:created event not received');
    }

    if (!updatedEventReceived) {
      errors.push('❌ Events: template:updated event not received');
    }

    // Clean up event listeners
    orchestrator.off('template:created', createdEventListener);
    orchestrator.off('template:updated', updatedEventListener);

    // Test 7: Integration with Task Creation
    results.push('🔍 Testing integration with task creation...');
    try {
      const taskFromTemplate = await orchestrator.useTemplate(updatedTemplate.id, {
        description: 'Task from verification template',
      });

      // Note: Task doesn't have a 'name' field - verify description was used from override
      if (taskFromTemplate.description !== 'Task from verification template') {
        errors.push('❌ Integration: Task description not set correctly');
      } else {
        results.push('✅ Integration: Task created successfully from template');
      }

      if (taskFromTemplate.workflow !== updatedTemplate.workflow) {
        errors.push('❌ Integration: Task workflow not inherited from template');
      } else {
        results.push('✅ Integration: Task workflow inherited correctly');
      }

    } catch (error) {
      errors.push('❌ Integration: Error creating task from template: ' + error);
    }

    // Test 8: Template Listing
    results.push('🔍 Testing template listing...');
    try {
      const allTemplates = await orchestrator.listTemplates();
      const createdTemplateInList = allTemplates.find(t => t.id === createdTemplate.id);

      if (!createdTemplateInList) {
        errors.push('❌ Listing: Created template not found in list');
      } else {
        results.push('✅ Listing: Created template found in list');
      }
    } catch (error) {
      errors.push('❌ Listing: Error listing templates: ' + error);
    }

    // Test 9: Template Deletion (cleanup)
    results.push('🔍 Testing template deletion...');
    try {
      await orchestrator.deleteTemplate(createdTemplate.id);
      await orchestrator.deleteTemplate(eventTestTemplate.id);

      const deletedTemplate = await orchestrator.getTemplate(createdTemplate.id);
      if (deletedTemplate !== null) {
        errors.push('❌ Deletion: Template still exists after deletion');
      } else {
        results.push('✅ Deletion: Template deleted successfully');
      }
    } catch (error) {
      errors.push('❌ Deletion: Error deleting template: ' + error);
    }

    return {
      success: errors.length === 0,
      results,
      errors,
    };

  } catch (error) {
    errors.push('❌ Fatal error during verification: ' + error);
    return {
      success: false,
      results,
      errors,
    };
  }
}

/**
 * Run verification and print results
 */
export async function runTemplateVerification(testDir: string): Promise<boolean> {
  console.log('🚀 Starting Template CRUD Implementation Verification...\n');

  let orchestrator: ApexOrchestrator | null = null;

  try {
    orchestrator = new ApexOrchestrator({ projectPath: testDir });
    await orchestrator.initialize();

    const verification = await verifyTemplateCRUDImplementation(orchestrator);

    console.log('📊 Verification Results:');
    console.log('========================\n');

    verification.results.forEach(result => {
      console.log(result);
    });

    if (verification.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      verification.errors.forEach(error => {
        console.log(error);
      });
    }

    console.log('\n' + '='.repeat(50));
    if (verification.success) {
      console.log('🎉 All verification tests PASSED! ✅');
      console.log('Template CRUD implementation is working correctly.');
    } else {
      console.log('❌ Some verification tests FAILED!');
      console.log(`${verification.errors.length} error(s) found.`);
    }
    console.log('='.repeat(50));

    return verification.success;

  } catch (error) {
    console.error('💥 Fatal error during verification setup:', error);
    return false;
  } finally {
    if (orchestrator) {
      orchestrator.close();
    }
  }
}

export default {
  verifyTemplateCRUDImplementation,
  runTemplateVerification,
};