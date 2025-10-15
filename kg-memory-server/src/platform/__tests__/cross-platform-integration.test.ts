import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { platformDetector } from '../platform-detector.js';
import { pathUtils } from '../path-utils.js';
import { fileSystem } from '../file-system-utils.js';
import { shellAdapter } from '../shell-adapter.js';
import { ConfigManager } from '../../config/config-manager.js';

describe('Cross-Platform Integration Tests', () => {
  let testDir: string;
  let configManager: ConfigManager;

  beforeEach(async () => {
    testDir = pathUtils.join(process.cwd(), 'test-cross-platform');
    await fileSystem.ensureDirectory(testDir);
    
    configManager = new ConfigManager({
      configPath: pathUtils.join(testDir, 'config.json')
    });
  });

  afterEach(async () => {
    if (await fileSystem.exists(testDir)) {
      await fileSystem.deleteDirectory(testDir, true);
    }
  });

  describe('Platform Detection', () => {
    it('should detect current platform correctly', () => {
      const platformInfo = platformDetector.getPlatformInfo();
      
      expect(platformInfo.platform).toBeDefined();
      expect(platformInfo.arch).toBeDefined();
      expect(platformInfo.shell).toBeDefined();
      expect(platformInfo.pathSeparator).toBeDefined();
      expect(platformInfo.homeDirectory).toBeDefined();
      
      // Verify platform flags are mutually exclusive
      const platformFlags = [
        platformInfo.isWindows,
        platformInfo.isMacOS,
        platformInfo.isLinux
      ];
      const trueCount = platformFlags.filter(Boolean).length;
      expect(trueCount).toBe(1);
    });

    it('should provide compatible platform', () => {
      expect(platformDetector.isCompatiblePlatform()).toBe(true);
    });

    it('should detect shell type correctly', () => {
      const shellType = platformDetector.getShellType();
      expect(['powershell', 'cmd', 'bash', 'zsh', 'unknown']).toContain(shellType);
    });
  });

  describe('Path Operations', () => {
    it('should handle path operations consistently across platforms', () => {
      const segments = ['home', 'user', 'documents', 'file.txt'];
      const joined = pathUtils.join(...segments);
      
      expect(joined).toBeTruthy();
      expect(pathUtils.isAbsolute(pathUtils.resolve(joined))).toBe(true);
      
      const normalized = pathUtils.normalize(joined);
      expect(normalized).toBeTruthy();
      
      const dirname = pathUtils.dirname(joined);
      const basename = pathUtils.basename(joined);
      const extname = pathUtils.extname(joined);
      
      expect(dirname).toBeTruthy();
      expect(basename).toBe('file.txt');
      expect(extname).toBe('.txt');
    });

    it('should convert paths correctly for current platform', () => {
      const unixPath = 'home/user/documents/file.txt';
      const windowsPath = 'home\\user\\documents\\file.txt';
      
      const platformPath = pathUtils.toPlatformPath(unixPath);
      const unixConverted = pathUtils.toUnixPath(windowsPath);
      
      expect(platformPath).toBeTruthy();
      expect(unixConverted).toBe(unixPath);
    });

    it('should expand home directory correctly', () => {
      const homePath = '~/documents/file.txt';
      const expanded = pathUtils.expandHome(homePath);
      
      expect(expanded).not.toContain('~');
      expect(pathUtils.isAbsolute(expanded)).toBe(true);
    });

    it('should get platform-specific directories', () => {
      const configDir = pathUtils.getConfigDirectory();
      const dataDir = pathUtils.getDataDirectory();
      const cacheDir = pathUtils.getCacheDirectory();
      
      expect(configDir).toBeTruthy();
      expect(dataDir).toBeTruthy();
      expect(cacheDir).toBeTruthy();
      
      expect(pathUtils.isAbsolute(configDir)).toBe(true);
      expect(pathUtils.isAbsolute(dataDir)).toBe(true);
      expect(pathUtils.isAbsolute(cacheDir)).toBe(true);
    });

    it('should validate path safety', () => {
      const baseDir = '/safe/base';
      const safePath = 'subdir/file.txt';
      const unsafePath = '../../../etc/passwd';
      
      expect(pathUtils.isSafePath(safePath, baseDir)).toBe(true);
      expect(pathUtils.isSafePath(unsafePath, baseDir)).toBe(false);
    });
  });

  describe('File System Operations', () => {
    it('should perform basic file operations', async () => {
      const testFile = pathUtils.join(testDir, 'test-file.txt');
      const content = 'Hello, cross-platform world!';
      
      // Write file
      await fileSystem.writeFile(testFile, content);
      expect(await fileSystem.exists(testFile)).toBe(true);
      
      // Read file
      const readContent = await fileSystem.readFile(testFile, 'utf8');
      expect(readContent).toBe(content);
      
      // Append to file
      await fileSystem.appendFile(testFile, '\nAppended content');
      const appendedContent = await fileSystem.readFile(testFile, 'utf8');
      expect(appendedContent).toContain('Appended content');
      
      // Get file stats
      const stats = await fileSystem.getFileStats(testFile);
      expect(stats.isFile).toBe(true);
      expect(stats.size).toBeGreaterThan(content.length);
      
      // Delete file
      await fileSystem.deleteFile(testFile);
      expect(await fileSystem.exists(testFile)).toBe(false);
    });

    it('should perform directory operations', async () => {
      const subDir = pathUtils.join(testDir, 'subdir');
      const nestedDir = pathUtils.join(subDir, 'nested');
      
      // Create directories
      await fileSystem.createDirectory(nestedDir, true);
      expect(await fileSystem.exists(nestedDir)).toBe(true);
      expect(await fileSystem.isDirectory(nestedDir)).toBe(true);
      
      // List directory
      const contents = await fileSystem.listDirectory(testDir);
      expect(contents).toContain('subdir');
      
      // Delete directory
      await fileSystem.deleteDirectory(subDir, true);
      expect(await fileSystem.exists(subDir)).toBe(false);
    });

    it('should copy and move files', async () => {
      const sourceFile = pathUtils.join(testDir, 'source.txt');
      const copyFile = pathUtils.join(testDir, 'copy.txt');
      const moveFile = pathUtils.join(testDir, 'moved.txt');
      
      await fileSystem.writeFile(sourceFile, 'test content');
      
      // Copy file
      await fileSystem.copyFile(sourceFile, copyFile);
      expect(await fileSystem.exists(copyFile)).toBe(true);
      
      const copyContent = await fileSystem.readFile(copyFile, 'utf8');
      expect(copyContent).toBe('test content');
      
      // Move file
      await fileSystem.moveFile(copyFile, moveFile);
      expect(await fileSystem.exists(copyFile)).toBe(false);
      expect(await fileSystem.exists(moveFile)).toBe(true);
    });

    it('should find files by pattern', async () => {
      // Create test files
      await fileSystem.writeFile(pathUtils.join(testDir, 'test1.txt'), 'content');
      await fileSystem.writeFile(pathUtils.join(testDir, 'test2.txt'), 'content');
      await fileSystem.writeFile(pathUtils.join(testDir, 'other.md'), 'content');
      
      const txtFiles = await fileSystem.findFiles(/\.txt$/, testDir, false);
      expect(txtFiles).toHaveLength(2);
      expect(txtFiles.some(f => f.includes('test1.txt'))).toBe(true);
      expect(txtFiles.some(f => f.includes('test2.txt'))).toBe(true);
    });

    it('should handle temporary files', async () => {
      const tempFile = await fileSystem.createTempFile('cross-platform-test', '.tmp');
      
      expect(await fileSystem.exists(tempFile)).toBe(true);
      expect(tempFile).toContain('cross-platform-test');
      expect(tempFile).toContain('.tmp');
      
      // Clean up
      await fileSystem.deleteFile(tempFile);
    });

    it('should resolve safe paths', () => {
      const basePath = testDir;
      const safePath = fileSystem.resolveSafePath(basePath, 'subdir/file.txt');
      
      expect(safePath).toContain('subdir');
      expect(safePath).toContain('file.txt');
      
      expect(() => {
        fileSystem.resolveSafePath(basePath, '../../../etc/passwd');
      }).toThrow('Path traversal detected');
    });
  });

  describe('Shell Adapter Operations', () => {
    it('should generate appropriate commands for current platform', () => {
      const testPath = pathUtils.join(testDir, 'shell-test');
      
      const listCmd = shellAdapter.listFiles(testPath);
      const mkdirCmd = shellAdapter.createDirectory(testPath);
      const rmCmd = shellAdapter.removeFile(testPath);
      
      expect(listCmd.command).toBeTruthy();
      expect(listCmd.args).toBeDefined();
      expect(Array.isArray(listCmd.args)).toBe(true);
      
      expect(mkdirCmd.command).toBeTruthy();
      expect(mkdirCmd.args).toBeDefined();
      
      expect(rmCmd.command).toBeTruthy();
      expect(rmCmd.args).toBeDefined();
    });

    it('should handle environment variables', () => {
      const setCmd = shellAdapter.setEnvironmentVariable('TEST_VAR', 'test_value');
      const getCmd = shellAdapter.getEnvironmentVariable('TEST_VAR');
      
      expect(setCmd.command).toBeTruthy();
      expect(setCmd.args).toBeDefined();
      
      expect(getCmd.command).toBeTruthy();
      expect(getCmd.args).toBeDefined();
    });

    it('should handle file operations', () => {
      const source = pathUtils.join(testDir, 'source.txt');
      const dest = pathUtils.join(testDir, 'dest.txt');
      
      const copyCmd = shellAdapter.copyFile(source, dest);
      const moveCmd = shellAdapter.moveFile(source, dest);
      const existsCmd = shellAdapter.checkFileExists(source);
      
      expect(copyCmd.command).toBeTruthy();
      expect(moveCmd.command).toBeTruthy();
      expect(existsCmd.command).toBeTruthy();
    });
  });

  describe('Configuration Management', () => {
    it('should load configuration with platform-specific paths', async () => {
      const config = await configManager.loadConfiguration();
      
      expect(config.platform).toBeDefined();
      expect(config.platform.pathSeparator).toBeDefined();
      expect(config.platform.homeDirectory).toBeDefined();
      expect(config.platform.configDirectory).toBeDefined();
      expect(config.platform.dataDirectory).toBeDefined();
      expect(config.platform.cacheDirectory).toBeDefined();
      
      // Verify paths are absolute
      expect(pathUtils.isAbsolute(config.platform.homeDirectory!)).toBe(true);
      expect(pathUtils.isAbsolute(config.platform.configDirectory!)).toBe(true);
      expect(pathUtils.isAbsolute(config.platform.dataDirectory!)).toBe(true);
      expect(pathUtils.isAbsolute(config.platform.cacheDirectory!)).toBe(true);
    });

    it('should save and load configuration files', async () => {
      const customConfig = {
        server: {
          logLevel: 'debug' as const
        }
      };

      await configManager.loadConfiguration();
      await configManager.updateConfiguration(customConfig);
      
      // Create new manager to test loading
      const newManager = new ConfigManager({
        configPath: pathUtils.join(testDir, 'config.json')
      });
      
      const loadedConfig = await newManager.loadConfiguration();
      expect(loadedConfig.server.logLevel).toBe('debug');
    });

    it('should handle environment variables correctly', async () => {
      const originalLogLevel = process.env.KG_MEMORY_LOG_LEVEL;
      process.env.KG_MEMORY_LOG_LEVEL = 'warn';

      try {
        const config = await configManager.loadConfiguration();
        expect(config.server.logLevel).toBe('warn');
      } finally {
        if (originalLogLevel !== undefined) {
          process.env.KG_MEMORY_LOG_LEVEL = originalLogLevel;
        } else {
          delete process.env.KG_MEMORY_LOG_LEVEL;
        }
      }
    });
  });

  describe('Platform-Specific Behavior', () => {
    it('should handle Windows-specific behavior', async () => {
      const platformInfo = platformDetector.getPlatformInfo();
      
      if (platformInfo.isWindows) {
        expect(platformInfo.pathSeparator).toBe('\\');
        expect(['powershell', 'cmd']).toContain(platformInfo.shell);
        
        // Test Windows path handling
        const windowsPath = 'C:\\Users\\test\\file.txt';
        const normalized = pathUtils.normalize(windowsPath);
        expect(normalized).toContain('\\');
      }
    });

    it('should handle Unix-like behavior', async () => {
      const platformInfo = platformDetector.getPlatformInfo();
      
      if (platformInfo.isMacOS || platformInfo.isLinux) {
        expect(platformInfo.pathSeparator).toBe('/');
        expect(['bash', 'zsh']).toContain(platformInfo.shell);
        
        // Test Unix path handling
        const unixPath = '/home/user/file.txt';
        const normalized = pathUtils.normalize(unixPath);
        expect(normalized).toContain('/');
      }
    });

    it('should handle macOS-specific behavior', async () => {
      const platformInfo = platformDetector.getPlatformInfo();
      
      if (platformInfo.isMacOS) {
        const configDir = pathUtils.getConfigDirectory();
        expect(configDir).toContain('Library/Application Support');
      }
    });

    it('should handle Linux-specific behavior', async () => {
      const platformInfo = platformDetector.getPlatformInfo();
      
      if (platformInfo.isLinux) {
        const configDir = pathUtils.getConfigDirectory();
        expect(configDir).toMatch(/\.config|XDG_CONFIG_HOME/);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle file system errors gracefully', async () => {
      const nonExistentFile = pathUtils.join(testDir, 'non-existent.txt');
      
      await expect(fileSystem.readFile(nonExistentFile)).rejects.toThrow();
      await expect(fileSystem.deleteFile(nonExistentFile)).rejects.toThrow();
      
      expect(await fileSystem.exists(nonExistentFile)).toBe(false);
      expect(await fileSystem.isFile(nonExistentFile)).toBe(false);
      expect(await fileSystem.isDirectory(nonExistentFile)).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      // This test may behave differently on different platforms
      // We'll just ensure the methods don't crash
      const restrictedPath = '/root/restricted-file.txt';
      
      try {
        await fileSystem.exists(restrictedPath);
        await fileSystem.isFile(restrictedPath);
        await fileSystem.isDirectory(restrictedPath);
      } catch (error) {
        // Permission errors are expected and acceptable
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid paths gracefully', () => {
      const invalidPaths = [
        '',
        '\0',
        'con', // Windows reserved name
        'aux', // Windows reserved name
      ];

      for (const invalidPath of invalidPaths) {
        try {
          pathUtils.normalize(invalidPath);
          pathUtils.resolve(invalidPath);
        } catch (error) {
          // Errors are acceptable for invalid paths
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Performance', () => {
    it('should perform file operations within reasonable time', async () => {
      const startTime = Date.now();
      
      // Perform a series of file operations
      const testFile = pathUtils.join(testDir, 'performance-test.txt');
      await fileSystem.writeFile(testFile, 'test content');
      await fileSystem.readFile(testFile, 'utf8');
      await fileSystem.appendFile(testFile, ' appended');
      await fileSystem.getFileStats(testFile);
      await fileSystem.deleteFile(testFile);
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete within 1 second on any platform
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple concurrent operations', async () => {
      const operations = [];
      
      for (let i = 0; i < 10; i++) {
        const testFile = pathUtils.join(testDir, `concurrent-${i}.txt`);
        operations.push(
          fileSystem.writeFile(testFile, `content ${i}`)
            .then(() => fileSystem.readFile(testFile, 'utf8'))
            .then(() => fileSystem.deleteFile(testFile))
        );
      }
      
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });
});