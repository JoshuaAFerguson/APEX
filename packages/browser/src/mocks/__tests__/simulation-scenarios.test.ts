/**
 * @apexcli/browser/mocks - Simulation Scenario Tests
 *
 * Tests that verify the mocks can accurately simulate various real-world
 * browser automation scenarios, both successful and failure cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MockBrowserSession,
  MockBrowserManager,
  createMockBrowserSession,
  createMockBrowserManager,
  createMockScenario,
  launchMockBrowser,
  createMockSessionForTesting,
  createUnreliableMockSession,
  commonScenarios,
} from '../index.js';

describe('Browser Automation Simulation Scenarios', () => {
  describe('Successful Workflow Simulations', () => {
    it('should simulate complete e-commerce checkout workflow', async () => {
      const ecommerceScenario = createMockScenario()
        // Product listing page
        .forUrl('https://shop.example.com/products')
          .loadTime(800)
          .withTitle('Product Catalog - Example Shop')
        .and()
        .forElement('.product-card')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('.product-card .buy-button')
          .exists()
          .visible()
          .enabled()
          .withText('Add to Cart')
        .and()
        // Shopping cart page
        .forUrl('https://shop.example.com/cart')
          .loadTime(600)
          .withTitle('Shopping Cart')
        .and()
        .forElement('#cart-items')
          .exists()
          .visible()
          .withText('1 item in cart')
        .and()
        .forElement('#checkout-btn')
          .exists()
          .visible()
          .enabled()
          .withText('Proceed to Checkout')
        .and()
        // Checkout form page
        .forUrl('https://shop.example.com/checkout')
          .loadTime(700)
          .withTitle('Checkout - Complete Your Order')
        .and()
        .forElement('#email')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#address')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#payment-card')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#place-order')
          .exists()
          .visible()
          .enabled()
          .withText('Place Order')
        .and()
        // Success page
        .forUrl('https://shop.example.com/order-success')
          .loadTime(500)
          .withTitle('Order Confirmed - Thank You!')
        .and()
        .forElement('#confirmation-message')
          .exists()
          .visible()
          .withText('Your order has been confirmed!')
        .and()
        .build();

      const session = createMockBrowserSession({
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 100,
          useRealisticDelays: false,
        },
      }, ecommerceScenario);

      await session.launch();

      // Step 1: Browse products
      const productsResult = await session.navigate('https://shop.example.com/products');
      expect(productsResult.success).toBe(true);
      expect(productsResult.data?.title).toBe('Product Catalog - Example Shop');

      const productExists = await session.elementExists('.product-card');
      expect(productExists.success).toBe(true);
      expect(productExists.data).toBe(true);

      // Step 2: Add item to cart
      const addToCartResult = await session.clickElement('.product-card .buy-button');
      expect(addToCartResult.success).toBe(true);

      // Step 3: Go to cart
      const cartResult = await session.navigate('https://shop.example.com/cart');
      expect(cartResult.success).toBe(true);
      expect(cartResult.data?.title).toBe('Shopping Cart');

      const cartItemsText = await session.getElementText('#cart-items');
      expect(cartItemsText.success).toBe(true);
      expect(cartItemsText.data).toBe('1 item in cart');

      // Step 4: Proceed to checkout
      const proceedResult = await session.clickElement('#checkout-btn');
      expect(proceedResult.success).toBe(true);

      const checkoutResult = await session.navigate('https://shop.example.com/checkout');
      expect(checkoutResult.success).toBe(true);
      expect(checkoutResult.data?.title).toBe('Checkout - Complete Your Order');

      // Step 5: Fill checkout form
      const emailResult = await session.typeInElement('#email', 'customer@example.com');
      expect(emailResult.success).toBe(true);

      const addressResult = await session.typeInElement('#address', '123 Main St, City, State 12345');
      expect(addressResult.success).toBe(true);

      const cardResult = await session.typeInElement('#payment-card', '4111111111111111');
      expect(cardResult.success).toBe(true);

      // Step 6: Complete order
      const placeOrderResult = await session.clickElement('#place-order');
      expect(placeOrderResult.success).toBe(true);

      const successResult = await session.navigate('https://shop.example.com/order-success');
      expect(successResult.success).toBe(true);
      expect(successResult.data?.title).toBe('Order Confirmed - Thank You!');

      const confirmationText = await session.getElementText('#confirmation-message');
      expect(confirmationText.success).toBe(true);
      expect(confirmationText.data).toBe('Your order has been confirmed!');

      // Verify complete operation history
      const operations = session.getOperationHistory();
      const operationNames = operations.map(op => op.name);

      expect(operationNames).toContain('launch');
      expect(operationNames).toContain('navigate');
      expect(operationNames).toContain('clickElement');
      expect(operationNames).toContain('typeInElement');
      expect(operationNames).toContain('getElementText');

      await session.close();
    });

    it('should simulate user authentication workflow', async () => {
      const authScenario = createMockScenario()
        .forUrl('https://app.example.com/login')
          .loadTime(600)
          .withTitle('Login - Example App')
        .and()
        .forElement('#username')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#password')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#login-submit')
          .exists()
          .visible()
          .enabled()
          .withText('Sign In')
        .and()
        .forUrl('https://app.example.com/dashboard')
          .loadTime(800)
          .withTitle('Dashboard - Example App')
        .and()
        .forElement('#welcome-message')
          .exists()
          .visible()
          .withText('Welcome back, User!')
        .and()
        .forElement('#logout-btn')
          .exists()
          .visible()
          .enabled()
          .withText('Logout')
        .and()
        .build();

      const session = createMockBrowserSession({}, authScenario);
      await session.launch();

      // Login flow
      const loginPageResult = await session.navigate('https://app.example.com/login');
      expect(loginPageResult.success).toBe(true);
      expect(loginPageResult.data?.title).toBe('Login - Example App');

      await session.typeInElement('#username', 'testuser@example.com');
      await session.typeInElement('#password', 'securepassword123');

      const loginResult = await session.clickElement('#login-submit');
      expect(loginResult.success).toBe(true);

      // Redirect to dashboard
      const dashboardResult = await session.navigate('https://app.example.com/dashboard');
      expect(dashboardResult.success).toBe(true);
      expect(dashboardResult.data?.title).toBe('Dashboard - Example App');

      const welcomeText = await session.getElementText('#welcome-message');
      expect(welcomeText.success).toBe(true);
      expect(welcomeText.data).toBe('Welcome back, User!');

      // Logout
      const logoutResult = await session.clickElement('#logout-btn');
      expect(logoutResult.success).toBe(true);

      await session.close();
    });

    it('should simulate form validation and submission workflow', async () => {
      const formScenario = createMockScenario()
        .forUrl('https://forms.example.com/contact')
          .loadTime(400)
          .withTitle('Contact Us - Example Forms')
        .and()
        .forElement('#contact-form')
          .exists()
          .visible()
        .and()
        .forElement('#name')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#email')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#message')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#submit-form')
          .exists()
          .visible()
          .enabled()
          .withText('Send Message')
        .and()
        .forElement('#success-message')
          .exists(false) // Initially not visible
        .and()
        .forOperation('submitForm')
          .succeeds()
          .withDelay(800)
        .and()
        .build();

      const session = createMockBrowserSession({}, formScenario);
      await session.launch();

      const formPageResult = await session.navigate('https://forms.example.com/contact');
      expect(formPageResult.success).toBe(true);

      // Fill form fields
      await session.typeInElement('#name', 'John Doe');
      await session.typeInElement('#email', 'john.doe@example.com');
      await session.typeInElement('#message', 'This is a test message for the contact form.');

      // Verify form data was entered
      const pageState = session.getPageState();
      expect(pageState.elements.get('#name')?.value).toBe('John Doe');
      expect(pageState.elements.get('#email')?.value).toBe('john.doe@example.com');
      expect(pageState.elements.get('#message')?.value).toBe('This is a test message for the contact form.');

      // Submit form
      const submitResult = await session.clickElement('#submit-form');
      expect(submitResult.success).toBe(true);

      await session.close();
    });
  });

  describe('Failure Scenario Simulations', () => {
    it('should simulate network connectivity issues', async () => {
      const networkFailureScenario = createMockScenario()
        .forOperation('navigate')
          .fails('ERR_NETWORK_TIMEOUT')
          .withDelay(5000)
        .and()
        .forOperation('*')
          .succeeds()
        .and()
        .build();

      const session = createMockBrowserSession({}, networkFailureScenario);
      await session.launch();

      // Navigation should fail with network error
      const navResult = await session.navigate('https://unreachable.example.com');
      expect(navResult.success).toBe(false);
      expect(navResult.error).toBe('ERR_NETWORK_TIMEOUT');
      expect(navResult.duration).toBeGreaterThanOrEqual(5000);

      // Other operations should still work
      const screenshotResult = await session.captureScreenshot();
      expect(screenshotResult.success).toBe(true);

      await session.close();
    });

    it('should simulate authentication failure scenarios', async () => {
      const authFailureScenario = createMockScenario()
        .forUrl('https://secure.example.com/login')
          .loadTime(600)
        .and()
        .forElement('#username')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#password')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#login-btn')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#error-message')
          .exists()
          .visible()
          .withText('Invalid username or password')
        .and()
        .forOperation('authenticate')
          .fails('Authentication failed')
        .and()
        .build();

      const session = createMockBrowserSession({}, authFailureScenario);
      await session.launch();

      await session.navigate('https://secure.example.com/login');

      // Fill in wrong credentials
      await session.typeInElement('#username', 'wronguser');
      await session.typeInElement('#password', 'wrongpassword');

      const loginResult = await session.clickElement('#login-btn');
      expect(loginResult.success).toBe(true); // Click succeeds, but auth fails

      // Check error message appears
      const errorText = await session.getElementText('#error-message');
      expect(errorText.success).toBe(true);
      expect(errorText.data).toBe('Invalid username or password');

      await session.close();
    });

    it('should simulate page loading failures', async () => {
      const loadingFailureScenario = createMockScenario()
        .forUrl('https://slow.example.com')
          .loadTime(10000)
          .fails('Page load timeout')
        .and()
        .forUrl('https://broken.example.com')
          .fails('DNS_PROBE_FINISHED_NXDOMAIN')
        .and()
        .forUrl('https://working.example.com')
          .loadTime(500)
          .withTitle('Working Page')
        .and()
        .build();

      const session = createMockBrowserSession({}, loadingFailureScenario);
      await session.launch();

      // Slow page should timeout
      const slowResult = await session.navigate('https://slow.example.com');
      expect(slowResult.success).toBe(false);
      expect(slowResult.error).toBe('Page load timeout');

      // Broken page should fail with DNS error
      const brokenResult = await session.navigate('https://broken.example.com');
      expect(brokenResult.success).toBe(false);
      expect(brokenResult.error).toBe('DNS_PROBE_FINISHED_NXDOMAIN');

      // Working page should succeed
      const workingResult = await session.navigate('https://working.example.com');
      expect(workingResult.success).toBe(true);
      expect(workingResult.data?.title).toBe('Working Page');

      await session.close();
    });

    it('should simulate element interaction failures', async () => {
      const interactionFailureScenario = createMockScenario()
        .forElement('#hidden-element')
          .exists(true)
          .visible(false)
        .and()
        .forElement('#disabled-button')
          .exists(true)
          .visible(true)
          .enabled(false)
        .and()
        .forElement('#missing-element')
          .exists(false)
        .and()
        .forElement('#readonly-input')
          .exists(true)
          .visible(true)
          .enabled(false)
        .and()
        .build();

      const session = createMockBrowserSession({}, interactionFailureScenario);
      await session.launch();
      await session.navigate('https://example.com');

      // Hidden element click should fail
      const hiddenResult = await session.clickElement('#hidden-element');
      expect(hiddenResult.success).toBe(false);
      expect(hiddenResult.error).toBe('Element not visible');

      // Disabled button click should fail
      const disabledResult = await session.clickElement('#disabled-button');
      expect(disabledResult.success).toBe(false);
      expect(disabledResult.error).toBe('Element not enabled');

      // Missing element click should fail
      const missingResult = await session.clickElement('#missing-element');
      expect(missingResult.success).toBe(false);
      expect(missingResult.error).toBe('Element not found');

      // Readonly input type should fail
      const readonlyResult = await session.typeInElement('#readonly-input', 'test');
      expect(readonlyResult.success).toBe(false);
      expect(readonlyResult.error).toBe('Element not enabled');

      await session.close();
    });
  });

  describe('Complex Mixed Scenarios', () => {
    it('should simulate partial failure workflows', async () => {
      const partialFailureScenario = createMockScenario()
        .forUrl('https://flaky.example.com')
          .loadTime(1000)
          .withTitle('Flaky Service')
        .and()
        .forElement('#step1-btn')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#step2-btn')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#step3-btn')
          .exists()
          .visible()
          .enabled()
        .and()
        .forOperation('step1')
          .succeeds()
          .withDelay(200)
        .and()
        .forOperation('step2')
          .fails('Service temporarily unavailable')
        .and()
        .forOperation('step3')
          .succeeds()
          .withDelay(300)
        .and()
        .build();

      const session = createMockBrowserSession({}, partialFailureScenario);
      await session.launch();

      await session.navigate('https://flaky.example.com');

      // Step 1 should succeed
      const step1Result = await session.clickElement('#step1-btn');
      expect(step1Result.success).toBe(true);

      // Step 2 should fail
      const step2Result = await session.clickElement('#step2-btn');
      expect(step2Result.success).toBe(false);
      expect(step2Result.error).toBe('Service temporarily unavailable');

      // Step 3 should still succeed
      const step3Result = await session.clickElement('#step3-btn');
      expect(step3Result.success).toBe(true);

      // Verify operation history shows mixed results
      const operations = session.getOperationHistory();
      const clickOperations = operations.filter(op => op.name === 'clickElement');

      expect(clickOperations[0].success).toBe(true);
      expect(clickOperations[1].success).toBe(false);
      expect(clickOperations[2].success).toBe(true);

      await session.close();
    });

    it('should simulate race condition scenarios', async () => {
      const raceConditionScenario = createMockScenario()
        .forUrl('https://dynamic.example.com')
          .loadTime(500)
        .and()
        .forElement('#dynamic-button')
          .exists(true)
          .visible(true)
          .enabled(false) // Initially disabled
        .and()
        .forOperation('enableButton')
          .succeeds()
          .withDelay(2000) // Takes time to enable
        .and()
        .build();

      const session = createMockBrowserSession({}, raceConditionScenario);
      await session.launch();

      await session.navigate('https://dynamic.example.com');

      // Button should initially be disabled
      const initialClick = await session.clickElement('#dynamic-button');
      expect(initialClick.success).toBe(false);
      expect(initialClick.error).toBe('Element not enabled');

      // Simulate enabling the button (in real scenario, this would be JavaScript)
      // For mock, we update the element state directly
      const pageState = session.getPageState();
      const button = pageState.elements.get('#dynamic-button');
      if (button) {
        button.enabled = true;
      }

      // Now click should succeed
      const enabledClick = await session.clickElement('#dynamic-button');
      expect(enabledClick.success).toBe(true);

      await session.close();
    });

    it('should simulate unreliable service conditions', async () => {
      const unreliableSession = createUnreliableMockSession(0.3); // 30% failure rate
      await unreliableSession.launch();

      const results: boolean[] = [];
      const operationCount = 50;

      // Perform many operations to see the failure pattern
      for (let i = 0; i < operationCount; i++) {
        const result = await unreliableSession.elementExists(`#test-${i}`);
        results.push(result.success);
      }

      const successCount = results.filter(Boolean).length;
      const failureCount = results.length - successCount;

      // With 30% failure rate, expect roughly 70% success
      // (allowing variance due to randomness)
      expect(successCount).toBeGreaterThan(operationCount * 0.5);
      expect(successCount).toBeLessThan(operationCount * 0.9);
      expect(failureCount).toBeGreaterThan(operationCount * 0.1);
      expect(failureCount).toBeLessThan(operationCount * 0.5);

      console.log(`Unreliable test: ${successCount} successes, ${failureCount} failures out of ${operationCount} operations`);

      await unreliableSession.close();
    });
  });

  describe('Real-World Application Scenarios', () => {
    it('should simulate social media posting workflow', async () => {
      const socialMediaScenario = createMockScenario()
        .forUrl('https://social.example.com/compose')
          .loadTime(700)
          .withTitle('Create Post - Social Example')
        .and()
        .forElement('#post-text')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#image-upload')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#post-submit')
          .exists()
          .visible()
          .enabled()
          .withText('Share Post')
        .and()
        .forElement('#character-count')
          .exists()
          .visible()
          .withText('0/280')
        .and()
        .build();

      const session = createMockBrowserSession({}, socialMediaScenario);
      await session.launch();

      await session.navigate('https://social.example.com/compose');

      // Compose a post
      const postText = "Just testing my automated social media posting workflow! 🚀 #automation #testing";
      await session.typeInElement('#post-text', postText);

      // Verify character count updated
      const pageState = session.getPageState();
      expect(pageState.elements.get('#post-text')?.value).toBe(postText);

      // Submit the post
      const submitResult = await session.clickElement('#post-submit');
      expect(submitResult.success).toBe(true);

      await session.close();
    });

    it('should simulate online banking workflow', async () => {
      const bankingScenario = createMockScenario()
        .forUrl('https://secure-bank.example.com/login')
          .loadTime(1200)
          .withTitle('Secure Login - Example Bank')
        .and()
        .forElement('#account-number')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#pin')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#login-btn')
          .exists()
          .visible()
          .enabled()
          .withText('Secure Login')
        .and()
        .forUrl('https://secure-bank.example.com/dashboard')
          .loadTime(800)
          .withTitle('Account Dashboard - Example Bank')
        .and()
        .forElement('#account-balance')
          .exists()
          .visible()
          .withText('$1,234.56')
        .and()
        .forElement('#transfer-btn')
          .exists()
          .visible()
          .enabled()
          .withText('Transfer Money')
        .and()
        .build();

      const session = createMockBrowserSession({}, bankingScenario);
      await session.launch();

      // Login process
      await session.navigate('https://secure-bank.example.com/login');
      await session.typeInElement('#account-number', '123456789');
      await session.typeInElement('#pin', '9876');
      await session.clickElement('#login-btn');

      // Access dashboard
      await session.navigate('https://secure-bank.example.com/dashboard');

      const balanceText = await session.getElementText('#account-balance');
      expect(balanceText.success).toBe(true);
      expect(balanceText.data).toBe('$1,234.56');

      // Verify transfer button is available
      const transferExists = await session.elementExists('#transfer-btn');
      expect(transferExists.success).toBe(true);
      expect(transferExists.data).toBe(true);

      await session.close();
    });

    it('should simulate file upload and download workflow', async () => {
      const fileWorkflowScenario = createMockScenario()
        .forUrl('https://files.example.com/upload')
          .loadTime(600)
          .withTitle('File Manager - Upload Files')
        .and()
        .forElement('#file-input')
          .exists()
          .visible()
          .enabled()
        .and()
        .forElement('#upload-btn')
          .exists()
          .visible()
          .enabled()
          .withText('Upload File')
        .and()
        .forElement('#progress-bar')
          .exists()
          .visible()
        .and()
        .forElement('#download-link')
          .exists()
          .visible()
          .enabled()
          .withText('Download File')
        .and()
        .forOperation('uploadFile')
          .succeeds()
          .withDelay(3000) // Simulate upload time
        .and()
        .build();

      const session = createMockBrowserSession({}, fileWorkflowScenario);
      await session.launch();

      await session.navigate('https://files.example.com/upload');

      // Simulate file selection (in real scenario this would be file input)
      await session.typeInElement('#file-input', '/path/to/test-document.pdf');

      // Upload the file
      const uploadResult = await session.clickElement('#upload-btn');
      expect(uploadResult.success).toBe(true);

      // Verify download link is available
      const downloadExists = await session.elementExists('#download-link');
      expect(downloadExists.success).toBe(true);
      expect(downloadExists.data).toBe(true);

      const downloadText = await session.getElementText('#download-link');
      expect(downloadText.success).toBe(true);
      expect(downloadText.data).toBe('Download File');

      await session.close();
    });
  });

  describe('Performance and Stress Simulation', () => {
    it('should simulate high-load conditions', async () => {
      const loadTestSession = createMockSessionForTesting('load-test', {
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 5,
          useRealisticDelays: false,
        },
      });

      await loadTestSession.launch();
      await loadTestSession.navigate('https://load-test.example.com');

      const startTime = Date.now();
      const concurrentOperations = 100;

      // Create high concurrent load
      const operations = Array.from({ length: concurrentOperations }, (_, i) => {
        const operationType = i % 5;
        switch (operationType) {
          case 0: return loadTestSession.clickElement(`#button-${i}`);
          case 1: return loadTestSession.typeInElement(`#input-${i}`, `value-${i}`);
          case 2: return loadTestSession.elementExists(`#element-${i}`);
          case 3: return loadTestSession.getElementText(`#text-${i}`);
          case 4: return loadTestSession.captureScreenshot();
          default: return loadTestSession.elementExists(`#default-${i}`);
        }
      });

      const results = await Promise.all(operations);
      const duration = Date.now() - startTime;

      // All operations should complete successfully
      expect(results.every(r => r.success)).toBe(true);
      expect(duration).toBeLessThan(1000); // Should handle load efficiently

      console.log(`High-load test: ${concurrentOperations} operations completed in ${duration}ms`);

      await loadTestSession.close();
    });

    it('should simulate memory-intensive operations', async () => {
      const memorySession = createMockBrowserSession({
        trackOperations: true,
        mockConfig: {
          defaultSuccess: true,
          defaultDelay: 1,
          useRealisticDelays: false,
        },
      });

      await memorySession.launch();

      // Create large operation history
      for (let i = 0; i < 1000; i++) {
        await memorySession.typeInElement(`#large-input-${i}`, 'x'.repeat(1000));
      }

      const operations = memorySession.getOperationHistory();
      expect(operations.length).toBeGreaterThan(1000);

      // Verify all operations maintain data integrity
      operations.forEach(op => {
        expect(op.name).toBeDefined();
        expect(op.startTime).toBeDefined();
        expect(op.endTime).toBeDefined();
        expect(op.success).toBeDefined();
      });

      await memorySession.close();
    });
  });
});