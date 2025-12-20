import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Test suite for Natural Language Interface Documentation
 * This test validates that section 6 of v030-features.md contains comprehensive
 * natural language input documentation with intent detection examples,
 * clarification flows, and contextual suggestions as specified.
 */
describe('Natural Language Interface Documentation Tests', () => {
  const documentationPath = join(process.cwd(), 'docs', 'features', 'v030-features.md');
  let documentationContent: string;

  beforeEach(() => {
    // Read the documentation file
    documentationContent = readFileSync(documentationPath, 'utf-8');
  });

  describe('Section 6: Natural Language Interface Structure', () => {
    it('should contain the Natural Language Interface section', () => {
      expect(documentationContent).toContain('### 6. Natural Language Interface');
    });

    it('should have Smart Intent Detection subsection', () => {
      expect(documentationContent).toContain('#### Smart Intent Detection');
    });

    it('should have Conversational Context subsection', () => {
      expect(documentationContent).toContain('#### Conversational Context');
    });

    it('should have Intent Detection Examples subsection', () => {
      expect(documentationContent).toContain('#### Intent Detection Examples');
    });

    it('should have Advanced Intent Recognition subsection', () => {
      expect(documentationContent).toContain('#### Advanced Intent Recognition');
    });

    it('should have Natural Language Command Patterns subsection', () => {
      expect(documentationContent).toContain('#### Natural Language Command Patterns');
    });
  });

  describe('Intent Detection Examples - Commands vs Tasks vs Questions', () => {
    it('should include Commands vs Tasks vs Questions section', () => {
      expect(documentationContent).toContain('##### Commands vs Tasks vs Questions');
    });

    it('should show command examples with system function execution', () => {
      expect(documentationContent).toContain('**Commands** are recognized by explicit prefixes and trigger system functions:');
      expect(documentationContent).toContain('apex> /help');
      expect(documentationContent).toContain('apex> /status');
      expect(documentationContent).toContain('apex> /agents');
      expect(documentationContent).toContain('🔍 Intent: command');
      expect(documentationContent).toContain('📊 Confidence: 100%');
      expect(documentationContent).toContain('⚡ Action: Execute system function immediately');
    });

    it('should show task examples with agent workflow execution', () => {
      expect(documentationContent).toContain('**Tasks** are natural language requests that require agent execution:');
      expect(documentationContent).toContain('apex> Add user authentication to my React app');
      expect(documentationContent).toContain('apex> Refactor this component to use hooks');
      expect(documentationContent).toContain('apex> Create unit tests for the login functionality');
      expect(documentationContent).toContain('🔍 Intent: task');
      expect(documentationContent).toContain('🤖 Agent Assignment: architect → planner → developer');
      expect(documentationContent).toContain('⚡ Action: Create task execution workflow');
    });

    it('should show question examples with direct analysis responses', () => {
      expect(documentationContent).toContain('**Questions** seek information without requiring code changes:');
      expect(documentationContent).toContain('apex> What does this function do?');
      expect(documentationContent).toContain('apex> How do I configure JWT tokens?');
      expect(documentationContent).toContain('apex> What\'s the difference between useState and useReducer?');
      expect(documentationContent).toContain('🔍 Intent: question');
      expect(documentationContent).toContain('🤖 Agent Assignment: None (direct analysis)');
      expect(documentationContent).toContain('⚡ Action: Code explanation response');
    });

    it('should include confidence scores for intent detection', () => {
      expect(documentationContent).toContain('📊 Confidence: 95%');
      expect(documentationContent).toContain('📊 Confidence: 88%');
      expect(documentationContent).toContain('📊 Confidence: 92%');
      expect(documentationContent).toContain('📊 Confidence: 91%');
      expect(documentationContent).toContain('📊 Confidence: 89%');
      expect(documentationContent).toContain('📊 Confidence: 94%');
    });
  });

  describe('Ambiguous Input Handling', () => {
    it('should include Ambiguous Input Handling section', () => {
      expect(documentationContent).toContain('##### Ambiguous Input Handling');
    });

    it('should demonstrate clarification flow for unclear input', () => {
      expect(documentationContent).toContain('When intent is unclear, APEX engages in clarification flows:');
      expect(documentationContent).toContain('apex> Fix the bug');
      expect(documentationContent).toContain('🔍 Intent: task (uncertain)');
      expect(documentationContent).toContain('📊 Confidence: 45%');
      expect(documentationContent).toContain('⚠️ Clarification needed');
    });

    it('should show comprehensive clarification dialog with examples', () => {
      expect(documentationContent).toContain('┌─ Clarification Required');
      expect(documentationContent).toContain('🔍 What bug would you like me to fix?');
      expect(documentationContent).toContain('To provide the best assistance, could you specify:');
      expect(documentationContent).toContain('• Which component or file has the issue?');
      expect(documentationContent).toContain('• What behavior are you seeing vs what you expected?');
      expect(documentationContent).toContain('• Any error messages or console logs?');
      expect(documentationContent).toContain('Examples:');
      expect(documentationContent).toContain('• "Fix the login form validation error"');
      expect(documentationContent).toContain('• "The shopping cart isn\'t updating quantities correctly"');
      expect(documentationContent).toContain('• "Handle the 404 error in the user profile page"');
    });

    it('should show successful clarification resolution', () => {
      expect(documentationContent).toContain('apex> Fix the login form validation error');
      expect(documentationContent).toContain('🔍 Intent: task (clarified)');
      expect(documentationContent).toContain('📊 Confidence: 94%');
      expect(documentationContent).toContain('🤖 Agent Assignment: developer');
      expect(documentationContent).toContain('⚡ Action: Bug fix workflow initiated');
    });
  });

  describe('Contextual Suggestions', () => {
    it('should include Contextual Suggestions section', () => {
      expect(documentationContent).toContain('##### Contextual Suggestions');
    });

    it('should demonstrate project context analysis', () => {
      expect(documentationContent).toContain('APEX provides intelligent suggestions based on project context:');
      expect(documentationContent).toContain('apex> add auth');
      expect(documentationContent).toContain('🔍 Analyzing project context...');
      expect(documentationContent).toContain('📁 Detected: React + TypeScript project');
      expect(documentationContent).toContain('🔧 Dependencies: @auth0/auth0-react found');
    });

    it('should show categorized contextual suggestions', () => {
      expect(documentationContent).toContain('💡 Contextual Suggestions:');
      expect(documentationContent).toContain('┌─ Intent Suggestions');
      expect(documentationContent).toContain('Based on your project, you might want to:');
      expect(documentationContent).toContain('🔐 Authentication Features:');
      expect(documentationContent).toContain('→ "Add Auth0 login integration"');
      expect(documentationContent).toContain('→ "Create protected routes with authentication"');
      expect(documentationContent).toContain('→ "Add logout functionality to the navigation"');
      expect(documentationContent).toContain('🛡️ Authorization Features:');
      expect(documentationContent).toContain('→ "Add role-based access control"');
      expect(documentationContent).toContain('→ "Create admin dashboard with auth guards"');
      expect(documentationContent).toContain('🔧 Configuration:');
      expect(documentationContent).toContain('→ "Configure Auth0 environment variables"');
      expect(documentationContent).toContain('→ "Set up Auth0 callback URLs"');
    });

    it('should include interactive suggestion prompt', () => {
      expect(documentationContent).toContain('Type your selection or provide more specific details...');
    });
  });

  describe('Advanced Intent Recognition', () => {
    it('should include Multi-step Task Detection section', () => {
      expect(documentationContent).toContain('##### Multi-step Task Detection');
    });

    it('should demonstrate complex task breakdown', () => {
      expect(documentationContent).toContain('APEX recognizes complex, multi-step requests:');
      expect(documentationContent).toContain('apex> Create a blog system with posts, comments, and user profiles');
      expect(documentationContent).toContain('🔍 Intent: complex_task');
      expect(documentationContent).toContain('📊 Confidence: 89%');
      expect(documentationContent).toContain('🏗️ Multi-step workflow detected');
    });

    it('should show detailed task breakdown with components', () => {
      expect(documentationContent).toContain('┌─ Task Breakdown');
      expect(documentationContent).toContain('📋 Detected Components:');
      expect(documentationContent).toContain('1️⃣ Blog Posts System');
      expect(documentationContent).toContain('• Post creation/editing interface');
      expect(documentationContent).toContain('• Post listing and pagination');
      expect(documentationContent).toContain('• Rich text editor integration');
      expect(documentationContent).toContain('2️⃣ Comments System');
      expect(documentationContent).toContain('• Comment threads and replies');
      expect(documentationContent).toContain('• Comment moderation features');
      expect(documentationContent).toContain('• Real-time comment updates');
      expect(documentationContent).toContain('3️⃣ User Profiles');
      expect(documentationContent).toContain('• User profile pages');
      expect(documentationContent).toContain('• Profile editing capabilities');
      expect(documentationContent).toContain('• User avatar management');
    });

    it('should include execution planning and estimation', () => {
      expect(documentationContent).toContain('🤖 Suggested Execution Order:');
      expect(documentationContent).toContain('architect → planner → developer → tester → reviewer');
      expect(documentationContent).toContain('⏱️ Estimated Duration: 2-3 hours');
      expect(documentationContent).toContain('Proceed with this breakdown? (y/n)');
    });

    it('should include Context-Aware Modifications section', () => {
      expect(documentationContent).toContain('##### Context-Aware Modifications');
    });

    it('should demonstrate context-dependent enhancement', () => {
      expect(documentationContent).toContain('APEX understands references to previous work:');
      expect(documentationContent).toContain('apex> Make the authentication more secure');
      expect(documentationContent).toContain('🔍 Intent: task (context-dependent)');
      expect(documentationContent).toContain('📊 Confidence: 82%');
      expect(documentationContent).toContain('🧠 Context Analysis: Previous authentication task found');
    });

    it('should show context-aware enhancement options', () => {
      expect(documentationContent).toContain('┌─ Context-Aware Enhancement');
      expect(documentationContent).toContain('🔍 Found previous work: JWT Authentication System');
      expect(documentationContent).toContain('📅 Implemented: 2 hours ago');
      expect(documentationContent).toContain('🛡️ Security Enhancement Options:');
      expect(documentationContent).toContain('• Add refresh token rotation');
      expect(documentationContent).toContain('• Implement rate limiting on auth endpoints');
      expect(documentationContent).toContain('• Add two-factor authentication (2FA)');
      expect(documentationContent).toContain('• Enhance password strength requirements');
      expect(documentationContent).toContain('• Add session timeout management');
      expect(documentationContent).toContain('• Implement suspicious login detection');
      expect(documentationContent).toContain('Would you like me to implement all security enhancements');
      expect(documentationContent).toContain('or focus on specific areas?');
    });
  });

  describe('Natural Language Command Patterns', () => {
    it('should include command pattern sections', () => {
      expect(documentationContent).toContain('#### Natural Language Command Patterns');
      expect(documentationContent).toContain('##### Imperative Commands');
      expect(documentationContent).toContain('##### Descriptive Requests');
      expect(documentationContent).toContain('##### Problem-Oriented Input');
    });

    it('should show imperative command examples', () => {
      expect(documentationContent).toContain('apex> Create a new component called UserProfile');
      expect(documentationContent).toContain('apex> Delete the old authentication code');
      expect(documentationContent).toContain('apex> Refactor the shopping cart logic');
      expect(documentationContent).toContain('apex> Test the login functionality');
      expect(documentationContent).toContain('apex> Deploy the application to production');
    });

    it('should show descriptive request examples', () => {
      expect(documentationContent).toContain('apex> I need a way for users to reset their passwords');
      expect(documentationContent).toContain('apex> The search functionality should be faster');
      expect(documentationContent).toContain('apex> Users want to be able to save their favorite items');
      expect(documentationContent).toContain('apex> The mobile layout needs improvement');
    });

    it('should show problem-oriented input examples', () => {
      expect(documentationContent).toContain('apex> The app crashes when users try to checkout');
      expect(documentationContent).toContain('apex> Load times are too slow on the product page');
      expect(documentationContent).toContain('apex> Users can\'t find the logout button');
      expect(documentationContent).toContain('apex> The form validation isn\'t working correctly');
    });
  });

  describe('Visual Formatting and Consistency', () => {
    it('should use consistent box drawing characters for dialogs', () => {
      // Check for consistent use of box drawing characters
      expect(documentationContent).toContain('┌─');
      expect(documentationContent).toContain('└─');
      expect(documentationContent).toContain('├─');
      expect(documentationContent).toContain('│');
    });

    it('should use consistent emoji indicators', () => {
      const requiredEmojis = [
        '🔍', // Intent detection
        '📊', // Confidence scores
        '🤖', // Agent assignment
        '⚡', // Action indicators
        '⚠️', // Warnings
        '💡', // Suggestions
        '📁', // Project detection
        '🔧', // Dependencies
        '🏗️', // Multi-step workflow
        '📋', // Task breakdown
        '🧠', // Context analysis
        '📅', // Time indicators
        '🛡️', // Security features
        '🔐', // Authentication features
      ];

      requiredEmojis.forEach(emoji => {
        expect(documentationContent).toContain(emoji);
      });
    });

    it('should use consistent prompt format', () => {
      expect(documentationContent).toMatch(/apex> [^\n]+/g);
    });

    it('should maintain consistent indentation in examples', () => {
      // Check that dialog content is properly indented
      const dialogLines = documentationContent.match(/│[^│\n]*│/g);
      expect(dialogLines).toBeTruthy();
      expect(dialogLines!.length).toBeGreaterThan(10);
    });
  });

  describe('Content Completeness and Quality', () => {
    it('should have substantial content for the natural language section', () => {
      // Extract section 6 content
      const section6Match = documentationContent.match(/### 6\. Natural Language Interface([\s\S]*?)(?=### \d+\.|$)/);
      expect(section6Match).toBeTruthy();

      const section6Content = section6Match![1];
      expect(section6Content.length).toBeGreaterThan(8000); // Substantial content
    });

    it('should include all required subsections', () => {
      const requiredSubsections = [
        'Smart Intent Detection',
        'Conversational Context',
        'Intent Detection Examples',
        'Commands vs Tasks vs Questions',
        'Ambiguous Input Handling',
        'Contextual Suggestions',
        'Advanced Intent Recognition',
        'Multi-step Task Detection',
        'Context-Aware Modifications',
        'Natural Language Command Patterns',
        'Imperative Commands',
        'Descriptive Requests',
        'Problem-Oriented Input'
      ];

      requiredSubsections.forEach(subsection => {
        expect(documentationContent).toContain(subsection);
      });
    });

    it('should provide comprehensive usage examples', () => {
      // Should have multiple example interactions for each category
      const commandExamples = (documentationContent.match(/apex> \/\w+/g) || []).length;
      const taskExamples = (documentationContent.match(/apex> [A-Z][^\/\n]+/g) || []).length;

      expect(commandExamples).toBeGreaterThanOrEqual(3);
      expect(taskExamples).toBeGreaterThanOrEqual(15);
    });

    it('should include confidence scoring throughout examples', () => {
      const confidenceScores = documentationContent.match(/📊 Confidence: \d+%/g);
      expect(confidenceScores).toBeTruthy();
      expect(confidenceScores!.length).toBeGreaterThan(10);
    });

    it('should demonstrate various agent assignments', () => {
      expect(documentationContent).toContain('🤖 Agent Assignment: architect → planner → developer');
      expect(documentationContent).toContain('🤖 Agent Assignment: developer');
      expect(documentationContent).toContain('🤖 Agent Assignment: tester → developer');
      expect(documentationContent).toContain('🤖 Agent Assignment: None (direct analysis)');
    });
  });

  describe('Technical Accuracy', () => {
    it('should use realistic confidence scores', () => {
      const confidenceMatches = documentationContent.match(/📊 Confidence: (\d+)%/g);
      expect(confidenceMatches).toBeTruthy();

      confidenceMatches!.forEach(match => {
        const score = parseInt(match.match(/\d+/)![0]);
        expect(score).toBeGreaterThanOrEqual(40);
        expect(score).toBeLessThanOrEqual(100);
      });
    });

    it('should show appropriate action types for different intents', () => {
      expect(documentationContent).toContain('⚡ Action: Execute system function immediately');
      expect(documentationContent).toContain('⚡ Action: Create task execution workflow');
      expect(documentationContent).toContain('⚡ Action: Code refactoring workflow');
      expect(documentationContent).toContain('⚡ Action: Test generation workflow');
      expect(documentationContent).toContain('⚡ Action: Code explanation response');
      expect(documentationContent).toContain('⚡ Action: Documentation/guidance response');
      expect(documentationContent).toContain('⚡ Action: Conceptual explanation');
      expect(documentationContent).toContain('⚡ Action: Bug fix workflow initiated');
    });

    it('should include realistic project context detection', () => {
      expect(documentationContent).toContain('📁 Detected: React + TypeScript project');
      expect(documentationContent).toContain('🔧 Dependencies: @auth0/auth0-react found');
    });

    it('should show proper workflow progression', () => {
      expect(documentationContent).toContain('architect → planner → developer → tester → reviewer');
    });
  });
});