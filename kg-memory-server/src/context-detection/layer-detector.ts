import { ArchitecturalLayer, TaskContext } from '../types.js';

export interface LayerDetectionResult {
  layer: ArchitecturalLayer;
  confidence: number;
  indicators: string[];
}

export interface LayerKeywords {
  [key: string]: string[];
}

export class LayerDetector {
  private layerKeywords: LayerKeywords;

  constructor() {
    this.layerKeywords = {
      "1-Presentation": [
        // UI/Frontend keywords
        "ui", "component", "react", "vue", "angular", "css", "html", "jsx", "tsx",
        "frontend", "client", "browser", "dom", "render", "view", "template",
        "styling", "responsive", "accessibility", "user interface", "form",
        "button", "modal", "dropdown", "navigation", "layout", "theme",
        "material-ui", "bootstrap", "tailwind", "styled-components",
        
        // User interaction
        "click", "hover", "input", "validation", "user experience", "ux",
        "interaction", "event handler", "onchange", "onclick", "submit",
        "display", "show", "hide", "toggle", "animation", "transition"
      ],
      
      "2-Application": [
        // Business logic and orchestration
        "service", "controller", "handler", "workflow", "orchestration",
        "business logic", "application logic", "use case", "command",
        "query", "mediator", "facade", "coordinator", "manager",
        "process", "pipeline", "validation", "authorization", "authentication",
        
        // API and routing
        "api", "endpoint", "route", "router", "middleware", "request",
        "response", "http", "rest", "graphql", "websocket", "rpc",
        "express", "fastify", "koa", "nest", "spring", "asp.net",
        
        // Application services
        "email", "notification", "logging", "caching", "session",
        "security", "audit", "monitoring", "health check"
      ],
      
      "3-Domain": [
        // Domain modeling
        "entity", "aggregate", "value object", "domain model", "business rule",
        "domain service", "domain event", "specification", "policy",
        "invariant", "constraint", "business", "core logic", "domain logic",
        
        // DDD concepts
        "bounded context", "ubiquitous language", "aggregate root",
        "repository pattern", "factory", "builder", "strategy pattern",
        "command pattern", "observer pattern", "state machine",
        
        // Business concepts
        "calculation", "algorithm", "rule engine", "decision", "condition",
        "behavior", "method", "operation", "function", "procedure"
      ],
      
      "4-Persistence": [
        // Database operations
        "database", "sql", "nosql", "mongodb", "postgresql", "mysql",
        "sqlite", "redis", "elasticsearch", "repository", "dao",
        "orm", "prisma", "typeorm", "sequelize", "mongoose", "knex",
        
        // Data operations
        "query", "insert", "update", "delete", "select", "join",
        "transaction", "migration", "schema", "table", "collection",
        "index", "foreign key", "primary key", "constraint",
        
        // Storage concepts
        "persistence", "storage", "data access", "connection pool",
        "backup", "restore", "sync", "replication", "sharding"
      ],
      
      "5-Infrastructure": [
        // Infrastructure and deployment
        "docker", "kubernetes", "aws", "azure", "gcp", "cloud",
        "deployment", "ci/cd", "pipeline", "build", "test", "deploy",
        "infrastructure", "terraform", "ansible", "helm", "nginx",
        
        // System operations
        "monitoring", "logging", "metrics", "alerting", "scaling",
        "load balancer", "proxy", "gateway", "firewall", "security",
        "network", "dns", "ssl", "certificate", "backup",
        
        // DevOps tools
        "jenkins", "github actions", "gitlab ci", "circleci", "travis",
        "prometheus", "grafana", "elk stack", "datadog", "newrelic"
      ]
    };
  }

