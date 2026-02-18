/**
 * DOM structure simulation utilities for browser testing
 *
 * This module provides functions to generate HTML strings representing
 * common DOM structures for testing purposes.
 */

import { FormConfig, FormField, NavLink } from './mock-page';

/**
 * Table configuration interface
 */
export interface TableConfig {
  /** Table headers */
  headers: string[];
  /** Table rows (array of cell values) */
  rows: string[][];
  /** Table caption */
  caption?: string;
  /** Table CSS classes */
  className?: string;
  /** Table id */
  id?: string;
}

/**
 * Modal configuration interface
 */
export interface ModalConfig {
  /** Modal title */
  title: string;
  /** Modal content */
  content: string;
  /** Show close button */
  showCloseButton?: boolean;
  /** Modal id */
  id?: string;
  /** CSS classes */
  className?: string;
}

/**
 * Card configuration interface
 */
export interface CardConfig {
  /** Card title */
  title: string;
  /** Card content */
  content: string;
  /** Card image URL */
  imageUrl?: string;
  /** Card link URL */
  linkUrl?: string;
  /** Card id */
  id?: string;
  /** CSS classes */
  className?: string;
}

/**
 * Builds HTML for a form with given configuration
 */
export function buildFormHtml(config: FormConfig): string {
  const formId = config.id || 'form';
  const action = config.action || '';
  const method = config.method || 'POST';

  let html = `<form id="${formId}" action="${action}" method="${method}">`;

  config.fields.forEach(field => {
    html += buildFormFieldHtml(field);
  });

  html += `<button type="submit" id="submit-btn">${config.submitLabel || 'Submit'}</button>`;
  html += '</form>';

  return html;
}

/**
 * Builds HTML for a single form field
 */
function buildFormFieldHtml(field: FormField): string {
  const fieldId = field.id || field.name;
  const required = field.required ? 'required' : '';
  const placeholder = field.placeholder ? `placeholder="${field.placeholder}"` : '';
  const value = field.value ? `value="${field.value}"` : '';

  let html = `<div class="field-group">`;
  html += `<label for="${fieldId}">${field.label}</label>`;

  switch (field.type) {
    case 'textarea':
      html += `<textarea id="${fieldId}" name="${field.name}" ${placeholder} ${required}>${field.value || ''}</textarea>`;
      break;
    case 'select':
      html += `<select id="${fieldId}" name="${field.name}" ${required}>`;
      if (field.options) {
        field.options.forEach(option => {
          const selected = field.value === option ? 'selected' : '';
          html += `<option value="${option}" ${selected}>${option}</option>`;
        });
      }
      html += '</select>';
      break;
    case 'checkbox':
      const checked = field.value === 'true' || field.value === 'on' ? 'checked' : '';
      html += `<input type="checkbox" id="${fieldId}" name="${field.name}" ${checked} ${required}>`;
      break;
    case 'radio':
      if (field.options) {
        field.options.forEach((option, index) => {
          const optionId = `${fieldId}-${index}`;
          const checked = field.value === option ? 'checked' : '';
          html += `<input type="radio" id="${optionId}" name="${field.name}" value="${option}" ${checked} ${required}>`;
          html += `<label for="${optionId}">${option}</label>`;
        });
      }
      break;
    default:
      html += `<input type="${field.type}" id="${fieldId}" name="${field.name}" ${value} ${placeholder} ${required}>`;
      break;
  }

  html += '</div>';
  return html;
}

/**
 * Builds HTML for a table with given configuration
 */
