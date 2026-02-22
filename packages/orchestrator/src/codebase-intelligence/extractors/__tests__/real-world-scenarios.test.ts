/**
 * Real-World Scenarios Tests for Symbol Extractors
 *
 * Tests the symbol extraction system with realistic code samples,
 * common patterns, and practical use cases that developers encounter.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getExtractorForLanguage,
  SymbolKind,
  type ExtractionResult
} from '../index.js';
import { TypeScriptExtractor } from '../typescript-extractor.js';
import { PythonExtractor } from '../python-extractor.js';
import { SupportedLanguage } from '../../parsers/types.js';

describe('Real-World Symbol Extraction Scenarios', () => {
  beforeEach(() => {
    // Reset singleton instances before each test
    TypeScriptExtractor.resetInstance?.();
    PythonExtractor.resetInstance?.();
  });

  afterEach(() => {
    // Clean up after each test
    TypeScriptExtractor.resetInstance?.();
    PythonExtractor.resetInstance?.();
  });

  describe('React Component Patterns', () => {
    it('should extract React functional components', async () => {
      const reactCode = `
        import React, { useState, useEffect } from 'react';

        interface Props {
          title: string;
          onUpdate: (value: string) => void;
        }

        /**
         * A reusable input component
         */
        export const InputComponent: React.FC<Props> = ({ title, onUpdate }) => {
          const [value, setValue] = useState('');

          useEffect(() => {
            onUpdate(value);
          }, [value, onUpdate]);

          return (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={title}
            />
          );
        };

        export default InputComponent;
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TSX);
      const result = await extractor.extract(reactCode, SupportedLanguage.TSX);

      expect(result.symbols).toHaveLength(2); // Props interface and InputComponent

      const propsInterface = result.symbols.find(s => s.name === 'Props');
      expect(propsInterface).toBeDefined();
      expect(propsInterface!.kind).toBe(SymbolKind.Interface);

      const component = result.symbols.find(s => s.name === 'InputComponent');
      expect(component).toBeDefined();
      expect(component!.kind).toBe(SymbolKind.ArrowFunction);
      expect(component!.exportKind).toBe('named');
      expect(component!.documentation).toContain('reusable input component');
    });

    it('should extract React class components', async () => {
      const classComponentCode = `
        import React, { Component } from 'react';

        interface State {
          count: number;
          error: string | null;
        }

        /**
         * Counter component with error handling
         */
        export class Counter extends Component<{}, State> {
          constructor(props: {}) {
            super(props);
            this.state = {
              count: 0,
              error: null
            };
          }

          /**
           * Increment the counter
           */
          increment = (): void => {
            this.setState(prevState => ({
              count: prevState.count + 1,
              error: null
            }));
          };

          /**
           * Reset counter to zero
           */
          reset(): void {
            this.setState({ count: 0, error: null });
          }

          render() {
            const { count, error } = this.state;

            return (
              <div>
                <p>Count: {count}</p>
                {error && <p className="error">{error}</p>}
                <button onClick={this.increment}>Increment</button>
                <button onClick={() => this.reset()}>Reset</button>
              </div>
            );
          }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TSX);
      const result = await extractor.extract(classComponentCode, SupportedLanguage.TSX);

      const stateInterface = result.symbols.find(s => s.name === 'State');
      expect(stateInterface).toBeDefined();
      expect(stateInterface!.kind).toBe(SymbolKind.Interface);

      const counterClass = result.symbols.find(s => s.name === 'Counter');
      expect(counterClass).toBeDefined();
      expect(counterClass!.kind).toBe(SymbolKind.Class);
      expect(counterClass!.exportKind).toBe('named');
      expect(counterClass!.children).toBeDefined();
      expect(counterClass!.children!.length).toBeGreaterThan(0);

      // Should have constructor, increment method, reset method, and render method
      const constructor = counterClass!.children!.find(c => c.kind === SymbolKind.Constructor);
      const increment = counterClass!.children!.find(c => c.name === 'increment');
      const reset = counterClass!.children!.find(c => c.name === 'reset');
      const render = counterClass!.children!.find(c => c.name === 'render');

      expect(constructor).toBeDefined();
      expect(increment).toBeDefined();
      expect(reset).toBeDefined();
      expect(render).toBeDefined();
    });
  });

  describe('API and Service Patterns', () => {
    it('should extract REST API service class', async () => {
      const apiServiceCode = `
        /**
         * User API service for handling user-related operations
         */
        export class UserApiService {
          private baseUrl: string;
          private apiKey: string;

          constructor(baseUrl: string, apiKey: string) {
            this.baseUrl = baseUrl;
            this.apiKey = apiKey;
          }

          /**
           * Get user by ID
           */
          async getUser(id: number): Promise<User> {
            const response = await fetch(\`\${this.baseUrl}/users/\${id}\`, {
              headers: { 'Authorization': \`Bearer \${this.apiKey}\` }
            });

            if (!response.ok) {
              throw new Error(\`Failed to fetch user: \${response.statusText}\`);
            }

            return response.json();
          }

          /**
           * Create new user
           */
          async createUser(userData: CreateUserRequest): Promise<User> {
            const response = await fetch(\`\${this.baseUrl}/users\`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${this.apiKey}\`
              },
              body: JSON.stringify(userData)
            });

            return response.json();
          }

          /**
           * Update existing user
           */
          async updateUser(id: number, updates: Partial<User>): Promise<User> {
            const response = await fetch(\`\${this.baseUrl}/users/\${id}\`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': \`Bearer \${this.apiKey}\`
              },
              body: JSON.stringify(updates)
            });

            return response.json();
          }

          /**
           * Delete user
           */
          async deleteUser(id: number): Promise<void> {
            await fetch(\`\${this.baseUrl}/users/\${id}\`, {
              method: 'DELETE',
              headers: { 'Authorization': \`Bearer \${this.apiKey}\` }
            });
          }
        }
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(apiServiceCode, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(1);

      const serviceClass = result.symbols[0];
      expect(serviceClass.name).toBe('UserApiService');
      expect(serviceClass.kind).toBe(SymbolKind.Class);
      expect(serviceClass.exportKind).toBe('named');
      expect(serviceClass.documentation).toContain('User API service');

      expect(serviceClass.children).toBeDefined();
      expect(serviceClass.children!.length).toBeGreaterThan(5); // Properties + methods

      const methods = serviceClass.children!.filter(c => c.kind === SymbolKind.Method);
      const methodNames = methods.map(m => m.name);

      expect(methodNames).toContain('getUser');
      expect(methodNames).toContain('createUser');
      expect(methodNames).toContain('updateUser');
      expect(methodNames).toContain('deleteUser');

      // Check async modifiers
      const asyncMethods = methods.filter(m => m.modifiers.includes('async'));
      expect(asyncMethods.length).toBe(4); // All methods are async
    });

    it('should extract utility functions and helpers', async () => {
      const utilsCode = `
        /**
         * Format currency value with proper localization
         */
        export const formatCurrency = (
          amount: number,
          currency: string = 'USD',
          locale: string = 'en-US'
        ): string => {
          return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency
          }).format(amount);
        };

        /**
         * Debounce function calls
         */
        export function debounce<T extends (...args: any[]) => any>(
          fn: T,
          delay: number
        ): (...args: Parameters<T>) => void {
          let timeoutId: NodeJS.Timeout;

          return (...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), delay);
          };
        }

        /**
         * Deep clone an object
         */
        export const deepClone = <T>(obj: T): T => {
          if (obj === null || typeof obj !== 'object') {
            return obj;
          }

          if (obj instanceof Date) {
            return new Date(obj.getTime()) as unknown as T;
          }

          if (obj instanceof Array) {
            return obj.map(item => deepClone(item)) as unknown as T;
          }

          const cloned = {} as T;
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              cloned[key] = deepClone(obj[key]);
            }
          }

          return cloned;
        };
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(utilsCode, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(3);

      const formatCurrency = result.symbols.find(s => s.name === 'formatCurrency');
      expect(formatCurrency).toBeDefined();
      expect(formatCurrency!.kind).toBe(SymbolKind.ArrowFunction);
      expect(formatCurrency!.exportKind).toBe('named');

      const debounce = result.symbols.find(s => s.name === 'debounce');
      expect(debounce).toBeDefined();
      expect(debounce!.kind).toBe(SymbolKind.Function);
      expect(debounce!.exportKind).toBe('named');

      const deepClone = result.symbols.find(s => s.name === 'deepClone');
      expect(deepClone).toBeDefined();
      expect(deepClone!.kind).toBe(SymbolKind.ArrowFunction);
      expect(deepClone!.exportKind).toBe('named');

      // All should have documentation
      for (const symbol of result.symbols) {
        expect(symbol.documentation).toBeDefined();
        expect(symbol.documentation!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Python Framework Patterns', () => {
    it('should extract Flask API routes', async () => {
      const flaskCode = `
        from flask import Flask, jsonify, request
        from typing import Dict, Any, Optional

        app = Flask(__name__)

        class UserService:
            """Service class for user operations"""

            def __init__(self, database):
                self.db = database

            def get_user(self, user_id: int) -> Optional[Dict[str, Any]]:
                """Get user by ID"""
                return self.db.get_user(user_id)

            def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
                """Create a new user"""
                return self.db.create_user(user_data)

        user_service = UserService(database)

        @app.route('/users/<int:user_id>', methods=['GET'])
        def get_user_endpoint(user_id: int):
            """Get user by ID endpoint"""
            user = user_service.get_user(user_id)
            if user:
                return jsonify(user)
            return jsonify({'error': 'User not found'}), 404

        @app.route('/users', methods=['POST'])
        def create_user_endpoint():
            """Create user endpoint"""
            user_data = request.get_json()
            if not user_data:
                return jsonify({'error': 'Invalid data'}), 400

            try:
                user = user_service.create_user(user_data)
                return jsonify(user), 201
            except Exception as e:
                return jsonify({'error': str(e)}), 500

        @app.route('/health', methods=['GET'])
        def health_check():
            """Health check endpoint"""
            return jsonify({'status': 'healthy'})

        if __name__ == '__main__':
            app.run(debug=True)
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.Python);
      const result = await extractor.extract(flaskCode, SupportedLanguage.Python);

      expect(result.symbols.length).toBeGreaterThan(5);

      // Should extract the UserService class
      const userServiceClass = result.symbols.find(s => s.name === 'UserService');
      expect(userServiceClass).toBeDefined();
      expect(userServiceClass!.kind).toBe(SymbolKind.Class);
      expect(userServiceClass!.documentation).toContain('Service class for user operations');

      // Should extract the route handler functions
      const routeFunctions = result.symbols.filter(s =>
        s.kind === SymbolKind.Function &&
        ['get_user_endpoint', 'create_user_endpoint', 'health_check'].includes(s.name)
      );

      expect(routeFunctions).toHaveLength(3);

      for (const routeFunction of routeFunctions) {
        expect(routeFunction.documentation).toBeDefined();
        expect(routeFunction.documentation).toContain('endpoint');
      }
    });

    it('should extract Django model and views', async () => {
      const djangoCode = `
        from django.db import models
        from django.http import JsonResponse
        from django.views import View
        from django.utils.decorators import method_decorator
        from django.views.decorators.csrf import csrf_exempt
        import json

        class User(models.Model):
            """User model for the application"""

            email = models.EmailField(unique=True)
            first_name = models.CharField(max_length=100)
            last_name = models.CharField(max_length=100)
            created_at = models.DateTimeField(auto_now_add=True)
            updated_at = models.DateTimeField(auto_now=True)
            is_active = models.BooleanField(default=True)

            class Meta:
                db_table = 'users'
                ordering = ['-created_at']

            def __str__(self):
                return f"{self.first_name} {self.last_name} ({self.email})"

            @property
            def full_name(self):
                """Get the user's full name"""
                return f"{self.first_name} {self.last_name}"

            def deactivate(self):
                """Deactivate the user account"""
                self.is_active = False
                self.save()

        @method_decorator(csrf_exempt, name='dispatch')
        class UserAPIView(View):
            """API view for user operations"""

            def get(self, request, user_id=None):
                """Handle GET requests"""
                if user_id:
                    try:
                        user = User.objects.get(id=user_id, is_active=True)
                        return JsonResponse({
                            'id': user.id,
                            'email': user.email,
                            'full_name': user.full_name,
                            'created_at': user.created_at.isoformat()
                        })
                    except User.DoesNotExist:
                        return JsonResponse({'error': 'User not found'}, status=404)
                else:
                    users = User.objects.filter(is_active=True)
                    return JsonResponse({
                        'users': [{'id': u.id, 'email': u.email} for u in users]
                    })

            def post(self, request):
                """Handle POST requests"""
                try:
                    data = json.loads(request.body)
                    user = User.objects.create(**data)
                    return JsonResponse({
                        'id': user.id,
                        'email': user.email,
                        'full_name': user.full_name
                    }, status=201)
                except Exception as e:
                    return JsonResponse({'error': str(e)}, status=400)
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.Python);
      const result = await extractor.extract(djangoCode, SupportedLanguage.Python);

      // Should extract User model class
      const userModel = result.symbols.find(s => s.name === 'User');
      expect(userModel).toBeDefined();
      expect(userModel!.kind).toBe(SymbolKind.Class);
      expect(userModel!.documentation).toContain('User model for the application');

      // Should extract UserAPIView class
      const apiView = result.symbols.find(s => s.name === 'UserAPIView');
      expect(apiView).toBeDefined();
      expect(apiView!.kind).toBe(SymbolKind.Class);
      expect(apiView!.documentation).toContain('API view for user operations');

      // Check for nested classes and methods
      if (userModel!.children) {
        const metaClass = userModel!.children.find(c => c.name === 'Meta');
        expect(metaClass).toBeDefined();
        expect(metaClass!.kind).toBe(SymbolKind.Class);

        const strMethod = userModel!.children.find(c => c.name === '__str__');
        expect(strMethod).toBeDefined();
        expect(strMethod!.kind).toBe(SymbolKind.Method);

        const fullNameProperty = userModel!.children.find(c => c.name === 'full_name');
        expect(fullNameProperty).toBeDefined();
      }
    });
  });

  describe('Complex Type Definitions', () => {
    it('should extract complex TypeScript type definitions', async () => {
      const typeDefinitionsCode = `
        /**
         * Base configuration interface
         */
        export interface BaseConfig {
          readonly id: string;
          name: string;
          version: number;
          enabled: boolean;
        }

        /**
         * Database configuration with connection details
         */
        export interface DatabaseConfig extends BaseConfig {
          host: string;
          port: number;
          database: string;
          credentials: {
            username: string;
            password: string;
          };
          ssl?: boolean;
          maxConnections?: number;
        }

        /**
         * API configuration with endpoints and authentication
         */
        export interface ApiConfig extends BaseConfig {
          baseUrl: string;
          endpoints: {
            [key: string]: {
              path: string;
              method: 'GET' | 'POST' | 'PUT' | 'DELETE';
              authenticated: boolean;
            };
          };
          auth: {
            type: 'bearer' | 'api-key' | 'oauth';
            token?: string;
            clientId?: string;
            clientSecret?: string;
          };
        }

        /**
         * Application configuration union type
         */
        export type AppConfig = DatabaseConfig | ApiConfig;

        /**
         * Configuration manager utility type
         */
        export type ConfigManager<T extends BaseConfig> = {
          readonly config: T;
          validate(): boolean;
          update(updates: Partial<T>): void;
          reset(): void;
        };

        /**
         * Feature flags enumeration
         */
        export enum FeatureFlag {
          DARK_MODE = 'dark_mode',
          ANALYTICS = 'analytics',
          BETA_FEATURES = 'beta_features',
          EXPERIMENTAL_UI = 'experimental_ui'
        }

        /**
         * Response wrapper type with generic payload
         */
        export type ApiResponse<T = unknown> = {
          success: boolean;
          data?: T;
          error?: {
            code: string;
            message: string;
            details?: Record<string, any>;
          };
          meta?: {
            timestamp: string;
            requestId: string;
          };
        };
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(typeDefinitionsCode, SupportedLanguage.TypeScript);

      expect(result.symbols.length).toBe(7);

      // Check interfaces
      const interfaces = result.symbols.filter(s => s.kind === SymbolKind.Interface);
      expect(interfaces).toHaveLength(3);
      expect(interfaces.map(i => i.name)).toEqual(['BaseConfig', 'DatabaseConfig', 'ApiConfig']);

      // Check type aliases
      const typeAliases = result.symbols.filter(s => s.kind === SymbolKind.TypeAlias);
      expect(typeAliases).toHaveLength(3);
      expect(typeAliases.map(t => t.name)).toEqual(['AppConfig', 'ConfigManager', 'ApiResponse']);

      // Check enum
      const enums = result.symbols.filter(s => s.kind === SymbolKind.Enum);
      expect(enums).toHaveLength(1);
      expect(enums[0].name).toBe('FeatureFlag');

      // All should be exported
      for (const symbol of result.symbols) {
        expect(symbol.exportKind).toBe('named');
        expect(symbol.modifiers).toContain('export');
      }

      // All should have documentation
      for (const symbol of result.symbols) {
        expect(symbol.documentation).toBeDefined();
        expect(symbol.documentation!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Mixed Language Comments and Strings', () => {
    it('should handle international characters in code', async () => {
      const internationalCode = `
        /**
         * 多言語対応のユーティリティクラス
         * Classe utilitaire multilingue
         * Utilidad multiidioma
         */
        export class i18nUtils {
          private translations: Map<string, Map<string, string>> = new Map();

          /**
           * 翻訳を追加 - Add translation
           */
          addTranslation(lang: string, key: string, value: string): void {
            if (!this.translations.has(lang)) {
              this.translations.set(lang, new Map());
            }
            this.translations.get(lang)!.set(key, value);
          }

          /**
           * 翻訳を取得 - Get translation
           */
          translate(lang: string, key: string): string {
            const translations = this.translations.get(lang);
            if (!translations || !translations.has(key)) {
              return key; // Fallback to key
            }
            return translations.get(key)!;
          }

          /**
           * サポートされている言語を取得 - Get supported languages
           */
          getSupportedLanguages(): string[] {
            return Array.from(this.translations.keys());
          }
        }

        // 使用例 - Usage example
        const utils = new i18nUtils();
        utils.addTranslation('ja', 'hello', 'こんにちは');
        utils.addTranslation('fr', 'hello', 'Bonjour');
        utils.addTranslation('es', 'hello', 'Hola');
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(internationalCode, SupportedLanguage.TypeScript);

      expect(result.symbols).toHaveLength(2); // Class and variable

      const i18nClass = result.symbols.find(s => s.name === 'i18nUtils');
      expect(i18nClass).toBeDefined();
      expect(i18nClass!.kind).toBe(SymbolKind.Class);
      expect(i18nClass!.documentation).toContain('多言語対応');
      expect(i18nClass!.documentation).toContain('multilingue');
      expect(i18nClass!.documentation).toContain('multiidioma');

      expect(i18nClass!.children).toBeDefined();
      expect(i18nClass!.children!.length).toBeGreaterThan(3); // Methods and properties

      // Check that method documentation contains international characters
      const translateMethod = i18nClass!.children!.find(c => c.name === 'translate');
      expect(translateMethod).toBeDefined();
      expect(translateMethod!.documentation).toContain('翻訳を取得');
      expect(translateMethod!.documentation).toContain('Get translation');
    });
  });

  describe('Error Recovery and Partial Extraction', () => {
    it('should extract valid symbols from partially invalid code', async () => {
      const partiallyInvalidCode = `
        // This function is valid
        export function validFunction(param: string): string {
          return param.toUpperCase();
        }

        // This has syntax errors
        export function invalidFunction(
          // Missing closing parenthesis and body

        // Another valid function
        export const anotherValidFunction = (x: number, y: number): number => {
          return x + y;
        };

        // Invalid class syntax
        export class IncompleteClass {
          method() {
            if (condition
          // Missing closing brace and method body

        // Valid interface
        export interface ValidInterface {
          prop1: string;
          prop2: number;
        }

        // Incomplete interface
        export interface IncompleteInterface {
          prop1: string
          // Missing closing brace
      `;

      const extractor = getExtractorForLanguage(SupportedLanguage.TypeScript);
      const result = await extractor.extract(partiallyInvalidCode, SupportedLanguage.TypeScript);

      expect(result.hasErrors).toBe(true);
      expect(result.errors.length).toBeGreaterThan(0);

      // Should still extract the valid symbols
      expect(result.symbols.length).toBeGreaterThan(0);

      // Should extract the valid function and interface
      const validFunction = result.symbols.find(s => s.name === 'validFunction');
      const anotherValidFunction = result.symbols.find(s => s.name === 'anotherValidFunction');
      const validInterface = result.symbols.find(s => s.name === 'ValidInterface');

      expect(validFunction).toBeDefined();
      expect(anotherValidFunction).toBeDefined();
      expect(validInterface).toBeDefined();

      if (validFunction) {
        expect(validFunction.kind).toBe(SymbolKind.Function);
        expect(validFunction.exportKind).toBe('named');
      }

      if (validInterface) {
        expect(validInterface.kind).toBe(SymbolKind.Interface);
        expect(validInterface.exportKind).toBe('named');
      }
    });
  });
});