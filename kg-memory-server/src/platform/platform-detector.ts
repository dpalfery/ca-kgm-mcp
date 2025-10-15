import { platform, arch, release } from 'os';

export interface PlatformInfo {
  platform: NodeJS.Platform;
  arch: string;
  release: string;
  isWindows: boolean;
  isMacOS: boolean;
  isLinux: boolean;
  shell: string;
  pathSeparator: string;
  homeDirectory: string;
}

export class PlatformDetector {
  private static _instance: PlatformDetector;
  private _platformInfo: PlatformInfo;

  private constructor() {
    this._platformInfo = this.detectPlatform();
  }

  public static getInstance(): PlatformDetector {
    if (!PlatformDetector._instance) {
      PlatformDetector._instance = new PlatformDetector();
    }
    return PlatformDetector._instance;
  }

  public getPlatformInfo(): PlatformInfo {
    return { ...this._platformInfo };
  }

  private detectPlatform(): PlatformInfo {
    const currentPlatform = platform();
    const currentArch = arch();
    const currentRelease = release();

    const isWindows = currentPlatform === 'win32';
    const isMacOS = currentPlatform === 'darwin';
    const isLinux = currentPlatform === 'linux';

    // Detect shell environment
    let shell = 'bash'; // default
    if (isWindows) {
      // Check for PowerShell vs CMD
      const shellEnv = process.env.SHELL || process.env.ComSpec || '';
      if (shellEnv.toLowerCase().includes('powershell') || process.env.PSModulePath) {
        shell = 'powershell';
      } else {
        shell = 'cmd';
      }
    } else if (isMacOS) {
      shell = process.env.SHELL?.split('/').pop() || 'zsh';
    } else if (isLinux) {
      shell = process.env.SHELL?.split('/').pop() || 'bash';
    }

    // Path separator
    const pathSeparator = isWindows ? '\\' : '/';

    // Home directory
    const homeDirectory = process.env.HOME || process.env.USERPROFILE || process.cwd();

    return {
      platform: currentPlatform,
      arch: currentArch,
      release: currentRelease,
      isWindows,
      isMacOS,
      isLinux,
      shell,
      pathSeparator,
      homeDirectory
    };
  }

  public isCompatiblePlatform(): boolean {
    const { isWindows, isMacOS, isLinux } = this._platformInfo;
    return isWindows || isMacOS || isLinux;
  }

  public getShellType(): 'powershell' | 'cmd' | 'bash' | 'zsh' | 'unknown' {
    const { shell } = this._platformInfo;
    
    if (shell === 'powershell' || shell === 'pwsh') return 'powershell';
    if (shell === 'cmd') return 'cmd';
    if (shell === 'bash') return 'bash';
    if (shell === 'zsh') return 'zsh';
    
    return 'unknown';
  }
}

// Singleton instance
export const platformDetector = PlatformDetector.getInstance();