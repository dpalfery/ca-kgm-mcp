/**
 * System validation test runner that orchestrates comprehensive testing
 * of the Knowledge Graph Memory system across all validation dimensions
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

interface ValidationResult {
  testSuite: string;
  passed: boolean;
  duration: number;
  metrics: Record<string, any>;
  errors: string[];
}

interface SystemValidationReport {
  timestamp: string;
  overallStatus: 'PASS' | 'FAIL';
  results: ValidationResult[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    totalDuration: number;
    coverageMetrics: {
      functionalCoverage: number;
      performanceCoverage: number;
      accuracyCoverage: number;
    };
  };
  recommendations: string[];
}

export class SystemValidationRunner {
  private results: ValidationResult[] = [];
  private startTime: number = 0;

  async runFullValidation(): Promise<SystemValidationReport> {
    console.log('🚀 Starting comprehensive system validation...\n');
    this.startTime = Date.now();

    // Run validation test suites in order
    await this.runTestSuite('End-to-End Workflow', 'end-to-end-validation.test.ts');
    await this.runTestSuite('Accuracy Validation', 'accuracy-validation.test.ts');
    await this.runTestSuite('Performance Validation', 'performance-validation.test.ts');
    
    // Generate comprehensive report
    const report = this.generateReport();
    
    // Save report
    await this.saveReport(report);
    
    // Print summary
    this.printSummary(report);
    
    return report;
  }

  private async runTestSuite(name: string, testFile: string): Promise<void> {
    console.log(`📋 Running ${name}...`);
    const startTime = Date.now();
    
    try {
      // Run the test suite using vitest
      const output = execSync(
        `npx vitest run ${testFile} --reporter=json`,
        { 
          cwd: join(__dirname, '../../'),
          encoding: 'utf-8',
          timeout: 300000 // 5 minute timeout
        }
      );

      const testResults = JSON.parse(output);
      const duration = Date.now() - startTime;

      const result: ValidationResult = {
        testSuite: name,
        passed: testResults.success,
        duration,
        metrics: this.extractMetrics(testResults),
        errors: testResults.errors || []
      };

      this.results.push(result);
      
      console.log(`✅ ${name} completed in ${duration}ms`);
      if (result.metrics) {
        console.log(`   Metrics: ${JSON.stringify(result.metrics, null, 2)}`);
      }
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      const result: ValidationResult = {
        testSuite: name,
        passed: false,
        duration,
        metrics: {},
        errors: [error.message]
      };

      this.results.push(result);
      console.log(`❌ ${name} failed: ${error.message}`);
    }
    
    console.log('');
  }

  private extractMetrics(testResults: any): Record<string, any> {
    // Extract relevant metrics from test output
    const metrics: Record<string, any> = {};
    
    if (testResults.testResults) {
      testResults.testResults.forEach((suite: any) => {
        suite.assertionResults?.forEach((test: any) => {
          // Look for performance metrics in test names/output
          if (test.title.includes('latency') || test.title.includes('performance')) {
            // Extract timing information if available
            metrics.performanceTests = (metrics.performanceTests || 0) + 1;
          }
          
          if (test.title.includes('accuracy') || test.title.includes('detection')) {
            metrics.accuracyTests = (metrics.accuracyTests || 0) + 1;
          }
          
          if (test.title.includes('token') || test.title.includes('reduction')) {
            metrics.tokenEfficiencyTests = (metrics.tokenEfficiencyTests || 0) + 1;
          }
        });
      });
    }
    
    return metrics;
  }

  private generateReport(): SystemValidationReport {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = this.results.length - passedTests;
    
    const report: SystemValidationReport = {
      timestamp: new Date().toISOString(),
      overallStatus: failedTests === 0 ? 'PASS' : 'FAIL',
      results: this.results,
      summary: {
        totalTests: this.results.length,
        passedTests,
        failedTests,
        totalDuration,
        coverageMetrics: this.calculateCoverageMetrics()
      },
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  private calculateCoverageMetrics() {
    // Calculate coverage across different validation dimensions
    const functionalTests = this.results.filter(r => 
      r.testSuite.includes('End-to-End') || r.testSuite.includes('Workflow')
    );
    const performanceTests = this.results.filter(r => 
      r.testSuite.includes('Performance')
    );
    const accuracyTests = this.results.filter(r => 
      r.testSuite.includes('Accuracy')
    );
    
    return {
      functionalCoverage: functionalTests.length > 0 ? 
        (functionalTests.filter(t => t.passed).length / functionalTests.length) * 100 : 0,
      performanceCoverage: performanceTests.length > 0 ? 
        (performanceTests.filter(t => t.passed).length / performanceTests.length) * 100 : 0,
      accuracyCoverage: accuracyTests.length > 0 ? 
        (accuracyTests.filter(t => t.passed).length / accuracyTests.length) * 100 : 0
    };
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Analyze results and provide recommendations
    const failedResults = this.results.filter(r => !r.passed);
    
    if (failedResults.length === 0) {
      recommendations.push('✅ All validation tests passed! System is ready for deployment.');
    } else {
      recommendations.push('❌ Some validation tests failed. Review the following:');
      
      failedResults.forEach(result => {
        recommendations.push(`  - ${result.testSuite}: ${result.errors.join(', ')}`);
      });
    }
    
    // Performance recommendations
    const performanceResult = this.results.find(r => r.testSuite.includes('Performance'));
    if (performanceResult && performanceResult.passed) {
      recommendations.push('✅ Performance requirements met');
    } else if (performanceResult) {
      recommendations.push('⚠️  Performance issues detected - consider optimization');
    }
    
    // Accuracy recommendations
    const accuracyResult = this.results.find(r => r.testSuite.includes('Accuracy'));
    if (accuracyResult && accuracyResult.passed) {
      recommendations.push('✅ Accuracy targets achieved');
    } else if (accuracyResult) {
      recommendations.push('⚠️  Accuracy below targets - review model configuration');
    }
    
    // General recommendations
    if (this.results.every(r => r.passed)) {
      recommendations.push('🎯 System validation complete - ready for production deployment');
      recommendations.push('📊 Consider setting up continuous monitoring for these metrics');
      recommendations.push('🔄 Schedule regular validation runs to ensure continued performance');
    }
    
    return recommendations;
  }

  private async saveReport(report: SystemValidationReport): Promise<void> {
    const outputDir = join(__dirname, '../validation-reports');
    mkdirSync(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = join(outputDir, `validation-report-${timestamp}.json`);
    
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Also save a human-readable summary
    const summaryPath = join(outputDir, `validation-summary-${timestamp}.md`);
    const summaryContent = this.generateMarkdownSummary(report);
    writeFileSync(summaryPath, summaryContent);
    
    console.log(`📄 Validation report saved to: ${reportPath}`);
    console.log(`📄 Summary saved to: ${summaryPath}`);
  }

  private generateMarkdownSummary(report: SystemValidationReport): string {
    let markdown = `# System Validation Report\n\n`;
    markdown += `**Generated:** ${report.timestamp}\n`;
    markdown += `**Overall Status:** ${report.overallStatus}\n\n`;
    
    markdown += `## Summary\n\n`;
    markdown += `- **Total Test Suites:** ${report.summary.totalTests}\n`;
    markdown += `- **Passed:** ${report.summary.passedTests}\n`;
    markdown += `- **Failed:** ${report.summary.failedTests}\n`;
    markdown += `- **Total Duration:** ${(report.summary.totalDuration / 1000).toFixed(2)}s\n\n`;
    
    markdown += `## Coverage Metrics\n\n`;
    markdown += `- **Functional Coverage:** ${report.summary.coverageMetrics.functionalCoverage.toFixed(1)}%\n`;
    markdown += `- **Performance Coverage:** ${report.summary.coverageMetrics.performanceCoverage.toFixed(1)}%\n`;
    markdown += `- **Accuracy Coverage:** ${report.summary.coverageMetrics.accuracyCoverage.toFixed(1)}%\n\n`;
    
    markdown += `## Test Results\n\n`;
    report.results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      markdown += `### ${status} ${result.testSuite}\n\n`;
      markdown += `- **Duration:** ${result.duration}ms\n`;
      markdown += `- **Status:** ${result.passed ? 'PASSED' : 'FAILED'}\n`;
      
      if (Object.keys(result.metrics).length > 0) {
        markdown += `- **Metrics:** ${JSON.stringify(result.metrics, null, 2)}\n`;
      }
      
      if (result.errors.length > 0) {
        markdown += `- **Errors:**\n`;
        result.errors.forEach(error => {
          markdown += `  - ${error}\n`;
        });
      }
      
      markdown += `\n`;
    });
    
    markdown += `## Recommendations\n\n`;
    report.recommendations.forEach(rec => {
      markdown += `- ${rec}\n`;
    });
    
    return markdown;
  }

  private printSummary(report: SystemValidationReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SYSTEM VALIDATION SUMMARY');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Overall Status: ${report.overallStatus === 'PASS' ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`⏱️  Total Duration: ${(report.summary.totalDuration / 1000).toFixed(2)}s`);
    console.log(`📋 Test Suites: ${report.summary.passedTests}/${report.summary.totalTests} passed`);
    
    console.log('\n📈 Coverage Metrics:');
    console.log(`   Functional: ${report.summary.coverageMetrics.functionalCoverage.toFixed(1)}%`);
    console.log(`   Performance: ${report.summary.coverageMetrics.performanceCoverage.toFixed(1)}%`);
    console.log(`   Accuracy: ${report.summary.coverageMetrics.accuracyCoverage.toFixed(1)}%`);
    
    console.log('\n💡 Recommendations:');
    report.recommendations.forEach(rec => {
      console.log(`   ${rec}`);
    });
    
    console.log('\n' + '='.repeat(60));
  }
}

// CLI interface
if (require.main === module) {
  const runner = new SystemValidationRunner();
  
  runner.runFullValidation()
    .then(report => {
      process.exit(report.overallStatus === 'PASS' ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Validation runner failed:', error);
      process.exit(1);
    });
}