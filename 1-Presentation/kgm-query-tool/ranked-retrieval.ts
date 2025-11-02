// Ranked Retrieval with Scoring
// Implements authority match > when_to_apply match > layer match > semantic similarity scoring

interface RetrievalResult {
  entity: string;
  type: string;
  content: string;
  score: number;
  metadata: {
    severity?: 'must' | 'should' | 'may';
    topics?: string[];
    layer?: string;
    source?: string;
    whenToApply?: string;
    authoritativeFor?: string[];
  };
}

interface QueryContext {
  layer?: string;
  topics?: string[];
  keywords?: string[];
}

export function rankRetrievalResults(results: RetrievalResult[], context: QueryContext): RetrievalResult[] {
  return results.map(result => ({
    ...result,
    score: calculateRelevanceScore(result, context)
  })).sort((a, b) => b.score - a.score);
}

function calculateRelevanceScore(result: RetrievalResult, context: QueryContext): number {
  let score = 0;

  // 1. Authority match (highest priority)
  if (result.metadata.authoritativeFor && context.topics) {
    const authorityMatches = result.metadata.authoritativeFor.filter(auth =>
      context.topics!.some(topic => auth.toLowerCase().includes(topic.toLowerCase()))
    );
    score += authorityMatches.length * 100; // High weight for authority
  }

  // 2. When to apply match
  if (result.metadata.whenToApply && result.metadata.whenToApply !== 'Not specified') {
    const whenToApply = result.metadata.whenToApply.toLowerCase();
    if (context.layer && whenToApply.includes(context.layer.toLowerCase())) {
      score += 50;
    }
    if (context.topics && context.topics.some(topic => whenToApply.includes(topic))) {
      score += 30;
    }
  }

  // 3. Layer match
  if (result.metadata.layer && context.layer) {
    if (result.metadata.layer === context.layer) {
      score += 40;
    } else if (result.metadata.layer.includes(context.layer.split('-')[1])) {
      score += 20; // Partial layer match
    }
  }

  // 4. Topic match
  if (result.metadata.topics && context.topics) {
    const topicMatches = result.metadata.topics.filter(topic =>
      context.topics!.some(ctxTopic => topic.toLowerCase().includes(ctxTopic.toLowerCase()))
    );
    score += topicMatches.length * 15;
  }

  // 5. Severity boost (must > should > may)
  if (result.metadata.severity) {
    switch (result.metadata.severity) {
      case 'must': score += 25; break;
      case 'should': score += 15; break;
      case 'may': score += 5; break;
    }
  }

  // 6. Semantic similarity (basic keyword matching)
  if (context.keywords) {
    const content = (result.content + ' ' + JSON.stringify(result.metadata)).toLowerCase();
    const keywordMatches = context.keywords.filter(keyword =>
      content.includes(keyword.toLowerCase())
    );
    score += keywordMatches.length * 5;
  }

  // 7. Entity type preference (Directive > Rule > Section > Pattern)
  switch (result.type) {
    case 'Directive': score += 20; break;
    case 'Rule': score += 15; break;
    case 'Section': score += 10; break;
    case 'Pattern': score += 5; break;
  }

  return score;
}

// Filter and limit results
export function filterAndLimitResults(results: RetrievalResult[], maxResults: number = 10): RetrievalResult[] {
  // Remove duplicates based on content similarity
  const uniqueResults: RetrievalResult[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    const key = result.content.substring(0, 100).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(result);
    }
  }

  return uniqueResults.slice(0, maxResults);
}

// Example usage:
// const ranked = rankRetrievalResults(rawResults, context);
// const filtered = filterAndLimitResults(ranked, 5);