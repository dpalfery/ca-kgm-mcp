using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace KnowledgeGraphTool
{
    public class MarkdownCrawler
    {
        private readonly string[] _sourceDirectories = new[]
        {
            "../../.kilocode/rules",
            "../../.kilocode/rules/memory-bank",
            "../../6-Docs"
        };

        private readonly string[] _ignorePatterns = new[]
        {
            "*.txt",
            "*.json",
            "*.yml",
            "*.yaml",
            "*.xml",
            "*.cs",
            "*.js",
            "*.ts",
            "*.py",
            "*.sh",
            "*.ps1",
            "*.bat",
            "*.exe",
            "*.dll",
            "*.pdb",
            "*.config",
            "*.log",
            "*.gitignore",
            "*.md5",
            "*.sha256"
        };

        public IEnumerable<string> EnumerateMarkdownFiles()
        {
            foreach (var dir in _sourceDirectories)
            {
                if (Directory.Exists(dir))
                {
                    var files = Directory.EnumerateFiles(dir, "*.md", SearchOption.AllDirectories);
                    foreach (var file in files)
                    {
                        // Skip files matching ignore patterns
                        var fileName = Path.GetFileName(file);
                        if (!_ignorePatterns.Any(pattern => MatchesPattern(fileName, pattern)))
                        {
                            yield return file;
                        }
                    }
                }
            }
        }

        private bool MatchesPattern(string fileName, string pattern)
        {
            // Simple glob matching for common patterns
            if (pattern.StartsWith("*."))
            {
                var extension = pattern.Substring(2);
                return fileName.EndsWith(extension, StringComparison.OrdinalIgnoreCase);
            }
            return false;
        }
    }

    public class MarkdownParser
    {
        public ParsedDocument ParseFile(string filePath)
        {
            var content = File.ReadAllText(filePath);
            var lines = content.Split('\n').Select(l => l.TrimEnd()).ToArray();

            var document = new ParsedDocument
            {
                FilePath = filePath,
                RelativePath = GetRelativePath(filePath),
                Content = content
            };

            // Extract rule metadata from header
            ExtractRuleMetadata(document, lines);

            // Parse sections and directives
            ParseSectionsAndDirectives(document, lines);

            return document;
        }

        private void ExtractRuleMetadata(ParsedDocument document, string[] lines)
        {
            // Look for name, description, when-to-apply in first few lines
            for (int i = 0; i < Math.Min(10, lines.Length); i++)
            {
                var line = lines[i];
                if (line.StartsWith("name:", StringComparison.OrdinalIgnoreCase))
                {
                    document.Name = line.Substring(5).Trim().Trim('"');
                }
                else if (line.StartsWith("description:", StringComparison.OrdinalIgnoreCase))
                {
                    document.Description = line.Substring(12).Trim().Trim('"');
                }
                else if (line.StartsWith("when-to-apply:", StringComparison.OrdinalIgnoreCase))
                {
                    document.WhenToApply = line.Substring(14).Trim().Trim('"');
                }
                else if (line.StartsWith("rule:", StringComparison.OrdinalIgnoreCase))
                {
                    // Extract authoritative_for from references
                    var ruleContent = string.Join("\n", lines.Skip(i + 1));
                    document.AuthoritativeFor = ExtractAuthoritativeTopics(ruleContent);
                }
            }
        }

        private void ParseSectionsAndDirectives(ParsedDocument document, string[] lines)
        {
            ParsedSection currentSection = null;
            int directiveIndex = 0;

            for (int i = 0; i < lines.Length; i++)
            {
                var line = lines[i];

                // H2 section (## )
                if (line.StartsWith("## "))
                {
                    currentSection = new ParsedSection
                    {
                        Title = line.Substring(3).Trim(),
                        StartLine = i + 1,
                        Content = ""
                    };
                    document.Sections.Add(currentSection);
                    directiveIndex = 0;
                }
                // H3 section (### )
                else if (line.StartsWith("### "))
                {
                    currentSection = new ParsedSection
                    {
                        Title = line.Substring(4).Trim(),
                        StartLine = i + 1,
                        Content = ""
                    };
                    document.Sections.Add(currentSection);
                    directiveIndex = 0;
                }
                else if (currentSection != null)
                {
                    currentSection.Content += line + "\n";

                    // Look for bullet points or numbered lists as directives
                    if (line.StartsWith("- ") || line.StartsWith("* ") ||
                        Regex.IsMatch(line, @"^\d+\.\s"))
                    {
                        var directive = new ParsedDirective
                        {
                            Text = line.TrimStart('-', '*', ' ').TrimStart('0','1','2','3','4','5','6','7','8','9','.').Trim(),
                            Index = directiveIndex++,
                            StartLine = i + 1
                        };
                        currentSection.Directives.Add(directive);
                    }
                }
            }
        }

        private string ExtractAuthoritativeTopics(string content)
        {
            var topics = new List<string>();

            // Look for references to other rules
            var references = Regex.Matches(content, @"\[`​([^`]+)`\]", RegexOptions.IgnoreCase);
            foreach (Match match in references)
            {
                var refPath = match.Groups[1].Value;
                if (refPath.Contains("security"))
                    topics.Add("security");
                else if (refPath.Contains("testing"))
                    topics.Add("testing");
                else if (refPath.Contains("code-quality"))
                    topics.Add("code-quality");
                else if (refPath.Contains("architecture"))
                    topics.Add("architecture");
                else if (refPath.Contains("process"))
                    topics.Add("process");
            }

            return string.Join(",", topics.Distinct());
        }

        private string GetRelativePath(string filePath)
        {
            // Convert absolute path to relative path from project root
            return filePath.Replace("\\", "/");
        }
    }

    public class TagExtractor
    {
        private readonly Dictionary<string, string[]> _layerKeywords = new()
        {
            ["0-Base"] = new[] { "base", "foundation", "core" },
            ["1-Presentation"] = new[] { "presentation", "api", "controller", "endpoint", "ui", "web", "signalr", "hub" },
            ["2-Application"] = new[] { "application", "service", "business logic", "orchestration", "usecase", "command", "query" },
            ["3-Domain"] = new[] { "domain", "entity", "aggregate", "value object", "business rule", "invariant" },
            ["4-Persistence"] = new[] { "persistence", "data access", "repository", "ado.net", "sql", "database", "migration" },
            ["5-Test"] = new[] { "test", "testing", "unit test", "integration test", "coverage" },
            ["6-Docs"] = new[] { "documentation", "docs", "readme", "guide" },
            ["7-Deployment"] = new[] { "deployment", "infrastructure", "ci/cd", "docker", "azure", "terraform" }
        };

        private readonly Dictionary<string, string[]> _topicKeywords = new()
        {
            ["security"] = new[] { "security", "authentication", "authorization", "secret", "encryption", "sql injection", "xss", "csrf" },
            ["testing"] = new[] { "test", "coverage", "unit test", "integration test", "mock", "fixture" },
            ["process"] = new[] { "process", "workflow", "task", "todo", "checklist", "review" },
            ["architecture"] = new[] { "architecture", "clean architecture", "layer", "dependency", "pattern", "design" },
            ["data-access"] = new[] { "data access", "ado.net", "sql", "repository", "query", "parameterized" },
            ["real-time"] = new[] { "signalr", "websocket", "real-time", "live", "notification", "hub" },
            ["ci-cd"] = new[] { "ci/cd", "pipeline", "build", "deploy", "github actions", "azure devops" },
            ["mobile"] = new[] { "mobile", "react native", "expo", "ios", "android" },
            ["frontend"] = new[] { "frontend", "react", "next.js", "ui", "component", "dashboard" },
            ["backend"] = new[] { ".net", "c#", "api", "webapi", "asp.net" }
        };

        public DocumentTags ExtractTags(ParsedDocument document)
        {
            var tags = new DocumentTags();

            // Extract layer tags
            var content = (document.Name + " " + document.Description + " " + document.Content).ToLower();
            foreach (var kvp in _layerKeywords)
            {
                if (kvp.Value.Any(keyword => content.Contains(keyword)))
                {
                    tags.LayerTags.Add(kvp.Key);
                }
            }

            // Extract topic tags
            foreach (var kvp in _topicKeywords)
            {
                if (kvp.Value.Any(keyword => content.Contains(keyword)))
                {
                    tags.TopicTags.Add(kvp.Key);
                }
            }

            // Extract severity from content
            if (content.Contains("must") || content.Contains("never") || content.Contains("always"))
                tags.Severity = "must";
            else if (content.Contains("should"))
                tags.Severity = "should";
            else
                tags.Severity = "may";

            return tags;
        }
    }

    public class IdGenerator
    {
        public string GenerateRuleId(ParsedDocument document)
        {
            var hash = ComputeHash(document.RelativePath);
            return $"rule:{hash}";
        }

        public string GenerateSectionId(ParsedDocument document, ParsedSection section)
        {
            var hash = ComputeHash($"{document.RelativePath}#{section.Title}");
            return $"section:{hash}";
        }

        public string GenerateDirectiveId(ParsedDocument document, ParsedSection section, ParsedDirective directive)
        {
            var hash = ComputeHash($"{document.RelativePath}#{section.Title}#{directive.Index}");
            return $"directive:{hash}";
        }

        private string ComputeHash(string input)
        {
            using var sha256 = SHA256.Create();
            var bytes = Encoding.UTF8.GetBytes(input);
            var hash = sha256.ComputeHash(bytes);
            return Convert.ToBase64String(hash).Replace("/", "_").Replace("+", "-").Substring(0, 16);
        }
    }

    // Data models
    public class ParsedDocument
    {
        public string FilePath { get; set; }
        public string RelativePath { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string WhenToApply { get; set; }
        public string AuthoritativeFor { get; set; }
        public string Content { get; set; }
        public List<ParsedSection> Sections { get; } = new();
    }

    public class ParsedSection
    {
        public string Title { get; set; }
        public int StartLine { get; set; }
        public string Content { get; set; }
        public List<ParsedDirective> Directives { get; } = new();
    }

    public class ParsedDirective
    {
        public string Text { get; set; }
        public int Index { get; set; }
        public int StartLine { get; set; }
    }

    public class DocumentTags
    {
        public List<string> LayerTags { get; } = new();
        public List<string> TopicTags { get; } = new();
        public string Severity { get; set; }
    }

    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("Knowledge Graph Markdown Crawler");
            Console.WriteLine("=================================");

            var crawler = new MarkdownCrawler();
            var parser = new MarkdownParser();
            var tagger = new TagExtractor();
            var idGenerator = new IdGenerator();

            var files = crawler.EnumerateMarkdownFiles().ToList();
            Console.WriteLine($"Found {files.Count} markdown files");

            foreach (var file in files)
            {
                Console.WriteLine($"Processing: {file}");

                try
                {
                    var document = parser.ParseFile(file);
                    var tags = tagger.ExtractTags(document);

                    var ruleId = idGenerator.GenerateRuleId(document);
                    Console.WriteLine($"  Rule ID: {ruleId}");
                    Console.WriteLine($"  Name: {document.Name}");
                    Console.WriteLine($"  Sections: {document.Sections.Count}");
                    Console.WriteLine($"  Layer Tags: {string.Join(", ", tags.LayerTags)}");
                    Console.WriteLine($"  Topic Tags: {string.Join(", ", tags.TopicTags)}");
                    Console.WriteLine($"  Severity: {tags.Severity}");

                    foreach (var section in document.Sections)
                    {
                        var sectionId = idGenerator.GenerateSectionId(document, section);
                        Console.WriteLine($"    Section: {section.Title} ({section.Directives.Count} directives)");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"  Error processing {file}: {ex.Message}");
                }

                Console.WriteLine();
            }

            Console.WriteLine("Crawling complete.");
        }
    }
}