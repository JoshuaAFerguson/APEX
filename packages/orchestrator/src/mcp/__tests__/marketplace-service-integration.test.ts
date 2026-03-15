/**
 * @fileoverview Integration Tests for MCPMarketplaceService
 *
 * This test file focuses on integration testing of the marketplace service
 * with minimal mocking to verify real functionality.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { MCPMarketplaceService, MarketplaceMetadata } from '../marketplace-service.js';
import { ApexConfig } from '@apexcli/core';

describe('MCPMarketplaceService Integration Tests', () => {
  let service: MCPMarketplaceService;
  let mockConfig: ApexConfig;
  let mockProjectPath: string;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    mockConfig = {
      project: {
        name: 'test-project',
        version: '1.0.0',
      },
      mcp: {
        enabled: true,
        servers: {},
      },
    };

    service = new MCPMarketplaceService(mockProjectPath, mockConfig);
  });

  describe('Service initialization', () => {
    it('should create service instance successfully', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(MCPMarketplaceService);
    });
  });

  describe('Marketplace data loading', () => {
    it('should handle missing marketplace data file gracefully', async () => {
      // This will try to load from marketplace-data.json which likely doesn't exist
      const data = await service.loadMarketplaceData();

      // Should return empty data structure when file is missing
      expect(data).toEqual({
        entries: [],
        categories: [],
        featured: [],
      });
    });

    it('should cache marketplace data between calls', async () => {
      const firstCall = await service.loadMarketplaceData();
      const secondCall = await service.loadMarketplaceData();

      // Should return the same cached instance
      expect(firstCall).toBe(secondCall);
    });
  });

  describe('getMarketplaceEntries functionality', () => {
    it('should handle empty marketplace data gracefully', async () => {
      const entries = await service.getMarketplaceEntries();
      expect(entries).toEqual([]);
    });

    it('should handle filtering options with empty data', async () => {
      // Test all filter options with empty data
      const categoryFilter = await service.getMarketplaceEntries({ category: 'test' });
      expect(categoryFilter).toEqual([]);

      const searchFilter = await service.getMarketplaceEntries({ search: 'test' });
      expect(searchFilter).toEqual([]);

      const featuredFilter = await service.getMarketplaceEntries({ featured: true });
      expect(featuredFilter).toEqual([]);

      const verifiedFilter = await service.getMarketplaceEntries({ verified: true });
      expect(verifiedFilter).toEqual([]);
    });

    it('should handle edge case filter values', async () => {
      // Test with edge case values
      const emptyCategoryFilter = await service.getMarketplaceEntries({ category: '' });
      expect(emptyCategoryFilter).toEqual([]);

      const whitespaceSearchFilter = await service.getMarketplaceEntries({ search: '   ' });
      expect(whitespaceSearchFilter).toEqual([]);

      const allCategoryFilter = await service.getMarketplaceEntries({ category: 'all' });
      expect(allCategoryFilter).toEqual([]);
    });
  });

  describe('getMarketplaceEntry functionality', () => {
    it('should return null for any entry name with empty data', async () => {
      const entry = await service.getMarketplaceEntry('test-server');
      expect(entry).toBeNull();
    });
  });

  describe('getCategories functionality', () => {
    it('should return empty categories with empty data', async () => {
      const categories = await service.getCategories();
      expect(categories).toEqual([]);
    });
  });

  describe('getFeaturedEntries functionality', () => {
    it('should return empty featured entries with empty data', async () => {
      const featured = await service.getFeaturedEntries();
      expect(featured).toEqual([]);
    });
  });

  describe('autoConfigureStandardTools functionality', () => {
    it('should handle configuration with no marketplace data', async () => {
      const result = await service.autoConfigureStandardTools();

      // Should return proper result structure
      expect(result).toHaveProperty('configured');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');

      expect(Array.isArray(result.configured)).toBe(true);
      expect(Array.isArray(result.skipped)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should handle empty custom servers array', async () => {
      const result = await service.autoConfigureStandardTools({
        customServers: []
      });

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'configuration',
          error: 'No valid servers to configure'
        })
      );
    });

    it('should handle invalid custom server names', async () => {
      const result = await service.autoConfigureStandardTools({
        customServers: ['', '   ', null, undefined] as any
      });

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          name: 'configuration',
          error: 'No valid servers to configure'
        })
      );
    });

    it('should handle project detection for current directory', async () => {
      // This will run actual project detection on the current test directory
      const result = await service.autoConfigureStandardTools();

      // Should not throw and should return valid structure
      expect(result).toHaveProperty('configured');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('getInstallationRecommendations functionality', () => {
    it('should return recommendation structure with empty data', async () => {
      const recommendations = await service.getInstallationRecommendations();

      expect(recommendations).toHaveProperty('essential');
      expect(recommendations).toHaveProperty('recommended');
      expect(recommendations).toHaveProperty('optional');

      expect(Array.isArray(recommendations.essential)).toBe(true);
      expect(Array.isArray(recommendations.recommended)).toBe(true);
      expect(Array.isArray(recommendations.optional)).toBe(true);

      // With empty marketplace data, all should be empty
      expect(recommendations.essential).toEqual([]);
      expect(recommendations.recommended).toEqual([]);
      expect(recommendations.optional).toEqual([]);
    });
  });
});