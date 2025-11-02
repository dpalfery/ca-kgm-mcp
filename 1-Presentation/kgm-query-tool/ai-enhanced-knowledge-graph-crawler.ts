import * as fs from 'fs';
import * as path from 'path';

import { MemoryManager } from '../src/memory/memory-manager.js';
import { loadNeo4jConfig } from '../src/config/neo4j-config.js';
import { LocalModelManager } from '../src/rules/local-model-manager.js';
// import { DirectiveProcessor } from '../src/parsing/directive-processor.js';
import { RulesEngineConfig } from '../src/config/rules-engine-config.js';
import { z } from 'zod';

// Enhanced Knowledge Graph Schema Types
interface RuleEntity {
  name: string;
  description: string;
  whenToApply: string;
  authoritativeFor: string[];
  layerTags: string[];
  topics: string[];
  filePath: string;
  content: string;
}

interface SectionEntity {
  title: string;
  layerTags: string[];
  topics: string[];
  filePath: string;
  content: string;
}

interface AIDirectiveEntity {
  text: string;
  severity: 'MUST' | 'SHOULD' | 'MAY';
  layerTags: string[];
  topics: string[];
  technologies: string[];
  filePath: string;
  sectionTitle: string;
  isGenerated: boolean;
  confidence: number;
  reasoning?: string;
}

interface PatternEntity {
  snippet: string;
  topics: string[];
  filePath: string;
  context: string;
}

// AI-Enhanced Directive Detection Schema
const AIDirectiveAnalysisSchema = z.array(z.object({
  content: z.string(),
  severity: z.string(), // Accept any string, we'll map it later
  reasoning: z.string(),
  confidence: z.number().min(0).max(1)
}));

// type AIDirectiveAnalysis = z.infer<typeof AIDirectiveAnalysisSchema>;

function buildObservations(
  ...parts: Array<string | string[] | null | undefined>
): string[] {
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part) {
      continue;
    }

    if (Array.isArray(part)) {
      for (const value of part) {
        if (typeof value !== 'string') {
          continue;
        }
        const trimmed = value.trim();
        if (trimmed) {
          normalized.push(trimmed);
        }
      }
      continue;
    }

    const trimmed = part.trim();
    if (trimmed) {
      normalized.push(trimmed);
    }
  }

  return [...new Set(normalized)];
}

/**
 * AI-Enhanced Knowledge Graph Crawler
 */
class AIEnhancedKnowledgeGraphCrawler {
  private mm: MemoryManager | null = null;
  private localModelManager: LocalModelManager | null = null;
  // private directiveProcessor: DirectiveProcessor | null = null;
  private config: RulesEngineConfig;

  constructor() {
    // Default AI configuration - can be overridden via environment variables
    this.config = {
      llm: {
        provider: (process.env.LLM_PROVIDER as any) || 'local',
        apiFormat: (process.env.LLM_API_FORMAT as any) || 'openai-compatible',
        endpoint: process.env.LLM_ENDPOINT || 'http://localhost:63327/v1',
        apiKey: process.env.LLM_API_KEY,
        model: process.env.LLM_MODEL || 'Phi-4-mini-instruct-cuda-gpu:4',
      },
      processing: {
        enableSplitting: false, // Keep disabled for crawler
        minWordCountForSplit: 250,
        enableDirectiveGeneration: true, // Enable AI directive generation
        minWordCountForGeneration: 50 // Lower threshold for directive generation
      },
      queryDefaults: {
        maxItems: 8,
        tokenBudget: 0,
        includeMetadata: false
      },
      modes: {
        allowedModes: ['architect', 'code', 'debug']
      }
    };
  }

  async initialize(): Promise<void> {
    // Initialize Neo4j connection
    const neo4jConfig = loadNeo4jConfig();
    this.mm = new MemoryManager(neo4jConfig);
    await this.mm.initialize();

    // Initialize AI components
    this.localModelManager = new LocalModelManager(this.config);
    this.localModelManager.initialize();

    // this.directiveProcessor = new DirectiveProcessor(this.localModelManager);

    console.log('🤖 AI-Enhanced Knowledge Graph Crawler initialized');
    console.log(`   LLM Provider: ${this.config.llm.provider}`);
    console.log(`   API Format: ${this.config.llm.apiFormat}`);
    console.log(`   Endpoint: ${this.config.llm.endpoint}`);
    console.log(`   Model: ${this.config.llm.model}`);
    console.log(`   AI Directive Generation: ${this.config.processing.enableDirectiveGeneration ? 'ENABLED' : 'DISABLED'}`);
  }

