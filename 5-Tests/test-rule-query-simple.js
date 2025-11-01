import { RuleManager } from '../src/rules/rule-manager.js';
import { detectTaskContext } from '../kgm-query-tool/task-context-detector.js';

async function testAIContextIdentification() {
    console.log('🧪 Testing AI-Based Context Identification with Rule Query\n');
    
    try {
        // Initialize the rule manager
        const ruleManager = new RuleManager();
        await ruleManager.initialize();
        
        // Test cases with different task descriptions
        const testCases = [
            {
                name: "ASP.NET Core API Development",
                taskDescription: "I need to create a new API endpoint for user authentication in ASP.NET Core",
                modeSlug: "code"
            },
            {
                name: "Frontend React Component",
                taskDescription: "Building a React component for user profile management with form validation",
                modeSlug: "code"
            },
            {
                name: "Database Design",
                taskDescription: "Designing a database schema for an e-commerce application with user orders",
                modeSlug: "architect"
            },
            {
                name: "Security Implementation",
                taskDescription: "Implementing JWT authentication and authorization middleware",
                modeSlug: "code"
            },
            {
                name: "Performance Optimization",
                taskDescription: "Optimizing API response times and implementing caching strategies",
                modeSlug: "debug"
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n📋 Test Case: ${testCase.name}`);
            console.log(`Task: ${testCase.taskDescription}`);
            console.log(`Mode: ${testCase.modeSlug}`);
            console.log('─'.repeat(80));
            
            try {
                // First, detect context
                const contextInfo = detectTaskContext(testCase.taskDescription);
                console.log(`\n🎯 Context Detection:`);
                console.log(`   Layer: ${contextInfo.layer || 'Not detected'}`);
                console.log(`   Technologies: ${contextInfo.technologies?.join(', ') || 'None detected'}`);
                console.log(`   Topics: ${contextInfo.topics?.join(', ') || 'None detected'}`);
                console.log(`   Confidence: ${contextInfo.confidence || 'N/A'}`);
                
                // Query for relevant directives
                const result = await ruleManager.queryDirectives(testCase.taskDescription, testCase.modeSlug, {
                    maxItems: 5,
                    includeBreadcrumbs: true,
                    severityFilter: ["MUST", "SHOULD"]
                });
                
                if (result && result.directives && result.directives.length > 0) {
                    console.log(`\n✅ Found ${result.directives.length} relevant directives:`);
                    
                    result.directives.slice(0, 3).forEach((directive, index) => {
                        console.log(`\n${index + 1}. [${directive.severity}] ${directive.text}`);
                        if (directive.reasoning) {
                            console.log(`   💡 Reasoning: ${directive.reasoning}`);
                        }
                        if (directive.topics && directive.topics.length > 0) {
                            console.log(`   🏷️  Topics: ${directive.topics.join(', ')}`);
                        }
                        if (directive.source) {
                            console.log(`   📄 Source: ${directive.source}`);
                        }
                        if (directive.confidence) {
                            console.log(`   🎯 Confidence: ${directive.confidence}`);
                        }
                    });
                    
                    if (result.directives.length > 3) {
                        console.log(`   ... and ${result.directives.length - 3} more directives`);
                    }
                } else {
                    console.log('\n❌ No relevant directives found');
                }
                
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
                console.error(error.stack);
            }
            
            // Wait a bit between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n🎉 AI Context Identification Testing Complete!');
        
    } catch (error) {
        console.error('❌ Failed to initialize:', error.message);
        console.error(error.stack);
    }
}

// Run the test
testAIContextIdentification().catch(console.error);