/**
 * @fileoverview DOM Element Test Fixtures
 *
 * This file provides standardized test fixtures for DOM element interaction testing.
 * It includes common element configurations, test scenarios, and reusable patterns
 * for comprehensive element testing across the APEX browser integration suite.
 */

import { FormField } from '../utils/element-interaction-helpers.js';

// ============================================================================
// Basic Element Fixtures
// ============================================================================

/**
 * Standard button configurations for testing
 */
export const BUTTON_FIXTURES = {
  primary: {
    tag: 'button',
    className: 'btn btn-primary',
    attributes: {
      'type': 'button',
      'data-test': 'primary-button'
    },
    styles: {
      backgroundColor: '#007bff',
      color: 'white',
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '0.25rem',
      cursor: 'pointer'
    },
    text: 'Primary Button'
  },

  secondary: {
    tag: 'button',
    className: 'btn btn-secondary',
    attributes: {
      'type': 'button',
      'data-test': 'secondary-button'
    },
    styles: {
      backgroundColor: '#6c757d',
      color: 'white',
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '0.25rem',
      cursor: 'pointer'
    },
    text: 'Secondary Button'
  },

  disabled: {
    tag: 'button',
    className: 'btn btn-disabled',
    attributes: {
      'type': 'button',
      'disabled': 'true',
      'data-test': 'disabled-button'
    },
    styles: {
      backgroundColor: '#e9ecef',
      color: '#6c757d',
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '0.25rem',
      cursor: 'not-allowed',
      opacity: '0.6'
    },
    text: 'Disabled Button'
  },

  submit: {
    tag: 'button',
    className: 'btn btn-submit',
    attributes: {
      'type': 'submit',
      'data-test': 'submit-button'
    },
    styles: {
      backgroundColor: '#28a745',
      color: 'white',
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '0.25rem',
      cursor: 'pointer'
    },
    text: 'Submit'
  }
};

/**
 * Standard input configurations for testing
 */
export const INPUT_FIXTURES = {
  text: {
    tag: 'input',
    className: 'form-control',
    attributes: {
      'type': 'text',
      'placeholder': 'Enter text...',
      'data-test': 'text-input'
    },
    styles: {
      padding: '0.5rem',
      border: '1px solid #ced4da',
      borderRadius: '0.25rem',
      fontSize: '1rem',
      width: '100%'
    }
  },

  email: {
    tag: 'input',
    className: 'form-control',
    attributes: {
      'type': 'email',
      'placeholder': 'Enter email...',
      'data-test': 'email-input'
    },
    styles: {
      padding: '0.5rem',
      border: '1px solid #ced4da',
      borderRadius: '0.25rem',
      fontSize: '1rem',
      width: '100%'
    }
  },

  number: {
    tag: 'input',
    className: 'form-control',
    attributes: {
      'type': 'number',
      'placeholder': 'Enter number...',
      'min': '0',
      'max': '100',
      'data-test': 'number-input'
    },
    styles: {
      padding: '0.5rem',
      border: '1px solid #ced4da',
      borderRadius: '0.25rem',
      fontSize: '1rem',
      width: '100%'
    }
  },

  checkbox: {
    tag: 'input',
    className: 'form-check-input',
    attributes: {
      'type': 'checkbox',
      'data-test': 'checkbox-input'
    },
    styles: {
      marginRight: '0.5rem'
    }
  }
};

/**
 * Standard form configurations for testing
 */
export const FORM_FIXTURES = {
  simpleForm: {
    id: 'test-form',
    fields: [
      {
        selector: 'name',
        type: 'text' as const,
        value: 'Test User',
        label: 'Name',
        required: true
      },
      {
        selector: 'email',
        type: 'email' as const,
        value: 'test@example.com',
        label: 'Email',
        required: true
      }
    ] as FormField[],
    submitButton: true,
    resetButton: false
  },

  contactForm: {
    id: 'contact-form',
    fields: [
      {
        selector: 'name',
        type: 'text' as const,
        value: 'Test Contact',
        label: 'Your Name',
        required: true
      },
      {
        selector: 'subject',
        type: 'text' as const,
        value: 'Test Subject',
        label: 'Subject',
        required: true
      },
      {
        selector: 'message',
        type: 'textarea' as const,
        value: 'Test message content here.',
        label: 'Message',
        required: true
      }
    ] as FormField[],
    submitButton: true,
    resetButton: true
  }
};

// ============================================================================
// Complex Element Structures
// ============================================================================

/**
 * Navigation menu fixture
 */
export const NAVIGATION_FIXTURE = {
  tag: 'nav',
  className: 'navbar',
  attributes: {
    'role': 'navigation',
    'data-test': 'main-navigation'
  },
  styles: {
    backgroundColor: '#343a40',
    padding: '1rem',
    marginBottom: '2rem'
  },
  html: `
    <ul class="nav-list" style="list-style: none; margin: 0; padding: 0; display: flex; gap: 1rem;">
      <li><a href="#home" style="color: white; text-decoration: none; padding: 0.5rem;">Home</a></li>
      <li><a href="#about" style="color: white; text-decoration: none; padding: 0.5rem;">About</a></li>
      <li><a href="#services" style="color: white; text-decoration: none; padding: 0.5rem;">Services</a></li>
      <li><a href="#contact" style="color: white; text-decoration: none; padding: 0.5rem;">Contact</a></li>
    </ul>
  `
};

