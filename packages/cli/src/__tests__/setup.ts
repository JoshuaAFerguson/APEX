/**
 * @fileoverview CLI package test setup
 *
 * Provides CLI-specific test setup including environment configuration,
 * mock setup for CLI-related dependencies.
 */

import { setupGlobalTestEnvironment } from '../../../../test-setup.js';
import '@testing-library/jest-dom';

// Initialize global test environment
setupGlobalTestEnvironment();
