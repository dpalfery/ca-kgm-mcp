#!/usr/bin/env node

/**
 * Simple validation script for rule template
 * Tests that the template follows the expected format for ContextISO
 */

const fs = require('fs');
const path = require('path');

function validateRuleTemplate(filePath) {
  console.log(`\n📋 Validating rule template: ${filePath}\n`);
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const results = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  // Test 1: Check for YAML front matter
  if (content.startsWith('---')) {
    results.passed.push('✓ Has YAML front matter');
    
    // Extract YAML section
    const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (yamlMatch) {
      const yaml = yamlMatch[1];
      
      // Check for key metadata fields
      if (yaml.includes('title:')) results.passed.push('✓ Has title field');
      else results.warnings.push('⚠ Missing title field (optional but recommended)');
      
      if (yaml.includes('layer:')) results.passed.push('✓ Has layer field');
      else results.warnings.push('⚠ Missing layer field (optional but recommended)');
      
      if (yaml.includes('topics:')) results.passed.push('✓ Has topics field');
      else results.warnings.push('⚠ Missing topics field (optional but recommended)');
      
      if (yaml.includes('technologies:')) results.passed.push('✓ Has technologies field');
      else results.warnings.push('⚠ Missing technologies field (optional but recommended)');
    }
  } else {
    results.warnings.push('⚠ No YAML front matter (optional but recommended)');
  }
  
  // Test 2: Check for severity markers
  const mustCount = (content.match(/\[MUST\]/g) || []).length;
  const shouldCount = (content.match(/\[SHOULD\]/g) || []).length;
  const mayCount = (content.match(/\[MAY\]/g) || []).length;
  
  if (mustCount > 0) results.passed.push(`✓ Has ${mustCount} MUST directive(s)`);
  else results.failed.push('✗ No MUST directives found');
  
  if (shouldCount > 0) results.passed.push(`✓ Has ${shouldCount} SHOULD directive(s)`);
  else results.warnings.push('⚠ No SHOULD directives found');
  
  if (mayCount > 0) results.passed.push(`✓ Has ${mayCount} MAY directive(s)`);
  else results.warnings.push('⚠ No MAY directives found');
  
  // Test 3: Check for markdown headers
  const headers = content.match(/^#{1,6}\s+.+$/gm) || [];
  if (headers.length > 0) results.passed.push(`✓ Has ${headers.length} markdown header(s)`);
  else results.failed.push('✗ No markdown headers found');
  
  // Test 4: Check for code blocks (examples)
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  if (codeBlocks.length > 0) results.passed.push(`✓ Has ${codeBlocks.length} code example(s)`);
  else results.warnings.push('⚠ No code examples found (recommended)');
  
  // Test 5: Check for proper directive format (not in code blocks)
  const contentWithoutCode = content.replace(/```[\s\S]*?```/g, '');
  const invalidDirectives = contentWithoutCode.match(/\[(must|should|may)\]/gi) || [];
  if (invalidDirectives.length > 0) {
    results.warnings.push(`⚠ Found ${invalidDirectives.length} directive(s) with incorrect casing (should be uppercase: [MUST], [SHOULD], [MAY])`);
  }
  
  // Print results
  console.log('PASSED CHECKS:');
  results.passed.forEach(msg => console.log(`  ${msg}`));
  
  if (results.warnings.length > 0) {
    console.log('\nWARNINGS:');
    results.warnings.forEach(msg => console.log(`  ${msg}`));
  }
  
  if (results.failed.length > 0) {
    console.log('\nFAILED CHECKS:');
    results.failed.forEach(msg => console.log(`  ${msg}`));
  }
  
  console.log('\n' + '='.repeat(60));
  
  if (results.failed.length === 0) {
    console.log('✅ Template validation PASSED!');
    console.log('\nThis template is ready to use with ContextISO.');
    return true;
  } else {
    console.log('❌ Template validation FAILED!');
    console.log('\nPlease fix the issues above before using with ContextISO.');
    return false;
  }
}

// Main execution
const templatePath = path.join(__dirname, 'rule-template.md');

if (!fs.existsSync(templatePath)) {
  console.error(`Error: Template file not found at ${templatePath}`);
  process.exit(1);
}

const isValid = validateRuleTemplate(templatePath);
process.exit(isValid ? 0 : 1);
