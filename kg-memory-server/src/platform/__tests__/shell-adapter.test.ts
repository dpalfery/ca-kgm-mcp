import { describe, it, expect, beforeEach } from 'vitest';
import { 
  WindowsPowerShellAdapter, 
  WindowsCmdAdapter, 
  UnixShellAdapter,
  ShellAdapterFactory,
  shellAdapter
} from '../shell-adapter.js';

describe('Shell Adapters', () => {
  describe('WindowsPowerShellAdapter', () => {
    let adapter: WindowsPowerShellAdapter;

    beforeEach(() => {
      adapter = new WindowsPowerShellAdapter();
    });

    it('should generate correct PowerShell commands', () => {
      const listCmd = adapter.listFiles('C:\\test');
      expect(listCmd.command).toBe('powershell');
      expect(listCmd.args).toContain('-Command');
      expect(listCmd.args.join(' ')).toContain('Get-ChildItem');

      const mkdirCmd = adapter.createDirectory('C:\\test\\new');
      expect(mkdirCmd.command).toBe('powershell');
      expect(mkdirCmd.args.join(' ')).toContain('New-Item');

      const rmCmd = adapter.removeFile('C:\\test\\file.txt');
      expect(rmCmd.command).toBe('powershell');
      expect(rmCmd.args.join(' ')).toContain('Remove-Item');
    });

    it('should handle environment variables', () => {
      const setCmd = adapter.setEnvironmentVariable('TEST_VAR', 'test_value');
      expect(setCmd.args.join(' ')).toContain('$env:TEST_VAR');

      const getCmd = adapter.getEnvironmentVariable('TEST_VAR');
      expect(getCmd.args.join(' ')).toContain('$env:TEST_VAR');
    });
  });

  describe('WindowsCmdAdapter', () => {
    let adapter: WindowsCmdAdapter;

    beforeEach(() => {
      adapter = new WindowsCmdAdapter();
    });

    it('should generate correct CMD commands', () => {
      const listCmd = adapter.listFiles('C:\\test');
      expect(listCmd.command).toBe('cmd');
      expect(listCmd.args).toContain('/c');
      expect(listCmd.args).toContain('dir');

      const mkdirCmd = adapter.createDirectory('C:\\test\\new');
      expect(mkdirCmd.command).toBe('cmd');
      expect(mkdirCmd.args).toContain('mkdir');

      const rmCmd = adapter.removeFile('C:\\test\\file.txt');
      expect(rmCmd.command).toBe('cmd');
      expect(rmCmd.args).toContain('del');
    });

    it('should handle environment variables', () => {
      const setCmd = adapter.setEnvironmentVariable('TEST_VAR', 'test_value');
      expect(setCmd.args.join(' ')).toContain('set');

      const getCmd = adapter.getEnvironmentVariable('TEST_VAR');
      expect(getCmd.args.join(' ')).toContain('%TEST_VAR%');
    });
  });

  describe('UnixShellAdapter', () => {
    let adapter: UnixShellAdapter;

    beforeEach(() => {
      adapter = new UnixShellAdapter();
    });

    it('should generate correct Unix commands', () => {
      const listCmd = adapter.listFiles('/test');
      expect(listCmd.command).toBe('ls');
      expect(listCmd.args).toContain('-la');

      const mkdirCmd = adapter.createDirectory('/test/new');
      expect(mkdirCmd.command).toBe('mkdir');
      expect(mkdirCmd.args).toContain('-p');

      const rmCmd = adapter.removeFile('/test/file.txt');
      expect(rmCmd.command).toBe('rm');
      expect(rmCmd.args).toContain('-f');
    });

    it('should handle environment variables', () => {
      const setCmd = adapter.setEnvironmentVariable('TEST_VAR', 'test_value');
      expect(setCmd.command).toBe('export');

      const getCmd = adapter.getEnvironmentVariable('TEST_VAR');
      expect(getCmd.command).toBe('echo');
      expect(getCmd.args.join(' ')).toContain('$TEST_VAR');
    });
  });

  describe('ShellAdapterFactory', () => {
    it('should create appropriate adapter for platform', () => {
      const adapter = ShellAdapterFactory.createAdapter();
      expect(adapter).toBeDefined();
      
      // Test that it implements the interface
      expect(typeof adapter.listFiles).toBe('function');
      expect(typeof adapter.createDirectory).toBe('function');
      expect(typeof adapter.removeFile).toBe('function');
    });
  });

  describe('singleton instance', () => {
    it('should provide singleton access', () => {
      expect(shellAdapter).toBeDefined();
      expect(typeof shellAdapter.listFiles).toBe('function');
    });
  });

  describe('command structure validation', () => {
    it('should return valid command structures', () => {
      const testPath = '/test/path';
      const cmd = shellAdapter.listFiles(testPath);
      
      expect(cmd).toHaveProperty('command');
      expect(cmd).toHaveProperty('args');
      expect(typeof cmd.command).toBe('string');
      expect(Array.isArray(cmd.args)).toBe(true);
    });

    it('should handle special characters in paths', () => {
      const pathWithSpaces = '/test path/with spaces';
      const cmd = shellAdapter.createDirectory(pathWithSpaces);
      
      expect(cmd.command).toBeTruthy();
      expect(cmd.args).toBeTruthy();
    });
  });
});