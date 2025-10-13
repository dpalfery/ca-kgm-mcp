/**
 * Windows-specific platform adapter for local model detection
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { PlatformAdapter, ProcessInfo, ServiceInfo, LocalModelProviderInfo } from './interfaces.js';

const execAsync = promisify(exec);

export class WindowsPlatformAdapter implements PlatformAdapter {
  getPlatform(): 'windows' {
    return 'windows';
  }

  async isProcessRunning(processName: string): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`tasklist /FI "IMAGENAME eq ${processName}" /FO CSV`);
      return stdout.includes(processName);
    } catch (error) {
      console.warn(`Failed to check process ${processName}:`, error);
      return false;
    }
  }

  async getRunningProcesses(namePattern: string): Promise<ProcessInfo[]> {
    try {
      const { stdout } = await execAsync('tasklist /FO CSV');
      const lines = stdout.split('\n').slice(1); // Skip header
      const processes: ProcessInfo[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        
        const columns = line.split('","').map(col => col.replace(/"/g, ''));
        if (columns.length >= 2) {
          const [name, pidStr] = columns;
          const pid = parseInt(pidStr, 10);
          
          if (name.toLowerCase().includes(namePattern.toLowerCase()) && !isNaN(pid)) {
            processes.push({
              pid,
              name,
              command: name
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
      const { stdout } = await execAsync(`sc query "${serviceName}"`);
      return stdout.includes('RUNNING');
    } catch (error) {
      // Service might not exist or access denied
      return false;
    }
  }

  async getServiceInfo(serviceName: string): Promise<ServiceInfo | null> {
    try {
      const { stdout } = await execAsync(`sc query "${serviceName}"`);
      
      const isRunning = stdout.includes('RUNNING');
      const status = isRunning ? 'running' : stdout.includes('STOPPED') ? 'stopped' : 'unknown';
      
      return {
        name: serviceName,
        status: status as 'running' | 'stopped' | 'unknown'
      };
    } catch (error) {
      return null;
    }
  }

  async isPortInUse(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`netstat -an | findstr :${port}`);
      return stdout.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  async getProcessOnPort(port: number): Promise<ProcessInfo | null> {
    try {
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
          const pid = parseInt(parts[4], 10);
          if (!isNaN(pid)) {
            // Get process name from PID
            try {
              const { stdout: tasklistOutput } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
              const taskLines = tasklistOutput.split('\n');
              if (taskLines.length > 1) {
                const processName = taskLines[1].split('","')[0].replace(/"/g, '');
                return {
                  pid,
                  name: processName,
                  port
                };
              }
            } catch {
              // Fallback to just PID
              return {
                pid,
                name: `Process-${pid}`,
                port
              };
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  async isApplicationInstalled(appName: string): Promise<boolean> {
    try {
      // Check in common installation paths
      const commonPaths = [
        `C:\\Program Files\\${appName}`,
        `C:\\Program Files (x86)\\${appName}`,
        `C:\\Users\\%USERNAME%\\AppData\\Local\\${appName}`,
        `C:\\Users\\%USERNAME%\\AppData\\Roaming\\${appName}`
      ];

      for (const path of commonPaths) {
        try {
          const { stdout } = await execAsync(`dir "${path}" 2>nul`);
          if (stdout.includes('Directory of')) {
            return true;
          }
        } catch {
          // Directory doesn't exist, continue
        }
      }

      // Check in registry for installed programs
      try {
        const { stdout } = await execAsync(
          `reg query "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall" /s /f "${appName}" 2>nul`
        );
        return stdout.includes(appName);
      } catch {
        // Registry query failed
      }

      // Check if it's available in PATH
      try {
        await execAsync(`where ${appName}`);
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      return false;
    }
  }

  async getApplicationPath(appName: string): Promise<string | null> {
    try {
      // Try to find in PATH first
      const { stdout } = await execAsync(`where ${appName}`);
      const paths = stdout.trim().split('\n');
      if (paths.length > 0 && paths[0].trim()) {
        return paths[0].trim();
      }
    } catch {
      // Not in PATH, try common locations
    }

    try {
      // Check common installation paths
      const commonPaths = [
        `C:\\Program Files\\${appName}\\${appName}.exe`,
        `C:\\Program Files (x86)\\${appName}\\${appName}.exe`,
        `C:\\Users\\%USERNAME%\\AppData\\Local\\${appName}\\${appName}.exe`,
        `C:\\Users\\%USERNAME%\\AppData\\Roaming\\${appName}\\${appName}.exe`
      ];

      for (const path of commonPaths) {
        try {
          const { stdout } = await execAsync(`dir "${path}" 2>nul`);
          if (stdout.includes(appName)) {
            return path;
          }
        } catch {
          // File doesn't exist, continue
        }
      }
    } catch (error) {
      console.warn(`Failed to get application path for ${appName}:`, error);
    }

    return null;
  }

  /**
   * Windows-specific method to detect local model providers
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
      ollamaInfo.isRunning = await this.isProcessRunning('ollama.exe') || await this.isPortInUse(11434);
      if (ollamaInfo.isRunning) {
        ollamaInfo.port = 11434;
      }
      ollamaInfo.executable = await this.getApplicationPath('ollama');
    }

    providers.push(ollamaInfo);

    // Check for LocalAI
    const localAIInfo: LocalModelProviderInfo = {
      name: 'LocalAI',
      isInstalled: await this.isApplicationInstalled('local-ai') || await this.isProcessRunning('local-ai.exe'),
      isRunning: false
    };

    if (localAIInfo.isInstalled) {
      localAIInfo.isRunning = await this.isProcessRunning('local-ai.exe') || await this.isPortInUse(8080);
      if (localAIInfo.isRunning) {
        localAIInfo.port = 8080;
      }
    }

    providers.push(localAIInfo);

    // Check for LM Studio
    const lmStudioInfo: LocalModelProviderInfo = {
      name: 'LM Studio',
      isInstalled: await this.isApplicationInstalled('LM Studio') || await this.isProcessRunning('lmstudio.exe'),
      isRunning: false
    };

    if (lmStudioInfo.isInstalled) {
      lmStudioInfo.isRunning = await this.isProcessRunning('lmstudio.exe') || await this.isPortInUse(1234);
      if (lmStudioInfo.isRunning) {
        lmStudioInfo.port = 1234;
      }
    }

    providers.push(lmStudioInfo);

    return providers;
  }
}