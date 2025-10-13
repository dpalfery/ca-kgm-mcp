/**
 * Cross-platform detector that manages platform-specific logic
 * for local model provider detection and system integration
 */

import { PlatformAdapter, LocalModelProviderInfo } from './interfaces.js';
import { WindowsPlatformAdapter } from './windows-adapter.js';
import { MacOSPlatformAdapter } from './macos-adapter.js';

export class CrossPlatformDetector {
  private adapter: PlatformAdapter;
  private platform: string;

  constructor() {
    this.platform = process.platform;
    
    if (this.platform === 'win32') {
      this.adapter = new WindowsPlatformAdapter();
    } else if (this.platform === 'darwin') {
      this.adapter = new MacOSPlatformAdapter();
    } else {
      throw new Error(`Unsupported platform: ${this.platform}. Only Windows (win