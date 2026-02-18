/**
 * @apexcli/browser - DOM Builders Test Suite
 *
 * Comprehensive tests for DOM structure simulation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  buildFormHtml,
  buildTableHtml,
  buildNavigationHtml,
  buildListHtml,
  buildModalHtml,
  buildCardGridHtml,
  buildCardHtml,
  buildCompletePage,
  buildLayoutHtml,
  buildBreadcrumbHtml,
  buildPaginationHtml,
  type TableConfig,
  type ModalConfig,
  type CardConfig,
  type FormConfig,
  type NavLink,
  type FormField
} from '../dom-builders.js';

describe('DOM Builders', () => {
  describe('buildFormHtml', () => {
    it('should build a basic form with default values', () => {
      const config: FormConfig = {
        fields: [
          { name: 'username', type: 'text', label: 'Username' }
        ]
      };

      const html = buildFormHtml(config);

      expect(html).toContain('<form action="" method="POST"');
      expect(html).toContain('type="text"');
      expect(html).toContain('name="username"');
      expect(html).toContain('<label for="username">Username</label>');
      expect(html).toContain('<button type="submit">Submit</button>');
    });

    it('should build a form with custom action and method', () => {
      const config: FormConfig = {
        action: '/api/login',
        method: 'GET',
        submitLabel: 'Sign In',
        className: 'login-form',
        fields: [
          { name: 'email', type: 'email', label: 'Email' }
        ]
      };

      const html = buildFormHtml(config);

      expect(html).toContain('action="/api/login"');
      expect(html).toContain('method="GET"');
      expect(html).toContain('class="login-form"');
      expect(html).toContain('<button type="submit">Sign In</button>');
    });

    it('should handle different field types correctly', () => {
      const config: FormConfig = {
        fields: [
          {
            name: 'message',
            type: 'textarea',
            label: 'Message',
            placeholder: 'Enter your message',
            value: 'Default text',
            required: true
          },
          {
            name: 'country',
            type: 'select',
            label: 'Country',
            options: ['USA', 'Canada', 'UK'],
            value: 'USA'
          },
          {
            name: 'newsletter',
            type: 'checkbox',
            label: 'Subscribe to Newsletter',
            value: 'true'
          },
          {
            name: 'gender',
            type: 'radio',
            label: 'Gender',
            options: ['Male', 'Female', 'Other'],
            value: 'Female'
          }
        ]
      };

      const html = buildFormHtml(config);

      // Textarea
      expect(html).toContain('<textarea id="message"');
      expect(html).toContain('placeholder="Enter your message"');
      expect(html).toContain('required');
      expect(html).toContain('>Default text</textarea>');

      // Select
      expect(html).toContain('<select id="country"');
      expect(html).toContain('<option value="USA" selected>USA</option>');
      expect(html).toContain('<option value="Canada">Canada</option>');

      // Checkbox
      expect(html).toContain('type="checkbox"');
      expect(html).toContain('checked');

      // Radio
      expect(html).toContain('type="radio"');
      expect(html).toContain('value="Female" checked');
    });

    it('should handle field properties like required, placeholder, and className', () => {
      const config: FormConfig = {
        fields: [
          {
            name: 'password',
            type: 'password',
            label: 'Password',
            required: true,
            placeholder: 'Enter password',
            className: 'password-field'
          }
        ]
      };

      const html = buildFormHtml(config);

      expect(html).toContain('required');
      expect(html).toContain('placeholder="Enter password"');
      expect(html).toContain('class="password-field"');
    });
  });

  describe('buildTableHtml', () => {
    it('should build a basic table', () => {
      const config: TableConfig = {
        headers: ['Name', 'Age', 'City'],
        rows: [
          ['John', '25', 'New York'],
          ['Jane', '30', 'Los Angeles'],
          ['Bob', '35', 'Chicago']
        ]
      };

      const html = buildTableHtml(config);

      expect(html).toContain('<table');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('<th>Age</th>');
      expect(html).toContain('<th>City</th>');
      expect(html).toContain('<td>John</td>');
      expect(html).toContain('<td>30</td>');
      expect(html).toContain('<td>Chicago</td>');
    });

    it('should handle table configuration options', () => {
      const config: TableConfig = {
        headers: ['Product', 'Price'],
        rows: [['Widget', '$19.99']],
        caption: 'Product Pricing',
        className: 'pricing-table',
        striped: true
      };

      const html = buildTableHtml(config);

      expect(html).toContain('<caption>Product Pricing</caption>');
      expect(html).toContain('class="pricing-table"');
      expect(html).toContain('striped');
    });

    it('should handle empty rows', () => {
      const config: TableConfig = {
        headers: ['Column1', 'Column2'],
        rows: []
      };

      const html = buildTableHtml(config);

      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th>Column1</th>');
      expect(html).not.toContain('<td>');
    });
  });

  describe('buildNavigationHtml', () => {
    it('should build a basic navigation menu', () => {
      const links: NavLink[] = [
        { href: '/', text: 'Home' },
        { href: '/about', text: 'About' },
        { href: '/contact', text: 'Contact' }
      ];

      const html = buildNavigationHtml(links);

      expect(html).toContain('<nav>');
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>');
      expect(html).toContain('href="/"');
      expect(html).toContain('>Home</a>');
      expect(html).toContain('href="/about"');
      expect(html).toContain('>Contact</a>');
    });

    it('should handle link properties like target and className', () => {
      const links: NavLink[] = [
        { href: '/external', text: 'External Link', target: '_blank' },
        { href: '/special', text: 'Special', className: 'special-link' }
      ];

      const html = buildNavigationHtml(links);

      expect(html).toContain('target="_blank"');
      expect(html).toContain('class="special-link"');
    });

    it('should handle empty links array', () => {
      const html = buildNavigationHtml([]);

      expect(html).toContain('<nav>');
      expect(html).toContain('<ul>');
      expect(html).not.toContain('<li>');
    });
  });

  describe('buildListHtml', () => {
    it('should build an unordered list by default', () => {
      const items = ['Apple', 'Banana', 'Orange'];
      const html = buildListHtml(items);

      expect(html).toContain('<ul>');
      expect(html).toContain('</ul>');
      expect(html).toContain('<li>Apple</li>');
      expect(html).toContain('<li>Banana</li>');
      expect(html).toContain('<li>Orange</li>');
    });

    it('should build an ordered list when specified', () => {
      const items = ['First', 'Second', 'Third'];
      const html = buildListHtml(items, true);

      expect(html).toContain('<ol>');
      expect(html).toContain('</ol>');
      expect(html).toContain('<li>First</li>');
    });

    it('should handle empty items array', () => {
      const html = buildListHtml([]);

      expect(html).toContain('<ul>');
      expect(html).toContain('</ul>');
      expect(html).not.toContain('<li>');
    });

    it('should handle HTML entities in list items', () => {
      const items = ['<script>alert("test")</script>', 'Normal & safe text'];
      const html = buildListHtml(items);

      expect(html).toContain('<li><script>alert("test")</script></li>');
      expect(html).toContain('<li>Normal & safe text</li>');
    });
  });

  describe('buildModalHtml', () => {
    it('should build a basic modal with default settings', () => {
      const config: ModalConfig = {
        title: 'Test Modal',
        content: 'This is modal content'
      };

      const html = buildModalHtml(config);

      expect(html).toContain('<div class="modal-overlay">');
      expect(html).toContain('<div id="modal" class="modal"');
      expect(html).toContain('<button class="modal-close"');
      expect(html).toContain('<h2>Test Modal</h2>');
      expect(html).toContain('This is modal content');
    });

    it('should handle modal configuration options', () => {
      const config: ModalConfig = {
        id: 'custom-modal',
        title: 'Custom Modal',
        content: 'Custom content',
        hasCloseButton: false,
        hasOverlay: false,
        className: 'custom-modal-class'
      };

      const html = buildModalHtml(config);

      expect(html).toContain('id="custom-modal"');
      expect(html).toContain('class="custom-modal-class"');
      expect(html).not.toContain('<div class="modal-overlay">');
      expect(html).not.toContain('<button class="modal-close"');
    });

    it('should include close button by default', () => {
      const config: ModalConfig = {
        title: 'Modal',
        content: 'Content'
      };

      const html = buildModalHtml(config);

      expect(html).toContain('button class="modal-close"');
      expect(html).toContain('aria-label="Close"');
      expect(html).toContain('&times;');
    });
  });

  describe('buildCardHtml', () => {
    it('should build a basic card', () => {
      const config: CardConfig = {
        title: 'Test Card',
        content: 'This is card content'
      };

      const html = buildCardHtml(config);

      expect(html).toContain('<div class="card"');
      expect(html).toContain('<h3 class="card-title">Test Card</h3>');
      expect(html).toContain('<div class="card-body">This is card content</div>');
    });

    it('should handle card with image', () => {
      const config: CardConfig = {
        title: 'Card with Image',
        content: 'Content',
        imageUrl: '/images/test.jpg'
      };

      const html = buildCardHtml(config);

      expect(html).toContain('<img src="/images/test.jpg"');
      expect(html).toContain('alt="Card with Image"');
      expect(html).toContain('class="card-image"');
    });

    it('should handle card actions', () => {
      const config: CardConfig = {
        title: 'Card with Actions',
        content: 'Content',
        actions: [
          { text: 'View', href: '/view/123' },
          { text: 'Edit', href: '/edit/123', className: 'edit-button' },
          { text: 'Delete', className: 'danger' }
        ]
      };

      const html = buildCardHtml(config);

      expect(html).toContain('<div class="card-actions">');
      expect(html).toContain('<a href="/view/123">View</a>');
      expect(html).toContain('<a href="/edit/123" class="edit-button">Edit</a>');
      expect(html).toContain('<button class="danger">Delete</button>');
    });

    it('should handle custom className', () => {
      const config: CardConfig = {
        title: 'Custom Card',
        content: 'Content',
        className: 'special-card'
      };

      const html = buildCardHtml(config);

      expect(html).toContain('class="special-card"');
    });
  });

  describe('buildCardGridHtml', () => {
    it('should build a grid of cards', () => {
      const cards: CardConfig[] = [
        { title: 'Card 1', content: 'Content 1' },
        { title: 'Card 2', content: 'Content 2' },
        { title: 'Card 3', content: 'Content 3' }
      ];

      const html = buildCardGridHtml(cards);

      expect(html).toContain('<div class="card-grid">');
      expect(html).toContain('<h3 class="card-title">Card 1</h3>');
      expect(html).toContain('<h3 class="card-title">Card 2</h3>');
      expect(html).toContain('<h3 class="card-title">Card 3</h3>');
    });

    it('should handle empty cards array', () => {
      const html = buildCardGridHtml([]);

      expect(html).toContain('<div class="card-grid">');
      expect(html).not.toContain('<div class="card"');
    });
  });

  describe('buildCompletePage', () => {
    it('should build a complete HTML page with minimal options', () => {
      const html = buildCompletePage({
        body: '<h1>Hello World</h1>'
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<title>Test Page</title>');
      expect(html).toContain('<meta charset="UTF-8">');
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('<body>');
      expect(html).toContain('<h1>Hello World</h1>');
    });

    it('should handle all page options', () => {
      const html = buildCompletePage({
        title: 'Custom Page',
        body: '<main>Content</main>',
        styles: 'body { margin: 0; }',
        scripts: 'console.log("loaded");',
        meta: [
          { name: 'description', content: 'Test page' },
          { property: 'og:title', content: 'Custom Page' }
        ]
      });

      expect(html).toContain('<title>Custom Page</title>');
      expect(html).toContain('<style>body { margin: 0; }</style>');
      expect(html).toContain('<script>console.log("loaded");</script>');
      expect(html).toContain('<meta name="description" content="Test page">');
      expect(html).toContain('<meta property="og:title" content="Custom Page">');
      expect(html).toContain('<main>Content</main>');
    });

    it('should handle missing optional properties', () => {
      const html = buildCompletePage({
        body: '<p>Simple</p>',
        title: 'Simple Page'
      });

      expect(html).toContain('<title>Simple Page</title>');
      expect(html).toContain('<p>Simple</p>');
      expect(html).not.toContain('<style>');
      expect(html).not.toContain('<script>');
    });
  });

  describe('buildLayoutHtml', () => {
    it('should build a layout with all sections', () => {
      const html = buildLayoutHtml({
        header: '<h1>Site Header</h1>',
        main: '<p>Main content</p>',
        footer: '<p>Footer content</p>',
        sidebar: '<nav>Navigation</nav>'
      });

      expect(html).toContain('<div class="layout">');
      expect(html).toContain('<header class="layout-header">');
      expect(html).toContain('<h1>Site Header</h1>');
      expect(html).toContain('<aside class="layout-sidebar">');
      expect(html).toContain('<nav>Navigation</nav>');
      expect(html).toContain('<main class="layout-main">');
      expect(html).toContain('<p>Main content</p>');
      expect(html).toContain('<footer class="layout-footer">');
      expect(html).toContain('<p>Footer content</p>');
    });

    it('should handle minimal layout with only main content', () => {
      const html = buildLayoutHtml({
        main: '<p>Just main content</p>'
      });

      expect(html).toContain('<main class="layout-main">');
      expect(html).toContain('<p>Just main content</p>');
      expect(html).not.toContain('<header');
      expect(html).not.toContain('<footer');
      expect(html).not.toContain('<aside');
    });
  });

  describe('buildBreadcrumbHtml', () => {
    it('should build breadcrumb navigation', () => {
      const items = [
        { text: 'Home', href: '/' },
        { text: 'Products', href: '/products' },
        { text: 'Widgets' }
      ];

      const html = buildBreadcrumbHtml(items);

      expect(html).toContain('<nav aria-label="breadcrumb">');
      expect(html).toContain('<ol class="breadcrumb">');
      expect(html).toContain('<a href="/">Home</a>');
      expect(html).toContain('<a href="/products">Products</a>');
      expect(html).toContain('<span>Widgets</span>');
      expect(html).toContain('class="breadcrumb-item active"');
    });

    it('should handle single breadcrumb item', () => {
      const items = [{ text: 'Current Page' }];
      const html = buildBreadcrumbHtml(items);

      expect(html).toContain('<span>Current Page</span>');
      expect(html).toContain('class="breadcrumb-item active"');
      expect(html).not.toContain('<a href');
    });

    it('should handle empty breadcrumb items', () => {
      const html = buildBreadcrumbHtml([]);

      expect(html).toContain('<ol class="breadcrumb">');
      expect(html).not.toContain('<li');
    });
  });

  describe('buildPaginationHtml', () => {
    it('should build pagination with all features', () => {
      const html = buildPaginationHtml({
        currentPage: 3,
        totalPages: 10,
        baseUrl: '/products',
        showFirstLast: true,
        showPrevNext: true
      });

      expect(html).toContain('<nav aria-label="pagination">');
      expect(html).toContain('<ul class="pagination">');
      expect(html).toContain('href="/products?page=1">First</a>');
      expect(html).toContain('href="/products?page=2">Previous</a>');
      expect(html).toContain('href="/products?page=4">Next</a>');
      expect(html).toContain('href="/products?page=10">Last</a>');
      expect(html).toContain('<span class="page-link">3</span>'); // Current page
    });

    it('should handle first page pagination', () => {
      const html = buildPaginationHtml({
        currentPage: 1,
        totalPages: 5
      });

      expect(html).not.toContain('>First</a>');
      expect(html).not.toContain('>Previous</a>');
      expect(html).toContain('<span class="page-link">1</span>');
      expect(html).toContain('href="#?page=2">Next</a>');
    });

    it('should handle last page pagination', () => {
      const html = buildPaginationHtml({
        currentPage: 5,
        totalPages: 5
      });

      expect(html).toContain('href="#?page=4">Previous</a>');
      expect(html).toContain('<span class="page-link">5</span>');
      expect(html).not.toContain('>Next</a>');
      expect(html).not.toContain('>Last</a>');
    });

    it('should handle minimal pagination options', () => {
      const html = buildPaginationHtml({
        currentPage: 2,
        totalPages: 3,
        showFirstLast: false,
        showPrevNext: false
      });

      expect(html).not.toContain('>First</a>');
      expect(html).not.toContain('>Previous</a>');
      expect(html).not.toContain('>Next</a>');
      expect(html).not.toContain('>Last</a>');
      expect(html).toContain('<span class="page-link">2</span>');
    });

    it('should show page numbers around current page', () => {
      const html = buildPaginationHtml({
        currentPage: 5,
        totalPages: 10
      });

      // Should show pages 3, 4, 5, 6, 7 (current ± 2)
      expect(html).toContain('href="#?page=3">3</a>');
      expect(html).toContain('href="#?page=4">4</a>');
      expect(html).toContain('<span class="page-link">5</span>');
      expect(html).toContain('href="#?page=6">6</a>');
      expect(html).toContain('href="#?page=7">7</a>');
    });
  });

  describe('Integration tests', () => {
    it('should build a complete page with multiple components', () => {
      // Build individual components
      const navigation = buildNavigationHtml([
        { href: '/', text: 'Home' },
        { href: '/products', text: 'Products' }
      ]);

      const form = buildFormHtml({
        action: '/search',
        fields: [
          { name: 'query', type: 'text', label: 'Search', placeholder: 'Enter search term' }
        ],
        submitLabel: 'Search'
      });

      const table = buildTableHtml({
        headers: ['Product', 'Price', 'Stock'],
        rows: [
          ['Widget A', '$19.99', '15'],
          ['Widget B', '$24.99', '8']
        ]
      });

      // Combine into complete page
      const completePage = buildCompletePage({
        title: 'Product Search',
        body: `
          ${navigation}
          <main>
            <h1>Product Search</h1>
            ${form}
            <h2>Results</h2>
            ${table}
          </main>
        `,
        styles: `
          .navigation { margin-bottom: 20px; }
          .form { margin: 20px 0; }
          .table { width: 100%; }
        `
      });

      // Verify complete page structure
      expect(completePage).toContain('<!DOCTYPE html>');
      expect(completePage).toContain('<title>Product Search</title>');
      expect(completePage).toContain('<nav>');
      expect(completePage).toContain('href="/"');
      expect(completePage).toContain('<form action="/search"');
      expect(completePage).toContain('placeholder="Enter search term"');
      expect(completePage).toContain('<table');
      expect(completePage).toContain('<th>Product</th>');
      expect(completePage).toContain('<td>Widget A</td>');
      expect(completePage).toContain('width: 100%;');
    });
  });
});