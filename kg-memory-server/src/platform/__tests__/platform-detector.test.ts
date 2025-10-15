import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlatformDetector, platformDetector } from '../platform-detector.js';

describe('PlatformDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = PlatformDetector.getInstance();
      const instance2 = PlatformDetector.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getPlatformInfo', () => {
    it('should return platform information', () => {
      const info = platformDetector.getPlatformInfo();
      
      expect(info).toHaveProperty('platform');
      expect(info).toHaveProperty('arch');
      expect(info).toHaveProperty('release');
      expect(info).toHaveProperty('isWindows');
      expect(info).toHaveProperty('isMacOS');
      expect(info).toHaveProperty('isLinux');
      expect(info).toHaveProperty('shell');
      expect(info).toHaveProperty('pathSeparator');
      expect(info).toHaveProperty('homeDirectory');
    });

    it('should have correct boolean flags', () => {
      const info = platformDetector.getPlatformInfo();
      const trueCount = [info.isWindows, info.isMacOS, info.isLinux].filter(Boolean).length;
      expect(trueCount).toBe(1); // Only one should be true
    });
  });

  describe('isCompatiblePlatform', () => {
    it('should return true for supported platforms', () => {
      expect(platformDetector.isCompatiblePlatform()).toBe(true);
    });
  });

  describe('getShellType', () => {
    it('should return valid shell type', () => {
      const shellType = platformDetector.getShellType();
      expect(['powershell', 'cmd', 'bash', 'zsh', 'unknown']).toContain(shellType);
    });
  });

  describe('platform-specific behavior', () => {
    it('should detect Windows correctly', () => {
      const info = platformDetector.getPlatformInfo();
      if (info.platform === 'win32') {
        expect(info.isWindows).toBe(true);
        expect(info.isMacOS).toBe(false);
        expect(info.isLinux).toBe(false);
        expect(info.pathSeparator).toBe('\\');
        expect(['powershell', 'cmd']).toContain(info.shell);
      }
    });

    it('should detect macOS correctly', () => {
      const info = platformDetector.getPlatformInfo();
      if (info.platform === 'darwin') {
        expect(info.isWindows).toBe(false);
        expect(info.isMacOS).toBe(true);
        expect(info.isLinux).toBe(false);
        expect(info.pathSeparator).toBe('/');
      }
    });

    it('should detect Linux correctly', () => {
      const info = platformDetector.getPlatformInfo();
      if (info.platform === 'linux') {
        expect(info.isWindows).toBe(false);
        expect(info.isMacOS).toBe(false);
        expect(info.isLinux).toBe(true);
        expect(info.pathSeparator).toBe('/');
      }
    });
  });
});