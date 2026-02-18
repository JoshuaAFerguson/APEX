/**
 * @apexcli/browser - Multi-Page Browser Workflows Integration Tests
 *
 * Comprehensive integration tests covering multi-page browser workflows including:
 * - Multi-step navigation flows
 * - State persistence across pages
 * - Handling redirects (301/302)
 * - Back/forward navigation
 * - Complex user journey simulations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createBrowserManager,
  createBrowserSession,
  BrowserManager,
  BrowserSession,
} from '../index.js';

describe('Multi-Page Browser Workflows Integration Tests', () => {
  let manager: BrowserManager;
  let session: BrowserSession;

  beforeEach(async () => {
    manager = createBrowserManager({
      maxInstances: 2,
      reuseInstances: false,
    });

    session = createBrowserSession(manager, {
      browserType: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 },
    });

    const launchResult = await session.launch();
    expect(launchResult.success).toBe(true);
  });

  afterEach(async () => {
    if (session) {
      await session.close();
    }
    if (manager) {
      await manager.shutdown();
    }
  });

  describe('Multi-Step Navigation Flows', () => {
    it('should handle linear multi-step navigation workflow', async () => {
      // Step 1: Landing page
      const landingHtml = `
        <html>
        <head><title>Landing Page</title></head>
        <body>
          <h1>Welcome</h1>
          <a href="data:text/html,${encodeURIComponent('<html><head><title>Step 2</title></head><body><h1>Step 2</h1><a href="#" onclick="window.location.href=\'data:text/html,${encodeURIComponent('<html><head><title>Step 3</title></head><body><h1>Step 3 - Complete</h1><div id="completion">Workflow Complete</div></body></html>')}\'; return false;" id="next-btn">Next</a></body></html>')}" id="step2-link">Go to Step 2</a>
        </body>
        </html>
      `;

      let result = await session.navigate(`data:text/html,${encodeURIComponent(landingHtml)}`);
      expect(result.success).toBe(true);

      // Verify initial page
      let titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Landing Page');

      let textResult = await session.getText('h1');
      expect(textResult.data).toBe('Welcome');

      // Step 2: Navigate to second page
      const clickResult = await session.click('#step2-link');
      expect(clickResult.success).toBe(true);

      // Wait for navigation
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Step 2');

      textResult = await session.getText('h1');
      expect(textResult.data).toBe('Step 2');

      // Step 3: Navigate to final page
      const nextBtnClick = await session.click('#next-btn');
      expect(nextBtnClick.success).toBe(true);

      // Wait for navigation
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Step 3 - Complete');

      const completionText = await session.getText('#completion');
      expect(completionText.data).toBe('Workflow Complete');
    }, 15000);

    it('should handle branching navigation flows', async () => {
      const branchingHtml = `
        <html>
        <head><title>Branching Hub</title></head>
        <body>
          <h1>Choose Your Path</h1>
          <div>
            <a href="data:text/html,${encodeURIComponent('<html><head><title>Path A</title></head><body><h1>Path A Selected</h1><div id="path-result">You chose path A</div></body></html>')}" id="path-a">Path A</a>
            <a href="data:text/html,${encodeURIComponent('<html><head><title>Path B</title></head><body><h1>Path B Selected</h1><div id="path-result">You chose path B</div></body></html>')}" id="path-b">Path B</a>
          </div>
        </body>
        </html>
      `;

      // Navigate to branching page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(branchingHtml)}`);
      expect(result.success).toBe(true);

      // Test Path A
      let clickResult = await session.click('#path-a');
      expect(clickResult.success).toBe(true);

      await session.waitForNavigation();

      let titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Path A');

      let pathResult = await session.getText('#path-result');
      expect(pathResult.data).toBe('You chose path A');

      // Go back and test Path B
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Branching Hub');

      clickResult = await session.click('#path-b');
      expect(clickResult.success).toBe(true);

      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Path B');

      pathResult = await session.getText('#path-result');
      expect(pathResult.data).toBe('You chose path B');
    }, 15000);

    it('should handle form-based navigation workflows', async () => {
      const formHtml = `
        <html>
        <head><title>Registration Form</title></head>
        <body>
          <h1>Register</h1>
          <form id="reg-form" onsubmit="handleSubmit(event)">
            <input type="text" id="username" name="username" placeholder="Username" required>
            <input type="email" id="email" name="email" placeholder="Email" required>
            <button type="submit" id="submit-btn">Register</button>
          </form>
          <script>
            function handleSubmit(event) {
              event.preventDefault();
              const username = document.getElementById('username').value;
              const email = document.getElementById('email').value;
              window.location.href = 'data:text/html,' + encodeURIComponent(
                '<html><head><title>Registration Success</title></head><body>' +
                '<h1>Welcome, ' + username + '!</h1>' +
                '<p id="email-display">Email: ' + email + '</p>' +
                '<div id="success-msg">Registration completed successfully</div>' +
                '</body></html>'
              );
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to form page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(formHtml)}`);
      expect(result.success).toBe(true);

      // Fill out form
      await session.type('#username', 'testuser');
      await session.type('#email', 'test@example.com');

      // Submit form
      const submitResult = await session.click('#submit-btn');
      expect(submitResult.success).toBe(true);

      // Wait for navigation to success page
      await session.waitForNavigation();

      const titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Registration Success');

      const welcomeText = await session.getText('h1');
      expect(welcomeText.data).toBe('Welcome, testuser!');

      const emailText = await session.getText('#email-display');
      expect(emailText.data).toBe('Email: test@example.com');

      const successMsg = await session.getText('#success-msg');
      expect(successMsg.data).toBe('Registration completed successfully');
    }, 15000);
  });

  describe('State Persistence Across Pages', () => {
    it('should maintain localStorage across page navigations', async () => {
      const page1Html = `
        <html>
        <head><title>Page 1 - Set Data</title></head>
        <body>
          <h1>Page 1</h1>
          <button id="set-data" onclick="setData()">Set Data</button>
          <a href="data:text/html,${encodeURIComponent('<html><head><title>Page 2 - Read Data</title></head><body><h1>Page 2</h1><div id="stored-data"></div><script>document.getElementById(\'stored-data\').textContent = localStorage.getItem(\'testData\') || \'No data found\';</script></body></html>')}" id="next-page">Go to Page 2</a>
          <script>
            function setData() {
              localStorage.setItem('testData', 'Persistent data across pages');
              document.getElementById('set-data').textContent = 'Data Set!';
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to page 1
      let result = await session.navigate(`data:text/html,${encodeURIComponent(page1Html)}`);
      expect(result.success).toBe(true);

      // Set data in localStorage
      const setDataResult = await session.click('#set-data');
      expect(setDataResult.success).toBe(true);

      // Verify data was set
      const buttonText = await session.getText('#set-data');
      expect(buttonText.data).toBe('Data Set!');

      // Navigate to page 2
      const navResult = await session.click('#next-page');
      expect(navResult.success).toBe(true);

      await session.waitForNavigation();

      // Verify data persists
      const titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Page 2 - Read Data');

      const storedDataText = await session.getText('#stored-data');
      expect(storedDataText.data).toBe('Persistent data across pages');
    }, 15000);

    it('should maintain sessionStorage across same-tab navigation', async () => {
      const page1Html = `
        <html>
        <head><title>Session Storage Page 1</title></head>
        <body>
          <h1>Session Storage Test</h1>
          <input type="text" id="session-input" placeholder="Enter data">
          <button id="store-session" onclick="storeSessionData()">Store in Session</button>
          <a href="data:text/html,${encodeURIComponent('<html><head><title>Session Storage Page 2</title></head><body><h1>Session Data Check</h1><div id="session-result"></div><script>document.getElementById(\'session-result\').textContent = sessionStorage.getItem(\'sessionTest\') || \'No session data\';</script></body></html>')}" id="check-session">Check Session Data</a>
          <script>
            function storeSessionData() {
              const value = document.getElementById('session-input').value;
              sessionStorage.setItem('sessionTest', value);
              document.getElementById('store-session').textContent = 'Stored!';
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to session storage page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(page1Html)}`);
      expect(result.success).toBe(true);

      // Enter and store session data
      await session.type('#session-input', 'Session persistent data');

      const storeResult = await session.click('#store-session');
      expect(storeResult.success).toBe(true);

      const buttonText = await session.getText('#store-session');
      expect(buttonText.data).toBe('Stored!');

      // Navigate to check page
      const checkResult = await session.click('#check-session');
      expect(checkResult.success).toBe(true);

      await session.waitForNavigation();

      // Verify session data persists
      const sessionResult = await session.getText('#session-result');
      expect(sessionResult.data).toBe('Session persistent data');
    }, 15000);

    it('should handle cookies across page navigations', async () => {
      const cookiePage1Html = `
        <html>
        <head><title>Cookie Page 1</title></head>
        <body>
          <h1>Set Cookie</h1>
          <button id="set-cookie" onclick="setCookie()">Set Cookie</button>
          <a href="data:text/html,${encodeURIComponent('<html><head><title>Cookie Page 2</title></head><body><h1>Read Cookie</h1><div id="cookie-value"></div><script>document.getElementById(\'cookie-value\').textContent = document.cookie || \'No cookies\';</script></body></html>')}" id="read-cookie">Read Cookie</a>
          <script>
            function setCookie() {
              document.cookie = 'testCookie=CookieValuePersists; path=/';
              document.getElementById('set-cookie').textContent = 'Cookie Set!';
            }
          </script>
        </body>
        </html>
      `;

      // Navigate and set cookie
      let result = await session.navigate(`data:text/html,${encodeURIComponent(cookiePage1Html)}`);
      expect(result.success).toBe(true);

      const setCookieResult = await session.click('#set-cookie');
      expect(setCookieResult.success).toBe(true);

      // Navigate to read cookie page
      const readResult = await session.click('#read-cookie');
      expect(readResult.success).toBe(true);

      await session.waitForNavigation();

      // Verify cookie persists
      const cookieValue = await session.getText('#cookie-value');
      expect(cookieValue.data).toContain('testCookie=CookieValuePersists');
    }, 15000);
  });

  describe('Redirect Handling (301/302)', () => {
    it('should handle 301 permanent redirects properly', async () => {
      // Create pages that simulate redirects using JavaScript
      const redirectSourceHtml = `
        <html>
        <head><title>Redirect Source</title></head>
        <body>
          <h1>Redirecting...</h1>
          <script>
            // Simulate 301 redirect behavior
            setTimeout(() => {
              window.location.replace('data:text/html,' + encodeURIComponent(
                '<html><head><title>Redirect Destination</title></head><body><h1>301 Redirect Success</h1><div id="redirect-type">Permanent Redirect</div></body></html>'
              ));
            }, 100);
          </script>
        </body>
        </html>
      `;

      const result = await session.navigate(`data:text/html,${encodeURIComponent(redirectSourceHtml)}`);
      expect(result.success).toBe(true);

      // Wait for redirect to complete
      await session.waitForNavigation({ timeout: 5000 });

      const titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Redirect Destination');

      const redirectTypeText = await session.getText('#redirect-type');
      expect(redirectTypeText.data).toBe('Permanent Redirect');
    }, 10000);

    it('should handle 302 temporary redirects properly', async () => {
      const redirectTempHtml = `
        <html>
        <head><title>Temp Redirect Source</title></head>
        <body>
          <h1>Temporary Redirecting...</h1>
          <script>
            // Simulate 302 redirect behavior
            setTimeout(() => {
              window.location.href = 'data:text/html,' + encodeURIComponent(
                '<html><head><title>Temporary Destination</title></head><body><h1>302 Redirect Success</h1><div id="redirect-type">Temporary Redirect</div></body></html>'
              );
            }, 100);
          </script>
        </body>
        </html>
      `;

      const result = await session.navigate(`data:text/html,${encodeURIComponent(redirectTempHtml)}`);
      expect(result.success).toBe(true);

      // Wait for redirect
      await session.waitForNavigation({ timeout: 5000 });

      const titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Temporary Destination');

      const redirectTypeText = await session.getText('#redirect-type');
      expect(redirectTypeText.data).toBe('Temporary Redirect');
    }, 10000);

    it('should handle redirect chains', async () => {
      const redirect1Html = `
        <html>
        <head><title>Redirect 1</title></head>
        <body>
          <h1>First Redirect</h1>
          <script>
            setTimeout(() => {
              window.location.href = 'data:text/html,' + encodeURIComponent(
                '<html><head><title>Redirect 2</title></head><body><h1>Second Redirect</h1><script>setTimeout(() => { window.location.href = "data:text/html," + encodeURIComponent("<html><head><title>Final Destination</title></head><body><h1>Chain Complete</h1><div id=\\"chain-result\\">Redirect chain completed</div></body></html>"); }, 100);</script></body></html>'
              );
            }, 100);
          </script>
        </body>
        </html>
      `;

      const result = await session.navigate(`data:text/html,${encodeURIComponent(redirect1Html)}`);
      expect(result.success).toBe(true);

      // Wait for first redirect
      await session.waitForNavigation({ timeout: 3000 });

      // Wait for second redirect
      await session.waitForNavigation({ timeout: 3000 });

      const titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Final Destination');

      const chainResult = await session.getText('#chain-result');
      expect(chainResult.data).toBe('Redirect chain completed');
    }, 15000);
  });

  describe('Back/Forward Navigation', () => {
    it('should handle browser back/forward navigation correctly', async () => {
      // Create a sequence of pages for navigation testing
      const page1Html = `
        <html>
        <head><title>Navigation Page 1</title></head>
        <body>
          <h1>Page 1</h1>
          <a href="data:text/html,${encodeURIComponent('<html><head><title>Navigation Page 2</title></head><body><h1>Page 2</h1><a href="data:text/html,' + encodeURIComponent('<html><head><title>Navigation Page 3</title></head><body><h1>Page 3</h1><div id="page-num">3</div></body></html>') + '" id="page3-link">Go to Page 3</a><div id="page-num">2</div></body></html>')}" id="page2-link">Go to Page 2</a>
          <div id="page-num">1</div>
        </body>
        </html>
      `;

      // Navigate to first page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(page1Html)}`);
      expect(result.success).toBe(true);

      let pageNum = await session.getText('#page-num');
      expect(pageNum.data).toBe('1');

      // Navigate to page 2
      await session.click('#page2-link');
      await session.waitForNavigation();

      let titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Navigation Page 2');

      pageNum = await session.getText('#page-num');
      expect(pageNum.data).toBe('2');

      // Navigate to page 3
      await session.click('#page3-link');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Navigation Page 3');

      pageNum = await session.getText('#page-num');
      expect(pageNum.data).toBe('3');

      // Test back navigation
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Navigation Page 2');

      pageNum = await session.getText('#page-num');
      expect(pageNum.data).toBe('2');

      // Test forward navigation
      const forwardResult = await session.goForward();
      expect(forwardResult.success).toBe(true);

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Navigation Page 3');

      pageNum = await session.getText('#page-num');
      expect(pageNum.data).toBe('3');

      // Test multiple back navigations
      await session.goBack();
      await session.goBack();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Navigation Page 1');

      pageNum = await session.getText('#page-num');
      expect(pageNum.data).toBe('1');
    }, 20000);

    it('should preserve page state during back/forward navigation', async () => {
      const statePage1Html = `
        <html>
        <head><title>State Page 1</title></head>
        <body>
          <h1>Page 1 - Form State</h1>
          <input type="text" id="user-input" placeholder="Enter text">
          <div id="display"></div>
          <a href="data:text/html,${encodeURIComponent('<html><head><title>State Page 2</title></head><body><h1>Page 2</h1><div>Temporary page</div><a href="#" onclick="history.back(); return false;" id="back-link">Go Back</a></body></html>')}" id="next-page">Go to Page 2</a>
          <script>
            document.getElementById('user-input').addEventListener('input', function() {
              document.getElementById('display').textContent = 'You typed: ' + this.value;
            });
          </script>
        </body>
        </html>
      `;

      // Navigate to state page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(statePage1Html)}`);
      expect(result.success).toBe(true);

      // Enter text in form
      await session.type('#user-input', 'Test state preservation');

      const displayText = await session.getText('#display');
      expect(displayText.data).toBe('You typed: Test state preservation');

      // Navigate away
      await session.click('#next-page');
      await session.waitForNavigation();

      let titleResult = await session.getTitle();
      expect(titleResult.data).toBe('State Page 2');

      // Navigate back
      const backResult = await session.goBack();
      expect(backResult.success).toBe(true);

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('State Page 1');

      // Verify state is preserved
      const inputValue = await session.evaluate(() =>
        (document.getElementById('user-input') as HTMLInputElement)?.value
      );
      expect(inputValue.data).toBe('Test state preservation');

      const preservedDisplay = await session.getText('#display');
      expect(preservedDisplay.data).toBe('You typed: Test state preservation');
    }, 15000);
  });

  describe('Complex User Journey Simulations', () => {
    it('should handle complete e-commerce-like user journey', async () => {
      // Simulate a multi-page e-commerce flow
      const homepageHtml = `
        <html>
        <head><title>E-commerce Home</title></head>
        <body>
          <h1>Online Store</h1>
          <div class="products">
            <div class="product" data-id="1">
              <h3>Product A</h3>
              <button onclick="addToCart(1)" class="add-to-cart">Add to Cart</button>
            </div>
            <div class="product" data-id="2">
              <h3>Product B</h3>
              <button onclick="addToCart(2)" class="add-to-cart">Add to Cart</button>
            </div>
          </div>
          <a href="data:text/html,${encodeURIComponent('<html><head><title>Shopping Cart</title></head><body><h1>Shopping Cart</h1><div id="cart-items"></div><button id="checkout-btn" onclick="goToCheckout()">Proceed to Checkout</button><script>const cart = JSON.parse(localStorage.getItem("cart") || "[]"); document.getElementById("cart-items").innerHTML = cart.length ? cart.map(item => `<div>Product ${item}</div>`).join("") : "Empty cart"; function goToCheckout() { window.location.href = "data:text/html," + encodeURIComponent("<html><head><title>Checkout</title></head><body><h1>Checkout</h1><div id=\\"order-summary\\"></div><button id=\\"complete-order\\">Complete Order</button><script>const orderCart = JSON.parse(localStorage.getItem(\\"cart\\") || \\"[]\\"); document.getElementById(\\"order-summary\\").textContent = `Order: ${orderCart.length} items`; document.getElementById(\\"complete-order\\").onclick = () => { localStorage.setItem(\\"orderComplete\\", \\"true\\"); window.location.href = \\"data:text/html,\\" + encodeURIComponent(\\"<html><head><title>Order Complete</title></head><body><h1>Thank You!</h1><div id=\\\\\\"success-message\\\\\\">Your order has been completed</div></body></html>\\"); };</script></body></html>"); }</script></body></html>')}" id="cart-link">View Cart (<span id="cart-count">0</span>)</a>
          <script>
            let cart = JSON.parse(localStorage.getItem('cart') || '[]');

            function addToCart(productId) {
              cart.push(productId);
              localStorage.setItem('cart', JSON.stringify(cart));
              updateCartCount();
              event.target.textContent = 'Added!';
            }

            function updateCartCount() {
              document.getElementById('cart-count').textContent = cart.length;
            }

            updateCartCount();
          </script>
        </body>
        </html>
      `;

      // Start journey on homepage
      let result = await session.navigate(`data:text/html,${encodeURIComponent(homepageHtml)}`);
      expect(result.success).toBe(true);

      let titleResult = await session.getTitle();
      expect(titleResult.data).toBe('E-commerce Home');

      // Add products to cart
      const addButtons = await session.evaluate(() =>
        Array.from(document.querySelectorAll('.add-to-cart')).length
      );
      expect(addButtons.data).toBe(2);

      // Add first product
      await session.click('[data-id="1"] .add-to-cart');

      // Wait and verify cart count updated
      await new Promise(resolve => setTimeout(resolve, 100));
      let cartCount = await session.getText('#cart-count');
      expect(cartCount.data).toBe('1');

      // Add second product
      await session.click('[data-id="2"] .add-to-cart');

      await new Promise(resolve => setTimeout(resolve, 100));
      cartCount = await session.getText('#cart-count');
      expect(cartCount.data).toBe('2');

      // Navigate to cart
      await session.click('#cart-link');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Shopping Cart');

      // Verify cart contents
      const cartItems = await session.getText('#cart-items');
      expect(cartItems.data).toContain('Product 1');
      expect(cartItems.data).toContain('Product 2');

      // Proceed to checkout
      await session.click('#checkout-btn');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Checkout');

      const orderSummary = await session.getText('#order-summary');
      expect(orderSummary.data).toBe('Order: 2 items');

      // Complete order
      await session.click('#complete-order');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Order Complete');

      const successMessage = await session.getText('#success-message');
      expect(successMessage.data).toBe('Your order has been completed');
    }, 25000);

    it('should handle user authentication flow journey', async () => {
      const loginPageHtml = `
        <html>
        <head><title>Login Page</title></head>
        <body>
          <h1>Login</h1>
          <form id="login-form" onsubmit="handleLogin(event)">
            <input type="text" id="username" placeholder="Username" required>
            <input type="password" id="password" placeholder="Password" required>
            <button type="submit" id="login-btn">Login</button>
          </form>
          <div id="error-msg" style="color: red; display: none;"></div>
          <script>
            function handleLogin(event) {
              event.preventDefault();
              const username = document.getElementById('username').value;
              const password = document.getElementById('password').value;

              // Simple validation
              if (username === 'testuser' && password === 'testpass') {
                localStorage.setItem('loggedIn', 'true');
                localStorage.setItem('username', username);

                window.location.href = 'data:text/html,' + encodeURIComponent(
                  '<html><head><title>Dashboard</title></head><body>' +
                  '<h1>Welcome to Dashboard</h1>' +
                  '<div id="welcome-user">Welcome, ' + username + '!</div>' +
                  '<nav>' +
                    '<a href="data:text/html,' + encodeURIComponent('<html><head><title>Profile</title></head><body><h1>User Profile</h1><div id="profile-name"></div><script>document.getElementById("profile-name").textContent = "Profile: " + localStorage.getItem("username");</script></body></html>') + '" id="profile-link">Profile</a>' +
                    '<button onclick="logout()" id="logout-btn">Logout</button>' +
                  '</nav>' +
                  '<script>' +
                    'function logout() {' +
                      'localStorage.removeItem("loggedIn");' +
                      'localStorage.removeItem("username");' +
                      'window.location.href = "data:text/html," + encodeURIComponent("<html><head><title>Logged Out</title></head><body><h1>Logged Out</h1><div id=\\"logout-message\\">You have been logged out successfully</div></body></html>");' +
                    '}' +
                  '</script>' +
                  '</body></html>'
                );
              } else {
                document.getElementById('error-msg').textContent = 'Invalid credentials';
                document.getElementById('error-msg').style.display = 'block';
              }
            }
          </script>
        </body>
        </html>
      `;

      // Start at login page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(loginPageHtml)}`);
      expect(result.success).toBe(true);

      let titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Login Page');

      // Test invalid login first
      await session.type('#username', 'wronguser');
      await session.type('#password', 'wrongpass');
      await session.click('#login-btn');

      await new Promise(resolve => setTimeout(resolve, 100));
      const errorMsg = await session.getText('#error-msg');
      expect(errorMsg.data).toBe('Invalid credentials');

      // Clear fields and try valid login
      await session.evaluate(() => {
        (document.getElementById('username') as HTMLInputElement).value = '';
        (document.getElementById('password') as HTMLInputElement).value = '';
      });

      await session.type('#username', 'testuser');
      await session.type('#password', 'testpass');
      await session.click('#login-btn');

      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Dashboard');

      const welcomeUser = await session.getText('#welcome-user');
      expect(welcomeUser.data).toBe('Welcome, testuser!');

      // Navigate to profile
      await session.click('#profile-link');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Profile');

      const profileName = await session.getText('#profile-name');
      expect(profileName.data).toBe('Profile: testuser');

      // Navigate back to dashboard
      await session.goBack();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Dashboard');

      // Test logout
      await session.click('#logout-btn');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Logged Out');

      const logoutMessage = await session.getText('#logout-message');
      expect(logoutMessage.data).toBe('You have been logged out successfully');
    }, 25000);

    it('should handle complex form wizard journey', async () => {
      const wizardStep1Html = `
        <html>
        <head><title>Wizard Step 1</title></head>
        <body>
          <h1>Step 1: Personal Information</h1>
          <form id="step1-form" onsubmit="proceedToStep2(event)">
            <input type="text" id="firstname" placeholder="First Name" required>
            <input type="text" id="lastname" placeholder="Last Name" required>
            <input type="date" id="birthdate" required>
            <button type="submit" id="next-step1">Next: Contact Info</button>
          </form>
          <script>
            function proceedToStep2(event) {
              event.preventDefault();
              const data = {
                firstname: document.getElementById('firstname').value,
                lastname: document.getElementById('lastname').value,
                birthdate: document.getElementById('birthdate').value
              };
              localStorage.setItem('wizardStep1', JSON.stringify(data));

              window.location.href = 'data:text/html,' + encodeURIComponent(
                '<html><head><title>Wizard Step 2</title></head><body>' +
                '<h1>Step 2: Contact Information</h1>' +
                '<form id="step2-form" onsubmit="proceedToStep3(event)">' +
                  '<input type="email" id="email" placeholder="Email" required>' +
                  '<input type="tel" id="phone" placeholder="Phone" required>' +
                  '<input type="text" id="address" placeholder="Address" required>' +
                  '<button type="button" onclick="goBackToStep1()" id="back-step1">Back</button>' +
                  '<button type="submit" id="next-step2">Next: Review</button>' +
                '</form>' +
                '<script>' +
                  'function goBackToStep1() { history.back(); }' +
                  'function proceedToStep3(event) {' +
                    'event.preventDefault();' +
                    'const data = {' +
                      'email: document.getElementById("email").value,' +
                      'phone: document.getElementById("phone").value,' +
                      'address: document.getElementById("address").value' +
                    '};' +
                    'localStorage.setItem("wizardStep2", JSON.stringify(data));' +
                    'window.location.href = "data:text/html," + encodeURIComponent(' +
                      '"<html><head><title>Wizard Step 3</title></head><body>" +' +
                      '"<h1>Step 3: Review & Submit</h1>" +' +
                      '"<div id=\\"review-data\\"></div>" +' +
                      '"<button onclick=\\"submitWizard()\\" id=\\"submit-wizard\\">Submit</button>" +' +
                      '"<script>" +' +
                        '"const step1Data = JSON.parse(localStorage.getItem(\\"wizardStep1\\") || \\"{}\\");" +' +
                        '"const step2Data = JSON.parse(localStorage.getItem(\\"wizardStep2\\") || \\"{}\\");" +' +
                        '"document.getElementById(\\"review-data\\").innerHTML = \\"<h3>Review:</h3><p>Name: \\" + step1Data.firstname + \\" \\" + step1Data.lastname + \\"</p><p>Email: \\" + step2Data.email + \\"</p><p>Phone: \\" + step2Data.phone + \\"</p>\\";" +' +
                        '"function submitWizard() {" +' +
                          '"localStorage.setItem(\\"wizardCompleted\\", \\"true\\");" +' +
                          '"window.location.href = \\"data:text/html,\\" + encodeURIComponent(\\"<html><head><title>Wizard Complete</title></head><body><h1>Wizard Completed!</h1><div id=\\\\\\"completion-message\\\\\\">Your information has been submitted successfully</div></body></html>\\");" +' +
                        '}" +' +
                      '"</script></body></html>"' +
                    ');' +
                  '}' +
                '</script></body></html>'
              );
            }
          </script>
        </body>
        </html>
      `;

      // Start wizard
      let result = await session.navigate(`data:text/html,${encodeURIComponent(wizardStep1Html)}`);
      expect(result.success).toBe(true);

      let titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Wizard Step 1');

      // Fill step 1
      await session.type('#firstname', 'John');
      await session.type('#lastname', 'Doe');
      await session.type('#birthdate', '1990-01-01');

      await session.click('#next-step1');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Wizard Step 2');

      // Fill step 2
      await session.type('#email', 'john.doe@example.com');
      await session.type('#phone', '555-0123');
      await session.type('#address', '123 Main St');

      // Test back navigation
      await session.click('#back-step1');

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Wizard Step 1');

      // Verify data persisted
      const firstnameValue = await session.evaluate(() =>
        (document.getElementById('firstname') as HTMLInputElement)?.value
      );
      expect(firstnameValue.data).toBe('John');

      // Go forward again
      await session.goForward();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Wizard Step 2');

      // Continue to step 3
      await session.click('#next-step2');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Wizard Step 3');

      // Verify review data
      const reviewData = await session.getText('#review-data');
      expect(reviewData.data).toContain('Name: John Doe');
      expect(reviewData.data).toContain('Email: john.doe@example.com');
      expect(reviewData.data).toContain('Phone: 555-0123');

      // Submit wizard
      await session.click('#submit-wizard');
      await session.waitForNavigation();

      titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Wizard Complete');

      const completionMessage = await session.getText('#completion-message');
      expect(completionMessage.data).toBe('Your information has been submitted successfully');
    }, 30000);
  });

  describe('Error Handling in Multi-Page Workflows', () => {
    it('should gracefully handle navigation errors in complex workflows', async () => {
      const errorPageHtml = `
        <html>
        <head><title>Error Test Page</title></head>
        <body>
          <h1>Navigation Error Test</h1>
          <button id="broken-link" onclick="navigateToBrokenPage()">Broken Link</button>
          <button id="working-link" onclick="navigateToWorkingPage()">Working Link</button>
          <script>
            function navigateToBrokenPage() {
              // This will fail
              window.location.href = 'invalid://broken.url';
            }

            function navigateToWorkingPage() {
              window.location.href = 'data:text/html,' + encodeURIComponent(
                '<html><head><title>Working Page</title></head><body><h1>Navigation Success</h1><div id="success-indicator">Page loaded successfully</div></body></html>'
              );
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to error test page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(errorPageHtml)}`);
      expect(result.success).toBe(true);

      // Try broken navigation - should remain on same page
      await session.click('#broken-link');

      // Wait a bit and verify we're still on the same page
      await new Promise(resolve => setTimeout(resolve, 1000));

      const titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Error Test Page');

      // Try working navigation
      await session.click('#working-link');
      await session.waitForNavigation();

      const newTitleResult = await session.getTitle();
      expect(newTitleResult.data).toBe('Working Page');

      const successIndicator = await session.getText('#success-indicator');
      expect(successIndicator.data).toBe('Page loaded successfully');
    }, 15000);

    it('should handle timeout scenarios in navigation flows', async () => {
      const slowPageHtml = `
        <html>
        <head><title>Slow Loading Test</title></head>
        <body>
          <h1>Slow Loading Simulation</h1>
          <button id="slow-navigate" onclick="navigateSlowly()">Navigate with Delay</button>
          <script>
            function navigateSlowly() {
              // Simulate slow loading
              setTimeout(() => {
                window.location.href = 'data:text/html,' + encodeURIComponent(
                  '<html><head><title>Finally Loaded</title></head><body><h1>Slow Page Loaded</h1><div id="load-indicator">Page eventually loaded</div></body></html>'
                );
              }, 2000); // 2 second delay
            }
          </script>
        </body>
        </html>
      `;

      // Navigate to slow page
      let result = await session.navigate(`data:text/html,${encodeURIComponent(slowPageHtml)}`);
      expect(result.success).toBe(true);

      // Trigger slow navigation
      await session.click('#slow-navigate');

      // Wait for navigation with reasonable timeout
      await session.waitForNavigation({ timeout: 5000 });

      const titleResult = await session.getTitle();
      expect(titleResult.data).toBe('Finally Loaded');

      const loadIndicator = await session.getText('#load-indicator');
      expect(loadIndicator.data).toBe('Page eventually loaded');
    }, 10000);
  });
});