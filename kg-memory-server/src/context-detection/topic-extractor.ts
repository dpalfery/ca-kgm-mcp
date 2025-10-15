export interface TopicExtractionResult {
  topics: string[];
  keywords: string[];
  technologies: string[];
  confidence: number;
}

export interface DomainVocabulary {
  [domain: string]: {
    keywords: string[];
    technologies: string[];
    synonyms: Record<string, string[]>;
  };
}

export class TopicExtractor {
  private domainVocabulary: DomainVocabulary;
  private technologyPatterns: RegExp[];

  constructor() {
    this.domainVocabulary = this.initializeDomainVocabulary();
    this.technologyPatterns = this.initializeTechnologyPatterns();
  }

  /**
   * Extract topics, keywords, and technologies from text
   */
  extractTopics(text: string): TopicExtractionResult {
    const normalizedText = text.toLowerCase();
    const words = this.extractMeaningfulWords(normalizedText);
    
    const detectedTopics = new Set<string>();
    const detectedKeywords = new Set<string>();
    const detectedTechnologies = new Set<string>();

    // Extract topics using domain vocabulary
    for (const [domain, vocabulary] of Object.entries(this.domainVocabulary)) {
      let domainScore = 0;
      const domainKeywords: string[] = [];

      // Check for direct keyword matches
      for (const keyword of vocabulary.keywords) {
        if (this.containsKeyword(normalizedText, keyword)) {
          domainScore += this.getKeywordWeight(keyword);
          domainKeywords.push(keyword);
          detectedKeywords.add(keyword);
        }
      }

      // Check for technology matches
      for (const tech of vocabulary.technologies) {
        if (this.containsKeyword(normalizedText, tech)) {
          domainScore += 2; // Technologies get higher weight
          detectedTechnologies.add(tech);
          detectedKeywords.add(tech);
        }
      }

      // Check for synonyms
      for (const [canonical, synonyms] of Object.entries(vocabulary.synonyms)) {
        for (const synonym of synonyms) {
          if (this.containsKeyword(normalizedText, synonym)) {
            domainScore += 1;
            detectedKeywords.add(canonical);
          }
        }
      }

      // Add domain as topic if score is significant
      if (domainScore >= 2) {
        detectedTopics.add(domain);
      }
    }

    // Extract additional technologies using patterns
    const patternTechnologies = this.extractTechnologiesUsingPatterns(text);
    patternTechnologies.forEach(tech => {
      detectedTechnologies.add(tech);
      detectedKeywords.add(tech);
    });

    // Extract general technical keywords
    const technicalKeywords = this.extractTechnicalKeywords(words);
    technicalKeywords.forEach(keyword => detectedKeywords.add(keyword));

    // Calculate confidence based on number of matches and text length
    const totalMatches = detectedTopics.size + detectedTechnologies.size;
    const textComplexity = Math.min(words.length / 10, 5); // Normalize text length factor
    const confidence = Math.min((totalMatches + textComplexity) / 10, 0.9);

    return {
      topics: Array.from(detectedTopics).sort(),
      keywords: Array.from(detectedKeywords).sort(),
      technologies: Array.from(detectedTechnologies).sort(),
      confidence
    };
  }

