import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Manual validation test for Natural Language Interface Documentation
 * This test can be run to verify the documentation meets the acceptance criteria
 * without requiring the full test suite execution.
 */
function validateNaturalLanguageDocumentation(): {
  success: boolean;
  errors: string[];
  summary: string;
} {
  const errors: string[] = [];
  const documentationPath = join(process.cwd(), 'docs', 'features', 'v030-features.md');

  try {
    const content = readFileSync(documentationPath, 'utf-8');

    // Test 1: Section 6 exists
    if (!content.includes('### 6. Natural Language Interface')) {
      errors.push('Missing: Natural Language Interface section');
    }

    // Test 2: Intent Detection Examples
    if (!content.includes('#### Intent Detection Examples')) {
      errors.push('Missing: Intent Detection Examples subsection');
    }

    if (!content.includes('##### Commands vs Tasks vs Questions')) {
      errors.push('Missing: Commands vs Tasks vs Questions subsection');
    }

    // Test 3: Commands examples
    const commandChecks = [
      'apex> /help',
      'apex> /status',
      '🔍 Intent: command',
      '📊 Confidence: 100%',
      '⚡ Action: Execute system function immediately'
    ];

    commandChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing command example element: ${check}`);
      }
    });

    // Test 4: Task examples
    const taskChecks = [
      'apex> Add user authentication to my React app',
      'apex> Refactor this component to use hooks',
      '🔍 Intent: task',
      '🤖 Agent Assignment: architect → planner → developer',
      '⚡ Action: Create task execution workflow'
    ];

    taskChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing task example element: ${check}`);
      }
    });

    // Test 5: Question examples
    const questionChecks = [
      'apex> What does this function do?',
      'apex> How do I configure JWT tokens?',
      '🔍 Intent: question',
      '🤖 Agent Assignment: None (direct analysis)',
      '⚡ Action: Code explanation response'
    ];

    questionChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing question example element: ${check}`);
      }
    });

    // Test 6: Ambiguous Input Handling
    if (!content.includes('##### Ambiguous Input Handling')) {
      errors.push('Missing: Ambiguous Input Handling subsection');
    }

    const clarificationChecks = [
      'apex> Fix the bug',
      '🔍 Intent: task (uncertain)',
      '📊 Confidence: 45%',
      '⚠️ Clarification needed',
      '┌─ Clarification Required',
      '🔍 What bug would you like me to fix?'
    ];

    clarificationChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing clarification flow element: ${check}`);
      }
    });

    // Test 7: Contextual Suggestions
    if (!content.includes('##### Contextual Suggestions')) {
      errors.push('Missing: Contextual Suggestions subsection');
    }

    const contextualChecks = [
      'apex> add auth',
      '🔍 Analyzing project context...',
      '📁 Detected: React + TypeScript project',
      '🔧 Dependencies: @auth0/auth0-react found',
      '💡 Contextual Suggestions:',
      '🔐 Authentication Features:',
      '→ "Add Auth0 login integration"'
    ];

    contextualChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing contextual suggestion element: ${check}`);
      }
    });

    // Test 8: Multi-step Task Detection
    if (!content.includes('##### Multi-step Task Detection')) {
      errors.push('Missing: Multi-step Task Detection subsection');
    }

    const multiStepChecks = [
      'apex> Create a blog system with posts, comments, and user profiles',
      '🔍 Intent: complex_task',
      '🏗️ Multi-step workflow detected',
      '┌─ Task Breakdown',
      '📋 Detected Components:',
      '1️⃣ Blog Posts System',
      '2️⃣ Comments System',
      '3️⃣ User Profiles'
    ];

    multiStepChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing multi-step detection element: ${check}`);
      }
    });

    // Test 9: Context-Aware Modifications
    if (!content.includes('##### Context-Aware Modifications')) {
      errors.push('Missing: Context-Aware Modifications subsection');
    }

    const contextAwareChecks = [
      'apex> Make the authentication more secure',
      '🔍 Intent: task (context-dependent)',
      '🧠 Context Analysis: Previous authentication task found',
      '🔍 Found previous work: JWT Authentication System',
      '🛡️ Security Enhancement Options:'
    ];

    contextAwareChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing context-aware modification element: ${check}`);
      }
    });

    // Test 10: Natural Language Command Patterns
    if (!content.includes('#### Natural Language Command Patterns')) {
      errors.push('Missing: Natural Language Command Patterns subsection');
    }

    const patternChecks = [
      '##### Imperative Commands',
      '##### Descriptive Requests',
      '##### Problem-Oriented Input',
      'apex> Create a new component called UserProfile',
      'apex> I need a way for users to reset their passwords',
      'apex> The app crashes when users try to checkout'
    ];

    patternChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing command pattern element: ${check}`);
      }
    });

    // Test 11: Visual formatting consistency
    const visualChecks = [
      '┌─', '└─', '├─', '│', // Box drawing
      '🔍', '📊', '🤖', '⚡', '💡', '🧠', // Emojis
    ];

    visualChecks.forEach(check => {
      if (!content.includes(check)) {
        errors.push(`Missing visual formatting element: ${check}`);
      }
    });

    // Test 12: Confidence score validation
    const confidenceMatches = content.match(/📊 Confidence: (\d+)%/g);
    if (!confidenceMatches || confidenceMatches.length < 10) {
      errors.push('Insufficient confidence score examples (need at least 10)');
    } else {
      confidenceMatches.forEach(match => {
        const score = parseInt(match.match(/\d+/)![0]);
        if (score < 40 || score > 100) {
          errors.push(`Invalid confidence score: ${score}% (must be 40-100%)`);
        }
      });
    }

    // Test 13: Prompt format consistency
    const promptMatches = content.match(/apex> [^\n]+/g);
    if (!promptMatches || promptMatches.length < 15) {
      errors.push('Insufficient prompt examples (need at least 15)');
    }

    // Test 14: Section content length
    const section6Match = content.match(/### 6\. Natural Language Interface([\s\S]*?)(?=### \d+\.|$)/);
    if (!section6Match || section6Match[1].length < 8000) {
      errors.push('Natural Language Interface section content is too short (needs to be substantial)');
    }

    const success = errors.length === 0;
    const summary = success
      ? 'All natural language interface documentation requirements met'
      : `Documentation validation failed with ${errors.length} errors`;

    return { success, errors, summary };

  } catch (error) {
    return {
      success: false,
      errors: [`Failed to read documentation file: ${error}`],
      summary: 'Documentation file could not be validated'
    };
  }
}

// Export for potential use in other test files
export { validateNaturalLanguageDocumentation };

// Run validation if this file is executed directly
if (require.main === module) {
  const result = validateNaturalLanguageDocumentation();

  console.log('='.repeat(60));
  console.log('NATURAL LANGUAGE INTERFACE DOCUMENTATION VALIDATION');
  console.log('='.repeat(60));
  console.log(`Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Summary: ${result.summary}`);

  if (result.errors.length > 0) {
    console.log('\nErrors found:');
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  console.log('='.repeat(60));
  process.exit(result.success ? 0 : 1);
}