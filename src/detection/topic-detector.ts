/**
 * Topic Identification
 * 
 * Identifies topics from text using keyword matching and semantic similarity.
 * Supports domain-specific terminology.
 */

export interface TopicDefinition {
  name: string;
  keywords: string[];
  relatedTerms: string[];
}

export interface TopicDetectionResult {
  topic: string;
  confidence: number;
}

/**
 * Topic definitions with keywords
 */
const TOPIC_DEFINITIONS: TopicDefinition[] = [
  {
    name: 'security',
    keywords: [
      'auth', 'authentication', 'authorization', 'encryption', 'decrypt',
      'password', 'token', 'jwt', 'oauth', 'ssl', 'tls', 'https',
      'vulnerability', 'secure', 'security', 'xss', 'csrf', 'sql injection',
      'sanitize', 'validate', 'permissions', 'access control', 'firewall',
      'certificate', 'key', 'hash', 'bcrypt', 'salt'
    ],
    relatedTerms: ['owasp', 'penetration testing', 'security audit', 'compliance']
  },
  {
    name: 'testing',
    keywords: [
      'test', 'testing', 'unit test', 'integration test', 'e2e', 'end-to-end',
      'coverage', 'tdd', 'test-driven', 'bdd', 'behavior-driven',
      'assertion', 'mock', 'stub', 'spy', 'fixture', 'test case',
      'test suite', 'spec', 'expect', 'assert', 'verify'
    ],
    relatedTerms: ['quality assurance', 'qa', 'automated testing', 'regression']
  },
  {
    name: 'performance',
    keywords: [
      'performance', 'optimization', 'optimize', 'cache', 'caching',
      'latency', 'throughput', 'speed', 'fast', 'slow', 'bottleneck',
      'scalability', 'scale', 'load', 'benchmark', 'profiling',
      'memory', 'cpu', 'resource', 'efficient', 'response time'
    ],
    relatedTerms: ['load testing', 'stress testing', 'performance tuning']
  },
  {
    name: 'api',
    keywords: [
      'api', 'rest', 'restful', 'graphql', 'grpc', 'endpoint',
      'route', 'routing', 'http', 'request', 'response',
      'get', 'post', 'put', 'delete', 'patch',
      'versioning', 'swagger', 'openapi', 'api gateway',
      'microservice', 'service', 'web service'
    ],
    relatedTerms: ['api design', 'api documentation', 'api contract']
  },
  {
    name: 'database',
    keywords: [
      'database', 'db', 'sql', 'nosql', 'query', 'schema',
      'table', 'collection', 'document', 'record', 'row',
      'migration', 'index', 'foreign key', 'primary key',
      'join', 'transaction', 'acid', 'backup', 'restore',
      'replication', 'sharding', 'partition'
    ],
    relatedTerms: ['data modeling', 'normalization', 'denormalization']
  },
  {
    name: 'deployment',
    keywords: [
      'deployment', 'deploy', 'ci/cd', 'pipeline', 'build',
      'release', 'environment', 'production', 'staging', 'development',
      'container', 'docker', 'kubernetes', 'orchestration',
      'infrastructure', 'terraform', 'ansible', 'jenkins',
      'github actions', 'gitlab ci', 'devops'
    ],
    relatedTerms: ['continuous integration', 'continuous deployment', 'automation']
  },
  {
    name: 'documentation',
    keywords: [
      'documentation', 'document', 'docs', 'readme', 'comment',
      'api docs', 'jsdoc', 'javadoc', 'docstring', 'swagger',
      'openapi', 'guide', 'tutorial', 'example', 'specification',
      'markdown', 'wiki', 'manual', 'reference'
    ],
    relatedTerms: ['technical writing', 'user guide', 'developer guide']
  },
  {
    name: 'accessibility',
    keywords: [
      'accessibility', 'a11y', 'wcag', 'aria', 'screen reader',
      'keyboard navigation', 'focus', 'semantic', 'alt text',
      'inclusive', 'disability', 'assistive technology',
      'contrast', 'color blind', 'tab index'
    ],
    relatedTerms: ['inclusive design', 'universal design', 'ada compliance']
  },
  {
    name: 'error-handling',
    keywords: [
      'error', 'exception', 'error handling', 'try', 'catch',
      'throw', 'failure', 'fault', 'recovery', 'retry',
      'fallback', 'graceful', 'resilience', 'timeout',
      'circuit breaker', 'validation', 'error message'
    ],
    relatedTerms: ['fault tolerance', 'error recovery', 'exception handling']
  },
  {
    name: 'logging',
    keywords: [
      'log', 'logging', 'logger', 'trace', 'debug',
      'info', 'warn', 'error', 'fatal', 'log level',
      'log file', 'audit', 'monitoring', 'observability',
      'telemetry', 'metrics', 'instrumentation'
    ],
    relatedTerms: ['log aggregation', 'log analysis', 'application monitoring']
  },
  {
    name: 'architecture',
    keywords: [
      'architecture', 'design pattern', 'pattern', 'mvc', 'mvvm',
      'clean architecture', 'hexagonal', 'onion', 'layered',
      'microservices', 'monolith', 'serverless', 'event-driven',
      'cqrs', 'event sourcing', 'domain-driven', 'ddd',
      'solid', 'separation of concerns', 'decoupling'
    ],
    relatedTerms: ['software design', 'architectural pattern', 'design principles']
  },
  {
    name: 'data-validation',
    keywords: [
      'validation', 'validate', 'sanitize', 'sanitization',
      'input validation', 'schema validation', 'constraint',
      'rule', 'check', 'verify', 'format', 'regex',
      'required', 'optional', 'min', 'max', 'length'
    ],
    relatedTerms: ['data integrity', 'input sanitization', 'data validation']
  },
  {
    name: 'state-management',
    keywords: [
      'state', 'state management', 'redux', 'mobx', 'vuex',
      'context', 'store', 'action', 'reducer', 'dispatch',
      'mutation', 'reactive', 'observable', 'immutable',
      'state machine', 'stateful', 'stateless'
    ],
    relatedTerms: ['application state', 'client state', 'server state']
  },
  {
    name: 'async-programming',
    keywords: [
      'async', 'asynchronous', 'await', 'promise', 'callback',
      'concurrent', 'parallel', 'threading', 'coroutine',
      'event loop', 'non-blocking', 'reactive', 'observable',
      'stream', 'future', 'task', 'goroutine'
    ],
    relatedTerms: ['concurrency', 'asynchronous programming', 'parallel processing']
  }
];