  /**
   * Initialize domain-specific vocabulary
   */
  private initializeDomainVocabulary(): DomainVocabulary {
    return {
      security: {
        keywords: [
          'authentication', 'authorization', 'oauth', 'jwt', 'token', 'session',
          'encryption', 'hashing', 'password', 'security', 'vulnerability',
          'xss', 'csrf', 'sql injection', 'sanitization', 'validation',
          'firewall', 'ssl', 'tls', 'certificate', 'key management',
          'access control', 'permissions', 'roles', 'rbac', 'audit'
        ],
        technologies: [
          'bcrypt', 'argon2', 'passport', 'auth0', 'okta', 'keycloak',
          'helmet', 'cors', 'rate-limiting', 'owasp'
        ],
        synonyms: {
          'authentication': ['auth', 'login', 'signin'],
          'authorization': ['authz', 'permissions', 'access'],
          'encryption': ['crypto', 'cipher']
        }
      },

      api: {
        keywords: [
          'rest', 'graphql', 'endpoint', 'route', 'middleware', 'request',
          'response', 'http', 'status code', 'header', 'body', 'parameter',
          'query string', 'path parameter', 'json', 'xml', 'serialization',
          'deserialization', 'content type', 'cors', 'rate limiting'
        ],
        technologies: [
          'express', 'fastify', 'koa', 'nestjs', 'apollo', 'swagger',
          'openapi', 'postman', 'insomnia', 'axios', 'fetch'
        ],
        synonyms: {
          'endpoint': ['api endpoint', 'service endpoint'],
          'middleware': ['interceptor', 'filter'],
          'serialization': ['marshalling', 'encoding']
        }
      },

      database: {
        keywords: [
          'query', 'transaction', 'migration', 'schema', 'index', 'constraint',
          'foreign key', 'primary key', 'join', 'aggregate', 'cursor',
          'connection pool', 'replication', 'sharding', 'backup', 'restore',
          'acid', 'consistency', 'isolation', 'durability', 'normalization'
        ],
        technologies: [
          'postgresql', 'mysql', 'sqlite', 'mongodb', 'redis', 'elasticsearch',
          'prisma', 'typeorm', 'sequelize', 'mongoose', 'knex', 'drizzle'
        ],
        synonyms: {
          'database': ['db', 'datastore'],
          'query': ['select', 'find'],
          'migration': ['schema change', 'db migration']
        }
      },

      testing: {
        keywords: [
          'unit test', 'integration test', 'e2e test', 'test case', 'assertion',
          'mock', 'stub', 'spy', 'fixture', 'test data', 'coverage',
          'tdd', 'bdd', 'test driven', 'behavior driven', 'snapshot',
          'regression test', 'performance test', 'load test'
        ],
        technologies: [
          'jest', 'vitest', 'mocha', 'chai', 'jasmine', 'cypress', 'playwright',
          'selenium', 'puppeteer', 'testing-library', 'enzyme', 'sinon'
        ],
        synonyms: {
          'test': ['spec', 'test case'],
          'mock': ['fake', 'double', 'stub'],
          'assertion': ['expect', 'should']
        }
      },

      performance: {
        keywords: [
          'optimization', 'caching', 'lazy loading', 'pagination', 'indexing',
          'compression', 'minification', 'bundling', 'code splitting',
          'memory usage', 'cpu usage', 'latency', 'throughput', 'scalability',
          'load balancing', 'cdn', 'edge computing'
        ],
        technologies: [
          'redis', 'memcached', 'varnish', 'nginx', 'cloudflare', 'webpack',
          'rollup', 'esbuild', 'terser', 'gzip', 'brotli'
        ],
        synonyms: {
          'optimization': ['optimize', 'perf'],
          'caching': ['cache', 'memoization'],
          'latency': ['response time', 'delay']
        }
      },

      deployment: {
        keywords: [
          'ci/cd', 'pipeline', 'build', 'deploy', 'release', 'environment',
          'staging', 'production', 'rollback', 'blue-green', 'canary',
          'infrastructure', 'provisioning', 'configuration', 'monitoring',
          'logging', 'alerting', 'health check'
        ],
        technologies: [
          'docker', 'kubernetes', 'jenkins', 'github actions', 'gitlab ci',
          'terraform', 'ansible', 'helm', 'aws', 'azure', 'gcp'
        ],
        synonyms: {
          'deployment': ['deploy', 'release'],
          'pipeline': ['workflow', 'build pipeline'],
          'environment': ['env', 'stage']
        }
      },

      frontend: {
        keywords: [
          'component', 'state management', 'routing', 'styling', 'responsive',
          'accessibility', 'seo', 'progressive web app', 'single page app',
          'server side rendering', 'static site generation', 'hydration',
          'virtual dom', 'hooks', 'lifecycle', 'props', 'context'
        ],
        technologies: [
          'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'gatsby',
          'redux', 'mobx', 'zustand', 'tailwind', 'styled-components',
          'sass', 'less', 'webpack', 'vite'
        ],
        synonyms: {
          'component': ['widget', 'element'],
          'styling': ['css', 'styles'],
          'responsive': ['mobile-friendly', 'adaptive']
        }
      },

      architecture: {
        keywords: [
          'microservices', 'monolith', 'service oriented', 'event driven',
          'domain driven design', 'clean architecture', 'hexagonal',
          'layered architecture', 'mvc', 'mvvm', 'repository pattern',
          'factory pattern', 'observer pattern', 'singleton', 'dependency injection',
          'inversion of control', 'solid principles', 'design patterns'
        ],
        technologies: [
          'spring', 'nest', 'express', 'fastapi', 'django', 'rails',
          'kafka', 'rabbitmq', 'redis', 'elasticsearch'
        ],
        synonyms: {
          'microservices': ['micro-services', 'service mesh'],
          'dependency injection': ['di', 'ioc'],
          'design patterns': ['patterns', 'architectural patterns']
        }
      }
    };
  }

