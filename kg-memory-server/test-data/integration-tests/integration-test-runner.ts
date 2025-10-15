/**
 * Integration Test Runner for Task 10.4
 * 
 * Executes comprehensive integration tests and generates reports
 * covering system integration, MCP compliance, and real-world scenarios
 */

import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join } from 'path';

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  output: string;
  error?: string;
}

interface TestReport {
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  results: TestResult[];
  summary: {
    mcpCompliance: boolean;
    systemIntegration: boolean;
    realWorldScenarios: boolean;
    performanceRequirements: boolean;
  };
}

class IntegrationTestRunner {
  private testFiles = [
    'mcp-protocol-compliance.test.ts',
    'real-world-scenarios.test.ts',
    'end-to-end-validation.test.ts',
    'comprehensive-integration.test.ts'
  ];

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting comprehensive integration tests for Task 10.4...\n');
    
    const startTime = Date.now();
    const results: TestResult[] = [];
    
    for (const testFile of this.testFiles) {
      console.log(`📋 Running ${testFile}...`);
      const result = await this.runSingleTest(testFile);
      results.push(result);
      
      if (result.passed) {
        console.log(`✅ ${testFile} - PASSED (${result.duration}ms)`);
      } else {
        console.log(`❌ ${testFile} - FAILED (${result.duration}ms)`);
        if (result.error) {
          console.log(`   Error: ${result.error.substring(0, 200)}...`);
        }
      }
      console.log('');
    }

    const totalDuration = Date.now() - startTime;
    const report = this.generateReport(results, totalDuration);
    
    this.printSummary(report);
    this.saveReport(report);
    
    return report;
  }

  private async runSingleTest(testFile: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const output = execSync(
        `npm run test test-data/integration-tests/${testFile}`,
        { 
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 120000 // 2 minute timeout per test file
        }
      );
      
      return {
        testFile,
        passed: true,
        duration: Date.now() - startTime,
        output
      };
    } catch (error: any) {
      return {
        testFile,
        passed: false,
        duration: Date.now() - startTime,
        output: error.stdout || '',
        error: error.message || error.toString()
      };
    }
  }

  private generateReport(results: TestResult[], totalDuration: number): TestReport {
    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    // Analyze test results for specific requirements
    const mcpCompliance = results.find(r => 
      r.testFile.includes('mcp-protocol-compliance')
    )?.passed || false;

    const systemIntegration = results.find(r => 
      r.testFile.includes('comprehensive-integration')
    )?.passed || false;

    const realWorldScenarios = results.find(r => 
      r.testFile.includes('real-world-scenarios')
    )?.passed || false;

    const performanceRequirements = results.every(r => 
      r.passed && r.duration < 60000 // All tests should complete within 1 minute
    );

    return {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedTests,
      failedTests,
      totalDuration,
      results,
      summary: {
        mcpCompliance,
        systemIntegration,
        realWorldScenarios,
        performanceRequirements
      }
    };
  }

  private printSummary(report: TestReport): void {
    console.log('📊 INTEGRATION TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passedTests}`);
    console.log(`Failed: ${report.failedTests}`);
    console.log(`Total Duration: ${(report.totalDuration / 1000).toFixed(2)}s`);
    console.log('');

    console.log('🎯 REQUIREMENT VALIDATION');
    console.log('-'.repeat(30));
    console.log(`MCP Protocol Compliance (5.1): ${report.summary.mcpCompliance ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`System Integration (5.1): ${report.summary.systemIntegration ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Real-World Scenarios (5.1-5.4): ${report.summary.realWorldScenarios ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Performance Requirements (5.2): ${report.summary.performanceRequirements ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    if (report.failedTests > 0) {
      console.log('❌ FAILED TESTS');
      console.log('-'.repeat(20));
      report.results
        .filter(r => !r.passed)
        .forEach(result => {
          console.log(`• ${result.testFile}`);
          if (result.error) {
            console.log(`  Error: ${result.error.substring(0, 100)}...`);
          }
        });
      console.log('');
    }

    const overallSuccess = report.failedTests === 0 && 
                          Object.values(report.summary).every(Boolean);

    console.log(`🏆 OVERALL RESULT: ${overallSuccess ? '✅ SUCCESS' : '❌ FAILURE'}`);
    
    if (overallSuccess) {
      console.log('');
      console.log('🎉 All integration tests passed! Task 10.4 requirements validated:');
      console.log('   • System integration with coding assistants ✅');
      console.log('   • MCP protocol compliance ✅');
      console.log('   • Real-world usage scenarios ✅');
      console.log('   • Performance and reliability requirements ✅');
    }
  }

  private saveReport(report: TestReport): void {
    const reportPath = join(__dirname, 'integration-test-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`📄 Detailed report saved to: ${reportPath}`);
  }
}

// CLI execution
async function main() {
  const runner = new IntegrationTestRunner();
  
  try {
    const report = await runner.runAllTests();
    const success = report.failedTests === 0 && 
                   Object.values(report.summary).every(Boolean);
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { IntegrationTestRunner, TestReport, TestResult };