import { promises as fs, constants } from 'fs';
import { pathUtils } from './path-utils.js';
import { platformDetector } from './platform-detector.js';

export interface FileSystemOperations {
  exists(path: string): Promise<boolean>;
  readFile(path: string, encoding?: BufferEncoding): Promise<string | Buffer>;
  writeFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  appendFile(path: string, data: string | Buffer, encoding?: BufferEncoding): Promise<void>;
  deleteFile(path: string): Promise<void>;
  createDirectory(path: string, recursive?: boolean): Promise<void>;
  deleteDirectory(path: string, recursive?: boolean): Promise<void>;
  listDirectory(path: string): Promise<string[]>;
  getFileStats(path: string): Promise<FileStats>;
  copyFile(source: string, destination: string): Promise<void>;
  moveFile(source: string, destination: string): Promise<void>;
  isDirectory(path: string): Promise<boolean>;
  isFile(path: string): Promise<boolean>;
  ensureDirectory(path: string): Promise<void>;
  findFiles(pattern: RegExp, directory: string, recursive?: boolean): Promise<string[]>;
}

export interface FileStats {
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  created: Date;
  modified: Date;
  accessed: Date;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export class CrossPlatformFileSystem implements FileSystemOperations {
  private platformInfo = platformDetector.getPlatformInfo();

  public async exists(path: string): Promise<boolean> {
    try {
      await fs.access(path, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  public async readFile(path: string, encoding: BufferEncoding = 'utf8'): Promise<string | Buffer> {
    const normalizedPath = pathUtils.normalize(path);
    if (encoding) {
      return await fs.readFile(normalizedPath, encoding);
    }
    return await fs.readFile(normalizedPath);
  }

  public async writeFile(path: string, data: string | Buffer, encoding: BufferEncoding = 'utf8'): Promise<void> {
    const normalizedPath = pathUtils.normalize(path);
    await this.ensureDirectory(pathUtils.dirname(normalizedPath));
    
    if (typeof data === 'string') {
      await fs.writeFile(normalizedPath, data, encoding);
    } else {
      await fs.writeFile(normalizedPath, data);
    }
  }

  public async appendFile(path: string, data: string | Buffer, encoding: BufferEncoding = 'utf8'): Promise<void> {
    const normalizedPath = pathUtils.normalize(path);
    
    if (typeof data === 'string') {
      await fs.appendFile(normalizedPath, data, encoding);
    } else {
      await fs.appendFile(normalizedPath, data);
    }
  }

  public async deleteFile(path: string): Promise<void> {
    const normalizedPath = pathUtils.normalize(path);
    await fs.unlink(normalizedPath);
  }

  public async createDirectory(path: string, recursive = true): Promise<void> {
    const normalizedPath = pathUtils.normalize(path);
    await fs.mkdir(normalizedPath, { recursive });
  }

  public async deleteDirectory(path: string, recursive = true): Promise<void> {
    const normalizedPath = pathUtils.normalize(path);
    if (recursive) {
      await fs.rm(normalizedPath, { recursive: true, force: true });
    } else {
      await fs.rmdir(normalizedPath);
    }
  }

  public async listDirectory(path: string): Promise<string[]> {
    const normalizedPath = pathUtils.normalize(path);
    return await fs.readdir(normalizedPath);
  }

  public async getFileStats(path: string): Promise<FileStats> {
    const normalizedPath = pathUtils.normalize(path);
    const stats = await fs.stat(normalizedPath);
    
    // Check permissions
    let readable = false;
    let writable = false;
    let executable = false;

    try {
      await fs.access(normalizedPath, constants.R_OK);
      readable = true;
    } catch {}

    try {
      await fs.access(normalizedPath, constants.W_OK);
      writable = true;
    } catch {}

    try {
      await fs.access(normalizedPath, constants.X_OK);
      executable = true;
    } catch {}

    return {
      size: stats.size,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      permissions: {
        readable,
        writable,
        executable
      }
    };
  }

  public async copyFile(source: string, destination: string): Promise<void> {
    const normalizedSource = pathUtils.normalize(source);
    const normalizedDestination = pathUtils.normalize(destination);
    
    await this.ensureDirectory(pathUtils.dirname(normalizedDestination));
    await fs.copyFile(normalizedSource, normalizedDestination);
  }

  public async moveFile(source: string, destination: string): Promise<void> {
    const normalizedSource = pathUtils.normalize(source);
    const normalizedDestination = pathUtils.normalize(destination);
    
    await this.ensureDirectory(pathUtils.dirname(normalizedDestination));
    await fs.rename(normalizedSource, normalizedDestination);
  }

  public async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await this.getFileStats(path);
      return stats.isDirectory;
    } catch {
      return false;
    }
  }

  public async isFile(path: string): Promise<boolean> {
    try {
      const stats = await this.getFileStats(path);
      return stats.isFile;
    } catch {
      return false;
    }
  }

  public async ensureDirectory(path: string): Promise<void> {
    const normalizedPath = pathUtils.normalize(path);
    if (!(await this.exists(normalizedPath))) {
      await this.createDirectory(normalizedPath, true);
    }
  }

  public async findFiles(pattern: RegExp, directory: string, recursive = true): Promise<string[]> {
    const normalizedDirectory = pathUtils.normalize(directory);
    const results: string[] = [];

    const searchDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await this.listDirectory(dir);
        
        for (const entry of entries) {
          const fullPath = pathUtils.join(dir, entry);
          const stats = await this.getFileStats(fullPath);
          
          if (stats.isFile && pattern.test(entry)) {
            results.push(fullPath);
          } else if (stats.isDirectory && recursive) {
            await searchDirectory(fullPath);
          }
        }
      } catch (error) {
        // Ignore permission errors and continue
      }
    };

    await searchDirectory(normalizedDirectory);
    return results;
  }

