/**
 * Demo script to showcase Phase 2 Context Detection
 */

import { detectLayer, detectMultipleLayers } from './layer-detector.js';
import { detectTechnologies } from './tech-detector.js';
import { detectTopics } from './topic-detector.js';

console.log('=== Phase 2 Context Detection Demo ===\n');

// Example 1: Frontend Task
console.log('Example 1: Frontend Development Task');
console.log('Text: "Build a React component with form inputs and submit button"\n');

const text1 = 'Build a React component with form inputs and submit button';
const layer1 = detectLayer(text1);
const techs1 = detectTechnologies(text1);
const topics1 = detectTopics(text1);

console.log(`  Layer: ${layer1.layer} (confidence: ${(layer1.confidence * 100).toFixed(0)}%)`);
console.log(`  Technologies: ${techs1.map(t => t.name).join(', ')}`);
console.log(`  Topics: ${topics1.map(t => t.topic).join(', ')}\n`);

// Example 2: Backend API Task
console.log('Example 2: Backend API Development Task');
console.log('Text: "Create REST API endpoints with authentication using Express and JWT"\n');

const text2 = 'Create REST API endpoints with authentication using Express and JWT';
const layer2 = detectLayer(text2);
const techs2 = detectTechnologies(text2);
const topics2 = detectTopics(text2);

console.log(`  Layer: ${layer2.layer} (confidence: ${(layer2.confidence * 100).toFixed(0)}%)`);
console.log(`  Technologies: ${techs2.map(t => t.name).join(', ')}`);
console.log(`  Topics: ${topics2.map(t => t.topic).join(', ')}\n`);

// Example 3: Database Task
console.log('Example 3: Database Development Task');
console.log('Text: "Implement repository pattern with Prisma ORM for PostgreSQL database migrations"\n');

const text3 = 'Implement repository pattern with Prisma ORM for PostgreSQL database migrations';
const layer3 = detectLayer(text3);
const techs3 = detectTechnologies(text3);
const topics3 = detectTopics(text3);

console.log(`  Layer: ${layer3.layer} (confidence: ${(layer3.confidence * 100).toFixed(0)}%)`);
console.log(`  Technologies: ${techs3.map(t => t.name).join(', ')}`);
console.log(`  Topics: ${topics3.map(t => t.topic).join(', ')}\n`);

// Example 4: Deployment Task
console.log('Example 4: Deployment Task');
console.log('Text: "Set up Docker containerization and Kubernetes deployment with CI/CD pipeline"\n');

const text4 = 'Set up Docker containerization and Kubernetes deployment with CI/CD pipeline';
const layer4 = detectLayer(text4);
const techs4 = detectTechnologies(text4);
const topics4 = detectTopics(text4);

console.log(`  Layer: ${layer4.layer} (confidence: ${(layer4.confidence * 100).toFixed(0)}%)`);
console.log(`  Technologies: ${techs4.map(t => t.name).join(', ')}`);
console.log(`  Topics: ${topics4.map(t => t.topic).join(', ')}\n`);

// Example 5: Multi-layer Task
console.log('Example 5: Full-Stack Development Task');
console.log('Text: "Build full-stack app with React frontend, Express API, and PostgreSQL database"\n');

const text5 = 'Build full-stack app with React frontend, Express API, and PostgreSQL database';
const layers5 = detectMultipleLayers(text5, { confidenceThreshold: 0.3 });
const techs5 = detectTechnologies(text5);
const topics5 = detectTopics(text5);

console.log(`  Multiple Layers Detected:`);
layers5.forEach(l => {
  console.log(`    - ${l.layer} (confidence: ${(l.confidence * 100).toFixed(0)}%)`);
});
console.log(`  Technologies: ${techs5.map(t => t.name).join(', ')}`);
console.log(`  Topics: ${topics5.map(t => t.topic).join(', ')}\n`);

console.log('=== Demo Complete ===');
