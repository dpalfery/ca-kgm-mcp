import { platformDetector } from './platform-detector.js';

export interface ShellCommand {
  command: string;
  args: string[];
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
  };
}

export interface ShellAdapter {
  listFiles(directory: string): ShellCommand;
  createDirectory(path: string): ShellCommand;
  removeFile(path: string): ShellCommand;
  removeDirectory(path: string): ShellCommand;
  copyFile(source: string, destination: string): ShellCommand;
  moveFile(source: string, destination: string): ShellCommand;
  checkFileExists(path: string): ShellCommand;
  getFileInfo(path: string): ShellCommand;
  findFiles(pattern: string, directory?: string): ShellCommand;
  setEnvironmentVariable(name: string, value: string): ShellCommand;
  getEnvironmentVariable(name: string): ShellCommand;
}

export class WindowsPowerShellAdapter implements ShellAdapter {
  listFiles(directory: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Get-ChildItem -Path "${directory}" | Format-Table -AutoSize`]
    };
  }

  createDirectory(path: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `New-Item -ItemType Directory -Path "${path}" -Force`]
    };
  }

  removeFile(path: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Remove-Item -Path "${path}" -Force`]
    };
  }

  removeDirectory(path: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Remove-Item -Path "${path}" -Recurse -Force`]
    };
  }

  copyFile(source: string, destination: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Copy-Item -Path "${source}" -Destination "${destination}" -Force`]
    };
  }

  moveFile(source: string, destination: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Move-Item -Path "${source}" -Destination "${destination}" -Force`]
    };
  }

  checkFileExists(path: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Test-Path -Path "${path}"`]
    };
  }

  getFileInfo(path: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Get-Item -Path "${path}" | Select-Object Name, Length, LastWriteTime`]
    };
  }

  findFiles(pattern: string, directory = '.'): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `Get-ChildItem -Path "${directory}" -Filter "${pattern}" -Recurse`]
    };
  }

  setEnvironmentVariable(name: string, value: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `$env:${name} = "${value}"`]
    };
  }

  getEnvironmentVariable(name: string): ShellCommand {
    return {
      command: 'powershell',
      args: ['-Command', `$env:${name}`]
    };
  }
}

export class WindowsCmdAdapter implements ShellAdapter {
  listFiles(directory: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'dir', `"${directory}"`]
    };
  }

  createDirectory(path: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'mkdir', `"${path}"`]
    };
  }

  removeFile(path: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'del', '/f', `"${path}"`]
    };
  }

  removeDirectory(path: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'rmdir', '/s', '/q', `"${path}"`]
    };
  }

  copyFile(source: string, destination: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'copy', '/y', `"${source}"`, `"${destination}"`]
    };
  }

  moveFile(source: string, destination: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'move', '/y', `"${source}"`, `"${destination}"`]
    };
  }

  checkFileExists(path: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'if', 'exist', `"${path}"`, 'echo', 'true']
    };
  }

  getFileInfo(path: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'dir', `"${path}"`]
    };
  }

  findFiles(pattern: string, directory = '.'): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'dir', '/s', '/b', `"${directory}\\${pattern}"`]
    };
  }

  setEnvironmentVariable(name: string, value: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'set', `${name}=${value}`]
    };
  }

  getEnvironmentVariable(name: string): ShellCommand {
    return {
      command: 'cmd',
      args: ['/c', 'echo', `%${name}%`]
    };
  }
}

export class UnixShellAdapter implements ShellAdapter {
  listFiles(directory: string): ShellCommand {
    return {
      command: 'ls',
      args: ['-la', directory]
    };
  }

  createDirectory(path: string): ShellCommand {
    return {
      command: 'mkdir',
      args: ['-p', path]
    };
  }

  removeFile(path: string): ShellCommand {
    return {
      command: 'rm',
      args: ['-f', path]
    };
  }

  removeDirectory(path: string): ShellCommand {
    return {
      command: 'rm',
      args: ['-rf', path]
    };
  }

  copyFile(source: string, destination: string): ShellCommand {
    return {
      command: 'cp',
      args: [source, destination]
    };
  }

  moveFile(source: string, destination: string): ShellCommand {
    return {
      command: 'mv',
      args: [source, destination]
    };
  }

  checkFileExists(path: string): ShellCommand {
    return {
      command: 'test',
      args: ['-f', path]
    };
  }

  getFileInfo(path: string): ShellCommand {
    return {
      command: 'stat',
      args: [path]
    };
  }

  findFiles(pattern: string, directory = '.'): ShellCommand {
    return {
      command: 'find',
      args: [directory, '-name', pattern]
    };
  }

  setEnvironmentVariable(name: string, value: string): ShellCommand {
    return {
      command: 'export',
      args: [`${name}=${value}`]
    };
  }

  getEnvironmentVariable(name: string): ShellCommand {
    return {
      command: 'echo',
      args: [`$${name}`]
    };
  }
}

export class ShellAdapterFactory {
  public static createAdapter(): ShellAdapter {
    const platformInfo = platformDetector.getPlatformInfo();
    const shellType = platformDetector.getShellType();

    if (platformInfo.isWindows) {
      if (shellType === 'powershell') {
        return new WindowsPowerShellAdapter();
      } else {
        return new WindowsCmdAdapter();
      }
    } else {
      return new UnixShellAdapter();
    }
  }
}

// Singleton instance
export const shellAdapter = ShellAdapterFactory.createAdapter();