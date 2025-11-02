import { spawn } from 'child_process';

async function testMCPQueryDirectives() {
    console.log('🧪 Testing MCP Server Query Directives Functionality\n');
    
    // Test cases with different task descriptions
    const testCases = [
        {
            name: "ASP.NET Core API Development",
            taskDescription: "I need to create a new API endpoint for user authentication in ASP.NET Core",
            modeSlug: "code"
        },
        {
            name: "Security Implementation", 
            taskDescription: "Implementing JWT authentication and authorization middleware",
            modeSlug: "code"
        },
        {
            name: "Database Design",
            taskDescription: "Designing a database schema for an e-commerce application with user orders",
            modeSlug: "architect"
        }
    ];

    for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        console.log(`📋 Test Case ${i + 1}: ${testCase.name}`);
        console.log(`Task: ${testCase.taskDescription}`);
        console.log(`Mode: ${testCase.modeSlug}`);
        console.log('─'.repeat(80));
        
        try {
            const result = await queryMCPServer(testCase.taskDescription, testCase.modeSlug);
            
            if (result && result.directives && result.directives.length > 0) {
                console.log(`✅ Found ${result.directives.length} relevant directives:`);
                
                // Show top 3 directives
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
                console.log('❌ No relevant directives found');
            }
            
            // Show context detection info if available
            if (result && result.contextInfo) {
                console.log(`\n🎯 Context Detection:`);
                console.log(`   Layer: ${result.contextInfo.layer || 'Not detected'}`);
                console.log(`   Technologies: ${result.contextInfo.technologies?.join(', ') || 'None detected'}`);
                console.log(`   Topics: ${result.contextInfo.topics?.join(', ') || 'None detected'}`);
            }
            
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
        }
        
        console.log('\n'); // Extra spacing between test cases
        
        // Wait between requests
        if (i < testCases.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log('🎉 MCP Server Query Testing Complete!');
}

function queryMCPServer(taskDescription, modeSlug) {
    return new Promise((resolve, reject) => {
        // Create a new MCP server instance for this query
        const child = spawn('npx', ['--yes', 'tsx', '1-Presentation/src/index.ts'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                NEO4J_URI: process.env.NEO4J_URI,
                NEO4J_USERNAME: process.env.NEO4J_USERNAME,
                NEO4J_PASSWORD: process.env.NEO4J_PASSWORD,
                NEO4J_DATABASE: 'neo4j'
            }
        });

        let outputBuffer = '';
        let initialized = false;
        let requestSent = false;

        child.stdout.on('data', (data) => {
            const text = data.toString();
            outputBuffer += text;
            
            // Wait for server to be ready
            if (!initialized && text.includes('Server is now listening')) {
                initialized = true;
                console.log('   🔄 MCP Server initialized, sending query...');
                
                // Send the query request
                const request = {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: {
                        name: "memory.rules.query_directives",
                        arguments: {
                            taskDescription: taskDescription,
                            modeSlug: modeSlug,
                            options: {
                                maxItems: 5,
                                includeBreadcrumbs: true,
                                severityFilter: ["MUST", "SHOULD"]
                            }
                        }
                    }
                };
                
                child.stdin.write(JSON.stringify(request) + '\n');
                requestSent = true;
            }
            
            // Look for JSON response
            if (requestSent) {
                const lines = outputBuffer.split('\n');
                for (const line of lines) {
                    if (line.trim() && line.includes('"jsonrpc"') && line.includes('"result"')) {
                        try {
                            const response = JSON.parse(line.trim());
                            if (response.result) {
                                child.kill();
                                resolve(response.result);
                                return;
                            }
                        } catch (e) {
                            // Continue looking for valid JSON
                        }
                    }
                }
            }
        });

        child.stderr.on('data', (data) => {
            const errorText = data.toString();
            if (!errorText.includes('ExperimentalWarning')) {
                console.error('   ⚠️  MCP Server Error:', errorText);
            }
        });

        child.on('close', (code) => {
            if (!requestSent) {
                reject(new Error('Server closed before request could be sent'));
            } else if (code !== 0) {
                reject(new Error(`MCP server exited with code ${code}`));
            } else {
                reject(new Error('No response received'));
            }
        });

        // Timeout after 15 seconds
        setTimeout(() => {
            child.kill();
            reject(new Error('Request timeout - server took too long to respond'));
        }, 15000);
    });
}

// Run the test
testMCPQueryDirectives().catch(console.error);