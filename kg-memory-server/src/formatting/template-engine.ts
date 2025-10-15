import { 
  TemplateEngine, 
  TemplateData 
} from '../interfaces/output-formatter.js';
import { RankedDirective, DirectiveSeverity } from '../types.js';

/**
 * Template engine for customizable output formatting
 * Supports simple variable substitution and basic control structures
 */
export class SimpleTemplateEngine implements TemplateEngine {
  private templates: Map<string, string> = new Map();

  constructor() {
    this.registerDefaultTemplates();
  }

  /**
   * Render context block using a template
   */
  async renderTemplate(templateName: string, data: TemplateData): Promise<string> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    return this.processTemplate(template, data);
  }

  /**
   * Register a custom template
   */
  registerTemplate(name: string, template: string): void {
    this.templates.set(name, template);
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  private registerDefaultTemplates(): void {
    // Standard context block template
    this.registerTemplate('standard', `
## 📋 Project Context

**Layer**: {{context.layer}} | **Topics**: {{join context.topics ", "}} | **Confidence**: {{format_confidence context.confidence}}%

### 🎯 Relevant Directives

{{#each directives}}
{{@index}}. {{severity_icon severity}} **{{severity}}** {{text}}
   {{#if rationale}}*Rationale*: {{rationale}}{{/if}}
   {{#if example}}*Example*: \`\`\`{{example}}\`\`\`{{/if}}
   *Source*: {{rule_name ruleId}} → {{section}}

{{/each}}

{{#if diagnostics.fallbackUsed}}
⚠️ *Fallback mode used - consider checking model provider configuration*
{{/if}}
`.trim());

    // Compact template for token-constrained scenarios
    this.registerTemplate('compact', `
## 📋 Context: {{context.layer}}

{{#each directives}}
{{@index}}. {{severity_icon severity}} {{text}}
{{/each}}
`.trim());

    // Detailed template with all information
    this.registerTemplate('detailed', `
## 📋 Project Context

**Layer**: {{context.layer}}
**Topics**: {{join context.topics ", "}}
**Keywords**: {{join context.keywords ", "}}
**Technologies**: {{join context.technologies ", "}}
**Confidence**: {{context.confidence}}%

### 🔴 MUST Requirements
{{#each (filter_by_severity directives "MUST")}}
{{@index}}. {{text}}
   {{#if rationale}}**Rationale**: {{rationale}}{{/if}}
   {{#if example}}**Example**:
   \`\`\`
   {{example}}
   \`\`\`{{/if}}
   {{#if antiPattern}}**Anti-pattern**:
   \`\`\`
   {{antiPattern}}
   \`\`\`{{/if}}
   *Source*: {{rule_name ruleId}} → {{section}}

{{/each}}

### 🟡 SHOULD Requirements
{{#each (filter_by_severity directives "SHOULD")}}
{{@index}}. {{text}}
   {{#if rationale}}**Rationale**: {{rationale}}{{/if}}
   *Source*: {{rule_name ruleId}} → {{section}}

{{/each}}

### 🟢 MAY Suggestions
{{#each (filter_by_severity directives "MAY")}}
{{@index}}. {{text}}
   *Source*: {{rule_name ruleId}} → {{section}}

{{/each}}

### 🗂️ Source Navigation
{{#each citations}}
- **{{ruleName}}** ({{layer}})
  - Section: {{section}}
  - Topics: {{join topics ", "}}
  - Path: {{sourcePath}}

{{/each}}

### 🔍 Query Diagnostics
- **Performance**: {{diagnostics.queryTime}}ms total ({{diagnostics.contextDetectionTime}}ms detection, {{diagnostics.rankingTime}}ms ranking)
- **Retrieval**: {{diagnostics.returnedDirectives}}/{{diagnostics.totalDirectives}} directives ({{selection_rate diagnostics}}% selection rate)
- **Provider**: {{diagnostics.modelProvider}}{{#if diagnostics.fallbackUsed}} (fallback used){{/if}}
`.trim());

    // Debug template for troubleshooting
    this.registerTemplate('debug', `
## 🐛 Debug Information

### Context Detection
- **Layer**: {{context.layer}} ({{format_confidence context.confidence}}% confidence)
- **Topics**: {{join context.topics ", "}}
- **Keywords**: {{join context.keywords ", "}}
- **Technologies**: {{join context.technologies ", "}}

### Directives ({{directives.length}} total)
{{#each directives}}
{{@index}}. [Score: {{format_score score}}] {{severity}} - {{text}}
   Rule: {{ruleId}} | Section: {{section}}
   Score Breakdown:
   - Authority: {{scoreBreakdown.authority}}
   - Layer Match: {{scoreBreakdown.layerMatch}}
   - Topic Overlap: {{scoreBreakdown.topicOverlap}}
   - Severity Boost: {{scoreBreakdown.severityBoost}}
   - Semantic Similarity: {{scoreBreakdown.semanticSimilarity}}
   - When To Apply: {{scoreBreakdown.whenToApply}}

{{/each}}

### Performance
- **Total Time**: {{diagnostics.queryTime}}ms
- **Context Detection**: {{diagnostics.contextDetectionTime}}ms
- **Ranking**: {{diagnostics.rankingTime}}ms
- **Model Provider**: {{diagnostics.modelProvider}}
- **Fallback Used**: {{diagnostics.fallbackUsed}}
`.trim());
  }

  private processTemplate(template: string, data: TemplateData): string {
    let result = template;

    // Register helper functions
    const helpers = this.createHelpers();

    // Process each blocks first (before simple substitutions)
    result = result.replace(/\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, 
      (match, arrayPath, content) => {
        const array = this.getNestedValue(data, arrayPath.trim());
        if (!Array.isArray(array)) return '';
        
        return array.map((item, index) => {
          let itemContent = content;
          // Replace @index with current index (1-based)
          itemContent = itemContent.replace(/\{\{@index\}\}/g, (index + 1).toString());
          // Replace item properties - handle both direct values and object properties
          itemContent = itemContent.replace(/\{\{([^}#/]+)\}\}/g, (match, prop) => {
            const trimmedProp = prop.trim();
            if (trimmedProp.startsWith('@')) return match; // Skip special variables already processed
            if (trimmedProp === '.') return this.formatValue(item); // Current item
            return this.formatValue(this.getNestedValue(item, trimmedProp));
          });
          return itemContent;
        }).join('');
      }
    );

    // Process if blocks
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, condition, content) => {
        const value = this.getNestedValue(data, condition.trim());
        return value ? content : '';
      }
    );

    // Process simple variable substitutions
    result = result.replace(/\{\{([^}#/]+)\}\}/g, (match, expression) => {
      return this.evaluateExpression(expression.trim(), data, helpers);
    });

    return result.trim();
  }

  private evaluateExpression(expression: string, data: TemplateData, helpers: Record<string, Function>): string {
    // Handle helper functions
    const helperMatch = expression.match(/^(\w+)\s+(.+)$/);
    if (helperMatch) {
      const [, helperName, args] = helperMatch;
      if (helpers[helperName]) {
        const argValues = this.parseArguments(args, data);
        return helpers[helperName](...argValues);
      }
    }

    // Handle simple property access
    const value = this.getNestedValue(data, expression);
    return this.formatValue(value);
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : '';
    }, obj);
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value.toString();
    if (typeof value === 'number') return value.toString();
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
  }

  private parseArguments(argsString: string, data: TemplateData): any[] {
    // Simple argument parsing - splits by spaces and resolves each as a path or literal
    const args: any[] = [];
    const parts = argsString.match(/("[^"]*"|\S+)/g) || [];
    
    for (const part of parts) {
      // Check if it's a quoted string
      if (part.startsWith('"') && part.endsWith('"')) {
        args.push(part.slice(1, -1));
      } else {
        // Otherwise treat as a data path
        args.push(this.getNestedValue(data, part));
      }
    }
    
    return args;
  }

  private createHelpers(): Record<string, Function> {
    return {
      join: (array: any[], separator: string = ', ') => {
        if (!Array.isArray(array)) return '';
        return array.join(separator);
      },

      severity_icon: (severity: DirectiveSeverity) => {
        switch (severity) {
          case 'MUST': return '🔴';
          case 'SHOULD': return '🟡';
          case 'MAY': return '🟢';
          default: return '⚪';
        }
      },

      rule_name: (ruleId: string) => {
        return ruleId.split('-').map(part => 
          part.charAt(0).toUpperCase() + part.slice(1)
        ).join(' ');
      },

      filter_by_severity: (directives: RankedDirective[], severity: DirectiveSeverity) => {
        return directives.filter(d => d.severity === severity);
      },

      selection_rate: (diagnostics: any) => {
        if (diagnostics.totalDirectives === 0) return 0;
        return Math.round((diagnostics.returnedDirectives / diagnostics.totalDirectives) * 100);
      },

      format_confidence: (confidence: number) => {
        return Math.round(confidence * 100);
      },

      format_score: (score: number) => {
        return score.toFixed(2);
      }
    };
  }
}

/**
 * Factory for creating template engines with different capabilities
 */
export class TemplateEngineFactory {
  static createSimpleEngine(): TemplateEngine {
    return new SimpleTemplateEngine();
  }

  static createWithCustomTemplates(templates: Record<string, string>): TemplateEngine {
    const engine = new SimpleTemplateEngine();
    
    Object.entries(templates).forEach(([name, template]) => {
      engine.registerTemplate(name, template);
    });
    
    return engine;
  }
}