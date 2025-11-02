/**
 * Topic Identification Module
 * 
 * Extracts topic categories from text to understand the domain/focus area
 * of a coding task (security, testing, performance, API, etc).
 */

export interface DetectedTopic {
  name: string;
  confidence: number;
  keywords: string[];
}

const TOPICS = {
  security: {
    keywords: [
      'auth', 'authentication', 'authorization', 'permission', 'role',
      'encryption', 'encrypt', 'decrypt', 'hash', 'salt',
      'password', 'token', 'jwt', 'oauth', 'oAuth2',
      'ssl', 'tls', 'certificate', 'https',
      'vulnerability', 'exploit', 'injection', 'xss', 'csrf',
      'owasp', 'security', 'secure', 'threat', 'attack',
      'access control', 'privilege', 'identity', 'confidentiality',
      'integrity', 'validation', 'sanitize', 'escape'
    ]
  },
  testing: {
    keywords: [
      'test', 'testing', 'unit test', 'integration test', 'e2e', 'end-to-end',
      'mock', 'stub', 'spy', 'coverage', 'assert', 'assertion',
      'expect', 'should', 'jest', 'vitest', 'mocha', 'cypress',
      'tdd', 'bdd', 'test-driven', 'behavior-driven',
      'quality', 'qa', 'validation', 'verification',
      'coverage report', 'codecov', 'nyc',
      'fixture', 'setup', 'teardown', 'beforeeach', 'aftereach'
    ]
  },
  performance: {
    keywords: [
      'performance', 'optimize', 'optimization', 'fast', 'faster',
      'slow', 'latency', 'throughput', 'bandwidth',
      'cache', 'caching', 'memoization', 'memo',
      'benchmark', 'profile', 'profiling',
      'memory', 'heap', 'leak', 'gc', 'garbage collection',
      'scalability', 'scale', 'load', 'stress', 'capacity',
      'efficiency', 'algorithm', 'complexity', 'big-o', 'o(n)'
    ]
  },
  api: {
    keywords: [
      'api', 'endpoint', 'route', 'rest', 'restful', 'graphql',
      'grpc', 'rpc', 'soap', 'http', 'request', 'response',
      'get', 'post', 'put', 'delete', 'patch', 'method',
      'header', 'body', 'query', 'parameter', 'url',
      'status code', 'http code', 'error code',
      'versioning', 'v1', 'v2', 'compatibility',
      'documentation', 'openapi', 'swagger', 'schema'
    ]
  },
  database: {
    keywords: [
      'database', 'db', 'schema', 'table', 'column', 'row',
      'query', 'sql', 'nosql', 'mongodb', 'postgres', 'mysql',
      'migration', 'seed', 'fixture', 'backup', 'restore',
      'index', 'indexing', 'transaction', 'transaction',
      'normalize', 'denormalize', 'join', 'relationship',
      'data model', 'erd', 'entity-relationship',
      'constraint', 'foreign key', 'primary key'
    ]
  },
  deployment: {
    keywords: [
      'deployment', 'deploy', 'release', 'version',
      'docker', 'container', 'image', 'kubernetes', 'k8s',
      'ci/cd', 'pipeline', 'github actions', 'gitlab ci',
      'environment', 'dev', 'staging', 'production', 'prod',
      'devops', 'infrastructure', 'iaas', 'paas',
      'cloud', 'aws', 'azure', 'gcp', 'heroku'
    ]
  },
  documentation: {
    keywords: [
      'documentation', 'document', 'doc', 'readme', 'readme.md',
      'comment', 'documentation string', 'docstring', 'jsdoc',
      'changelog', 'guide', 'tutorial', 'example',
      'api docs', 'api documentation', 'swagger', 'openapi',
      'inline comment', 'javadoc', 'tsdoc', 'eslint-disable',
      'explain', 'clarify', 'summary', 'description'
    ]
  },
  accessibility: {
    keywords: [
      'accessibility', 'a11y', 'wcag', 'accessible', 'wcag2',
      'aria', 'screen reader', 'keyboard', 'keyboard navigation',
      'color contrast', 'inclusive', 'disability',
      'alt text', 'semantic html', 'labeling',
      'focus', 'tab order', 'announce', 'live region'
    ]
  },
  refactoring: {
    keywords: [
      'refactor', 'refactoring', 'clean up', 'cleanup',
      'improve', 'improvement', 'enhance', 'enhancement',
      'simplify', 'simplification', 'optimize', 'optimization',
      'consolidate', 'dry', 'dont repeat yourself',
      'code quality', 'maintainability', 'readability'
    ]
  },
  architecture: {
    keywords: [
      'architecture', 'pattern', 'design pattern', 'architectural pattern',
      'microservice', 'monolith', 'modular', 'module',
      'layered', 'clean architecture', 'onion architecture',
      'mvc', 'mvvm', 'repository pattern', 'dependency injection',
      'service locator', 'factory', 'singleton', 'adapter',
      'facade', 'proxy', 'decorator'
    ]
  },
  'error-handling': {
    keywords: [
      'error', 'exception', 'try', 'catch', 'finally',
      'throw', 'throws', 'handling', 'handler',
      'fallback', 'recovery', 'resilience', 'retry',
      'timeout', 'circuit breaker', 'graceful',
      'debugging', 'debug', 'logging', 'log',
      'stacktrace', 'traceback', 'error message'
    ]
  }
};

/**
 * Calculate confidence for a topic based on keyword matches
 */
function calculateTopicConfidence(keywords: string[], text: string): number {
  const lowerText = text.toLowerCase();
  const words = new Set(lowerText.split(/\W+/));
  
  let matches = 0;
  for (const keyword of keywords) {
    if (words.has(keyword.toLowerCase())) {
      matches++;
    }
  }
  
  if (matches === 0) return 0;
  
  // More matches = higher confidence
  // Cap at 1.0
  return Math.min(matches / keywords.length, 1.0);
}

export class TopicDetector {
  /**
   * Detect topics from text
   */
  static detect(text: string): DetectedTopic[] {
    const detected: DetectedTopic[] = [];

    for (const [topicName, config] of Object.entries(TOPICS)) {
      const confidence = calculateTopicConfidence(config.keywords, text);
      
      if (confidence > 0.05) { // Only include if at least 5% match
        detected.push({
          name: topicName,
          confidence,
          keywords: config.keywords.filter(k => 
            text.toLowerCase().includes(k.toLowerCase())
          )
        });
      }
    }

    // Sort by confidence descending
    return detected.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get all available topics
   */
  static getAvailableTopics(): string[] {
    return Object.keys(TOPICS);
  }

  /**
   * Get keywords for a specific topic
   */
  static getTopicKeywords(topic: string): string[] {
    return (TOPICS as any)[topic]?.keywords || [];
  }
}
