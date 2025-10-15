import { PerformanceMonitor, PerformanceStats } from './performance-monitor.js';

export interface BenchmarkConfig {
  name: string;
  description: string;
  iterations: number;
  concurrency: number;
  warmupIterations?: number;
  timeout?: number;
}

export interface BenchmarkResult {
  config: BenchmarkConfig;
  stats: PerformanceStats;
  iterations: number;
  totalTime: number;
  successRate: number;
  errors: string[];
  startTime: number;
  endTime: number;
}

export interface BenchmarkSuite {
  name: string;
  benchmarks: BenchmarkConfig[];
}

/**
 * Benchmark runner for performance testing
 */
export class BenchmarkRunner {
  private monitor: PerformanceMonitor;

  constructor(monitor?: PerformanceMonitor) {
    this.monitor = monitor || new PerformanceMonitor();
  }

  /**
   * Run a single benchmark
   */
  async runBenchmark<T>(
    config: BenchmarkConfig,
    operation: () => Promise<T>
  ): Promise<BenchmarkResult> {
    console.log(`Starting benchmark: ${config.name}`);
    console.log(`Description: ${config.description}`);
    console.log(`Iterations: ${config.iterations}, Concurrency: ${config.concurrency}`);

    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Warmup phase
    if (config.warmupIterations && config.warmupIterations > 0) {
      console.log(`Warming up with ${config.warmupIterations} iterations...`);
      await this.runIterations(config.warmupIterations, 1, operation, true);
    }

    // Clear monitor data before actual benchmark
    this.monitor.clear();

    // Main benchmark phase
    console.log('Running benchmark...');
    
    try {
      const results = await this.runIterations(
        config.iterations,
        config.concurrency,
        operation,
        false,
        config.timeout
      );

      successCount = results.filter(r => r.success).length;
      errorCount = results.filter(r => !r.success).length;
      errors.push(...results.filter(r => !r.success).map(r => r.error || 'Unknown error'));

    } catch (error) {
      errors.push(`Benchmark failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const successRate = successCount / (successCount + errorCount);

    // Get performance stats from monitor
    const stats = this.monitor.getStats(totalTime);

    const result: BenchmarkResult = {
      config,
      stats,
      iterations: successCount + errorCount,
      totalTime,
      successRate,
      errors: [...new Set(errors)], // Remove duplicates
      startTime,
      endTime
    };

    console.log(`Benchmark completed: ${config.name}`);
    console.log(`Success rate: ${(successRate * 100).toFixed(1)}%`);
    console.log(`Average latency: ${stats.averageLatency.toFixed(1)}ms`);
    console.log(`P95 latency: ${stats.p95Latency.toFixed(1)}ms`);
    console.log(`Throughput: ${stats.throughput.toFixed(1)} ops/sec`);

    return result;
  }

  /**
   * Run a benchmark suite
   */
  async runSuite(
    suite: BenchmarkSuite,
    operations: Record<string, () => Promise<any>>
  ): Promise<Record<string, BenchmarkResult>> {
    console.log(`\n=== Running Benchmark Suite: ${suite.name} ===\n`);

    const results: Record<string, BenchmarkResult> = {};

    for (const benchmark of suite.benchmarks) {
      const operation = operations[benchmark.name];
      if (!operation) {
        console.error(`No operation found for benchmark: ${benchmark.name}`);
        continue;
      }

      try {
        results[benchmark.name] = await this.runBenchmark(benchmark, operation);
      } catch (error) {
        console.error(`Benchmark ${benchmark.name} failed:`, error);
      }

      console.log(''); // Add spacing between benchmarks
    }

    console.log(`=== Suite Complete: ${suite.name} ===\n`);
    this.printSuiteResults(results);

    return results;
  }

  /**
   * Run iterations with specified concurrency
   */
  private async runIterations<T>(
    iterations: number,
    concurrency: number,
    operation: () => Promise<T>,
    isWarmup: boolean = false,
    timeout?: number
  ): Promise<Array<{ success: boolean; error?: string; result?: T }>> {
    const results: Array<{ success: boolean; error?: string; result?: T }> = [];
    const batches = Math.ceil(iterations / concurrency);

    for (let batch = 0; batch < batches; batch++) {
      const batchSize = Math.min(concurrency, iterations - batch * concurrency);
      const promises: Promise<{ success: boolean; error?: string; result?: T }>[] = [];

      for (let i = 0; i < batchSize; i++) {
        const promise = this.runSingleIteration(operation, isWarmup, timeout);
        promises.push(promise);
      }

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);

      // Progress reporting for long benchmarks
      if (!isWarmup && iterations > 100 && batch % 10 === 0) {
        const completed = Math.min((batch + 1) * concurrency, iterations);
        console.log(`Progress: ${completed}/${iterations} (${((completed / iterations) * 100).toFixed(1)}%)`);
      }
    }

    return results;
  }

  /**
   * Run a single iteration with monitoring
   */
  private async runSingleIteration<T>(
    operation: () => Promise<T>,
    isWarmup: boolean,
    timeout?: number
  ): Promise<{ success: boolean; error?: string; result?: T }> {
    const queryId = isWarmup ? '' : this.monitor.startQuery('benchmark_operation');

    try {
      let result: T;

      if (timeout) {
        result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Operation timeout')), timeout)
          )
        ]);
      } else {
        result = await operation();
      }

      if (!isWarmup) {
        this.monitor.endQuery(queryId, true);
      }

      return { success: true, result };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (!isWarmup) {
        this.monitor.endQuery(queryId, false, errorMessage);
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Print suite results summary
   */
  private printSuiteResults(results: Record<string, BenchmarkResult>): void {
    console.log('=== Benchmark Suite Results ===');
    console.log('');

    const tableData = Object.entries(results).map(([name, result]) => ({
      Benchmark: name,
      'Success Rate': `${(result.successRate * 100).toFixed(1)}%`,
      'Avg Latency': `${result.stats.averageLatency.toFixed(1)}ms`,
      'P95 Latency': `${result.stats.p95Latency.toFixed(1)}ms`,
      'Throughput': `${result.stats.throughput.toFixed(1)} ops/sec`,
      'Total Time': `${(result.totalTime / 1000).toFixed(1)}s`
    }));

    console.table(tableData);

    // Print any errors
    const benchmarksWithErrors = Object.entries(results).filter(([_, result]) => result.errors.length > 0);
    if (benchmarksWithErrors.length > 0) {
      console.log('\n=== Errors ===');
      benchmarksWithErrors.forEach(([name, result]) => {
        console.log(`\n${name}:`);
        result.errors.forEach(error => console.log(`  - ${error}`));
      });
    }
  }

  /**
   * Compare benchmark results
   */
  compareBenchmarks(
    baseline: BenchmarkResult,
    current: BenchmarkResult
  ): {
    latencyChange: number;
    throughputChange: number;
    successRateChange: number;
    summary: string;
  } {
    const latencyChange = ((current.stats.averageLatency - baseline.stats.averageLatency) / baseline.stats.averageLatency) * 100;
    const throughputChange = ((current.stats.throughput - baseline.stats.throughput) / baseline.stats.throughput) * 100;
    const successRateChange = ((current.successRate - baseline.successRate) / baseline.successRate) * 100;

    let summary = `Performance comparison:\n`;
    summary += `  Latency: ${latencyChange > 0 ? '+' : ''}${latencyChange.toFixed(1)}% (${baseline.stats.averageLatency.toFixed(1)}ms → ${current.stats.averageLatency.toFixed(1)}ms)\n`;
    summary += `  Throughput: ${throughputChange > 0 ? '+' : ''}${throughputChange.toFixed(1)}% (${baseline.stats.throughput.toFixed(1)} → ${current.stats.throughput.toFixed(1)} ops/sec)\n`;
    summary += `  Success Rate: ${successRateChange > 0 ? '+' : ''}${successRateChange.toFixed(1)}% (${(baseline.successRate * 100).toFixed(1)}% → ${(current.successRate * 100).toFixed(1)}%)`;

    return {
      latencyChange,
      throughputChange,
      successRateChange,
      summary
    };
  }

  /**
   * Generate performance report
   */
  generateReport(results: Record<string, BenchmarkResult>): string {
    const report: string[] = [];
    report.push('# Performance Benchmark Report');
    report.push('');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');

    // Summary table
    report.push('## Summary');
    report.push('');
    report.push('| Benchmark | Success Rate | Avg Latency | P95 Latency | Throughput | Total Time |');
    report.push('|-----------|--------------|-------------|-------------|------------|------------|');

    Object.entries(results).forEach(([name, result]) => {
      report.push(`| ${name} | ${(result.successRate * 100).toFixed(1)}% | ${result.stats.averageLatency.toFixed(1)}ms | ${result.stats.p95Latency.toFixed(1)}ms | ${result.stats.throughput.toFixed(1)} ops/sec | ${(result.totalTime / 1000).toFixed(1)}s |`);
    });

    report.push('');

    // Detailed results
    report.push('## Detailed Results');
    report.push('');

    Object.entries(results).forEach(([name, result]) => {
      report.push(`### ${name}`);
      report.push('');
      report.push(`**Description:** ${result.config.description}`);
      report.push(`**Configuration:** ${result.config.iterations} iterations, concurrency ${result.config.concurrency}`);
      report.push('');
      report.push('**Performance Metrics:**');
      report.push(`- Total Queries: ${result.stats.totalQueries}`);
      report.push(`- Success Rate: ${(result.successRate * 100).toFixed(1)}%`);
      report.push(`- Average Latency: ${result.stats.averageLatency.toFixed(1)}ms`);
      report.push(`- P50 Latency: ${result.stats.p50Latency.toFixed(1)}ms`);
      report.push(`- P95 Latency: ${result.stats.p95Latency.toFixed(1)}ms`);
      report.push(`- P99 Latency: ${result.stats.p99Latency.toFixed(1)}ms`);
      report.push(`- Throughput: ${result.stats.throughput.toFixed(1)} operations/second`);
      report.push(`- Error Rate: ${(result.stats.errorRate * 100).toFixed(1)}%`);
      report.push('');

      if (result.errors.length > 0) {
        report.push('**Errors:**');
        result.errors.forEach(error => {
          report.push(`- ${error}`);
        });
        report.push('');
      }
    });

    return report.join('\n');
  }

  /**
   * Get the performance monitor instance
   */
  getMonitor(): PerformanceMonitor {
    return this.monitor;
  }
}