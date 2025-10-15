import { ModelProvider, ProviderHealthInfo } from '../interfaces/model-provider.js';
import { TaskContext, ArchitecturalLayer } from '../types.js';

/**
 * Configuration for rule-based provider
 */
export interface RuleBasedProviderConfig {
  layerKeywords?: Record<ArchitecturalLayer, string[]>;
  topicKeywords?: Record<string, string[]>;
  technologyKeywords?: Record<string, string[]>;
  confidenceThresholds?: {
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Rule-based model provider that uses keyword matching and heuristics
 * for context detection. This provider serves as a fallback when
 * external model providers are unavailable.
 */
export class RuleBasedProvider implements ModelProvider {
  name = 'rule-based-heuristic';
  type = 'rule-based' as const;

  private layerKeywords: Record<ArchitecturalLayer, string[]>;
  private topicKeywords: Record<string, string[]>;
  private technologyKeywords: Record<string, string[]>;
  private confidenceThresholds: { high: number; medium: number; low: number };

  constructor(config: RuleBasedProviderConfig = {}) {
    this.layerKeywords = config.layerKeywords || this.getDefaultLayerKeywords();
    this.topicKeywords = config.topicKeywords || this.getDefaultTopicKeywords();
    this.technologyKeywords = config.technologyKeywords || this.getDefaultTechnologyKeywords();
    this.confidenceThresholds = config.confidenceThresholds || {
      high: 0.8,
      medium: 0.6,
      low: 0.4
    };
  }

  /**
   * Rule-based provider is always available (no external dependencies)
   */
  async isAvailable(): Promise<boolean> {
    return true;
  }

  /**
   * Detect context using keyword matching and heuristic analysis
   */
  async detectContext(text: string): Promise<TaskContext> {
    const normalizedText = text.toLowerCase();
    const words = this.extractWords(normalizedText);
    
    // Detect architectural layer
    const layerDetection = this.detectArchitecturalLayer(words, normalizedText);
    
    // Extract topics
    const topics = this.extractTopics(words, normalizedText);
    
    // Extract technologies
    const technologies = this.extractTechnologies(words, normalizedText);
    
    // Extract keywords (significant words that aren't common stop words)
    const keywords = this.extractSignificantKeywords(words);
    
    // Calculate overall confidence based on matches found
    const confidence = this.calculateConfidence(layerDetection, topics, technologies);

    return {
      layer: layerDetection.layer,
      topics,
      keywords,
      technologies,
      confidence
    };
  }

  /**
   * Get provider health information
   */
  async getHealthInfo(): Promise<ProviderHealthInfo> {
    return {
      status: 'healthy',
      latency: 0, // Rule-based is instant
      lastChecked: new Date(),
      details: {
        type: 'rule-based',
        keywordSets: {
          layers: Object.keys(this.layerKeywords).length,
          topics: Object.keys(this.topicKeywords).length,
          technologies: Object.keys(this.technologyKeywords).length
        }
      }
    };
  }

  /**
   * Detect architectural layer using keyword matching
   */
  private detectArchitecturalLayer(words: string[], text: string): { layer: ArchitecturalLayer; confidence: number } {
    const layerScores: Record<ArchitecturalLayer, number> = {
      '1-Presentation': 0,
      '2-Application': 0,
      '3-Domain': 0,
      '4-Persistence': 0,
      '5-Infrastructure': 0,
      '*': 0
    };

    // Score each layer based on keyword matches
    for (const [layer, keywords] of Object.entries(this.layerKeywords)) {
      const layerKey = layer as ArchitecturalLayer;
      if (layerKey === '*') continue; // Skip wildcard layer for scoring
      
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        
        // Exact word match (higher score)
        if (words.includes(keywordLower)) {
          layerScores[layerKey] += 2;
        }
        
        // Partial text match (lower score)
        if (text.includes(keywordLower)) {
          layerScores[layerKey] += 1;
        }
      }
    }

    // Find the layer with highest score
    let bestLayer: ArchitecturalLayer = '*';
    let bestScore = 0;
    
    for (const [layer, score] of Object.entries(layerScores)) {
      if (score > bestScore) {
        bestScore = score;
        bestLayer = layer as ArchitecturalLayer;
      }
    }

    // Calculate confidence based on score and presence of multiple indicators
    const totalPossibleScore = Math.max(...Object.values(this.layerKeywords).map(keywords => keywords.length * 2));
    const confidence = bestScore > 0 ? Math.min(bestScore / totalPossibleScore, 1) : 0.1;

    return {
      layer: bestLayer,
      confidence
    };
  }

  /**
   * Extract topics from text using keyword matching
   */
  private extractTopics(words: string[], text: string): string[] {
    const topics: string[] = [];
    
    for (const [topic, keywords] of Object.entries(this.topicKeywords)) {
      let matches = 0;
      
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        if (words.includes(keywordLower) || text.includes(keywordLower)) {
          matches++;
        }
      }
      
      // Include topic if it has sufficient keyword matches
      if (matches >= Math.min(2, keywords.length)) {
        topics.push(topic);
      }
    }
    
    return topics;
  }

