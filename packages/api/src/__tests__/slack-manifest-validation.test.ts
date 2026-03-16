import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';

/**
 * Slack App Manifest Validation Tests
 *
 * Tests the Slack app manifest configuration to ensure it meets
 * the requirements for the OAuth-enabled APEX Slack app.
 */
describe.skip('Slack App Manifest Validation', () => {
  let manifest: any;

  beforeEach(() => {
    // Find the manifest file in the project root
    const possiblePaths = [
      join(process.cwd(), '../../../docs/slack-app-manifest.yaml'),
      join(process.cwd(), '../../docs/slack-app-manifest.yaml'),
      join(process.cwd(), '../docs/slack-app-manifest.yaml'),
      join(process.cwd(), 'docs/slack-app-manifest.yaml')
    ];

    let manifestPath: string | null = null;
    for (const path of possiblePaths) {
      try {
        if (readFileSync(path, 'utf8')) {
          manifestPath = path;
          break;
        }
      } catch {
        // Continue to next path
      }
    }

    if (!manifestPath) {
      throw new Error('Could not find slack-app-manifest.yaml in any expected location');
    }

    try {
      const manifestContent = readFileSync(manifestPath, 'utf8');
      manifest = yaml.load(manifestContent);
    } catch (error) {
      throw new Error(`Failed to load slack-app-manifest.yaml from ${manifestPath}: ${error}`);
    }
  });

  describe('Basic App Information', () => {
    it('should have required display information', () => {
      expect(manifest.display_information).toBeDefined();
      expect(manifest.display_information.name).toBe('APEX');
      expect(manifest.display_information.description).toBe('APEX task orchestration via Slack commands');
      expect(manifest.display_information.background_color).toBe('#0D0F12');
      expect(manifest.display_information.long_description).toContain('APEX enables AI-powered task management');
    });

    it('should configure bot user correctly', () => {
      expect(manifest.features.bot_user).toBeDefined();
      expect(manifest.features.bot_user.display_name).toBe('APEX');
      expect(manifest.features.bot_user.always_online).toBe(true);
    });

    it('should enable app home tab', () => {
      expect(manifest.features.app_home).toBeDefined();
      expect(manifest.features.app_home.home_tab_enabled).toBe(true);
      expect(manifest.features.app_home.messages_tab_enabled).toBe(true);
      expect(manifest.features.app_home.messages_tab_read_only_enabled).toBe(false);
    });
  });

  describe('Slash Commands Configuration', () => {
    it('should define the /apex slash command', () => {
      expect(manifest.features.slash_commands).toBeDefined();
      expect(manifest.features.slash_commands).toHaveLength(1);

      const apexCommand = manifest.features.slash_commands[0];
      expect(apexCommand.command).toBe('/apex');
      expect(apexCommand.url).toBe('https://your-domain.com/slack/events');
      expect(apexCommand.description).toBe('Manage APEX tasks and status');
      expect(apexCommand.usage_hint).toContain('run "task", think "idea", status');
      expect(apexCommand.should_escape).toBe(false);
    });

    it('should include all expected command variations in usage hint', () => {
      const apexCommand = manifest.features.slash_commands[0];
      const usageHint = apexCommand.usage_hint;

      expect(usageHint).toContain('run "task"');
      expect(usageHint).toContain('think "idea"');
      expect(usageHint).toContain('status');
      expect(usageHint).toContain('report <taskId>');
      expect(usageHint).toContain('cancel <taskId>');
    });
  });

  describe('OAuth Configuration', () => {
    it('should have OAuth configuration for production and development', () => {
      expect(manifest.oauth_config).toBeDefined();
      expect(manifest.oauth_config.redirect_urls).toBeDefined();
      expect(manifest.oauth_config.redirect_urls).toHaveLength(2);

      expect(manifest.oauth_config.redirect_urls).toContain('https://your-domain.com/slack/oauth_redirect');
      expect(manifest.oauth_config.redirect_urls).toContain('http://localhost:3000/slack/oauth_redirect');
    });

    it('should define required bot scopes for OAuth', () => {
      expect(manifest.oauth_config.scopes.bot).toBeDefined();

      const requiredScopes = [
        'commands',
        'chat:write',
        'chat:write.public',
        'channels:read',
        'users:read',
        'team:read',
        'app_mentions:read',
        'im:history',
        'im:write'
      ];

      const botScopes = manifest.oauth_config.scopes.bot;
      requiredScopes.forEach(scope => {
        expect(botScopes).toContain(scope);
      });
    });

    it('should have minimum required scopes for core functionality', () => {
      const botScopes = manifest.oauth_config.scopes.bot;

      // Core functionality scopes
      expect(botScopes).toContain('commands'); // For slash commands
      expect(botScopes).toContain('chat:write'); // For posting messages
      expect(botScopes).toContain('channels:read'); // For reading channel info
      expect(botScopes).toContain('users:read'); // For user info
      expect(botScopes).toContain('team:read'); // For team info
    });

    it('should include scopes for enhanced functionality', () => {
      const botScopes = manifest.oauth_config.scopes.bot;

      // Enhanced functionality scopes
      expect(botScopes).toContain('chat:write.public'); // For posting to channels the bot isn't in
      expect(botScopes).toContain('app_mentions:read'); // For handling @mentions
      expect(botScopes).toContain('im:history'); // For reading DM history
      expect(botScopes).toContain('im:write'); // For sending DMs
    });
  });

  describe('Event Subscriptions', () => {
    it('should configure event subscriptions endpoint', () => {
      expect(manifest.settings.event_subscriptions).toBeDefined();
      expect(manifest.settings.event_subscriptions.request_url).toBe('https://your-domain.com/slack/events');
    });

    it('should subscribe to required bot events', () => {
      const botEvents = manifest.settings.event_subscriptions.bot_events;
      expect(botEvents).toBeDefined();

      const requiredEvents = ['app_home_opened', 'app_uninstalled', 'message.im'];
      requiredEvents.forEach(event => {
        expect(botEvents).toContain(event);
      });
    });

    it('should include app lifecycle events', () => {
      const botEvents = manifest.settings.event_subscriptions.bot_events;

      expect(botEvents).toContain('app_home_opened'); // For home tab welcome
      expect(botEvents).toContain('app_uninstalled'); // For cleanup
    });

    it('should include messaging events', () => {
      const botEvents = manifest.settings.event_subscriptions.bot_events;

      expect(botEvents).toContain('message.im'); // For DM conversations
    });
  });

  describe('Interactivity Settings', () => {
    it('should enable interactivity', () => {
      expect(manifest.settings.interactivity).toBeDefined();
      expect(manifest.settings.interactivity.is_enabled).toBe(true);
      expect(manifest.settings.interactivity.request_url).toBe('https://your-domain.com/slack/events');
    });
  });

  describe('Enterprise and Security Settings', () => {
    it('should enable org deploy for Enterprise Grid', () => {
      expect(manifest.settings.org_deploy_enabled).toBe(true);
    });

    it('should disable Socket Mode for OAuth production usage', () => {
      expect(manifest.settings.socket_mode_enabled).toBe(false);
    });

    it('should enable token rotation for security', () => {
      expect(manifest.settings.token_rotation_enabled).toBe(true);
    });
  });

  describe('URL Consistency', () => {
    it('should use consistent base URL across all endpoints', () => {
      const baseUrl = 'https://your-domain.com';
      const slackPath = '/slack';

      // Check slash command URL
      expect(manifest.features.slash_commands[0].url).toBe(`${baseUrl}${slackPath}/events`);

      // Check event subscription URL
      expect(manifest.settings.event_subscriptions.request_url).toBe(`${baseUrl}${slackPath}/events`);

      // Check interactivity URL
      expect(manifest.settings.interactivity.request_url).toBe(`${baseUrl}${slackPath}/events`);

      // Check OAuth redirect URL
      expect(manifest.oauth_config.redirect_urls[0]).toBe(`${baseUrl}${slackPath}/oauth_redirect`);
    });

    it('should include localhost for development', () => {
      const devUrl = 'http://localhost:3000/slack/oauth_redirect';
      expect(manifest.oauth_config.redirect_urls).toContain(devUrl);
    });
  });

  describe('Manifest Structure Validation', () => {
    it('should have all required top-level sections', () => {
      const requiredSections = [
        'display_information',
        'features',
        'oauth_config',
        'settings'
      ];

      requiredSections.forEach(section => {
        expect(manifest[section]).toBeDefined();
      });
    });

    it('should have proper features structure', () => {
      expect(manifest.features).toBeDefined();
      expect(manifest.features.bot_user).toBeDefined();
      expect(manifest.features.app_home).toBeDefined();
      expect(manifest.features.slash_commands).toBeDefined();
    });

    it('should have proper settings structure', () => {
      expect(manifest.settings).toBeDefined();
      expect(manifest.settings.event_subscriptions).toBeDefined();
      expect(manifest.settings.interactivity).toBeDefined();
      expect(manifest.settings.org_deploy_enabled).toBeDefined();
      expect(manifest.settings.socket_mode_enabled).toBeDefined();
      expect(manifest.settings.token_rotation_enabled).toBeDefined();
    });
  });

  describe('Production Readiness', () => {
    it('should be configured for production OAuth deployment', () => {
      // OAuth should be configured
      expect(manifest.oauth_config).toBeDefined();
      expect(manifest.oauth_config.redirect_urls.length).toBeGreaterThan(0);
      expect(manifest.oauth_config.scopes.bot.length).toBeGreaterThan(0);

      // Socket Mode should be disabled for production
      expect(manifest.settings.socket_mode_enabled).toBe(false);

      // Token rotation should be enabled for security
      expect(manifest.settings.token_rotation_enabled).toBe(true);

      // Org deploy should be enabled for enterprise
      expect(manifest.settings.org_deploy_enabled).toBe(true);
    });

    it('should support multi-workspace installation', () => {
      // OAuth config enables multi-workspace
      expect(manifest.oauth_config).toBeDefined();

      // Org deploy enables Enterprise Grid
      expect(manifest.settings.org_deploy_enabled).toBe(true);

      // Socket Mode disabled means HTTP mode (multi-workspace capable)
      expect(manifest.settings.socket_mode_enabled).toBe(false);
    });

    it('should have security best practices enabled', () => {
      // Token rotation for token security
      expect(manifest.settings.token_rotation_enabled).toBe(true);

      // OAuth instead of static tokens
      expect(manifest.oauth_config).toBeDefined();

      // Proper scopes (not overly broad)
      const botScopes = manifest.oauth_config.scopes.bot;
      expect(botScopes).not.toContain('admin'); // No admin permissions
      expect(botScopes).not.toContain('*'); // No wildcard permissions
    });
  });
});