/**
 * Data table fixture
 */
export const TABLE_FIXTURE = {
  tag: 'table',
  className: 'data-table',
  attributes: {
    'data-test': 'data-table'
  },
  styles: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '1rem'
  },
  html: `
    <thead>
      <tr style="background-color: #f8f9fa;">
        <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: left;">Name</th>
        <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: left;">Email</th>
        <th style="padding: 0.75rem; border: 1px solid #dee2e6; text-align: left;">Actions</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 0.75rem; border: 1px solid #dee2e6;">Test User 1</td>
        <td style="padding: 0.75rem; border: 1px solid #dee2e6;">user1@test.com</td>
        <td style="padding: 0.75rem; border: 1px solid #dee2e6;">
          <button class="btn-edit" data-id="1" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem;">Edit</button>
          <button class="btn-delete" data-id="1" style="padding: 0.25rem 0.5rem;">Delete</button>
        </td>
      </tr>
      <tr>
        <td style="padding: 0.75rem; border: 1px solid #dee2e6;">Test User 2</td>
        <td style="padding: 0.75rem; border: 1px solid #dee2e6;">user2@test.com</td>
        <td style="padding: 0.75rem; border: 1px solid #dee2e6;">
          <button class="btn-edit" data-id="2" style="margin-right: 0.5rem; padding: 0.25rem 0.5rem;">Edit</button>
          <button class="btn-delete" data-id="2" style="padding: 0.25rem 0.5rem;">Delete</button>
        </td>
      </tr>
    </tbody>
  `
};

// ============================================================================
// Interactive Element Collections
// ============================================================================

/**
 * Generates button collection template
 */
export function createButtonCollectionTemplate(count: number = 5) {
  return {
    tag: 'button',
    baseId: 'collection-btn',
    className: 'collection-button',
    count,
    attributes: {
      'type': 'button',
      'data-collection': 'buttons'
    },
    styles: {
      backgroundColor: '#17a2b8',
      color: 'white',
      padding: '0.5rem 1rem',
      border: 'none',
      borderRadius: '0.25rem',
      margin: '0.25rem',
      cursor: 'pointer'
    }
  };
}

/**
 * Generates input collection template
 */
export function createInputCollectionTemplate(count: number = 3) {
  return {
    tag: 'input',
    baseId: 'collection-input',
    className: 'collection-input',
    count,
    attributes: {
      'type': 'text',
      'data-collection': 'inputs'
    },
    styles: {
      padding: '0.5rem',
      border: '1px solid #ced4da',
      borderRadius: '0.25rem',
      margin: '0.25rem',
      width: 'calc(33.333% - 0.5rem)'
    }
  };
}

// ============================================================================
// Test Scenario Configurations
// ============================================================================

/**
 * Standard test scenarios for element interactions
 */
export const TEST_SCENARIOS = {
  formValidation: {
    name: 'Form Validation Test',
    description: 'Tests form field validation and error handling',
    elements: ['form', 'input', 'button'],
    interactions: ['fill', 'click', 'validate']
  },

  buttonInteractions: {
    name: 'Button Interaction Test',
    description: 'Tests various button states and click behaviors',
    elements: ['button'],
    interactions: ['click', 'hover', 'disabled-state']
  },

  dynamicContent: {
    name: 'Dynamic Content Test',
    description: 'Tests dynamic element creation and modification',
    elements: ['div', 'span', 'button'],
    interactions: ['create', 'modify', 'remove']
  }
};

// ============================================================================
// Wait Condition Templates
// ============================================================================

/**
 * Common wait condition sets for different testing scenarios
 */
export const WAIT_CONDITIONS = {
  standardVisibility: [
    { condition: 'visible' as const, timeout: 5000 },
    { condition: 'enabled' as const, timeout: 5000 }
  ],

  formReady: [
    { condition: 'visible' as const, timeout: 10000 },
    { condition: 'stable' as const, timeout: 10000 }
  ],

  dynamicContent: [
    { condition: 'visible' as const, timeout: 15000 },
    { condition: 'stable' as const, timeout: 10000 }
  ]
};

// ============================================================================
// Assertion Templates
// ============================================================================

/**
 * Common assertion patterns for element testing
 */
export const ASSERTION_TEMPLATES = {
  buttonState: (selector: string, expectedText: string) => [
    {
      selector,
      type: 'text' as const,
      expected: expectedText
    },
    {
      selector,
      type: 'state' as const,
      property: 'visible',
      expected: true
    }
  ],

  inputValidation: (selector: string, expectedValue: string) => [
    {
      selector,
      type: 'attribute' as const,
      attribute: 'value',
      expected: expectedValue
    },
    {
      selector,
      type: 'state' as const,
      property: 'visible',
      expected: true
    }
  ]
};

// Export all fixtures and utilities
export default {
  BUTTON_FIXTURES,
  INPUT_FIXTURES,
  FORM_FIXTURES,
  NAVIGATION_FIXTURE,
  TABLE_FIXTURE,
  TEST_SCENARIOS,
  WAIT_CONDITIONS,
  ASSERTION_TEMPLATES,
  createButtonCollectionTemplate,
  createInputCollectionTemplate
};