export function buildTableHtml(config: TableConfig): string {
  const tableId = config.id || 'table';
  const className = config.className || '';

  let html = `<table id="${tableId}" class="${className}">`;

  if (config.caption) {
    html += `<caption>${config.caption}</caption>`;
  }

  // Headers
  if (config.headers.length > 0) {
    html += '<thead><tr>';
    config.headers.forEach(header => {
      html += `<th>${header}</th>`;
    });
    html += '</tr></thead>';
  }

  // Body rows
  if (config.rows.length > 0) {
    html += '<tbody>';
    config.rows.forEach(row => {
      html += '<tr>';
      row.forEach(cell => {
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody>';
  }

  html += '</table>';
  return html;
}

/**
 * Builds HTML for navigation links
 */
export function buildNavigationHtml(links: NavLink[]): string {
  let html = '<nav id="navigation">';
  html += '<ul>';

  links.forEach((link, index) => {
    const target = link.target ? `target="${link.target}"` : '';
    const title = link.title ? `title="${link.title}"` : '';
    const className = link.className ? `class="${link.className}"` : '';

    html += '<li>';
    html += `<a href="${link.href}" ${target} ${title} ${className}>${link.text}</a>`;
    html += '</li>';
  });

  html += '</ul>';
  html += '</nav>';
  return html;
}

/**
 * Builds HTML for a list (ordered or unordered)
 */
export function buildListHtml(items: string[], ordered = false): string {
  const tag = ordered ? 'ol' : 'ul';
  const id = ordered ? 'ordered-list' : 'unordered-list';

  let html = `<${tag} id="${id}">`;
  items.forEach(item => {
    html += `<li>${item}</li>`;
  });
  html += `</${tag}>`;

  return html;
}

/**
 * Builds HTML for a modal dialog
 */
export function buildModalHtml(config: ModalConfig): string {
  const modalId = config.id || 'modal';
  const className = config.className || 'modal';

  let html = `<div id="${modalId}" class="${className}">`;
  html += '<div class="modal-content">';

  if (config.showCloseButton !== false) {
    html += '<button class="modal-close" aria-label="Close">&times;</button>';
  }

  html += `<h2 class="modal-title">${config.title}</h2>`;
  html += `<div class="modal-body">${config.content}</div>`;

  html += '</div>';
  html += '</div>';

  return html;
}

/**
 * Builds HTML for a grid of cards
 */
export function buildCardGridHtml(cards: CardConfig[]): string {
  let html = '<div id="card-grid" class="card-grid">';

  cards.forEach((card, index) => {
    const cardId = card.id || `card-${index}`;
    const className = card.className || 'card';

    html += `<div id="${cardId}" class="${className}">`;

    if (card.imageUrl) {
      html += `<img src="${card.imageUrl}" alt="${card.title}" class="card-image">`;
    }

    html += '<div class="card-content">';
    html += `<h3 class="card-title">${card.title}</h3>`;
    html += `<p class="card-text">${card.content}</p>`;

    if (card.linkUrl) {
      html += `<a href="${card.linkUrl}" class="card-link">Read More</a>`;
    }

    html += '</div>';
    html += '</div>';
  });

  html += '</div>';
  return html;
}

/**
 * Builds HTML for a basic page layout
 */
export function buildBasicPageHtml(options: {
  title?: string;
  body?: string;
  cssClasses?: string[];
  scripts?: string[];
  stylesheets?: string[];
} = {}): string {
  const title = options.title || 'Test Page';
  const body = options.body || '<h1>Test Page</h1>';
  const bodyClasses = options.cssClasses ? ` class="${options.cssClasses.join(' ')}"` : '';

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>`;

  // Add stylesheets
  if (options.stylesheets) {
    options.stylesheets.forEach(stylesheet => {
      html += `\n    <link rel="stylesheet" href="${stylesheet}">`;
    });
  }

  html += `
</head>
<body${bodyClasses}>
    ${body}`;

  // Add scripts
  if (options.scripts) {
    options.scripts.forEach(script => {
      html += `\n    <script src="${script}"></script>`;
    });
  }

  html += `
</body>
</html>`;

  return html;
}

/**
 * Builds HTML for a loading spinner
 */
export function buildLoadingSpinnerHtml(options: {
  id?: string;
  className?: string;
  text?: string;
} = {}): string {
  const id = options.id || 'loading-spinner';
  const className = options.className || 'loading-spinner';
  const text = options.text || 'Loading...';

  return `
    <div id="${id}" class="${className}">
      <div class="spinner"></div>
      <span class="loading-text">${text}</span>
    </div>
  `;
}

/**
 * Builds HTML for error display
 */
export function buildErrorHtml(options: {
  message: string;
  id?: string;
  className?: string;
  showRetry?: boolean;
} = { message: 'An error occurred' }): string {
  const id = options.id || 'error-display';
  const className = options.className || 'error-display';

  let html = `<div id="${id}" class="${className}">`;
  html += `<p class="error-message">${options.message}</p>`;

  if (options.showRetry) {
    html += '<button id="retry-btn" class="retry-button">Retry</button>';
  }

  html += '</div>';
  return html;
}