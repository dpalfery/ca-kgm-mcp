/**
 * Test data generator utilities for creating comprehensive test datasets
 * for the Knowledge Graph Memory system validation and benchmarking.
 */

import { randomUUID } from 'crypto';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface GeneratedRule {
  id: string;
  name: string;
  layer: string;
  authoritativeFor: string[];
  topics: string[];
  sourcePath: string;
  directives: GeneratedDirective[];
}

export interface GeneratedDirective {
  id: string;
  ruleId: string;
  section: string;
  severity: 'MUST' | 'SHOULD' | 'MAY';
  text: string;
  rationale?: string;
  example?: string;
  antiPattern?: string;
  topics: string[];
  whenToApply: string[];
}

export interface GeneratedTaskDescription {
  id: string;
  description: string;
  expectedLayer: string;
  expectedTopics: string[];
  expectedKeywords: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

export class TestDataGenerator {
  private readonly layers = [
    '1-Presentation',
    '2-Application', 
    '3-Domain',
    '4-Persistence',
    '5-Infrastructure'
  ];

  private readonly topicsByLayer = {
    '1-Presentation': ['React', 'UI', 'components', 'forms', 'validation', 'CSS', 'accessibility', 'UX'],
    '2-Application': ['API', 'REST', 'GraphQL', 'services', 'authentication', 'authorization', 'caching'],
    '3-Domain': ['DDD', 'entities', 'value-objects', 'aggregates', 'business-rules', 'domain-services'],
    '4-Persistence': ['database', 'SQL', 'repositories', 'migrations', 'indexing', 'transactions'],
    '5-Infrastructure': ['Docker', 'Kubernetes', 'CI/CD', 'monitoring', 'logging', 'deployment']
  };

  private readonly severityWeights = {
    'MUST': 0.4,
    'SHOULD': 0.4, 
    'MAY': 0.2
  };

  /**
   * Generate a comprehensive set of rule documents for testing
   */
  generateRules(count: number): GeneratedRule[] {
    const rules: GeneratedRule[] = [];

    for (let i = 0; i < count; i++) {
      const layer = this.getRandomLayer();
      const topics = this.getRandomTopics(layer, 2, 5);
      const authoritativeFor = this.getRandomAuthoritativeAreas(2, 4);

      const rule: GeneratedRule = {
        id: `rule-${i.toString().padStart(3, '0')}`,
        name: this.generateRuleName(layer, topics),
        layer,
        authoritativeFor,
        topics,
        sourcePath: `rules/${layer.toLowerCase()}/${rule.id}.md`,
        directives: this.generateDirectives(rule.id, layer, topics, 3, 8)
      };

      rules.push(rule);
    }

    return rules;
  }

  /**
   * Generate task descriptions for context detection testing
   */
  generateTaskDescriptions(count: number): GeneratedTaskDescription[] {
    const tasks: GeneratedTaskDescription[] = [];

    for (let i = 0; i < count; i++) {
      const layer = this.getRandomLayer();
      const topics = this.getRandomTopics(layer, 1, 3);
      const difficulty = this.getRandomDifficulty();

      const task: GeneratedTaskDescription = {
        id: `task-${i.toString().padStart(3, '0')}`,
        description: this.generateTaskDescription(layer, topics, difficulty),
        expectedLayer: layer,
        expectedTopics: topics,
        expectedKeywords: this.extractKeywords(task.description),
        difficulty
      };

      tasks.push(task);
    }

    return tasks;
  }

  /**
   * Generate performance test scenarios
   */
  generatePerformanceScenarios(ruleCount: number, queryCount: number) {
    const rules = this.generateRules(ruleCount);
    const queries = this.generateTaskDescriptions(queryCount);

    return {
      rules,
      queries,
      scenarios: [
        {
          name: 'Sequential Queries',
          type: 'sequential',
          queryCount,
          expectedMaxLatency: this.calculateExpectedLatency(ruleCount, 'sequential')
        },
        {
          name: 'Concurrent Queries',
          type: 'concurrent',
          concurrency: Math.min(10, queryCount),
          queryCount,
          expectedMaxLatency: this.calculateExpectedLatency(ruleCount, 'concurrent')
        },
        {
          name: 'Burst Load',
          type: 'burst',
          burstSize: Math.min(50, queryCount),
          queryCount,
          expectedMaxLatency: this.calculateExpectedLatency(ruleCount, 'burst')
        }
      ]
    };
  }

