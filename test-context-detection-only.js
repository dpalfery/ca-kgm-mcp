import { detectTaskContext } from './kgm-query-tool/task-context-detector.js';

async function testContextDetection() {
    console.log('🧪 Testing AI-Based Context Detection (Pattern Matching)\n');
    
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
        },
        {
            name: "Unit Testing",
            taskDescription: "Writing unit tests for the user service with mocking and coverage",
            modeSlug: "code"
        },
        {
            name: "Documentation",
            taskDescription: "Creating architecture documentation and API specifications",
            modeSlug: "architect"
        }
    ];

    console.log('Testing pattern-based context detection...\n');

    for (const testCase of testCases) {
        console.log(`📋 Test Case: ${testCase.name}`);
        console.log(`Task: ${testCase.taskDescription}`);
        console.log(`Mode: ${testCase.modeSlug}`);
        console.log('─'.repeat(80));
        
        try {
            // Detect context using pattern matching
            const contextInfo = detectTaskContext(testCase.taskDescription);
            
            console.log(`🎯 Context Detection Results:`);
            console.log(`   Layer: ${contextInfo.layer || 'Not detected'}`);
            console.log(`   Topics: ${contextInfo.topics?.join(', ') || 'None detected'}`);
            console.log(`   Keywords: ${contextInfo.keywords?.slice(0, 5).join(', ') || 'None detected'}`);
            console.log(`   Confidence: ${(contextInfo.confidence * 100).toFixed(1)}%`);
            
            // Analyze the quality of detection
            if (contextInfo.layer) {
                console.log(`✅ Layer detected successfully`);
            } else {
                console.log(`⚠️  No layer detected`);
            }
            
            if (contextInfo.topics.length > 0) {
                console.log(`✅ ${contextInfo.topics.length} topic(s) identified`);
            } else {
                console.log(`⚠️  No topics identified`);
            }
            
            if (contextInfo.confidence > 0.5) {
                console.log(`✅ High confidence detection (${(contextInfo.confidence * 100).toFixed(1)}%)`);
            } else if (contextInfo.confidence > 0.3) {
                console.log(`⚠️  Medium confidence detection (${(contextInfo.confidence * 100).toFixed(1)}%)`);
            } else {
                console.log(`❌ Low confidence detection (${(contextInfo.confidence * 100).toFixed(1)}%)`);
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        
        console.log(''); // Empty line for spacing
    }
    
    console.log('🎉 Context Detection Testing Complete!');
    console.log('\n📊 Summary:');
    console.log('This test demonstrates the pattern-based context detection that helps');
    console.log('the AI system understand what type of development task is being performed');
    console.log('and which architectural layer and topics are most relevant.');
    console.log('\nThe detected context is used to:');
    console.log('• Find relevant directives from the knowledge graph');
    console.log('• Prioritize rules based on architectural layer');
    console.log('• Filter by relevant topics and technologies');
    console.log('• Provide contextually appropriate guidance');
}

// Run the test
testContextDetection().catch(console.error);