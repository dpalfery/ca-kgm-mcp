import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Profiler, globalProfiler, profileAsync, profileSync } from '../profiler.js';

describe('Profiler', () => {
  let profiler: Profiler;

  beforeEach(() => {
    profiler = new Profiler({ enabled: true, sampleRate: 1.0 });
  });

  afterEach(() => {
    profiler.clear();
  });

  describe('basic profiling', () => {
    it('should profile synchronous operations', () => {
      const result = profiler.profileSync('test_sync', () => {
        // Simulate some work
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      });

      expect(result).toBe(499500); // Sum of 0 to 999

      const report = profiler.generateReport();
      expect(report.samples).toHaveLength(1);
      expect(report.samples[0].name).toBe('test_sync');
      expect(report.samples[0].duration).toBeGreaterThan(0);
    });

    it('should profile asynchronous operations', async () => {
      const result = await profiler.profile('test_async', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'async_result';
      });

      expect(result).toBe('async_result');

      const report = profiler.generateReport();
      expect(report.samples).toHaveLength(1);
      expect(report.samples[0].name).toBe('test_async');
      expect(report.samples[0].duration).toBeGreaterThan(40);
    });

    it('should handle nested profiling', async () => {
      await profiler.profile('outer_operation', async () => {
        await profiler.profile('inner_operation_1', async () => {
          await new Promise(resolve => setTimeout(resolve, 20));
        });

        await profiler.profile('inner_operation_2', async () => {
          await new Promise(resolve => setTimeout(resolve, 30));
        });
      });

      const report = profiler.generateReport();
      expect(report.samples).toHaveLength(1);
      
      const outerSample = report.samples[0];
      expect(outerSample.name).toBe('outer_operation');
      expect(outerSample.children).toHaveLength(2);
      expect(outerSample.children[0].name).toBe('inner_operation_1');
      expect(outerSample.children[1].name).toBe('inner_operation_2');
    });

    it('should track metadata', async () => {
      await profiler.profile('test_with_metadata', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      }, { userId: '123', operation: 'test' });

      const report = profiler.generateReport();
      expect(report.samples[0].metadata).toEqual({
        userId: '123',
        operation: 'test'
      });
    });
  });

  describe('manual start/end profiling', () => {
    it('should support manual start/end', () => {
      const sampleId = profiler.start('manual_operation');
      
      // Simulate work
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
      
      profiler.end(sampleId);

      const report = profiler.generateReport();
      expect(report.samples).toHaveLength(1);
      expect(report.samples[0].name).toBe('manual_operation');
      expect(report.samples[0].duration).toBeGreaterThan(0);
    });

    it('should handle invalid sample IDs gracefully', () => {
      expect(() => {
        profiler.end('invalid_id');
      }).not.toThrow();

      expect(() => {
        profiler.end(null);
      }).not.toThrow();
    });

    it('should handle nested manual profiling', () => {
      const outer = profiler.start('outer');
      const inner = profiler.start('inner');
      
      profiler.end(inner);
      profiler.end(outer);

      const report = profiler.generateReport();
      expect(report.samples).toHaveLength(1);
      expect(report.samples[0].children).toHaveLength(1);
    });
  });

  describe('sampling', () => {
    it('should respect sample rate', () => {
      const lowSampleProfiler = new Profiler({ 
        enabled: true, 
        sampleRate: 0.1 // 10% sampling
      });

      let sampledCount = 0;
      
      // Run many operations
      for (let i = 0; i < 100; i++) {
        const sampleId = lowSampleProfiler.start('test_operation');
        if (sampleId !== null) {
          sampledCount++;
          lowSampleProfiler.end(sampleId);
        }
      }

      // Should sample approximately 10% (allow some variance)
      expect(sampledCount).toBeGreaterThan(0);
      expect(sampledCount).toBeLessThan(30); // Should be much less than 100
    });

    it('should not profile when disabled', () => {
      const disabledProfiler = new Profiler({ enabled: false });

      const sampleId = disabledProfiler.start('test_operation');
      expect(sampleId).toBeNull();

      const report = disabledProfiler.generateReport();
      expect(report.samples).toHaveLength(0);
    });
  });

  describe('hotspot analysis', () => {
    it('should identify performance hotspots', async () => {
      // Create operations with different performance characteristics
      await profiler.profile('fast_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await profiler.profile('slow_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Call fast operation multiple times
      for (let i = 0; i < 3; i++) {
        await profiler.profile('fast_operation', async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }

      const hotspots = profiler.getHotspots(5);
      
      expect(hotspots.length).toBeGreaterThan(0);
      
      // Find the operations in hotspots
      const slowOp = hotspots.find(h => h.name === 'slow_operation');
      const fastOp = hotspots.find(h => h.name === 'fast_operation');
      
      expect(slowOp).toBeDefined();
      expect(fastOp).toBeDefined();
      
      // Fast operation should have higher call count
      expect(fastOp!.callCount).toBe(4); // 1 + 3 additional calls
      expect(slowOp!.callCount).toBe(1);
      
      // Slow operation should have higher average time
      expect(slowOp!.averageTime).toBeGreaterThan(fastOp!.averageTime);
    });

    it('should calculate self time correctly', async () => {
      await profiler.profile('parent_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50)); // Parent work
        
        await profiler.profile('child_operation', async () => {
          await new Promise(resolve => setTimeout(resolve, 30)); // Child work
        });
        
        await new Promise(resolve => setTimeout(resolve, 20)); // More parent work
      });

      const hotspots = profiler.getHotspots();
      const parentHotspot = hotspots.find(h => h.name === 'parent_operation');
      const childHotspot = hotspots.find(h => h.name === 'child_operation');
      
      expect(parentHotspot).toBeDefined();
      expect(childHotspot).toBeDefined();
      
      // Parent's self time should be less than total time (excluding child)
      expect(parentHotspot!.selfTime).toBeLessThan(parentHotspot!.totalTime);
      
      // Child's self time should equal total time (no nested operations)
      expect(childHotspot!.selfTime).toBeCloseTo(childHotspot!.totalTime, 5);
    });
  });

  describe('call tree', () => {
    it('should build accurate call tree', async () => {
      await profiler.profile('root', async () => {
        await profiler.profile('branch_a', async () => {
          await profiler.profile('leaf_a1', async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
          });
          
          await profiler.profile('leaf_a2', async () => {
            await new Promise(resolve => setTimeout(resolve, 15));
          });
        });
        
        await profiler.profile('branch_b', async () => {
          await profiler.profile('leaf_b1', async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
          });
        });
      });

      const callTree = profiler.getCallTree();
      
      expect(callTree).toHaveLength(1);
      expect(callTree[0].name).toBe('root');
      expect(callTree[0].children).toHaveLength(2);
      
      const branchA = callTree[0].children[0];
      const branchB = callTree[0].children[1];
      
      expect(branchA.name).toBe('branch_a');
      expect(branchA.children).toHaveLength(2);
      
      expect(branchB.name).toBe('branch_b');
      expect(branchB.children).toHaveLength(1);
    });
  });

  describe('profiler report', () => {
    it('should generate comprehensive report', async () => {
      await profiler.profile('operation_1', async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
      });

      await profiler.profile('operation_2', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const report = profiler.generateReport();
      
      expect(report.totalTime).toBeGreaterThan(70);
      expect(report.samples).toHaveLength(2);
      expect(report.hotspots).toHaveLength(2);
      expect(report.callTree).toHaveLength(2);
      
      // Hotspots should be sorted by total time
      expect(report.hotspots[0].totalTime).toBeGreaterThanOrEqual(report.hotspots[1].totalTime);
    });
  });

  describe('memory management', () => {
    it('should limit sample history', () => {
      const limitedProfiler = new Profiler({ 
        enabled: true, 
        maxSamples: 5 
      });

      // Add more samples than the limit
      for (let i = 0; i < 10; i++) {
        limitedProfiler.profileSync(`operation_${i}`, () => {
          return i * 2;
        });
      }

      const report = limitedProfiler.generateReport();
      expect(report.samples.length).toBeLessThanOrEqual(5);
    });

    it('should provide memory usage statistics', () => {
      // Add some samples
      for (let i = 0; i < 10; i++) {
        profiler.profileSync(`operation_${i}`, () => i);
      }

      const stats = profiler.getStats();
      expect(stats.enabled).toBe(true);
      expect(stats.sampleCount).toBe(10);
      expect(stats.totalSamples).toBe(10);
      expect(stats.memoryUsage).toBeGreaterThan(0);
    });
  });

  describe('data export/import', () => {
    it('should export and import profiling data', async () => {
      await profiler.profile('test_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      const exported = profiler.exportData();
      expect(exported.samples).toHaveLength(1);
      expect(exported.metadata.totalSamples).toBe(1);

      const newProfiler = new Profiler({ enabled: true });
      newProfiler.importData(exported);

      const importedReport = newProfiler.generateReport();
      expect(importedReport.samples).toHaveLength(1);
      expect(importedReport.samples[0].name).toBe('test_operation');
    });
  });

  describe('global profiler utilities', () => {
    it('should work with global profiler functions', async () => {
      globalProfiler.setEnabled(true);
      globalProfiler.clear();

      const asyncResult = await profileAsync('global_async', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async_result';
      });

      const syncResult = profileSync('global_sync', () => {
        return 'sync_result';
      });

      expect(asyncResult).toBe('async_result');
      expect(syncResult).toBe('sync_result');

      const report = globalProfiler.generateReport();
      expect(report.samples).toHaveLength(2);
      
      globalProfiler.setEnabled(false);
    });
  });

  describe('error handling', () => {
    it('should handle errors in profiled functions', async () => {
      let errorThrown = false;
      
      try {
        await profiler.profile('error_operation', async () => {
          throw new Error('Test error');
        });
      } catch (error) {
        errorThrown = true;
        expect(error.message).toBe('Test error');
      }

      expect(errorThrown).toBe(true);

      // Should still record the sample
      const report = profiler.generateReport();
      expect(report.samples).toHaveLength(1);
      expect(report.samples[0].name).toBe('error_operation');
    });

    it('should handle synchronous errors', () => {
      let errorThrown = false;
      
      try {
        profiler.profileSync('sync_error_operation', () => {
          throw new Error('Sync test error');
        });
      } catch (error) {
        errorThrown = true;
        expect(error.message).toBe('Sync test error');
      }

      expect(errorThrown).toBe(true);

      const report = profiler.generateReport();
      expect(report.samples).toHaveLength(1);
    });
  });
});