  /**
   * Initialize technology detection patterns
   */
  private initializeTechnologyPatterns(): RegExp[] {
    return [
      // Version patterns (e.g., "React 18", "Node.js 16")
      /(\w+(?:\.\w+)*)\s+v?\d+(?:\.\d+)*/gi,
      
      // File extensions as technology indicators
      /\.(?:js|ts|jsx|tsx|py|java|cs|php|rb|go|rs|cpp|c|h)(?:\s|$)/gi,
      
      // Package/library patterns
      /@[\w-]+\/[\w-]+/gi, // Scoped packages like @types/node
      /npm\s+(?:install\s+)?([\w-]+)/gi,
      /yarn\s+add\s+([\w-]+)/gi,
      /pip\s+install\s+([\w-]+)/gi,
      
      // Framework/library specific patterns
      /(?:import|from|require)\s+['"]([^'"]+)['"]/gi,
      /use\w+\(/gi, // React hooks pattern
      /@\w+/gi // Decorators/annotations
    ];
  }

  /**
   * Extract meaningful words, filtering stop words and short words
   */
  private extractMeaningfulWords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
    ]);

    return text
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word.toLowerCase()))
      .map(word => word.toLowerCase());
  }

  /**
   * Check if text contains a keyword (handles multi-word keywords and case sensitivity)
   */
  private containsKeyword(text: string, keyword: string): boolean {
    const normalizedKeyword = keyword.toLowerCase();
    
    if (normalizedKeyword.includes(' ')) {
      // Multi-word keyword - check for exact phrase
      return text.includes(normalizedKeyword);
    } else {
      // Single word - check for word boundaries
      const regex = new RegExp(`\\b${normalizedKeyword}\\b`, 'i');
      return regex.test(text);
    }
  }

  /**
   * Get weight for a keyword based on its specificity
   */
  private getKeywordWeight(keyword: string): number {
    // Longer, more specific keywords get higher weight
    const wordCount = keyword.split(' ').length;
    return Math.max(1, wordCount);
  }

  /**
   * Extract technologies using regex patterns
   */
  private extractTechnologiesUsingPatterns(text: string): string[] {
    const technologies = new Set<string>();

    for (const pattern of this.technologyPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          // Extract the technology name from capture group
          const tech = match[1].toLowerCase().trim();
          if (tech.length > 2) {
            technologies.add(tech);
          }
        }
      }
    }

    return Array.from(technologies);
  }

  /**
   * Extract general technical keywords that might not be in domain vocabulary
   */
  private extractTechnicalKeywords(words: string[]): string[] {
    const technicalPatterns = [
      // Programming concepts
      /^(class|function|method|variable|constant|interface|type|enum)$/i,
      
      // Common technical terms
      /^(async|await|promise|callback|event|listener|handler|service|util|helper)$/i,
      
      // Data structures
      /^(array|list|map|set|queue|stack|tree|graph|hash)$/i,
      
      // Common abbreviations
      /^(api|ui|ux|db|orm|mvc|spa|pwa|seo|cdn|dns|ssl|http|tcp|udp)$/i
    ];

    return words.filter(word => 
      technicalPatterns.some(pattern => pattern.test(word))
    );
  }

  /**
   * Get domain vocabulary for testing/debugging
   */
  getDomainVocabulary(): DomainVocabulary {
    return { ...this.domainVocabulary };
  }

  /**
   * Add custom vocabulary for a domain
   */
  addDomainVocabulary(domain: string, vocabulary: {
    keywords: string[];
    technologies: string[];
    synonyms: Record<string, string[]>;
  }): void {
    if (this.domainVocabulary[domain]) {
      // Merge with existing
      this.domainVocabulary[domain].keywords.push(...vocabulary.keywords);
      this.domainVocabulary[domain].technologies.push(...vocabulary.technologies);
      Object.assign(this.domainVocabulary[domain].synonyms, vocabulary.synonyms);
    } else {
      // Create new domain
      this.domainVocabulary[domain] = vocabulary;
    }
  }
}