/**
 * Detect topics from text
 */
export function detectTopics(text: string): TopicDetectionResult[] {
  const normalizedText = text.toLowerCase();
  const words = normalizedText.split(/\s+/);
  const wordSet = new Set(words);

  const topicScores: TopicDetectionResult[] = [];

  for (const topic of TOPIC_DEFINITIONS) {
    let matchScore = 0;
    const allTerms = [...topic.keywords, ...topic.relatedTerms];

    for (const term of allTerms) {
      const termWords = term.toLowerCase().split(/\s+/);

      // Exact phrase match (highest weight)
      if (normalizedText.includes(term.toLowerCase())) {
        matchScore += 2.0;
      }
      // All words present
      else if (termWords.length > 1 && termWords.every(word => wordSet.has(word))) {
        matchScore += 1.5;
      }
      // Single word match
      else if (termWords.length === 1 && wordSet.has(termWords[0])) {
        matchScore += 1.0;
      }
      // Partial match
      else if (termWords.some(word => wordSet.has(word))) {
        matchScore += 0.3;
      }
    }

    // Calculate confidence (normalize by number of keywords)
    const confidence = Math.min(matchScore / (allTerms.length * 0.2), 1.0);

    // Only include topics with reasonable confidence
    if (confidence > 0.3) {
      topicScores.push({
        topic: topic.name,
        confidence
      });
    }
  }

  // Sort by confidence descending
  return topicScores.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Check if specific topic is present
 */
export function hasTopic(text: string, topicName: string): boolean {
  const detected = detectTopics(text);
  return detected.some(t => t.topic === topicName);
}

/**
 * Get primary topic (highest confidence)
 */
export function getPrimaryTopic(text: string): TopicDetectionResult | null {
  const topics = detectTopics(text);
  return topics.length > 0 ? topics[0] : null;
}

/**
 * Get all topics above a confidence threshold
 */
export function getTopicsAboveThreshold(
  text: string,
  threshold: number = 0.5
): TopicDetectionResult[] {
  const topics = detectTopics(text);
  return topics.filter(t => t.confidence >= threshold);
}
