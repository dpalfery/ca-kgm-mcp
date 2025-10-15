export interface ProfilerOptions {
  enabled?: boolean;
  sampleRate?: number;
  maxSamples?: number;
}

export interface ProfileSample {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  children: ProfileSample[];
  metadata?: Record<string, any>;
}

export interface ProfilerReport {
  totalTime: number;
  samples: ProfileSample[];
  hotspots: Array<{
    name: string;
    totalTime: number;
    selfTime: number;
    callCount: number;
    averageTime: number;
  }>;
  callTree: ProfileSample[];
}

/**
 * Performance profiler for identifying bottlenecks in query processing
 */
export class Profiler {
  private enabled: boolean;
  private sampleRate: number;
  private maxSamples: number;
  private samples: ProfileSample[] = [];
  private activeStack: ProfileSample[] = [];
  private sampleCount = 0;

  constructor(options: ProfilerOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.sampleRate = options.sampleRate ?? 1.0; // 100% sampling by default
    this.maxSamples = options.maxSamples ?? 10000;
  }

  /**
   * Start profiling a function or code block
   */
  start(name: string, metadata?: Record<string, any>): string | null {
    if (!this.enabled || !this.shouldSample()) {
      return null;
    }

    const sample: ProfileSample = {
      name,
      startTime: this.getHighResTime(),
      children: [],
      metadata
    };

    // Add to parent's children if we're in a nested call
    if (this.activeStack.length > 0) {
      const parent = this.activeStack[this.activeStack.length - 1];
      parent.children.push(sample);
    } else {
      // Top-level sample
      this.samples.push(sample);
    }

    this.activeStack.push(sample);
    this.sampleCount++;

    // Trim samples if we exceed the limit
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    return this.generateSampleId(sample);
  }

  /**
   * End profiling for a code block
   */
  end(sampleId: string | null): void {
    if (!this.enabled || !sampleId || this.activeStack.length === 0) {
      return;
    }

    const sample = this.activeStack.pop();
    if (sample) {
      sample.endTime = this.getHighResTime();
      sample.duration = sample.endTime - sample.startTime;
    }
  }

  /**
   * Profile a function call
   */
  async profile<T>(
    name: string,
    fn: () => Promise<T> | T,
    metadata?: Record<string, any>
  ): Promise<T> {
    const sampleId = this.start(name, metadata);
    
    try {
      const result = await fn();
      return result;
    } finally {
      this.end(sampleId);
    }
  }

  /**
   * Profile a synchronous function call
   */
  profileSync<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, any>
  ): T {
    const sampleId = this.start(name, metadata);
    
    try {
      return fn();
    } finally {
      this.end(sampleId);
    }
  }

  /**
   * Generate a profiler report
   */
  generateReport(): ProfilerReport {
    const totalTime = this.calculateTotalTime();
    const hotspots = this.calculateHotspots();
    const callTree = this.buildCallTree();

    return {
      totalTime,
      samples: [...this.samples],
      hotspots,
      callTree
    };
  }

  /**
   * Get performance hotspots (functions taking the most time)
   */
  getHotspots(limit: number = 10): Array<{
    name: string;
    totalTime: number;
    selfTime: number;
    callCount: number;
    averageTime: number;
  }> {
    return this.calculateHotspots().slice(0, limit);
  }

  /**
   * Get call tree for visualization
   */
  getCallTree(): ProfileSample[] {
    return this.buildCallTree();
  }

  /**
   * Clear all profiling data
   */
  clear(): void {
    this.samples = [];
    this.activeStack = [];
    this.sampleCount = 0;
  }

  /**
   * Enable/disable profiling
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  /**
   * Check if profiling is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get profiling statistics
   */
  getStats(): {
    enabled: boolean;
    sampleCount: number;
    totalSamples: number;
    memoryUsage: number;
  } {
    return {
      enabled: this.enabled,
      sampleCount: this.sampleCount,
      totalSamples: this.samples.length,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Export profiling data for external analysis
   */
  exportData(): {
    samples: ProfileSample[];
    metadata: {
      sampleRate: number;
      maxSamples: number;
      totalSamples: number;
      exportTime: number;
    };
  } {
    return {
      samples: [...this.samples],
      metadata: {
        sampleRate: this.sampleRate,
        maxSamples: this.maxSamples,
        totalSamples: this.samples.length,
        exportTime: Date.now()
      }
    };
  }

  /**
   * Import profiling data
   */
  importData(data: { samples: ProfileSample[] }): void {
    this.samples = [...data.samples];
    this.sampleCount = this.samples.length;
  }

  /**
   * Create a profiling decorator for methods
   */
  createDecorator(name?: string) {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
      const originalMethod = descriptor.value;
      const profileName = name || `${target.constructor.name}.${propertyKey}`;

      descriptor.value = async function (...args: any[]) {
        return await this.profile(profileName, () => originalMethod.apply(this, args));
      };

      return descriptor;
    };
  }

  /**
   * Determine if we should sample this call
   */
  private shouldSample(): boolean {
    return Math.random() < this.sampleRate;
  }

  /**
   * Get high-resolution timestamp
   */
  private getHighResTime(): number {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  /**
   * Generate unique sample ID
   */
  private generateSampleId(sample: ProfileSample): string {
    return `${sample.name}_${sample.startTime}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate total profiling time
   */
  private calculateTotalTime(): number {
    return this.samples.reduce((total, sample) => {
      return total + (sample.duration || 0);
    }, 0);
  }

  /**
   * Calculate performance hotspots
   */
  private calculateHotspots(): Array<{
    name: string;
    totalTime: number;
    selfTime: number;
    callCount: number;
    averageTime: number;
  }> {
    const functionStats = new Map<string, {
      totalTime: number;
      selfTime: number;
      callCount: number;
    }>();

    const processSample = (sample: ProfileSample) => {
      if (!sample.duration) return;

      const stats = functionStats.get(sample.name) || {
        totalTime: 0,
        selfTime: 0,
        callCount: 0
      };

      stats.totalTime += sample.duration;
      stats.callCount += 1;

      // Calculate self time (time spent in this function excluding children)
      const childrenTime = sample.children.reduce((sum, child) => {
        return sum + (child.duration || 0);
      }, 0);
      stats.selfTime += sample.duration - childrenTime;

      functionStats.set(sample.name, stats);

      // Process children recursively
      sample.children.forEach(processSample);
    };

    this.samples.forEach(processSample);

    return Array.from(functionStats.entries())
      .map(([name, stats]) => ({
        name,
        totalTime: stats.totalTime,
        selfTime: stats.selfTime,
        callCount: stats.callCount,
        averageTime: stats.totalTime / stats.callCount
      }))
      .sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Build call tree for visualization
   */
  private buildCallTree(): ProfileSample[] {
    // Return a deep copy of the samples to avoid mutation
    return JSON.parse(JSON.stringify(this.samples));
  }

  /**
   * Estimate memory usage of profiling data
   */
  private estimateMemoryUsage(): number {
    // Rough estimate: each sample takes about 200 bytes
    return this.samples.length * 200;
  }
}

/**
 * Global profiler instance
 */
export const globalProfiler = new Profiler({ enabled: false });

/**
 * Profiling decorator for class methods
 */
export function profile(name?: string) {
  return globalProfiler.createDecorator(name);
}

/**
 * Utility function to profile async operations
 */
export async function profileAsync<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  return await globalProfiler.profile(name, fn, metadata);
}

/**
 * Utility function to profile synchronous operations
 */
export function profileSync<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>
): T {
  return globalProfiler.profileSync(name, fn, metadata);
}