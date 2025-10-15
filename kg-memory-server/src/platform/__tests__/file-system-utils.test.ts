import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CrossPlatformFileSystem, fileSystem } from '../file-system-utils.js';
import { pathUtils } from '../path-utils.js';

describe('CrossPlatformFileSystem', () => {
  let fs: CrossPlatformFileSystem;
  let testDir: string;
  let testFile: string;

  beforeEach(async () => {
    fs = new CrossPlatformFileSystem();
    testDir = pathUtils.join(process.cwd(), 'test-temp-dir');
    testFile = pathUtils.join(testDir, 'test-file.txt');
    
    // Clean up any existing test directory
    if (await fs.exists(testDir)) {
      await fs.deleteDirectory(testDir, true);
    }
  });

  afterEach(async () => {
    // Clean up test directory
    if (await fs.exists(testDir)) {
      await fs.deleteDirectory(testDir, true);
    }
  });

  describe('basic file operations', () => {
    it('should create and check file existence', async () => {
      expect(await fs.exists(testFile)).toBe(false);
      
      await fs.writeFile(testFile, 'test content');
      expect(await fs.exists(testFile)).toBe(true);
    });

    it('should read and write files', async () => {
      const content = 'Hello, World!';
      await fs.writeFile(testFile, content);
      
      const readContent = await fs.readFile(testFile, 'utf8');
      expect(readContent).toBe(content);
    });

    it('should append to files', async () => {
      await fs.writeFile(testFile, 'Hello');
      await fs.appendFile(testFile, ', World!');
      
      const content = await fs.readFile(testFile, 'utf8');
      expect(content).toBe('Hello, World!');
    });

    it('should delete files', async () => {
      await fs.writeFile(testFile, 'test');
      expect(await fs.exists(testFile)).toBe(true);
      
      await fs.deleteFile(testFile);
      expect(await fs.exists(testFile)).toBe(false);
    });
  });

  describe('directory operations', () => {
    it('should create directories', async () => {
      expect(await fs.exists(testDir)).toBe(false);
      
      await fs.createDirectory(testDir);
      expect(await fs.exists(testDir)).toBe(true);
      expect(await fs.isDirectory(testDir)).toBe(true);
    });

    it('should create nested directories', async () => {
      const nestedDir = pathUtils.join(testDir, 'nested', 'deep');
      
      await fs.createDirectory(nestedDir, true);
      expect(await fs.exists(nestedDir)).toBe(true);
    });

    it('should list directory contents', async () => {
      await fs.createDirectory(testDir);
      await fs.writeFile(pathUtils.join(testDir, 'file1.txt'), 'content1');
      await fs.writeFile(pathUtils.join(testDir, 'file2.txt'), 'content2');
      
      const contents = await fs.listDirectory(testDir);
      expect(contents).toContain('file1.txt');
      expect(contents).toContain('file2.txt');
    });

    it('should ensure directory exists', async () => {
      const nestedDir = pathUtils.join(testDir, 'ensure', 'test');
      
      await fs.ensureDirectory(nestedDir);
      expect(await fs.exists(nestedDir)).toBe(true);
      
      // Should not throw if directory already exists
      await fs.ensureDirectory(nestedDir);
      expect(await fs.exists(nestedDir)).toBe(true);
    });
  });

  describe('file stats and metadata', () => {
    it('should get file stats', async () => {
      const content = 'test content';
      await fs.writeFile(testFile, content);
      
      const stats = await fs.getFileStats(testFile);
      expect(stats.size).toBe(content.length);
      expect(stats.isFile).toBe(true);
      expect(stats.isDirectory).toBe(false);
      expect(stats.created).toBeInstanceOf(Date);
      expect(stats.modified).toBeInstanceOf(Date);
    });

    it('should check if path is file or directory', async () => {
      await fs.createDirectory(testDir);
      await fs.writeFile(testFile, 'content');
      
      expect(await fs.isDirectory(testDir)).toBe(true);
      expect(await fs.isFile(testDir)).toBe(false);
      
      expect(await fs.isFile(testFile)).toBe(true);
      expect(await fs.isDirectory(testFile)).toBe(false);
    });
  });

  describe('file operations', () => {
    it('should copy files', async () => {
      const sourceFile = pathUtils.join(testDir, 'source.txt');
      const destFile = pathUtils.join(testDir, 'dest.txt');
      
      await fs.writeFile(sourceFile, 'test content');
      await fs.copyFile(sourceFile, destFile);
      
      expect(await fs.exists(destFile)).toBe(true);
      const content = await fs.readFile(destFile, 'utf8');
      expect(content).toBe('test content');
    });

    it('should move files', async () => {
      const sourceFile = pathUtils.join(testDir, 'source.txt');
      const destFile = pathUtils.join(testDir, 'dest.txt');
      
      await fs.writeFile(sourceFile, 'test content');
      await fs.moveFile(sourceFile, destFile);
      
      expect(await fs.exists(sourceFile)).toBe(false);
      expect(await fs.exists(destFile)).toBe(true);
      const content = await fs.readFile(destFile, 'utf8');
      expect(content).toBe('test content');
    });
  });

  describe('search operations', () => {
    it('should find files by pattern', async () => {
      await fs.createDirectory(testDir);
      await fs.writeFile(pathUtils.join(testDir, 'test1.txt'), 'content');
      await fs.writeFile(pathUtils.join(testDir, 'test2.txt'), 'content');
      await fs.writeFile(pathUtils.join(testDir, 'other.md'), 'content');
      
      const txtFiles = await fs.findFiles(/\.txt$/, testDir, false);
      expect(txtFiles).toHaveLength(2);
      expect(txtFiles.some(f => f.includes('test1.txt'))).toBe(true);
      expect(txtFiles.some(f => f.includes('test2.txt'))).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should get temp directory', () => {
      const tempDir = fs.getTempDirectory();
      expect(tempDir).toBeTruthy();
    });

    it('should create temp files', async () => {
      const tempFile = await fs.createTempFile('test', '.tmp');
      expect(await fs.exists(tempFile)).toBe(true);
      expect(tempFile).toContain('test');
      expect(tempFile).toContain('.tmp');
      
      // Clean up
      await fs.deleteFile(tempFile);
    });

    it('should resolve safe paths', () => {
      const basePath = '/safe/base';
      const safePath = fs.resolveSafePath(basePath, 'subdir/file.txt');
      expect(safePath).toContain('subdir');
      
      expect(() => {
        fs.resolveSafePath(basePath, '../../../etc/passwd');
      }).toThrow('Path traversal detected');
    });

    it('should get file extensions', () => {
      expect(fs.getFileExtension('test.txt')).toBe('.txt');
      expect(fs.getFileExtension('test.TXT')).toBe('.txt');
      expect(fs.getFileExtension('test')).toBe('');
    });
  });

  describe('singleton instance', () => {
    it('should provide singleton access', () => {
      expect(fileSystem).toBeInstanceOf(CrossPlatformFileSystem);
    });
  });
});