  /**
   * Extract technologies from text using keyword matching
   */
  private extractTechnologies(words: string[], text: string): string[] {
    const technologies: string[] = [];
    
    for (const [technology, keywords] of Object.entries(this.technologyKeywords)) {
      for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        if (words.includes(keywordLower) || text.includes(keywordLower)) {
          technologies.push(technology);
          break; // Only add each technology once
        }
      }
    }
    
    return technologies;
  }

  /**
   * Extract significant keywords (non-stop words)
   */
  private extractSignificantKeywords(words: string[]): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after',
      'above', 'below', 'between', 'among', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ]);

    return words
      .filter(word => 
        word.length > 2 && 
        !stopWords.has(word) && 
        /^[a-zA-Z]/.test(word) // Starts with letter
      )
      .slice(0, 10); // Limit to top 10 keywords
  }

  /**
   * Calculate overall confidence based on detection results
   */
  private calculateConfidence(
    layerDetection: { layer: ArchitecturalLayer; confidence: number },
    topics: string[],
    technologies: string[]
  ): number {
    let confidence = layerDetection.confidence * 0.5; // Layer detection is 50% of confidence
    
    // Add confidence based on topic matches
    confidence += Math.min(topics.length * 0.1, 0.3); // Up to 30% for topics
    
    // Add confidence based on technology matches
    confidence += Math.min(technologies.length * 0.05, 0.2); // Up to 20% for technologies
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Extract words from text (simple tokenization)
   */
  private extractWords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Default keyword mappings for architectural layers
   */
  private getDefaultLayerKeywords(): Record<ArchitecturalLayer, string[]> {
    return {
      '1-Presentation': [
        // UI/Frontend keywords
        'ui', 'frontend', 'component', 'view', 'template', 'render', 'display',
        'react', 'vue', 'angular', 'svelte', 'html', 'css', 'javascript', 'typescript',
        'jsx', 'tsx', 'scss', 'sass', 'styled-components', 'emotion',
        'button', 'form', 'input', 'modal', 'dialog', 'menu', 'navigation',
        'responsive', 'mobile', 'desktop', 'layout', 'grid', 'flexbox',
        'animation', 'transition', 'theme', 'styling', 'design-system'
      ],
      
      '2-Application': [
        // Application logic keywords
        'service', 'controller', 'handler', 'middleware', 'router', 'endpoint',
        'api', 'rest', 'graphql', 'websocket', 'http', 'request', 'response',
        'validation', 'authentication', 'authorization', 'session', 'jwt', 'oauth',
        'business-logic', 'workflow', 'orchestration', 'coordination',
        'express', 'fastify', 'koa', 'nestjs', 'spring', 'django', 'flask',
        'microservice', 'serverless', 'lambda', 'function'
      ],
      
      '3-Domain': [
        // Domain/Business logic keywords
        'domain', 'entity', 'aggregate', 'value-object', 'business-rule',
        'model', 'schema', 'type', 'interface', 'class', 'object',
        'calculation', 'algorithm', 'logic', 'rule', 'policy', 'constraint',
        'event', 'command', 'query', 'specification', 'factory', 'builder',
        'ddd', 'domain-driven', 'clean-architecture', 'hexagonal'
      ],
      
      '4-Persistence': [
        // Data/Persistence keywords
        'database', 'db', 'sql', 'nosql', 'query', 'table', 'collection',
        'repository', 'dao', 'orm', 'odm', 'migration', 'schema', 'index',
        'transaction', 'acid', 'consistency', 'isolation', 'durability',
        'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'sqlite',
        'prisma', 'typeorm', 'sequelize', 'mongoose', 'knex', 'drizzle',
        'crud', 'insert', 'update', 'delete', 'select', 'join', 'aggregate'
      ],
      
      '5-Infrastructure': [
        // Infrastructure/System keywords
        'infrastructure', 'deployment', 'devops', 'ci-cd', 'pipeline', 'build',
        'docker', 'kubernetes', 'container', 'orchestration', 'cluster',
        'aws', 'azure', 'gcp', 'cloud', 'serverless', 'edge', 'cdn',
        'monitoring', 'logging', 'metrics', 'alerting', 'observability',
        'security', 'encryption', 'ssl', 'tls', 'firewall', 'vpc', 'network',
        'cache', 'redis', 'memcached', 'queue', 'message-broker', 'kafka',
        'terraform', 'ansible', 'chef', 'puppet', 'helm', 'nginx', 'apache'
      ],
      
      '*': [] // Wildcard layer has no specific keywords
    };
  }

  /**
   * Default keyword mappings for topics
   */
  private getDefaultTopicKeywords(): Record<string, string[]> {
    return {
      'security': [
        'security', 'auth', 'authentication', 'authorization', 'permission',
        'jwt', 'oauth', 'saml', 'encryption', 'hash', 'salt', 'bcrypt',
        'ssl', 'tls', 'https', 'csrf', 'xss', 'injection', 'vulnerability',
        'firewall', 'sanitize', 'validate', 'escape'
      ],
      
      'api': [
        'api', 'rest', 'restful', 'graphql', 'endpoint', 'route', 'handler',
        'request', 'response', 'http', 'get', 'post', 'put', 'delete', 'patch',
        'json', 'xml', 'swagger', 'openapi', 'documentation', 'versioning'
      ],
      
      'database': [
        'database', 'db', 'sql', 'query', 'table', 'schema', 'migration',
        'index', 'transaction', 'orm', 'repository', 'crud', 'join', 'aggregate'
      ],
      
      'testing': [
        'test', 'testing', 'unit-test', 'integration-test', 'e2e', 'mock',
        'stub', 'spy', 'jest', 'mocha', 'chai', 'cypress', 'playwright',
        'assertion', 'coverage', 'tdd', 'bdd'
      ],
      
      'performance': [
        'performance', 'optimization', 'cache', 'caching', 'lazy-loading',
        'pagination', 'throttle', 'debounce', 'memoization', 'benchmark',
        'profiling', 'memory', 'cpu', 'latency', 'throughput'
      ],
      
      'validation': [
        'validation', 'validate', 'schema', 'constraint', 'rule', 'check',
        'sanitize', 'format', 'type-check', 'required', 'optional'
      ],
      
      'error-handling': [
        'error', 'exception', 'try-catch', 'throw', 'handling', 'recovery',
        'fallback', 'retry', 'circuit-breaker', 'timeout', 'logging'
      ]
    };
  }

  /**
   * Default keyword mappings for technologies
   */
  private getDefaultTechnologyKeywords(): Record<string, string[]> {
    return {
      'React': ['react', 'jsx', 'tsx', 'hooks', 'component', 'props', 'state'],
      'Vue': ['vue', 'vuejs', 'composition-api', 'options-api', 'nuxt'],
      'Angular': ['angular', 'typescript', 'component', 'service', 'directive'],
      'Node.js': ['node', 'nodejs', 'npm', 'yarn', 'express', 'fastify'],
      'Python': ['python', 'django', 'flask', 'fastapi', 'pip', 'conda'],
      'Java': ['java', 'spring', 'maven', 'gradle', 'jvm', 'kotlin'],
      'C#': ['csharp', 'dotnet', '.net', 'asp.net', 'nuget', 'visual-studio'],
      'Go': ['golang', 'go', 'goroutine', 'channel', 'gin', 'echo'],
      'Rust': ['rust', 'cargo', 'crate', 'tokio', 'actix', 'warp'],
      'Docker': ['docker', 'dockerfile', 'container', 'image', 'compose'],
      'Kubernetes': ['kubernetes', 'k8s', 'pod', 'deployment', 'service', 'helm'],
      'AWS': ['aws', 'lambda', 'ec2', 's3', 'rds', 'dynamodb', 'cloudformation'],
      'PostgreSQL': ['postgresql', 'postgres', 'psql', 'pg'],
      'MongoDB': ['mongodb', 'mongo', 'mongoose', 'aggregation'],
      'Redis': ['redis', 'cache', 'session-store', 'pub-sub'],
      'GraphQL': ['graphql', 'apollo', 'relay', 'schema', 'resolver', 'mutation'],
      'TypeScript': ['typescript', 'ts', 'type', 'interface', 'generic'],
      'Webpack': ['webpack', 'bundle', 'loader', 'plugin', 'hot-reload'],
      'Jest': ['jest', 'test', 'mock', 'snapshot', 'coverage'],
      'Cypress': ['cypress', 'e2e', 'integration-test', 'ui-test']
    };
  }
}