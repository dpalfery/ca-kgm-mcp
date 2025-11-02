// Task Context Detector
// Analyzes task descriptions to extract architectural layer and topics for knowledge graph retrieval

interface TaskContext {
  layer: string | null; // e.g., "1-Presentation", "4-Persistence"
  topics: string[]; // e.g., ["security", "testing", "process"]
  keywords: string[]; // Additional relevant keywords
  confidence: number; // 0-1 confidence score
}

export function detectTaskContext(taskDescription: string): TaskContext {
  const lowerTask = taskDescription.toLowerCase();

  // Layer detection patterns
  const layerPatterns = [
    { pattern: /\b(api|controller|endpoint|web|http|signalr|hub)\b/, layer: '1-Presentation' },
    { pattern: /\b(service|application|business|logic|use.case|command|query|handler)\b/, layer: '2-Application' },
    { pattern: /\b(domain|entity|value.object|aggregate|repository|contract|interface)\b/, layer: '3-Domain' },
    { pattern: /\b(data|persistence|repository|ado\.net|sql|database|migration)\b/, layer: '4-Persistence' },
    { pattern: /\b(test|unit|integration|e2e|coverage|spec|mock)\b/, layer: '5-Test' },
    { pattern: /\b(doc|documentation|readme|architecture|diagram)\b/, layer: '6-Docs' },
    { pattern: /\b(deploy|infrastructure|azure|docker|ci.cd|pipeline)\b/, layer: '7-Deployment' },
    { pattern: /\b(base|shared|common|utility|config)\b/, layer: '0-Base' }
  ];

  // Topic detection patterns
  const topicPatterns = [
    { pattern: /\b(security|auth|authorization|authentication|secret|encryption|https|sql.injection|xss|csrf)\b/, topic: 'security' },
    { pattern: /\b(test|unit|integration|e2e|coverage|spec|mock|assert|fixture)\b/, topic: 'testing' },
    { pattern: /\b(process|workflow|task|todo|status|tracking|cli|command|powershell)\b/, topic: 'process' },
    { pattern: /\b(architecture|layer|clean|ddd|pattern|design|structure)\b/, topic: 'architecture' },
    { pattern: /\b(data|database|sql|ado\.net|entity|migration|query|parameter)\b/, topic: 'data' },
    { pattern: /\b(build|compile|error|warning|quality|stylecop|lint)\b/, topic: 'build' },
    { pattern: /\b(code|quality|review|standard|best.practice|guideline)\b/, topic: 'quality' }
  ];

  // Detect layer
  let detectedLayer: string | null = null;
  let maxLayerScore = 0;

  for (const { pattern, layer } of layerPatterns) {
    const matches = lowerTask.match(pattern);
    if (matches) {
      const score = matches.length; // Simple scoring based on number of matches
      if (score > maxLayerScore) {
        maxLayerScore = score;
        detectedLayer = layer;
      }
    }
  }

  // Detect topics
  const detectedTopics: string[] = [];
  for (const { pattern, topic } of topicPatterns) {
    if (pattern.test(lowerTask)) {
      detectedTopics.push(topic);
    }
  }

  // Extract additional keywords (nouns and technical terms)
  const keywordPatterns = /\b[a-z]{3,}\b/g;
  const allWords = lowerTask.match(keywordPatterns) || [];
  const keywords = allWords.filter(word =>
    !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'when', 'where', 'what', 'how', 'why'].includes(word) &&
    word.length > 2
  ).slice(0, 10); // Limit to top 10

  // Calculate confidence based on detection strength
  const layerConfidence = detectedLayer ? Math.min(maxLayerScore / 3, 1) : 0;
  const topicConfidence = detectedTopics.length > 0 ? Math.min(detectedTopics.length / 3, 1) : 0;
  const overallConfidence = (layerConfidence + topicConfidence) / 2;

  return {
    layer: detectedLayer,
    topics: detectedTopics,
    keywords,
    confidence: overallConfidence
  };
}

// Example usage:
// const context = detectTaskContext("Implement a secure API endpoint for user authentication");
// console.log(context);
// Output: { layer: "1-Presentation", topics: ["security"], keywords: ["implement", "secure", "api", "endpoint", "user", "authentication"], confidence: 0.75 }