  async createEntities(entities: any[]) {
    if (!this.mm) throw new Error('Memory manager not initialized');
    return await this.mm.handleTool('memory.create_entities', { entities });
  }

  async createRelations(relations: any[]) {
    if (!this.mm) throw new Error('Memory manager not initialized');
    return await this.mm.handleTool('memory.create_relations', { relations });
  }

  /**
   * Enhanced markdown parsing with AI-powered directive detection
   */
  async parseMarkdownFileWithAI(filePath: string): Promise<{
    rules: RuleEntity[],
    sections: SectionEntity[],
    directives: AIDirectiveEntity[],
    patterns: PatternEntity[]
  }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const rules: RuleEntity[] = [];
    const sections: SectionEntity[] = [];
    const directives: AIDirectiveEntity[] = [];
    const patterns: PatternEntity[] = [];

    let currentRule: Partial<RuleEntity> | null = null;
    let currentSection: Partial<SectionEntity> | null = null;

    console.log(`🔍 Processing file: ${filePath}`);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Parse rule metadata (same as before)
      if (line.startsWith('name: ')) {
        currentRule = {
          name: line.replace('name: ', '').replace(/"/g, ''),
          filePath,
          content: '',
          authoritativeFor: [],
          layerTags: [],
          topics: []
        };
      } else if (currentRule && line.startsWith('description: ')) {
        currentRule.description = line.replace('description: ', '').replace(/"/g, '');
      } else if (currentRule && line.startsWith('when-to-apply: ')) {
        currentRule.whenToApply = line.replace('when-to-apply: ', '').replace(/"/g, '');
      } else if (currentRule && line.startsWith('rule: |')) {
        // Start collecting rule content
        let ruleContent = '';
        i++; // Skip the 'rule: |' line
        while (i < lines.length && !lines[i].startsWith('---')) {
          ruleContent += lines[i] + '\n';
          i++;
        }
        currentRule.content = ruleContent;
        rules.push(currentRule as RuleEntity);
        currentRule = null;
      }

      // Parse sections (same as before)
      if (line.startsWith('## ') || line.startsWith('### ')) {
        if (currentSection) {
          sections.push(currentSection as SectionEntity);
        }
        currentSection = {
          title: line.replace(/^#+\s*/, ''),
          filePath,
          content: '',
          layerTags: [],
          topics: []
        };
        this.extractTagsFromContent(currentSection, line);
      } else if (currentSection) {
        currentSection.content += line + '\n';
      }

      // Parse patterns/examples (same as before)
      if (line.startsWith('```') || line.includes('Example:')) {
        let patternContent = '';
        if (line.startsWith('```')) {
          i++; // Skip opening ```
          while (i < lines.length && !lines[i].startsWith('```')) {
            patternContent += lines[i] + '\n';
            i++;
          }
        } else {
          // Collect example content
          while (i < lines.length && !lines[i].startsWith('##') && !lines[i].startsWith('###')) {
            patternContent += lines[i] + '\n';
            i++;
          }
          i--; // Back up one line
        }

        const pattern: PatternEntity = {
          snippet: patternContent,
          topics: [],
          filePath,
          context: currentSection?.title || ''
        };
        this.extractTagsFromContent(pattern, patternContent);
        patterns.push(pattern);
      }
    }

    // Close any remaining section
    if (currentSection) {
      sections.push(currentSection as SectionEntity);
    }

    // 🤖 AI-ENHANCED DIRECTIVE DETECTION
    console.log(`🤖 Running AI directive analysis on ${sections.length} sections...`);
    
    for (const section of sections) {
      if (section.content && section.content.trim().length > this.config.processing.minWordCountForGeneration) {
        try {
          const aiDirectives = await this.detectDirectivesWithAI(
            section.content,
            section.title,
            filePath
          );
          directives.push(...aiDirectives);
          
          if (aiDirectives.length > 0) {
            console.log(`   ✅ Found ${aiDirectives.length} AI directives in section: ${section.title}`);
          }
        } catch (error) {
          console.warn(`   ⚠️  AI directive detection failed for section ${section.title}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    // Also check rule content for directives
    for (const rule of rules) {
      if (rule.content && rule.content.trim().length > this.config.processing.minWordCountForGeneration) {
        try {
          const aiDirectives = await this.detectDirectivesWithAI(
            rule.content,
            rule.name,
            filePath
          );
          directives.push(...aiDirectives);
          
          if (aiDirectives.length > 0) {
            console.log(`   ✅ Found ${aiDirectives.length} AI directives in rule: ${rule.name}`);
          }
        } catch (error) {
          console.warn(`   ⚠️  AI directive detection failed for rule ${rule.name}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
    }

    console.log(`📊 File processing complete: ${rules.length} rules, ${sections.length} sections, ${directives.length} AI directives, ${patterns.length} patterns`);

    return { rules, sections, directives, patterns };
  }

  /**
   * AI-powered directive detection
   */
  private async detectDirectivesWithAI(
    content: string,
    sectionTitle: string,
    filePath: string
  ): Promise<AIDirectiveEntity[]> {
    if (!this.localModelManager || !this.localModelManager.isReady()) {
      console.warn('🤖 AI model not ready, skipping AI directive detection');
      return [];
    }

    const prompt = `Extract actionable directives from this software development content:

Content:
"""
${content}
"""

Return a JSON array of directives. Each directive should have:
- content: what developers need to do
- severity: "High" for critical requirements, "Medium" for recommendations, "Low" for optional
- reasoning: why this directive is important
- confidence: number between 0 and 1

Example format:
[
  {
    "content": "validate all user inputs",
    "severity": "High",
    "reasoning": "prevents security vulnerabilities",
    "confidence": 0.9
  }
]

Only return the JSON array, no other text.`;

    try {
      const response = await this.localModelManager.generateJson(prompt, AIDirectiveAnalysisSchema, {
        temperature: 0.3, // Lower temperature for more consistent results
        maxTokens: 2000,
        timeout: 30000
      });

      if (!response.success) {
        console.error('AI directive analysis failed:', response.error);
        return [];
      }

      const directiveArray = response.data;
      const aiDirectives: AIDirectiveEntity[] = [];

      for (const directive of directiveArray) {
        // Map severity from Phi-4 format to our format
        let mappedSeverity: 'MUST' | 'SHOULD' | 'MAY' = 'SHOULD';
        if (directive.severity.toLowerCase().includes('high') || directive.severity.toLowerCase().includes('critical')) {
          mappedSeverity = 'MUST';
        } else if (directive.severity.toLowerCase().includes('low') || directive.severity.toLowerCase().includes('optional')) {
          mappedSeverity = 'MAY';
        }

        // Extract metadata using existing logic
        const { topics, layers, technologies } = this.extractMetadataFromDirective(
          directive.content,
          content,
          [],
          [],
          []
        );

        aiDirectives.push({
          text: directive.content,
          severity: mappedSeverity,
          layerTags: layers,
          topics: topics,
          technologies: technologies,
          filePath,
          sectionTitle,
          isGenerated: true,
          confidence: directive.confidence,
          reasoning: directive.reasoning
        });
      }

      return aiDirectives;
    } catch (error) {
      console.error('Error in AI directive detection:', error);
      return [];
    }
  }

  /**
   * Enhanced metadata extraction for AI-generated directives
   */
  private extractMetadataFromDirective(
    directiveContent: string,
    sectionContent: string,
    aiTopics: string[] = [],
    aiLayers: string[] = [],
    aiTechnologies: string[] = []
  ): {
    topics: string[];
    layers: string[];
    technologies: string[];
  } {
    const topics = new Set<string>(aiTopics.map(t => t.toLowerCase()));
    const layers = new Set<string>(aiLayers);
    const technologies = new Set<string>(aiTechnologies.map(t => t.toLowerCase()));

    // Combine directive and section content for analysis
    const fullText = `${directiveContent} ${sectionContent}`.toLowerCase();

    // Enhanced topic detection
    const topicKeywords = {
      security: ['security', 'authentication', 'authorization', 'encrypt', 'validate', 'sanitize', 'xss', 'csrf', 'injection', 'secret', 'password', 'token'],
      testing: ['test', 'unit test', 'integration test', 'e2e', 'coverage', 'mock', 'tdd', 'bdd', 'assert'],
      performance: ['performance', 'optimize', 'cache', 'index', 'scale', 'latency', 'throughput', 'memory', 'speed'],
      api: ['api', 'rest', 'graphql', 'endpoint', 'http', 'request', 'response', 'contract', 'swagger'],
      database: ['database', 'sql', 'nosql', 'query', 'transaction', 'migration', 'schema', 'table', 'index'],
      frontend: ['ui', 'component', 'view', 'page', 'css', 'style', 'button', 'form', 'react', 'angular', 'vue'],
      backend: ['service', 'business logic', 'workflow', 'server', 'backend', 'microservice'],
      documentation: ['documentation', 'document', 'readme', 'spec', 'diagram', 'comment'],
      logging: ['log', 'logging', 'audit', 'trace', 'debug', 'monitor'],
      'error-handling': ['error', 'exception', 'fault', 'failure', 'retry', 'fallback'],
      architecture: ['architecture', 'design', 'pattern', 'structure', 'layer', 'component'],
      'code-quality': ['quality', 'clean code', 'refactor', 'maintainable', 'readable', 'standard'],
      deployment: ['deploy', 'deployment', 'ci/cd', 'pipeline', 'build', 'release'],
      configuration: ['config', 'configuration', 'setting', 'environment', 'variable']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        topics.add(topic);
      }
    }

    // Enhanced layer detection
    const layerKeywords = {
      '1-Presentation': ['ui', 'component', 'page', 'view', 'frontend', 'css', 'react', 'angular', 'vue', 'presentation'],
      '2-Application': ['service', 'business logic', 'workflow', 'orchestration', 'application', 'use case'],
      '3-Domain': ['entity', 'aggregate', 'domain model', 'business rule', 'domain', 'core'],
      '4-Persistence': ['database', 'repository', 'dao', 'sql', 'query', 'storage', 'persistence', 'data'],
      '5-Tests': ['test', 'testing', 'spec', 'jest', 'mocha', 'vitest', 'unit', 'integration', 'e2e'],
      '6-Tests': ['test', 'testing', 'unit test', 'integration test', 'e2e', 'spec'],
      '7-Infrastructure': ['deploy', 'infrastructure', 'ci/cd', 'monitoring', 'docker', 'kubernetes', 'cloud']
    };

    for (const [layer, keywords] of Object.entries(layerKeywords)) {
      if (keywords.some(keyword => fullText.includes(keyword))) {
        layers.add(layer);
      }
    }

    // Enhanced technology detection
    const techKeywords = [
      'react', 'angular', 'vue', 'typescript', 'javascript', 'node.js', 'nodejs',
      'c#', 'csharp', '.net', 'dotnet', 'java', 'python', 'go', 'rust',
      'sql', 'postgresql', 'mysql', 'mongodb', 'redis', 'neo4j', 'elasticsearch',
      'docker', 'kubernetes', 'azure', 'aws', 'gcp',
      'rest', 'graphql', 'grpc', 'http', 'https', 'jwt', 'oauth',
      'git', 'github', 'gitlab', 'jenkins', 'terraform'
    ];

    for (const tech of techKeywords) {
      if (fullText.includes(tech)) {
        technologies.add(tech);
      }
    }

    return {
      topics: Array.from(topics),
      layers: Array.from(layers),
      technologies: Array.from(technologies)
    };
  }

  /**
   * Legacy tag extraction (for backward compatibility)
   */
  private extractTagsFromContent(entity: any, content: string) {
    // Extract layer tags (e.g., 1-Presentation, 4-Persistence)
    const layerMatches = content.match(/\b\d-[A-Za-z]+\b/g);
    if (layerMatches) {
      entity.layerTags = layerMatches;
    }

    // Extract topics (security, testing, process, architecture)
    const topicMatches = content.match(/\b(security|testing|process|architecture|data|build|quality)\b/gi);
    if (topicMatches) {
      entity.topics = topicMatches.map(t => t.toLowerCase());
    }
  }

  /**
   * Main crawling function with AI enhancement
   */
  async crawlKnowledgeSourcesWithAI(): Promise<void> {
    const sourceDirs = [
      '.kilocode/rules',
      '.kilocode/rules/memory-bank',
      '6-Docs'
    ];

    const allEntities = {
      rules: [] as RuleEntity[],
      sections: [] as SectionEntity[],
      directives: [] as AIDirectiveEntity[],
      patterns: [] as PatternEntity[]
    };

    let totalFilesProcessed = 0;
    let totalAIDirectives = 0;

    for (const dir of sourceDirs) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
        console.log(`📁 Processing ${files.length} files in ${dir}`);

        for (const file of files) {
          const filePath = path.join(dir, file);
          const entities = await this.parseMarkdownFileWithAI(filePath);

          allEntities.rules.push(...entities.rules);
          allEntities.sections.push(...entities.sections);
          allEntities.directives.push(...entities.directives);
          allEntities.patterns.push(...entities.patterns);

          totalFilesProcessed++;
          totalAIDirectives += entities.directives.length;
        }
      }
    }

    console.log(`\n📊 AI-Enhanced Crawling Summary:`);
    console.log(`   Files processed: ${totalFilesProcessed}`);
    console.log(`   Rules found: ${allEntities.rules.length}`);
    console.log(`   Sections found: ${allEntities.sections.length}`);
    console.log(`   AI Directives generated: ${totalAIDirectives}`);
    console.log(`   Patterns found: ${allEntities.patterns.length}`);

    // Create entities in Neo4j
    console.log(`\n💾 Storing entities in Neo4j...`);
    await this.createEntities([
      ...allEntities.rules.map(r => ({
        name: r.name,
        entityType: 'Rule',
        observations: buildObservations(r.description, r.whenToApply, r.content, r.layerTags, r.topics)
      })),
      ...allEntities.sections.map(s => ({
        name: s.title,
        entityType: 'Section',
        observations: buildObservations(s.content, s.layerTags, s.topics)
      })),
      ...allEntities.directives.map(d => ({
        name: `${d.text.substring(0, 50)}...`,
        entityType: 'AIDirective',
        observations: buildObservations(
          d.text, 
          d.severity, 
          d.layerTags, 
          d.topics, 
          d.technologies,
          d.isGenerated ? 'AI-Generated' : 'Manual',
          d.confidence ? `Confidence: ${d.confidence}` : '',
          d.reasoning || ''
        )
      })),
      ...allEntities.patterns.map(p => ({
        name: p.context || 'Pattern',
        entityType: 'Pattern',
        observations: buildObservations(p.snippet, p.topics)
      }))
    ]);

    // Create relations
    console.log(`💫 Creating relationships...`);
    const relations = [];

    // Rule CONTAINS Section
    for (const rule of allEntities.rules) {
      for (const section of allEntities.sections) {
        if (section.filePath === rule.filePath) {
          relations.push({ from: rule.name, to: section.title, relationType: 'CONTAINS' });
        }
      }
    }

    // Section CONTAINS AIDirective
    for (const section of allEntities.sections) {
      for (const directive of allEntities.directives) {
        if (directive.filePath === section.filePath && directive.sectionTitle === section.title) {
          relations.push({ 
            from: section.title, 
            to: directive.text.substring(0, 50) + '...', 
            relationType: 'CONTAINS_AI_DIRECTIVE' 
          });
        }
      }
    }

    // Rule CONTAINS AIDirective (for directives found in rule content)
    for (const rule of allEntities.rules) {
      for (const directive of allEntities.directives) {
        if (directive.filePath === rule.filePath && directive.sectionTitle === rule.name) {
          relations.push({ 
            from: rule.name, 
            to: directive.text.substring(0, 50) + '...', 
            relationType: 'CONTAINS_AI_DIRECTIVE' 
          });
        }
      }
    }

    // AIDirective APPLIES_TO Layer
    for (const directive of allEntities.directives) {
      for (const layer of directive.layerTags) {
        relations.push({ 
          from: directive.text.substring(0, 50) + '...', 
          to: layer, 
          relationType: 'APPLIES_TO' 
        });
      }
    }

    // AIDirective RELATES_TO Topic
    for (const directive of allEntities.directives) {
      for (const topic of directive.topics) {
        relations.push({ 
          from: directive.text.substring(0, 50) + '...', 
          to: topic, 
          relationType: 'RELATES_TO' 
        });
      }
    }

    await this.createRelations(relations);

    console.log(`✅ AI-Enhanced knowledge graph crawling completed!`);
    console.log(`   Total entities: ${allEntities.rules.length + allEntities.sections.length + allEntities.directives.length + allEntities.patterns.length}`);
    console.log(`   Total relations: ${relations.length}`);
  }

  async close(): Promise<void> {
    if (this.mm) {
      await this.mm.close();
    }
  }
}

/**
 * Run the AI-Enhanced Knowledge Graph Crawler
 */
async function runAIEnhancedCrawler() {
  const crawler = new AIEnhancedKnowledgeGraphCrawler();
  
  try {
    await crawler.initialize();
    await crawler.crawlKnowledgeSourcesWithAI();
  } catch (error) {
    console.error('❌ AI-Enhanced crawler failed:', error);
    process.exit(1);
  } finally {
    await crawler.close();
  }
}

// Run the crawler
runAIEnhancedCrawler();