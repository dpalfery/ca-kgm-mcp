import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigManager } from '../config-manager.js';
import { DEFAULT_CONFIG, CONFIG_PROFILES } from '../config-schema.js';
import { fileSystem } from '../../platform/file-system-utils.js';
import { pathUtils } from '../../platform/path-utils.js';

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let tempConfigPath: string;

  beforeEach(async () => {
    tempConfigPath = await fileSystem.createTempFile('kg-memory-config', '.json');
    configManager = new ConfigManager({ configPath: tempConfigPath });
  });

  afterEach(async () => {
    if (await fileSystem.exists(tempConfigPath)) {
      await fileSystem.deleteFile(tempConfigPath);
    }
  });

  describe('loadConfiguration', () => {
    it('should load default configuration', async () => {
      const config = await configManager.loadConfiguration();
      
      expect(config.server.name).toBe(DEFAULT_CONFIG.server.name);
      expect(config.server.version).toBe(DEFAULT_CONFIG.server.version);
      expect(configManager.getLoadedSources()).toContain('default');
    });

    it('should load configuration from file', async () => {
      const customConfig = {
        server: {
          ...DEFAULT_CONFIG.server,
          logLevel: 'debug' as const
        }
      };

      await fileSystem.writeFile(tempConfigPath, JSON.stringify(customConfig));
      
      const config = await configManager.loadConfiguration();
      
      expect(config.server.logLevel).toBe('debug');
      expect(configManager.getLoadedSources()).toContain('file');
    });

    it('should apply profile configuration', async () => {
      const config = await configManager.loadConfiguration({ profile: 'development' });
      
      expect(config.server.logLevel).toBe('debug');
      expect(config.development.enableDebugMode).toBe(true);
      expect(configManager.getLoadedSources()).toContain('profile');
    });

    it('should apply environment configuration', async () => {
      const originalEnv = process.env.KG_MEMORY_LOG_LEVEL;
      process.env.KG_MEMORY_LOG_LEVEL = 'warn';

      try {
        const config = await configManager.loadConfiguration();
        expect(config.server.logLevel).toBe('warn');
        expect(configManager.getLoadedSources()).toContain('environment');
      } finally {
        if (originalEnv !== undefined) {
          process.env.KG_MEMORY_LOG_LEVEL = originalEnv;
        } else {
          delete process.env.KG_MEMORY_LOG_LEVEL;
        }
      }
    });

    it('should apply configuration overrides', async () => {
      const overrides = {
        server: {
          logLevel: 'error' as const
        }
      };

      const config = await configManager.loadConfiguration({ overrides });
      
      expect(config.server.logLevel).toBe('error');
      expect(configManager.getLoadedSources()).toContain('override');
    });

    it('should validate configuration by default', async () => {
      const invalidConfig = {
        server: {
          logLevel: 'invalid'
        }
      };

      await fileSystem.writeFile(tempConfigPath, JSON.stringify(invalidConfig));
      
      await expect(configManager.loadConfiguration()).rejects.toThrow('Configuration validation failed');
    });

    it('should skip validation when disabled', async () => {
      const invalidConfig = {
        server: {
          logLevel: 'invalid'
        }
      };

      await fileSystem.writeFile(tempConfigPath, JSON.stringify(invalidConfig));
      
      const config = await configManager.loadConfiguration({ validateConfig: false });
      expect(config.server.logLevel).toBe('invalid');
    });
  });

  describe('updateConfiguration', () => {
    it('should update configuration and save to file', async () => {
      await configManager.loadConfiguration();
      
      const updates = {
        server: {
          logLevel: 'debug' as const
        }
      };

      await configManager.updateConfiguration(updates);
      
      const config = configManager.getConfiguration();
      expect(config.server.logLevel).toBe('debug');

      // Verify it was saved to file
      const savedData = await fileSystem.readFile(tempConfigPath, 'utf8');
      const savedConfig = JSON.parse(savedData as string);
      expect(savedConfig.server.logLevel).toBe('debug');
    });
  });

  describe('saveConfiguration', () => {
    it('should save configuration to specified path', async () => {
      const customPath = await fileSystem.createTempFile('custom-config', '.json');
      
      try {
        await configManager.loadConfiguration();
        await configManager.saveConfiguration(customPath);
        
        expect(await fileSystem.exists(customPath)).toBe(true);
        
        const savedData = await fileSystem.readFile(customPath, 'utf8');
        const savedConfig = JSON.parse(savedData as string);
        expect(savedConfig.server.name).toBe(DEFAULT_CONFIG.server.name);
      } finally {
        if (await fileSystem.exists(customPath)) {
          await fileSystem.deleteFile(customPath);
        }
      }
    });
  });

  describe('validateConfiguration', () => {
    it('should validate current configuration', async () => {
      await configManager.loadConfiguration();
      
      const validation = configManager.validateConfiguration();
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect validation errors', async () => {
      await configManager.loadConfiguration();
      
      // Manually corrupt the configuration
      const config = configManager.getConfiguration();
      config.server.logLevel = 'invalid' as any;
      
      const validation = configManager.validateConfiguration();
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('static methods', () => {
    it('should get available profiles', () => {
      const profiles = ConfigManager.getAvailableProfiles();
      expect(profiles).toHaveLength(Object.keys(CONFIG_PROFILES).length);
      expect(profiles.some(p => p.name === 'production')).toBe(true);
      expect(profiles.some(p => p.name === 'development')).toBe(true);
    });

    it('should create with profile', async () => {
      const manager = await ConfigManager.createWithProfile('testing');
      const config = manager.getConfiguration();
      
      expect(config.development.enableTestMode).toBe(true);
      expect(config.database.path).toBe(':memory:');
    });

    it('should create for testing', () => {
      const overrides = {
        server: {
          logLevel: 'error' as const
        }
      };

      const manager = ConfigManager.createForTesting(overrides);
      const config = manager.getConfiguration();
      
      expect(config.development.enableTestMode).toBe(true);
      expect(config.server.logLevel).toBe('error');
    });

    it('should generate config template', () => {
      const template = ConfigManager.generateConfigTemplate();
      const parsed = JSON.parse(template);
      
      expect(parsed).toHaveProperty('$schema');
      expect(parsed.server.name).toBe(DEFAULT_CONFIG.server.name);
    });
  });

  describe('import/export', () => {
    it('should export configuration', async () => {
      await configManager.loadConfiguration();
      
      const exported = configManager.exportConfiguration();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('config');
      expect(parsed).toHaveProperty('sources');
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed.config.server.name).toBe(DEFAULT_CONFIG.server.name);
    });

    it('should import configuration', async () => {
      await configManager.loadConfiguration();
      
      const customConfig = {
        ...DEFAULT_CONFIG,
        server: {
          ...DEFAULT_CONFIG.server,
          logLevel: 'debug' as const
        }
      };

      const backupData = JSON.stringify({
        config: customConfig,
        sources: ['import'],
        timestamp: new Date().toISOString()
      });

      await configManager.importConfiguration(backupData);
      
      const config = configManager.getConfiguration();
      expect(config.server.logLevel).toBe('debug');
    });

    it('should reject invalid import data', async () => {
      const invalidData = JSON.stringify({ invalid: true });
      
      await expect(configManager.importConfiguration(invalidData))
        .rejects.toThrow('Invalid backup format');
    });
  });

  describe('configuration summary', () => {
    it('should provide configuration summary', async () => {
      await configManager.loadConfiguration({ profile: 'development' });
      
      const summary = configManager.getConfigurationSummary();
      
      expect(summary).toHaveProperty('sources');
      expect(summary).toHaveProperty('configPath');
      expect(summary).toHaveProperty('server');
      expect(summary).toHaveProperty('database');
      expect(summary).toHaveProperty('providers');
      expect(summary).toHaveProperty('cache');
      expect(summary).toHaveProperty('development');
      
      expect(summary.development.debugMode).toBe(true);
    });
  });

  describe('resetToDefaults', () => {
    it('should reset configuration to defaults', async () => {
      await configManager.loadConfiguration({ profile: 'development' });
      
      expect(configManager.getConfiguration().server.logLevel).toBe('debug');
      
      configManager.resetToDefaults();
      
      expect(configManager.getConfiguration().server.logLevel).toBe('info');
      expect(configManager.getLoadedSources()).toEqual(['default']);
    });
  });
});