  /**
   * Detect architectural layer using keyword-based pattern matching
   */
  detectLayer(text: string): LayerDetectionResult {
    const normalizedText = text.toLowerCase();
    const words = this.extractWords(normalizedText);
    
    const layerScores: Record<ArchitecturalLayer, { score: number; indicators: string[] }> = {
      "1-Presentation": { score: 0, indicators: [] },
      "2-Application": { score: 0, indicators: [] },
      "3-Domain": { score: 0, indicators: [] },
      "4-Persistence": { score: 0, indicators: [] },
      "5-Infrastructure": { score: 0, indicators: [] },
      "*": { score: 0, indicators: [] }
    };

    // Score each layer based on keyword matches
    for (const [layer, keywords] of Object.entries(this.layerKeywords)) {
      const layerKey = layer as ArchitecturalLayer;
      
      for (const keyword of keywords) {
        if (this.containsKeyword(normalizedText, keyword)) {
          // Weight longer keywords more heavily
          const weight = Math.max(1, keyword.split(' ').length);
          layerScores[layerKey].score += weight;
          layerScores[layerKey].indicators.push(keyword);
        }
      }
    }

    // Apply contextual boosters
    this.applyContextualBoosters(normalizedText, layerScores);

    // Find the layer with highest score
    let bestLayer: ArchitecturalLayer = "*";
    let bestScore = 0;
    let bestIndicators: string[] = [];

    for (const [layer, result] of Object.entries(layerScores)) {
      if (result.score > bestScore) {
        bestScore = result.score;
        bestLayer = layer as ArchitecturalLayer;
        bestIndicators = result.indicators;
      }
    }

    // Calculate confidence based on score distribution
    const totalScore = Object.values(layerScores).reduce((sum, result) => sum + result.score, 0);
    const confidence = totalScore > 0 ? bestScore / totalScore : 0;

    // If confidence is too low, default to wildcard
    if (confidence < 0.3 || bestScore === 0) {
      return {
        layer: "*",
        confidence: 0.1,
        indicators: []
      };
    }

    return {
      layer: bestLayer,
      confidence: Math.min(confidence, 0.95), // Cap confidence at 95%
      indicators: bestIndicators.slice(0, 5) // Limit indicators for readability
    };
  }

  /**
   * Extract meaningful words from text, filtering out common stop words
   */
  private extractWords(text: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have',
      'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
      'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
    ]);

    return text
      .split(/\W+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => word.toLowerCase());
  }

  /**
   * Check if text contains a keyword (handles multi-word keywords)
   */
  private containsKeyword(text: string, keyword: string): boolean {
    if (keyword.includes(' ')) {
      // Multi-word keyword - check for exact phrase
      return text.includes(keyword);
    } else {
      // Single word - check for word boundaries
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      return regex.test(text);
    }
  }

  /**
   * Apply contextual boosters based on action verbs and patterns
   */
  private applyContextualBoosters(
    text: string, 
    layerScores: Record<ArchitecturalLayer, { score: number; indicators: string[] }>
  ): void {
    // UI/Frontend action verbs
    const uiActions = ['render', 'display', 'show', 'hide', 'click', 'submit', 'validate'];
    if (uiActions.some(action => text.includes(action))) {
      layerScores["1-Presentation"].score += 2;
      layerScores["1-Presentation"].indicators.push('ui-action-detected');
    }

    // API/Service patterns
    const apiPatterns = ['endpoint', 'route', '/api/', 'controller', 'handler'];
    if (apiPatterns.some(pattern => text.includes(pattern))) {
      layerScores["2-Application"].score += 2;
      layerScores["2-Application"].indicators.push('api-pattern-detected');
    }

    // Business logic patterns
    const businessPatterns = ['business rule', 'calculate', 'validate', 'process', 'logic'];
    if (businessPatterns.some(pattern => text.includes(pattern))) {
      layerScores["3-Domain"].score += 2;
      layerScores["3-Domain"].indicators.push('business-logic-detected');
    }

    // Database patterns
    const dbPatterns = ['save', 'fetch', 'query', 'insert', 'update', 'delete'];
    if (dbPatterns.some(pattern => text.includes(pattern))) {
      layerScores["4-Persistence"].score += 2;
      layerScores["4-Persistence"].indicators.push('data-operation-detected');
    }

    // Infrastructure patterns
    const infraPatterns = ['deploy', 'configure', 'setup', 'install', 'build'];
    if (infraPatterns.some(pattern => text.includes(pattern))) {
      layerScores["5-Infrastructure"].score += 2;
      layerScores["5-Infrastructure"].indicators.push('infrastructure-action-detected');
    }
  }

  /**
   * Get all available layer keywords for testing/debugging
   */
  getLayerKeywords(): LayerKeywords {
    return { ...this.layerKeywords };
  }

  /**
   * Add custom keywords for a specific layer
   */
  addLayerKeywords(layer: ArchitecturalLayer, keywords: string[]): void {
    if (layer !== "*" && this.layerKeywords[layer]) {
      this.layerKeywords[layer].push(...keywords);
    }
  }
}