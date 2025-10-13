/**
 * Platform detection interfaces for cross-platform local model discovery
 */

export interface ProcessInfo {
  pid: number;
  name: string;
  command?: string;
  port?: number;
}

export interface ServiceInfo {
  name: string;
  status: 'running' | 'stopped' | 'unknown';
  port?: number;
  executable?: string;
}

export interface PlatformAdapter {
  /**
   * Get the current platform identifier
   */
  getPlatform(): 'windows' | 'macos' | 'linux';

  /**
   * Check if a specific process is running by name
   */
  isProcessRunning(processName: string): Promise<boolean>;

  /**
   * Get information about running processes matching a pattern
   */
  getRunningProcesses(namePattern: string): Promise<ProcessInfo[]>;

  /**
   * Check if a service is running (Windows services, macOS launchd, etc.)
   */
  isServiceRunning(serviceName: string): Promise<boolean>;

  /**
   * Get service information
   */
  getServiceInfo(serviceName: string): Promise<ServiceInfo | null>;

  /**
   * Check if a specific port is in use
   */
  isPortInUse(port: number): Promise<boolean>;

  /**
   * Get the process using a specific port
   */
  getProcessOnPort(port: number): Promise<ProcessInfo | null>;

  /**
   * Check if an application is installed
   */
  isApplicationInstalled(appName: string): Promise<boolean>;

  /**
   * Get application installation path
   */
  getApplicationPath(appName: string): Promise<string | null>;
}

export interface LocalModelProviderInfo {
  name: string;
  isInstalled: boolean;
  isRunning: boolean;
  port?: number;
  executable?: string;
  version?: string;
}