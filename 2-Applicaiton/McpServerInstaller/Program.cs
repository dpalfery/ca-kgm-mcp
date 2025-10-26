using System;
using System.Diagnostics;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;

namespace McpServerInstaller
{
    internal class Program
    {
        static async Task<int> Main(string[] args)
        {
            Console.WriteLine("MCP Server Installer");
            Console.WriteLine("====================");
            try
            {
                var repoRoot = FindRepoRoot();
                if (repoRoot == null)
                {
                    Console.Error.WriteLine("Error: Could not locate repository root (package.json not found).");
                    return 1;
                }

                Console.WriteLine($"Repo Root: {repoRoot}");

                if (!CheckCommand("node", "-v", repoRoot, out var nodeVer))
                {
                    Console.Error.WriteLine("Error: Node.js not found. Install from https://nodejs.org/ and re-run.");
                    return 1;
                }
                Console.WriteLine($"Node.js: {nodeVer}");

                if (!CheckCommand("npm", "-v", repoRoot, out var npmVer))
                {
                    Console.Error.WriteLine("Error: npm not found. Ensure Node.js installation includes npm and re-run.");
                    return 1;
                }
                Console.WriteLine($"npm: {npmVer}");

                Console.WriteLine("Running: npm install");
                var installOk = await RunAsync("cmd.exe", "/c npm install", repoRoot);
                if (installOk.code != 0)
                {
                    Console.Error.WriteLine("npm install failed.");
                    Console.Error.WriteLine(installOk.stderr);
                    return installOk.code;
                }

                Console.WriteLine("Running: npm run build");
                var buildOk = await RunAsync("cmd.exe", "/c npm run build", repoRoot);
                if (buildOk.code != 0)
                {
                    Console.WriteLine("Warning: npm run build failed. Continuing, dev mode may still work.");
                    Console.WriteLine(buildOk.stderr);
                }

                if (!EnsureMcpConfig(repoRoot, out var mcpPath))
                {
                    Console.Error.WriteLine("Failed to update .kilocode/mcp.json");
                    return 1;
                }
                Console.WriteLine($".kilocode/mcp.json ensured at: {mcpPath}");

                PrintNextSteps(repoRoot);
                return 0;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Unhandled error: {ex.Message}");
                return 1;
            }
        }

        private static string? FindRepoRoot()
        {
            var dir = Directory.GetCurrentDirectory();
            for (int i = 0; i < 10 && dir != null; i++)
            {
                if (File.Exists(Path.Combine(dir, "package.json")))
                {
                    return dir;
                }
                dir = Directory.GetParent(dir)?.FullName;
            }
            return null;
        }

        private static bool CheckCommand(string file, string args, string workingDir, out string version)
        {
            var result = Run("cmd.exe", $"/c {file} {args}", workingDir);
            version = (result.code == 0 ? result.stdout.Trim() : "").Replace(Environment.NewLine, " ");
            return result.code == 0;
        }

        private static (int code, string stdout, string stderr) Run(string fileName, string arguments, string workingDir, int timeoutMs = 60000)
        {
            var psi = new ProcessStartInfo(fileName, arguments)
            {
                WorkingDirectory = workingDir,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var proc = new Process { StartInfo = psi };
            proc.Start();
            if (!proc.WaitForExit(timeoutMs))
            {
                try { proc.Kill(true); } catch { /* ignore */ }
                return (-1, "", "Process timed out");
            }
            var stdout = proc.StandardOutput.ReadToEnd();
            var stderr = proc.StandardError.ReadToEnd();
            return (proc.ExitCode, stdout, stderr);
        }

        private static async Task<(int code, string stdout, string stderr)> RunAsync(string fileName, string arguments, string workingDir, int timeoutMs = 0)
        {
            return await Task.Run(() => Run(fileName, arguments, workingDir, timeoutMs == 0 ? 600000 : timeoutMs));
        }

        private static bool EnsureMcpConfig(string repoRoot, out string mcpConfigPath)
        {
            var dir = Path.Combine(repoRoot, ".kilocode");
            Directory.CreateDirectory(dir);
            mcpConfigPath = Path.Combine(dir, "mcp.json");

            JsonObject rootObj;
            if (File.Exists(mcpConfigPath))
            {
                try
                {
                    rootObj = JsonNode.Parse(File.ReadAllText(mcpConfigPath))?.AsObject() ?? new JsonObject();
                }
                catch
                {
                    rootObj = new JsonObject();
                }
            }
            else
            {
                rootObj = new JsonObject();
            }

            if (!rootObj.TryGetPropertyValue("mcpServers", out var serversNode) || serversNode is null || serversNode is not JsonObject)
            {
                serversNode = new JsonObject();
                rootObj["mcpServers"] = serversNode;
            }
            var servers = (JsonObject)serversNode;

            if (!servers.TryGetPropertyValue("context-iso", out var ctxNode) || ctxNode is null || ctxNode is not JsonObject)
            {
                var ctx = new JsonObject
                {
                    ["command"] = "npx",
                    ["args"] = new JsonArray("--yes", "tsx", "src/index.ts"),
                    ["env"] = new JsonObject
                    {
                        ["NEO4J_URI"] = "${env:NEO4J_URI}",
                        ["NEO4J_USERNAME"] = "${env:NEO4J_USERNAME}",
                        ["NEO4J_PASSWORD"] = "${env:NEO4J_PASSWORD}",
                        ["NEO4J_DATABASE"] = "neo4j"
                    },
                    ["disabled"] = false,
                    ["alwaysAllow"] = new JsonArray()
                };
                servers["context-iso"] = ctx;
            }
            else
            {
                var ctx = (JsonObject)ctxNode;
                ctx["disabled"] = false;
            }

            // Keep existing microsoft-learn entry if present; do nothing

            File.WriteAllText(mcpConfigPath, JsonSerializer.Serialize(rootObj, new JsonSerializerOptions { WriteIndented = true }));
            return true;
        }

        private static void PrintNextSteps(string repoRoot)
        {
            var mcp = Path.Combine(repoRoot, ".kilocode", "mcp.json");
            Console.WriteLine();
            Console.WriteLine("Installation complete.");
            Console.WriteLine("Next steps:");
            Console.WriteLine("  1) Set environment variables NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD (and optional NEO4J_DATABASE).");
            Console.WriteLine($"  2) Verify config: {mcp}");
            Console.WriteLine("  3) Start the MCP server in dev mode:");
            Console.WriteLine("       npm run dev");
            Console.WriteLine("     or run directly:");
            Console.WriteLine("       npx --yes tsx src/index.ts");
            Console.WriteLine("  4) For production build:");
            Console.WriteLine("       npm run build && npm start");
        }
    }
}