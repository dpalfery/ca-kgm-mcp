#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist');

/**
 * Recursively find all .js files in dist directory
 */
function findJsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

/**
 * Add .js extension to relative imports that don't have it
 */
function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;
  
  // Match: from './path' or from "../path" where path doesn't end with .js
  // Pattern: from ['"]\.{1,2}/[^'"]+(?<!\.js)['"]
  content = content.replace(
    /from\s+(['"])(\.[^'"]+)(?<!\.js)\1/g,
    (match, quote, importPath) => {
      // Don't add .js to node_modules or packages
      if (importPath.includes('node_modules')) {
        return match;
      }
      return `from ${quote}${importPath}.js${quote}`;
    }
  );
  
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`✓ Fixed imports in: ${path.relative(distDir, filePath)}`);
  }
}

// Main execution
console.log('🔧 Fixing ESM imports (.js extensions)...');
const jsFiles = findJsFiles(distDir);
console.log(`📁 Found ${jsFiles.length} .js files`);

jsFiles.forEach(fixImports);
console.log('✅ ESM imports fixed!');
