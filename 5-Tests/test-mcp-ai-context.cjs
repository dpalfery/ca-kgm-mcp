const { spawn } = require('child_process');

class MCPClient {
    constructor() {
        this.requestId = 1;
    }

    async testAIContextIdentification() {
        console.log('🧪 Testing MCP Server AI-Based Context Identification\n');
        
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
                const result = await this.queryDirectives(testCase.taskDescription, testCase.modeSlug);
                
                if (result && result.directives && result.directives.length > 0) {
                    console.log(`✅ Found ${result.directives.length} relevant directives:`);
                    
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
                    });
                    
                    if (result.directives.length > 3) {
                        console.log(`   ... and ${result.directives.length - 3} more directives`);
                    }
                } else {
                    console.log('❌ No relevant directives found');
                }
                
                // Show context detection info
                if (result && result.contextInfo) {
                    console.log(`\n🎯 Context Detection:`);
                    console.log(`   Layer: ${result.contextInfo.layer || 'Not detected'}`);
                    console.log(`   Technologies: ${result.contextInfo.technologies?.join(', ') || 'None detected'}`);
                    console.log(`   Topics: ${result.contextInfo.topics?.join(', ') || 'None detected'}`);
                }
                
            } catch (error) {
                console.log(`❌ Error: ${error.message}`);
            }
            
            // Wait a bit between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n🎉 AI Context Identification Testing Complete!');
    }

    async queryDirectives(taskDescription, modeSlug) {
        return new Promise((resolve, reject) => {
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

            let responseBuffer = '';
            let initialized = false;

            child.stdout.on('data', (data) => {
                const text = data.toString();
                responseBuffer += text;
                
                if (!initialized && text.includes('Server is now listening')) {
                    initialized = true;
                    // Send the query request
                    const request = {
                        jsonrpc: "2.0",
                        id: this.requestId++,
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
                }
                
                // Look for JSON response
                const lines = responseBuffer.split('\n');
                for (const line of lines) {
                    if (line.trim() && line.includes('"jsonrpc"')) {
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
            });

            child.stderr.on('data', (data) => {
                console.error('MCP Server Error:', data.toString());
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`MCP server exited with code ${code}`));
                }
            });

            // Timeout after 15 seconds
            setTimeout(() => {
                child.kill();
                reject(new Error('Request timeout'));
            }, 15000);
        });
    }
}

// Run the test
const client = new MCPClient();
client.testAIContextIdentification().catch(console.error);