  /**
   * Get platform-specific temporary directory
   */
  public getTempDirectory(): string {
    if (this.platformInfo.isWindows) {
      return process.env.TEMP || process.env.TMP || pathUtils.join(this.platformInfo.homeDirectory, 'AppData', 'Local', 'Temp');
    } else {
      return process.env.TMPDIR || '/tmp';
    }
  }

  /**
   * Create a temporary file with unique name
   */
  public async createTempFile(prefix = 'kg-memory', suffix = '.tmp'): Promise<string> {
    const tempDir = this.getTempDirectory();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const filename = `${prefix}-${timestamp}-${random}${suffix}`;
    const tempPath = pathUtils.join(tempDir, filename);
    
    await this.writeFile(tempPath, '');
    return tempPath;
  }

  /**
   * Safely resolve a path relative to a base directory
   */
  public resolveSafePath(basePath: string, relativePath: string): string {
    const resolved = pathUtils.resolve(basePath, relativePath);
    const normalizedBase = pathUtils.resolve(basePath);
    
    if (!resolved.startsWith(normalizedBase)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    
    return resolved;
  }

  /**
   * Get file extension with platform-specific handling
   */
  public getFileExtension(path: string): string {
    return pathUtils.extname(path).toLowerCase();
  }

  /**
   * Check if path is hidden (starts with . on Unix, has hidden attribute on Windows)
   */
  public async isHidden(path: string): Promise<boolean> {
    const basename = pathUtils.basename(path);
    
    if (!this.platformInfo.isWindows) {
      return basename.startsWith('.');
    }
    
    // On Windows, check file attributes
    try {
      const stats = await this.getFileStats(path);
      // This is a simplified check - in a real implementation,
      // you might want to use Windows-specific APIs
      return basename.startsWith('.');
    } catch {
      return false;
    }
  }
}

// Singleton instance
export const fileSystem = new CrossPlatformFileSystem();