  /**
   * Generate edge case scenarios for robustness testing
   */
  generateEdgeCases(): any[] {
    return [
      {
        id: 'edge-empty-query',
        description: '',
        expectedBehavior: 'Should handle gracefully with default context'
      },
      {
        id: 'edge-very-long-query',
        description: 'A'.repeat(10000),
        expectedBehavior: 'Should truncate or handle large input efficiently'
      },
      {
        id: 'edge-special-characters',
        description: 'Create component with special chars: @#$%^&*()[]{}|\\:";\'<>?,./`~',
        expectedBehavior: 'Should handle special characters without errors'
      },
      {
        id: 'edge-multilingual',
        description: 'Créer un composant React avec validation 创建带验证的React组件',
        expectedBehavior: 'Should handle non-English text appropriately'
      },
      {
        id: 'edge-ambiguous-context',
        description: 'Fix the thing that is broken',
        expectedBehavior: 'Should provide generic guidance when context is unclear'
      }
    ];
  }

  /**
   * Export generated data to files
   */
  exportToFiles(outputDir: string, data: any) {
    mkdirSync(outputDir, { recursive: true });

    // Export rules as individual markdown files
    if (data.rules) {
      const rulesDir = join(outputDir, 'generated-rules');
      mkdirSync(rulesDir, { recursive: true });

      data.rules.forEach((rule: GeneratedRule) => {
        const markdown = this.ruleToMarkdown(rule);
        writeFileSync(join(rulesDir, `${rule.id}.md`), markdown);
      });
    }

    // Export test cases as JSON
    if (data.testCases) {
      writeFileSync(
        join(outputDir, 'generated-test-cases.json'),
        JSON.stringify(data.testCases, null, 2)
      );
    }

    // Export performance scenarios
    if (data.performanceScenarios) {
      writeFileSync(
        join(outputDir, 'generated-performance-scenarios.json'),
        JSON.stringify(data.performanceScenarios, null, 2)
      );
    }

    console.log(`Test data exported to ${outputDir}`);
  }

  private getRandomLayer(): string {
    return this.layers[Math.floor(Math.random() * this.layers.length)];
  }

