/**
 * @fileoverview Integration Tests for Navigation Test Utilities
 *
 * This file tests the integration of navigation utilities with real browser
 * scenarios, testing full workflows and complex interactions.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NavigationTestHelper,
  NavigationTestFixture,
  NavigationTestFixtureFactory,
  TestPageTemplates,
  TestScenarios,
  createNavigationTestHelper,
  NavigationTestSetup,
} from '../navigation-test-utils.js';

describe('NavigationTestUtils - Integration Tests', () => {
  let helper: NavigationTestHelper | null = null;
  let fixture: NavigationTestFixture | null = null;

  afterEach(async () => {
    if (helper) {
      await helper.teardown().catch(console.warn);
      helper = null;
    }
    if (fixture) {
      await fixture.teardown().catch(console.warn);
      fixture = null;
    }
  });

  describe('End-to-End Navigation Workflows', () => {
    it('should handle complete user navigation journey', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        // Start with landing page
        await page.setContent(TestPageTemplates.simple);
        await fixture.navigationHelper.assertPageContent({ text: 'Test Page' });

        // Navigate to form page
        await page.setContent(TestPageTemplates.form);
        await fixture.navigationHelper.assertPageContent({ text: 'Test Form' });

        // Fill out form
        await page.fill('#name', 'Integration Test User');
        await page.fill('#email', 'test@integration.com');

        // Verify form data
        const formData = await page.evaluate(() => {
          const nameInput = document.querySelector('#name') as HTMLInputElement;
          const emailInput = document.querySelector('#email') as HTMLInputElement;
          return {
            name: nameInput?.value,
            email: emailInput?.value,
          };
        });

        expect(formData.name).toBe('Integration Test User');
        expect(formData.email).toBe('test@integration.com');

        // Navigate to SPA page
        await page.setContent(TestPageTemplates.spa);

        // Test SPA navigation
        await page.click('#about-btn');
        await page.waitForFunction(() =>
          document.getElementById('content')?.textContent?.includes('About Page')
        );

        await fixture.navigationHelper.assertPageContent({ text: 'About Page' });

        // Test browser history
        await page.goBack();
        await page.waitForFunction(() =>
          document.getElementById('content')?.textContent?.includes('Home Page')
        );

        await fixture.navigationHelper.assertPageContent({ text: 'Home Page' });
      }
    });

    it('should handle complex async workflows', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        const asyncWorkflowPage = `
          <!DOCTYPE html>
          <html>
          <head><title>Async Workflow</title></head>
          <body>
            <h1>Async Workflow Test</h1>
            <button id="start-workflow">Start Workflow</button>
            <div id="status">Ready</div>
            <div id="progress" style="width: 0%; height: 20px; background: blue;"></div>
            <div id="result" style="display: none;"></div>

            <script>
              async function startWorkflow() {
                document.getElementById('status').textContent = 'Starting...';

                for (let i = 1; i <= 5; i++) {
                  await new Promise(resolve => setTimeout(resolve, 200));
                  document.getElementById('status').textContent = \`Step \${i}/5\`;
                  document.getElementById('progress').style.width = \`\${i * 20}%\`;
                }

                document.getElementById('status').textContent = 'Completed!';
                document.getElementById('result').style.display = 'block';
                document.getElementById('result').textContent = 'Workflow completed successfully!';
              }

              document.getElementById('start-workflow').addEventListener('click', startWorkflow);
            </script>
          </body>
          </html>
        `;

        await page.setContent(asyncWorkflowPage);

        // Start the workflow
        await page.click('#start-workflow');

        // Wait for and verify each step
        await page.waitForFunction(() =>
          document.getElementById('status')?.textContent === 'Step 1/5'
        );

        await page.waitForFunction(() =>
          document.getElementById('status')?.textContent === 'Step 5/5'
        );

        // Wait for completion
        await page.waitForFunction(() =>
          document.getElementById('status')?.textContent === 'Completed!'
        );

        await fixture.navigationHelper.assertPageContent({
          text: 'Workflow completed successfully!',
        });

        // Verify progress bar is at 100%
        const progressWidth = await page.evaluate(() => {
          const progress = document.getElementById('progress') as HTMLElement;
          return progress.style.width;
        });
        expect(progressWidth).toBe('100%');
      }
    });

    it('should handle real-world form interactions', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        const complexFormPage = `
          <!DOCTYPE html>
          <html>
          <head><title>Complex Form</title></head>
          <body>
            <h1>Complex Form Test</h1>
            <form id="complex-form">
              <fieldset>
                <legend>Personal Information</legend>
                <input type="text" id="firstName" name="firstName" placeholder="First Name" required>
                <input type="text" id="lastName" name="lastName" placeholder="Last Name" required>
                <input type="email" id="email" name="email" placeholder="Email" required>
                <input type="tel" id="phone" name="phone" placeholder="Phone">
              </fieldset>

              <fieldset>
                <legend>Preferences</legend>
                <label><input type="checkbox" name="newsletter" value="yes"> Subscribe to newsletter</label>
                <label><input type="radio" name="contact" value="email" checked> Email</label>
                <label><input type="radio" name="contact" value="phone"> Phone</label>
                <select name="country">
                  <option value="">Select Country</option>
                  <option value="us">United States</option>
                  <option value="ca">Canada</option>
                  <option value="uk">United Kingdom</option>
                </select>
              </fieldset>

              <button type="submit">Submit</button>
              <div id="form-result"></div>
            </form>

            <script>
              document.getElementById('complex-form').addEventListener('submit', function(e) {
                e.preventDefault();
                const formData = new FormData(this);
                const data = Object.fromEntries(formData.entries());
                document.getElementById('form-result').innerHTML =
                  '<h3>Form Submitted:</h3><pre>' + JSON.stringify(data, null, 2) + '</pre>';
              });
            </script>
          </body>
          </html>
        `;

        await page.setContent(complexFormPage);

        // Fill out the complex form
        await page.fill('#firstName', 'John');
        await page.fill('#lastName', 'Doe');
        await page.fill('#email', 'john.doe@example.com');
        await page.fill('#phone', '+1-555-123-4567');

        // Check the newsletter checkbox
        await page.check('input[name="newsletter"]');

        // Select phone contact method
        await page.check('input[name="contact"][value="phone"]');

        // Select country
        await page.selectOption('select[name="country"]', 'us');

        // Submit the form
        await page.click('button[type="submit"]');

        // Wait for form result
        await page.waitForSelector('#form-result h3');

        // Verify the submitted data
        const resultText = await page.textContent('#form-result');
        expect(resultText).toContain('Form Submitted');
        expect(resultText).toContain('John');
        expect(resultText).toContain('john.doe@example.com');
        expect(resultText).toContain('phone');
        expect(resultText).toContain('us');
      }
    });
  });

  describe('Multi-Page Application Testing', () => {
    it('should handle navigation between multiple pages', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      // Create multiple test pages
      const pages = [];

      for (let i = 0; i < 3; i++) {
        const testPage = await fixture.createPage({
          content: `
            <html>
              <head><title>Test Page ${i + 1}</title></head>
              <body>
                <h1>Page ${i + 1}</h1>
                <p>This is test page number ${i + 1}</p>
                <button id="action-btn">Action ${i + 1}</button>
              </body>
            </html>
          `,
        });
        pages.push(testPage);
      }

      // Test each page
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const title = await page.title();
        expect(title).toBe(`Test Page ${i + 1}`);

        const heading = await page.textContent('h1');
        expect(heading).toBe(`Page ${i + 1}`);

        // Test interaction
        await page.click('#action-btn');
      }

      // Close all test pages
      await Promise.all(pages.map(page => page.close()));
    });

    it('should handle page isolation between tests', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        // Set up initial state
        await page.setContent(`
          <html>
            <body>
              <h1>Isolation Test</h1>
              <script>
                localStorage.setItem('testData', 'initial');
                sessionStorage.setItem('sessionData', 'initial');
                window.testGlobal = 'initial';
              </script>
            </body>
          </html>
        `);

        // Verify initial state
        const initialState = await page.evaluate(() => ({
          localStorage: localStorage.getItem('testData'),
          sessionStorage: sessionStorage.getItem('sessionData'),
          global: (window as any).testGlobal,
        }));

        expect(initialState.localStorage).toBe('initial');
        expect(initialState.sessionStorage).toBe('initial');
        expect(initialState.global).toBe('initial');

        // Reset fixture to test isolation
        await fixture.reset();

        // Verify state is cleared
        const clearedState = await page.evaluate(() => ({
          localStorage: localStorage.getItem('testData'),
          sessionStorage: sessionStorage.getItem('sessionData'),
        }));

        expect(clearedState.localStorage).toBeNull();
        expect(clearedState.sessionStorage).toBeNull();
      }
    });
  });

  describe('Performance and Monitoring Integration', () => {
    it('should capture and analyze navigation performance', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      const navigationResults = [];

      // Perform multiple navigations
      for (let i = 0; i < 5; i++) {
        await fixture.reset();

        const result = await fixture.navigationHelper.goto('about:blank');
        navigationResults.push(result);

        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
      }

      // Analyze performance trends
      const durations = navigationResults.map(r => r.duration);
      const averageDuration = durations.reduce((a, b) => a + b) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      expect(averageDuration).toBeGreaterThan(0);
      expect(maxDuration).toBeGreaterThanOrEqual(averageDuration);
      expect(minDuration).toBeLessThanOrEqual(averageDuration);

      console.log('Navigation Performance Analysis:', {
        average: averageDuration,
        min: minDuration,
        max: maxDuration,
        samples: durations.length,
      });
    });

    it('should monitor network activity during tests', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        // Page that makes multiple network requests
        const networkTestPage = `
          <!DOCTYPE html>
          <html>
          <head><title>Network Test</title></head>
          <body>
            <h1>Network Activity Test</h1>
            <button id="make-requests">Make Requests</button>

            <script>
              document.getElementById('make-requests').addEventListener('click', async () => {
                const requests = [
                  fetch('data:text/plain,response1'),
                  fetch('data:text/plain,response2'),
                  fetch('data:text/plain,response3'),
                ];
                await Promise.all(requests);
              });
            </script>
          </body>
          </html>
        `;

        await page.setContent(networkTestPage);

        // Clear previous network activity
        await fixture.reset();
        await page.setContent(networkTestPage);

        // Trigger network requests
        await page.click('#make-requests');

        // Wait for requests to complete
        await page.waitForTimeout(1000);

        // Check captured network activity
        const networkActivity = fixture.networkActivity;
        expect(networkActivity.length).toBeGreaterThan(0);

        // Verify request details
        const dataRequests = networkActivity.filter(req =>
          req.url.startsWith('data:text/plain')
        );
        expect(dataRequests.length).toBeGreaterThan(0);
      }
    });

    it('should capture console activity during tests', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        // Page that generates console output
        const consoleTestPage = `
          <!DOCTYPE html>
          <html>
          <head><title>Console Test</title></head>
          <body>
            <h1>Console Activity Test</h1>
            <script>
              console.log('Test log message');
              console.warn('Test warning message');
              console.error('Test error message');
              console.info('Test info message');
            </script>
          </body>
          </html>
        `;

        await page.setContent(consoleTestPage);

        // Wait for console messages
        await page.waitForTimeout(500);

        // Check captured console activity
        const consoleActivity = fixture.consoleActivity;
        expect(consoleActivity.length).toBeGreaterThan(0);

        // Verify different message types
        const logTypes = consoleActivity.map(log => log.type);
        expect(logTypes).toContain('log');
        expect(logTypes).toContain('warning');
        expect(logTypes).toContain('error');

        // Verify message content
        const messages = consoleActivity.map(log => log.text);
        expect(messages.some(msg => msg.includes('Test log message'))).toBe(true);
      }
    });
  });

  describe('Real-world Scenario Testing', () => {
    it('should handle authentication flow simulation', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        const authFlowPage = `
          <!DOCTYPE html>
          <html>
          <head><title>Auth Flow</title></head>
          <body>
            <div id="login-form" style="display: block;">
              <h1>Login</h1>
              <input type="text" id="username" placeholder="Username">
              <input type="password" id="password" placeholder="Password">
              <button id="login-btn">Login</button>
              <div id="error-message" style="color: red; display: none;"></div>
            </div>

            <div id="dashboard" style="display: none;">
              <h1>Dashboard</h1>
              <p>Welcome, <span id="user-name"></span>!</p>
              <button id="logout-btn">Logout</button>
            </div>

            <script>
              document.getElementById('login-btn').addEventListener('click', () => {
                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;

                if (username === 'testuser' && password === 'password123') {
                  document.getElementById('login-form').style.display = 'none';
                  document.getElementById('dashboard').style.display = 'block';
                  document.getElementById('user-name').textContent = username;
                } else {
                  document.getElementById('error-message').style.display = 'block';
                  document.getElementById('error-message').textContent = 'Invalid credentials';
                }
              });

              document.getElementById('logout-btn').addEventListener('click', () => {
                document.getElementById('login-form').style.display = 'block';
                document.getElementById('dashboard').style.display = 'none';
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';
                document.getElementById('error-message').style.display = 'none';
              });
            </script>
          </body>
          </html>
        `;

        await page.setContent(authFlowPage);

        // Test invalid login
        await page.fill('#username', 'wronguser');
        await page.fill('#password', 'wrongpass');
        await page.click('#login-btn');

        await fixture.navigationHelper.assertPageContent({
          text: 'Invalid credentials',
        });

        // Test valid login
        await page.fill('#username', 'testuser');
        await page.fill('#password', 'password123');
        await page.click('#login-btn');

        await fixture.navigationHelper.assertPageContent({
          text: 'Welcome, testuser!',
        });

        // Test logout
        await page.click('#logout-btn');

        await fixture.navigationHelper.assertPageContent({
          text: 'Login',
        });
      }
    });

    it('should handle e-commerce workflow simulation', async () => {
      fixture = NavigationTestFixtureFactory.createIntegrationTestFixture();
      await fixture.setup();

      if (fixture.page) {
        const page = fixture.page;

        const ecommercePage = `
          <!DOCTYPE html>
          <html>
          <head><title>E-commerce Test</title></head>
          <body>
            <h1>Online Store</h1>

            <div class="products">
              <div class="product" data-id="1">
                <h3>Product 1</h3>
                <p>Price: $10</p>
                <button class="add-to-cart" data-id="1" data-price="10">Add to Cart</button>
              </div>
              <div class="product" data-id="2">
                <h3>Product 2</h3>
                <p>Price: $20</p>
                <button class="add-to-cart" data-id="2" data-price="20">Add to Cart</button>
              </div>
            </div>

            <div id="cart">
              <h2>Shopping Cart</h2>
              <div id="cart-items"></div>
              <div id="cart-total">Total: $0</div>
              <button id="checkout" style="display: none;">Checkout</button>
            </div>

            <div id="checkout-form" style="display: none;">
              <h2>Checkout</h2>
              <input type="text" id="customer-name" placeholder="Name" required>
              <input type="email" id="customer-email" placeholder="Email" required>
              <button id="complete-order">Complete Order</button>
            </div>

            <div id="order-confirmation" style="display: none;">
              <h2>Order Confirmed!</h2>
              <p>Thank you for your purchase!</p>
            </div>

            <script>
              let cart = [];

              document.addEventListener('click', (e) => {
                if (e.target.classList.contains('add-to-cart')) {
                  const id = e.target.dataset.id;
                  const price = parseInt(e.target.dataset.price);
                  cart.push({ id, price });
                  updateCart();
                }
              });

              function updateCart() {
                const cartItems = document.getElementById('cart-items');
                const cartTotal = document.getElementById('cart-total');
                const checkout = document.getElementById('checkout');

                cartItems.innerHTML = cart.map(item =>
                  \`<div>Product \${item.id} - $\${item.price}</div>\`
                ).join('');

                const total = cart.reduce((sum, item) => sum + item.price, 0);
                cartTotal.textContent = \`Total: $\${total}\`;
                checkout.style.display = cart.length > 0 ? 'block' : 'none';
              }

              document.getElementById('checkout').addEventListener('click', () => {
                document.getElementById('checkout-form').style.display = 'block';
              });

              document.getElementById('complete-order').addEventListener('click', () => {
                const name = document.getElementById('customer-name').value;
                const email = document.getElementById('customer-email').value;

                if (name && email) {
                  document.getElementById('checkout-form').style.display = 'none';
                  document.getElementById('order-confirmation').style.display = 'block';
                }
              });
            </script>
          </body>
          </html>
        `;

        await page.setContent(ecommercePage);

        // Add products to cart
        await page.click('.product[data-id="1"] .add-to-cart');
        await page.click('.product[data-id="2"] .add-to-cart');

        // Verify cart total
        await fixture.navigationHelper.assertPageContent({
          text: 'Total: $30',
        });

        // Proceed to checkout
        await page.click('#checkout');

        // Fill checkout form
        await page.fill('#customer-name', 'Test Customer');
        await page.fill('#customer-email', 'test@customer.com');

        // Complete order
        await page.click('#complete-order');

        // Verify order confirmation
        await fixture.navigationHelper.assertPageContent({
          text: 'Order Confirmed!',
        });
      }
    });
  });
});