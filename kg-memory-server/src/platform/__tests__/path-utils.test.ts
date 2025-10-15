import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CrossPlatformPathUtils, pathUtils } from '../path-utils.js';
import { platformDetector } from '../platform-detector.js';

describe('CrossPlatformPathUtils', () => {
  let pathUtilsInstance: CrossPlatformPathUtils;

  beforeEach(() => {
    pathUtilsInstance = new CrossPlatformPathUtils();
  });

  describe('basic path operations', () => {
    it('should join paths correctly', () => {
      const result = pathUtilsInstance.join('a', 'b', 'c');
      expect(result).toMatch(/a[\/\\]b[\/\\]c/);
    });

    it('should resolve paths correctly', () => {
      const result = pathUtilsInstance.resolve('.');
      expect(result).toBeTruthy();
      expect(pathUtilsInstance.isAbsolute(result)).toBe(true);
    });

    it('should normalize paths correctly', () => {
      const result = pathUtilsInstance.normalize('a//b/../c');
      expect(result).toMatch(/a[\/\\]c/);
    });

    it('should get dirname correctly', () => {
      const result = pathUtilsInstance.dirname('/a/b/c.txt');
      expect(result).toMatch(/[\/\\]a[\/\\]b/);
    });

    it('should get basename correctly', () => {
      const result = pathUtilsInstance.basename('/a/b/c.txt');
      expect(result).toBe('c.txt');
    });

    it('should get extname correctly', () => {
      const result = pathUtilsInstance.extname('/a/b/c.txt');
      expect(result).toBe('.txt');
    });
  });

  describe('path conversion', () => {
    it('should convert to Unix paths', () => {
      const result = pathUtilsInstance.toUnixPath('a\\b\\c');
      expect(result).toBe('a/b/c');
    });

    it('should convert to platform paths', () => {
      const platformInfo = platformDetector.getPlatformInfo();
      const result = pathUtilsInstance.toPlatformPath('a/b/c');
      
      if (platformInfo.isWindows) {
        expect(result).toBe('a\\b\\c');
      } else {
        expect(result).toBe('a/b/c');
      }
    });

    it('should expand home directory', () => {
      const platformInfo = platformDetector.getPlatformInfo();
      const result = pathUtilsInstance.expandHome('~/test');
      expect(result).toBe(pathUtilsInstance.join(platformInfo.homeDirectory, 'test'));
    });

    it('should not expand non-home paths', () => {
      const result = pathUtilsInstance.expandHome('/absolute/path');
      expect(result).toBe('/absolute/path');
    });
  });

  describe('platform-specific directories', () => {
    it('should get config directory', () => {
      const result = pathUtilsInstance.getConfigDirectory();
      expect(result).toBeTruthy();
      expect(pathUtilsInstance.isAbsolute(result)).toBe(true);
    });

    it('should get data directory', () => {
      const result = pathUtilsInstance.getDataDirectory();
      expect(result).toBeTruthy();
      expect(pathUtilsInstance.isAbsolute(result)).toBe(true);
    });

    it('should get cache directory', () => {
      const result = pathUtilsInstance.getCacheDirectory();
      expect(result).toBeTruthy();
      expect(pathUtilsInstance.isAbsolute(result)).toBe(true);
    });
  });

  describe('security', () => {
    it('should validate safe paths', () => {
      const baseDir = '/safe/base';
      const safePath = 'subdir/file.txt';
      const result = pathUtilsInstance.isSafePath(safePath, baseDir);
      expect(result).toBe(true);
    });

    it('should reject unsafe paths with directory traversal', () => {
      const baseDir = '/safe/base';
      const unsafePath = '../../../etc/passwd';
      const result = pathUtilsInstance.isSafePath(unsafePath, baseDir);
      expect(result).toBe(false);
    });
  });

  describe('singleton instance', () => {
    it('should provide singleton access', () => {
      expect(pathUtils).toBeInstanceOf(CrossPlatformPathUtils);
    });
  });
});