/**
 * @apexcli/browser - Navigation Helpers Integration Tests
 *
 * Integration tests for navigation helper functions testing real-world workflows,
 * performance scenarios, and complex multi-step operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import {
  goto,
  waitForNavigation,
  assertURL,
  assertPageContent,
  type NavigationHelperResult,
} from '../navigation-helpers.js';

describe('Navigation Helpers - Integration Tests', () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await browser?.close();
  });

  describe('Multi-Step Navigation Workflows', () => {
    it('should handle complete user journey simulation', async () => {
      // Step 1: Navigate to landing page
      const landingPage = `
        <html>
          <body>
            <h1>Welcome to Our Site</h1>
            <nav>
              <a href="#about" onclick="showAbout()">About</a>
              <a href="#contact" onclick="showContact()">Contact</a>
            </nav>
            <div id="content">
              <p>Landing page content</p>
            </div>
            <script>
              function showAbout() {
                document.getElementById('content').innerHTML = '<h2>About Us</h2><p>We are a great company!</p>';
                document.title = 'About Us';
              }
              function showContact() {
                document.getElementById('content').innerHTML = '<h2>Contact Us</h2><p>Email: contact@example.com</p>';
                document.title = 'Contact Us';
              }
            </script>
          </body>
        </html>
      `;

      const result1 = await goto(page, `data:text/html,${encodeURIComponent(landingPage)}`);
      expect(result1.success).toBe(true);

      // Step 2: Verify landing page loaded correctly
      const contentResult1 = await assertPageContent(page, 'Welcome to Our Site');
      expect(contentResult1.success).toBe(true);

      // Step 3: Navigate to about section
      await page.click('a[href="#about"]');
      await page.waitForTimeout(100); // Allow for content change

      // Step 4: Verify about content loaded
      const aboutResult = await assertPageContent(page, 'About Us');
      expect(aboutResult.success).toBe(true);

      // Step 5: Navigate to contact section
      await page.click('a[href="#contact"]');
      await page.waitForTimeout(100);

      // Step 6: Verify contact content loaded
      const contactResult = await assertPageContent(page, 'contact@example.com');
      expect(contactResult.success).toBe(true);
    });

    it('should handle form submission workflow', async () => {
      const formPage = `
        <html>
          <body>
            <h1>Contact Form</h1>
            <form id="contactForm" onsubmit="handleSubmit(event)">
              <input type="text" id="name" placeholder="Your Name" required>
              <input type="email" id="email" placeholder="Your Email" required>
              <textarea id="message" placeholder="Your Message" required></textarea>
              <button type="submit">Submit</button>
            </form>
            <div id="result" style="display: none;">
              <h2>Thank You!</h2>
              <p>Your message has been sent successfully.</p>
            </div>
            <script>
              function handleSubmit(event) {
                event.preventDefault();
                document.querySelector('form').style.display = 'none';
                document.getElementById('result').style.display = 'block';
              }
            </script>
          </body>
        </html>
      `;

      const result1 = await goto(page, `data:text/html,${encodeURIComponent(formPage)}`);
      expect(result1.success).toBe(true);

      // Verify form is present
      const formResult = await assertPageContent(page, 'Contact Form');
      expect(formResult.success).toBe(true);

      // Fill and submit form
      await page.fill('#name', 'John Doe');
      await page.fill('#email', 'john@example.com');
      await page.fill('#message', 'Test message');
      await page.click('button[type="submit"]');

      // Wait for form submission
      await page.waitForTimeout(100);

      // Verify success message
      const successResult = await assertPageContent(page, 'Thank You!');
      expect(successResult.success).toBe(true);

      const messageResult = await assertPageContent(page, 'sent successfully');
      expect(messageResult.success).toBe(true);
    });

    it('should handle dynamic content loading workflow', async () => {
      const dynamicPage = `
        <html>
          <body>
            <h1>Dynamic Content Demo</h1>
            <button onclick="loadContent()">Load Content</button>
            <div id="loading" style="display: none;">Loading...</div>
            <div id="content"></div>
            <script>
              function loadContent() {
                document.getElementById('loading').style.display = 'block';
                setTimeout(() => {
                  document.getElementById('loading').style.display = 'none';
                  document.getElementById('content').innerHTML =
                    '<h2>Dynamic Content Loaded</h2><p>This content was loaded dynamically!</p>';
                }, 500);
              }
            </script>
          </body>
        </html>
      `;

      const result1 = await goto(page, `data:text/html,${encodeURIComponent(dynamicPage)}`);
      expect(result1.success).toBe(true);

      // Click to load content
      await page.click('button');

      // Verify loading message appears
      const loadingResult = await assertPageContent(page, 'Loading...', { timeout: 1000 });
      expect(loadingResult.success).toBe(true);

      // Wait for content to load and verify
      const contentResult = await assertPageContent(page, 'Dynamic Content Loaded', { timeout: 2000 });
      expect(contentResult.success).toBe(true);

      const detailResult = await assertPageContent(page, 'loaded dynamically');
      expect(detailResult.success).toBe(true);
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle navigation failure and recovery', async () => {
      // Try to navigate to invalid URL
      const failResult = await goto(page, 'http://definitely-not-a-real-domain-12345.invalid', {
        timeout: 1000
      });
      expect(failResult.success).toBe(false);

      // Recover by navigating to valid page
      const validPage = '<html><body><h1>Recovery Successful</h1></body></html>';
      const recoveryResult = await goto(page, `data:text/html,${encodeURIComponent(validPage)}`);
      expect(recoveryResult.success).toBe(true);

      // Verify recovery
      const verifyResult = await assertPageContent(page, 'Recovery Successful');
      expect(verifyResult.success).toBe(true);
    });

    it('should handle timeout recovery in assertions', async () => {
      const testPage = '<html><body><h1>Test Page</h1></body></html>';
      await goto(page, `data:text/html,${encodeURIComponent(testPage)}`);

      // Try assertion that will timeout
      const timeoutResult = await assertPageContent(page, 'Non-existent content', {
        timeout: 100
      });
      expect(timeoutResult.success).toBe(false);

      // Immediately try valid assertion
      const validResult = await assertPageContent(page, 'Test Page');
      expect(validResult.success).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle repeated operations efficiently', async () => {
      const testPage = '<html><body><h1>Performance Test</h1><p>Content for testing</p></body></html>';
      await goto(page, `data:text/html,${encodeURIComponent(testPage)}`);

      const operations = [];
      const iterations = 50;

      // Time multiple iterations
      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        operations.push(
          Promise.all([
            assertURL(page, /data:text\/html/),
            assertPageContent(page, 'Performance Test'),
            assertPageContent(page, 'Content for testing')
          ])
        );
      }

      const results = await Promise.all(operations);
      const endTime = Date.now();

      // All operations should succeed
      results.forEach(resultSet => {
        resultSet.forEach(result => {
          expect(result.success).toBe(true);
        });
      });

      // Performance should be reasonable
      const avgTimePerOperation = (endTime - startTime) / (iterations * 3);
      expect(avgTimePerOperation).toBeLessThan(50); // Less than 50ms per operation on average
    });

    it('should handle concurrent operations without interference', async () => {
      const testPage = '<html><body><h1>Concurrent Test</h1><div class="content">Test content</div></body></html>';
      await goto(page, `data:text/html,${encodeURIComponent(testPage)}`);

      // Run many concurrent operations
      const concurrentOperations = [];

      for (let i = 0; i < 20; i++) {
        concurrentOperations.push(
          assertURL(page, /data:text\/html/),
          assertPageContent(page, 'Concurrent Test'),
          assertPageContent(page, 'Test content', { selector: '.content' }),
          assertPageContent(page, /Concurrent/, { ignoreCase: true })
        );
      }

      const results = await Promise.all(concurrentOperations);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Performance should be reasonable
      const avgDuration = results.reduce((sum, result) => sum + result.duration, 0) / results.length;
      expect(avgDuration).toBeLessThan(100);
    });

    it('should handle large page content efficiently', async () => {
      // Create large page content
      const largeParagraph = 'Lorem ipsum '.repeat(1000);
      const targetContent = 'FIND_ME_IN_LARGE_CONTENT';
      const largeContent = `<p>${largeParagraph}</p>`.repeat(100) + `<p>${targetContent}</p>` + `<p>${largeParagraph}</p>`.repeat(100);
      const largePage = `<html><body><h1>Large Content Test</h1>${largeContent}</body></html>`;

      const gotoResult = await goto(page, `data:text/html,${encodeURIComponent(largePage)}`);
      expect(gotoResult.success).toBe(true);

      // Test finding content in large page
      const startTime = Date.now();
      const findResult = await assertPageContent(page, targetContent);
      const duration = Date.now() - startTime;

      expect(findResult.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Complex Selector Integration', () => {
    it('should handle nested selector hierarchies', async () => {
      const complexPage = `
        <html>
          <body>
            <nav class="navigation">
              <ul class="menu">
                <li class="item active">
                  <a href="#home" class="link">Home</a>
                  <ul class="submenu">
                    <li><a href="#news" class="sublink">News</a></li>
                    <li><a href="#events" class="sublink">Events</a></li>
                  </ul>
                </li>
                <li class="item">
                  <a href="#about" class="link">About</a>
                </li>
              </ul>
            </nav>
            <main class="content">
              <section class="hero">
                <h1>Welcome</h1>
                <p class="subtitle">This is our amazing website</p>
              </section>
              <section class="features">
                <div class="feature" data-feature="speed">
                  <h3>Fast</h3>
                  <p>Lightning fast performance</p>
                </div>
                <div class="feature" data-feature="secure">
                  <h3>Secure</h3>
                  <p>Bank-level security</p>
                </div>
              </section>
            </main>
          </body>
        </html>
      `;

      await goto(page, `data:text/html,${encodeURIComponent(complexPage)}`);

      const selectorTests = [
        { selector: '.navigation .menu .item.active .link', content: 'Home' },
        { selector: '.navigation .submenu .sublink', content: 'News' },
        { selector: '.content .hero h1', content: 'Welcome' },
        { selector: '.features .feature[data-feature="speed"] h3', content: 'Fast' },
        { selector: '.features .feature[data-feature="secure"] p', content: 'Bank-level security' },
      ];

      for (const test of selectorTests) {
        const result = await assertPageContent(page, test.content, {
          selector: test.selector
        });
        expect(result.success).toBe(true);
      }
    });

    it('should handle ElementSelector types in complex scenarios', async () => {
      const complexPage = `
        <html>
          <body>
            <div class="container">
              <h1 id="main-title">Main Title</h1>
              <div data-testid="content-area">
                <p>This is a test paragraph</p>
                <button role="button">Click Me</button>
                <span>Some text content</span>
              </div>
            </div>
          </body>
        </html>
      `;

      await goto(page, `data:text/html,${encodeURIComponent(complexPage)}`);

      const elementSelectorTests = [
        { selector: { type: 'css' as const, value: '#main-title' }, content: 'Main Title' },
        { selector: { type: 'testId' as const, value: 'content-area' }, content: 'test paragraph' },
        { selector: { type: 'xpath' as const, value: '//button[@role="button"]' }, content: 'Click Me' },
        { selector: { type: 'text' as const, value: 'Some text content' }, content: 'Some text content' },
      ];

      for (const test of elementSelectorTests) {
        const result = await assertPageContent(page, test.content, {
          selector: test.selector
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('Real-world Scenario Simulation', () => {
    it('should handle single-page application navigation simulation', async () => {
      const spaPage = `
        <html>
          <head>
            <title>SPA Test</title>
          </head>
          <body>
            <nav>
              <button onclick="showHome()">Home</button>
              <button onclick="showProfile()">Profile</button>
              <button onclick="showSettings()">Settings</button>
            </nav>
            <div id="app">
              <h1>Home Page</h1>
              <p>Welcome to the home page</p>
            </div>
            <script>
              function showHome() {
                document.getElementById('app').innerHTML =
                  '<h1>Home Page</h1><p>Welcome to the home page</p>';
                document.title = 'SPA Test - Home';
              }
              function showProfile() {
                document.getElementById('app').innerHTML =
                  '<h1>Profile Page</h1><p>Your profile information</p><div class="profile-info">User: John Doe</div>';
                document.title = 'SPA Test - Profile';
              }
              function showSettings() {
                document.getElementById('app').innerHTML =
                  '<h1>Settings Page</h1><p>Application settings</p><div class="settings"><label><input type="checkbox" checked> Enable notifications</label></div>';
                document.title = 'SPA Test - Settings';
              }
            </script>
          </body>
        </html>
      `;

      await goto(page, `data:text/html,${encodeURIComponent(spaPage)}`);

      // Navigate through SPA sections
      const homeResult = await assertPageContent(page, 'Welcome to the home page');
      expect(homeResult.success).toBe(true);

      // Navigate to profile
      await page.click('button:has-text("Profile")');
      await page.waitForTimeout(100);

      const profileResult = await assertPageContent(page, 'Profile Page');
      expect(profileResult.success).toBe(true);

      const userInfoResult = await assertPageContent(page, 'User: John Doe', {
        selector: '.profile-info'
      });
      expect(userInfoResult.success).toBe(true);

      // Navigate to settings
      await page.click('button:has-text("Settings")');
      await page.waitForTimeout(100);

      const settingsResult = await assertPageContent(page, 'Settings Page');
      expect(settingsResult.success).toBe(true);

      const notificationResult = await assertPageContent(page, 'Enable notifications', {
        selector: '.settings'
      });
      expect(notificationResult.success).toBe(true);
    });

    it('should handle e-commerce workflow simulation', async () => {
      const ecommercePage = `
        <html>
          <body>
            <header>
              <h1>Online Store</h1>
              <div class="cart">Cart: <span id="cart-count">0</span> items</div>
            </header>
            <main>
              <div class="product" data-id="1">
                <h3>Product 1</h3>
                <p class="price">$19.99</p>
                <button onclick="addToCart(1)">Add to Cart</button>
              </div>
              <div class="product" data-id="2">
                <h3>Product 2</h3>
                <p class="price">$29.99</p>
                <button onclick="addToCart(2)">Add to Cart</button>
              </div>
              <div id="cart-items"></div>
              <button id="checkout" style="display: none;" onclick="checkout()">Checkout</button>
              <div id="checkout-success" style="display: none;">
                <h2>Order Successful!</h2>
                <p>Thank you for your purchase!</p>
              </div>
            </main>
            <script>
              let cart = [];
              function addToCart(productId) {
                cart.push(productId);
                document.getElementById('cart-count').textContent = cart.length;
                updateCartDisplay();
              }
              function updateCartDisplay() {
                const cartItems = document.getElementById('cart-items');
                cartItems.innerHTML = '<h3>Cart Items:</h3>' +
                  cart.map(id => '<div>Product ' + id + '</div>').join('');
                document.getElementById('checkout').style.display = cart.length > 0 ? 'block' : 'none';
              }
              function checkout() {
                document.getElementById('checkout-success').style.display = 'block';
                document.querySelector('main').children[0].style.display = 'none';
                document.querySelector('main').children[1].style.display = 'none';
              }
            </script>
          </body>
        </html>
      `;

      await goto(page, `data:text/html,${encodeURIComponent(ecommercePage)}`);

      // Verify initial state
      const storeResult = await assertPageContent(page, 'Online Store');
      expect(storeResult.success).toBe(true);

      const cartResult = await assertPageContent(page, 'Cart: 0 items');
      expect(cartResult.success).toBe(true);

      // Add items to cart
      await page.click('.product[data-id="1"] button');
      await page.waitForTimeout(100);

      const cartUpdate1 = await assertPageContent(page, 'Cart: 1 items');
      expect(cartUpdate1.success).toBe(true);

      await page.click('.product[data-id="2"] button');
      await page.waitForTimeout(100);

      const cartUpdate2 = await assertPageContent(page, 'Cart: 2 items');
      expect(cartUpdate2.success).toBe(true);

      // Verify cart items display
      const cartItems = await assertPageContent(page, 'Cart Items:');
      expect(cartItems.success).toBe(true);

      // Checkout
      await page.click('#checkout');
      await page.waitForTimeout(100);

      const checkoutSuccess = await assertPageContent(page, 'Order Successful!');
      expect(checkoutSuccess.success).toBe(true);

      const thankYou = await assertPageContent(page, 'Thank you for your purchase!');
      expect(thankYou.success).toBe(true);
    });
  });
});