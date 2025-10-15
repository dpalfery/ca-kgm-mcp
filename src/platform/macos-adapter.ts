/**
 * macOS-specific platform adapter for local model detection
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, ProcessInfo, ServiceInfo, LocalModelProviderInfo } from './interfaces.js';

const execAsync = promisify(exec);

export class MacOSPlatformAdapter implements PlatformAdapter {
  getPlatform(): 'macos' {
    return 'macos';
  }

  async isProcessRunning(processName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`pgrep -f "${processName}"`);
      return stdout.trim().length > 0;
    } catch (error) {
      // pgrep returns exit code 1 when no processes found
      return false;
    }
  }

  async getRunningProcesses(namePattern: string): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync(`ps aux | grep -i "${namePattern}" | grep -v grep`);
      const lines = stdout.trim().split('\n');
      const processes: ProcessInfo[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 11) {
          const pid = parseInt(parts[1], 10);
          const command = parts.slice(10).join(' ');
          const name = parts[10].split('/').pop() || parts[10];
          
          if (!isNaN(pid)) {
            processes.push({
              pid,
              name,
              command
            });
          }
        }
      }

      return processes;
    } catch (error) {
      console.warn(`Failed to get running processes for pattern ${namePattern}:`, error);
      return [];
    }
  }

  async isServiceRunning(serviceName: string): Promise<boolean> {
    try {
      // Check launchd services
      const { stdout } = await execAsync(`launchctl list | grep "${serviceName}"`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  async getServiceInfo(serviceName: string): Promise<ServiceInfo | null> {
    try {
      const { stdout } = await execAsync(`launchctl list | grep "${serviceName}"`);
      
      if (stdout.trim().length === 0) {
        return null;
      }

      const lines = stdout.trim().split('\n');
      const line = lines[0];
      const parts = line.trim().split(/\s+/);
      
      if (parts.length >= 3) {
        const pid = parts[0];
        const status = pid === '-' ? 'stopped' : 'running';
        
        return {
          name: serviceName,
          status: status as 'running' | 'stopped'
        };
      }

      return {
        name: serviceName,
        status: 'unknown'
      };
    } catch (error) {
      return null;
    }
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port}`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  async getProcessOnPort(port: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} -t`);
      const pidStr = stdout.trim();
      
      if (!pidStr) {
        return null;
      }

      const pid = parseInt(pidStr, 10);
      if (isNaN(pid)) {
        return null;
      }

      // Get process name from PID
      try {
        const { stdout: psOutput } = await execAsync(`ps -p ${pid} -o comm=`);
        const name = psOutput.trim().split('/').pop() || `Process-${pid}`;
        
        return {
          pid,
          name,
          port
        };
      } catch {
        return {
          pid,
          name: `Process-${pid}`,
          port
        };
      }
    } catch (error) {
      return null;
    }
  }

  async isApplicationInstalled(appName: string): Promise<boolean> {
    try {
      // Check in /Applications
      const { stdout: appsCheck } = await execAsync(`ls "/Applications" | grep -i "${appName}"`);
      if (appsCheck.trim().length > 0) {
        return true;
      }
    } catch {
      // Directory might not exist or no permission
    }

    try {
      // Check in /usr/local/bin
      const { stdout: binCheck } = await execAsync(`ls "/usr/local/bin" | grep -i "${appName}"`);
      if (binCheck.trim().length > 0) {
        return true;
      }
    } catch {
      // Directory might not exist
    }

    try {
      // Check if it's available in PATH
      await execAsync(`which ${appName}`);
      return true;
    } catch {
      return false;
    }
  }

  async getApplicationPath(appName: string): Promise<string | null> {
    try {
      // Try to find in PATH first
      const { stdout } = await execAsync(`which ${appName}`);
      const path = stdout.trim();
      if (path) {
        return path;
      }
    } catch {
      // Not in PATH, try other locations
    }

    try {
      // Check in /Applications
      const { stdout: appsCheck } = await execAsync(`find "/Applications" -name "*${appName}*" -type d -maxdepth 2 2>/dev/null`);
      const appPaths = appsCheck.trim().split('\n').filter(p => p.trim());
      if (appPaths.length > 0) {
        return appPaths[0];
      }
    } catch {
      // Search failed
    }

    try {
      // Check in /usr/local/bin
      const { stdout: binCheck } = await execAsync(`find "/usr/local/bin" -name "*${appName}*" 2>/dev/null`);
      const binPaths = binCheck.trim().split('\n').filter(p => p.trim());
      if (binPaths.length > 0) {
        return binPaths[0];
      }
    } catch {
      // Search failed
    }

    return null;
  }

  /**
   * macOS-specific method to detect local model providers
   */
  async detectLocalModelProviders(): Promise<LocalModelProviderInfo[]> {
    const providers: LocalModelProviderInfo[] = [];

    // Check for Ollama
    const ollamaInfo: LocalModelProviderInfo = {
      name: 'Ollama',
      isInstalled: await this.isApplicationInstalled('ollama'),
      isRunning: false
    };

    if (ollamaInfo.isInstalled) {
      ollamaInfo.isRunning = await this.isProcessRunning('ollama') || await this.isPortInUse(11434);
      if (ollamaInfo.isRunning) {
        ollamaInfo.port = 11434;
      }
      ollamaInfo.executable = await this.getApplicationPath('ollama');
    }

    providers.push(ollamaInfo);

    // Check for LocalAI
    const localAIInfo: LocalModelProviderInfo = {
      name: 'LocalAI',
      isInstalled: await this.isApplicationInstalled('local-ai') || await this.isProcessRunning('local-ai'),
      isRunning: false
    };

    if (localAIInfo.isInstalled) {
      localAIInfo.isRunning = await this.isProcessRunning('local-ai') || await this.isPortInUse(8080);
      if (localAIInfo.isRunning) {
        localAIInfo.port = 8080;
      }
    }

    providers.push(localAIInfo);

    // Check for LM Studio
    const lmStudioInfo: LocalModelProviderInfo = {
      name: 'LM Studio',
      isInstalled: await this.isApplicationInstalled('LM Studio') || 
                   await this.isApplicationInstalled('lmstudio') ||
                   (await execAsync('ls "/Applications" | grep -i "lm.studio"').then(() => true).catch(() => false)),
      isRunning: false
    };

    if (lmStudioInfo.isInstalled) {
      lmStudioInfo.isRunning = await this.isProcessRunning('lmstudio') || 
                               await this.isProcessRunning('LM Studio') ||
                               await this.isPortInUse(1234);
      if (lmStudioInfo.isRunning) {
        lmStudioInfo.port = 1234;
      }
    }

    providers.push(lmStudioInfo);

    return providers;
  }
}