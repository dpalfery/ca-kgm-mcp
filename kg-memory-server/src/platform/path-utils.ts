import { join, resolve, normalize, isAbsolute, dirname, basename, extname } from 'path';
import { platformDetector } from './platform-detector.js';

export interface PathOperations {
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
  normalize(path: string): string;
  isAbsolute(path: string): boolean;
  dirname(path: string): string;
  basename(path: string, ext?: string): string;
  extname(path: string): string;
  toUnixPath(path: string): string;
  toPlatformPath(path: string): string;
  expandHome(path: string): string;
  makeRelative(from: string, to: string): string;
}

export class CrossPlatformPathUtils implements PathOperations {
  private platformInfo = platformDetector.getPlatformInfo();

  public join(...paths: string[]): string {
    return join(...paths);
  }

  public resolve(...paths: string[]): string {
    return resolve(...paths);
  }

  public normalize(path: string): string {
    return normalize(path);
  }

  public isAbsolute(path: string): boolean {
    return isAbsolute(path);
  }

  public dirname(path: string): string {
    return dirname(path);
  }

  public basename(path: string, ext?: string): string {
    return basename(path, ext);
  }

  public extname(path: string): string {
    return extname(path);
  }

  /**
   * Convert Windows-style paths to Unix-style paths
   */
  public toUnixPath(path: string): string {
    return path.replace(/\\/g, '/');
  }

  /**
   * Convert paths to platform-specific format
   */
  public toPlatformPath(path: string): string {
    if (this.platformInfo.isWindows) {
      return path.replace(/\//g, '\\');
    }
    return path.replace(/\\/g, '/');
  }

  /**
   * Expand ~ to home directory
   */
  public expandHome(path: string): string {
    if (path.startsWith('~')) {
      const expanded = path.replace('~', this.platformInfo.homeDirectory);
      return this.normalize(expanded);
    }
    return path;
  }

  /**
   * Make a relative path from one absolute path to another
   */
  public makeRelative(from: string, to: string): string {
    const { relative } = require('path');
    return relative(from, to);
  }

  /**
   * Ensure path uses correct separators for current platform
   */
  public ensurePlatformSeparators(path: string): string {
    return this.toPlatformPath(path);
  }

  /**
   * Get platform-specific config directory
   */
  public getConfigDirectory(): string {
    const { homeDirectory, isWindows, isMacOS } = this.platformInfo;
    
    if (isWindows) {
      return process.env.APPDATA || join(homeDirectory, 'AppData', 'Roaming');
    } else if (isMacOS) {
      return join(homeDirectory, 'Library', 'Application Support');
    } else {
      // Linux and other Unix-like systems
      return process.env.XDG_CONFIG_HOME || join(homeDirectory, '.config');
    }
  }

  /**
   * Get platform-specific data directory
   */
  public getDataDirectory(): string {
    const { homeDirectory, isWindows, isMacOS } = this.platformInfo;
    
    if (isWindows) {
      return process.env.LOCALAPPDATA || join(homeDirectory, 'AppData', 'Local');
    } else if (isMacOS) {
      return join(homeDirectory, 'Library', 'Application Support');
    } else {
      // Linux and other Unix-like systems
      return process.env.XDG_DATA_HOME || join(homeDirectory, '.local', 'share');
    }
  }

  /**
   * Get platform-specific cache directory
   */
  public getCacheDirectory(): string {
    const { homeDirectory, isWindows, isMacOS } = this.platformInfo;
    
    if (isWindows) {
      return process.env.TEMP || process.env.TMP || join(homeDirectory, 'AppData', 'Local', 'Temp');
    } else if (isMacOS) {
      return join(homeDirectory, 'Library', 'Caches');
    } else {
      // Linux and other Unix-like systems
      return process.env.XDG_CACHE_HOME || join(homeDirectory, '.cache');
    }
  }

  /**
   * Validate that a path is safe (no directory traversal)
   */
  public isSafePath(path: string, baseDir: string): boolean {
    const resolvedPath = resolve(baseDir, path);
    const resolvedBase = resolve(baseDir);
    return resolvedPath.startsWith(resolvedBase);
  }
}

// Singleton instance
export const pathUtils = new CrossPlatformPathUtils();