  private getRandomTopics(layer: string, min: number, max: number): string[] {
    const availableTopics = this.topicsByLayer[layer] || [];
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...availableTopics].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, Math.min(count, availableTopics.length));
  }

  private getRandomAuthoritativeAreas(min: number, max: number): string[] {
    const areas = ['security', 'performance', 'maintainability', 'scalability', 'usability', 'reliability'];
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const shuffled = [...areas].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  private getRandomSeverity(): 'MUST' | 'SHOULD' | 'MAY' {
    const rand = Math.random();
    if (rand < this.severityWeights.MUST) return 'MUST';
    if (rand < this.severityWeights.MUST + this.severityWeights.SHOULD) return 'SHOULD';
    return 'MAY';
  }

  private getRandomDifficulty(): 'easy' | 'medium' | 'hard' {
    const rand = Math.random();
    if (rand < 0.4) return 'easy';
    if (rand < 0.8) return 'medium';
    return 'hard';
  }

  private generateRuleName(layer: string, topics: string[]): string {
    const layerName = layer.split('-')[1];
    const primaryTopic = topics[0] || 'General';
    return `${layerName} ${primaryTopic} Rules`;
  }

  private generateDirectives(ruleId: string, layer: string, topics: string[], min: number, max: number): GeneratedDirective[] {
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    const directives: GeneratedDirective[] = [];

    for (let i = 0; i < count; i++) {
      const severity = this.getRandomSeverity();
      const directiveTopics = this.getRandomTopics(layer, 1, 3);
      
      directives.push({
        id: `${ruleId}-dir-${i}`,
        ruleId,
        section: this.generateSectionName(directiveTopics),
        severity,
        text: this.generateDirectiveText(severity, directiveTopics),
        rationale: this.generateRationale(directiveTopics),
        topics: directiveTopics,
        whenToApply: this.generateWhenToApply(directiveTopics)
      });
    }

    return directives;
  }

  private generateSectionName(topics: string[]): string {
    const primaryTopic = topics[0] || 'General';
    return primaryTopic.charAt(0).toUpperCase() + primaryTopic.slice(1);
  }

  private generateDirectiveText(severity: string, topics: string[]): string {
    const action = severity === 'MUST' ? 'implement' : severity === 'SHOULD' ? 'consider' : 'optionally use';
    const topic = topics[0] || 'appropriate practices';
    return `${severity} ${action} proper ${topic} handling to ensure system reliability and maintainability.`;
  }

  private generateRationale(topics: string[]): string {
    return `Proper ${topics.join(' and ')} implementation ensures system reliability, security, and maintainability.`;
  }

  private generateWhenToApply(topics: string[]): string[] {
    return topics.map(topic => `when working with ${topic}`);
  }

  private generateTaskDescription(layer: string, topics: string[], difficulty: 'easy' | 'medium' | 'hard'): string {
    const actions = {
      easy: ['create', 'add', 'update', 'fix'],
      medium: ['implement', 'design', 'optimize', 'refactor'],
      hard: ['architect', 'integrate', 'migrate', 'scale']
    };

    const action = actions[difficulty][Math.floor(Math.random() * actions[difficulty].length)];
    const topic = topics[0] || 'component';
    const layerContext = this.getLayerContext(layer);

    return `${action.charAt(0).toUpperCase() + action.slice(1)} ${topic} ${layerContext}`;
  }

  private getLayerContext(layer: string): string {
    const contexts = {
      '1-Presentation': 'component with user interface',
      '2-Application': 'service with business logic',
      '3-Domain': 'entity with business rules',
      '4-Persistence': 'repository with data access',
      '5-Infrastructure': 'deployment with monitoring'
    };
    return contexts[layer] || 'implementation';
  }

  private extractKeywords(description: string): string[] {
    return description
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5);
  }

  private calculateExpectedLatency(ruleCount: number, scenario: string): string {
    const baseLatency = Math.log(ruleCount) * 10;
    const multiplier = scenario === 'concurrent' ? 1.5 : scenario === 'burst' ? 2 : 1;
    return `< ${Math.ceil(baseLatency * multiplier)}ms`;
  }

  private ruleToMarkdown(rule: GeneratedRule): string {
    let markdown = `# ${rule.name}\n\n`;
    markdown += `## Metadata\n`;
    markdown += `- **Layer**: ${rule.layer}\n`;
    markdown += `- **AuthoritativeFor**: [${rule.authoritativeFor.join(', ')}]\n`;
    markdown += `- **Topics**: [${rule.topics.join(', ')}]\n\n`;
    
    markdown += `## When to Apply\n`;
    markdown += `- When working with ${rule.topics.join(' and ')}\n\n`;
    
    markdown += `## Directives\n\n`;
    
    rule.directives.forEach(directive => {
      markdown += `### ${directive.section}\n\n`;
      markdown += `**${directive.severity}** ${directive.text}\n\n`;
      if (directive.rationale) {
        markdown += `**Rationale**: ${directive.rationale}\n\n`;
      }
    });

    return markdown;
  }
}

// CLI interface for generating test data
if (require.main === module) {
  const generator = new TestDataGenerator();
  
  const args = process.argv.slice(2);
  const ruleCount = parseInt(args[0]) || 50;
  const taskCount = parseInt(args[1]) || 100;
  const outputDir = args[2] || './generated-test-data';

  console.log(`Generating test data: ${ruleCount} rules, ${taskCount} tasks`);
  
  const rules = generator.generateRules(ruleCount);
  const tasks = generator.generateTaskDescriptions(taskCount);
  const performanceScenarios = generator.generatePerformanceScenarios(ruleCount, taskCount);
  const edgeCases = generator.generateEdgeCases();

  generator.exportToFiles(outputDir, {
    rules,
    testCases: tasks,
    performanceScenarios,
    edgeCases
  });

  console.log('Test data generation completed!');
}