# Complete Tasks Workflow

This workflow enables autonomous task completion across various software projects. The AI agent will work independently to identify, analyze, and complete tasks while maintaining project-specific architectural principles and coding standards.

## Configuration Variables

you must ask the user to provide the below 4 variables when using this workflow. provide the user the default and ask them if they want to use it:

- **{TASK_SOURCE_FILE}**: Path to the file containing pending tasks (e.g., `@/docs/specs/hotshot-logistics-platform/tasks.md`)
- **{DOCS_FOLDER}**: Path to documentation folder (e.g., `/docs/specs`)
- **{ARCHIVE_FOLDER}**: Path to archived documentation folder (e.g., `/docs/archive`)
- **{STATUS_FILE}**: Path to status tracking file (e.g., `codex.status.md`)

## Usage

Replace the variables above with actual file paths when executing this workflow in your specific project context.

## Project Context

This workflow is designed to work with multiple project types and architectures. The agent will adapt to each project's specific:
- Technology stack and framework requirements
- Architectural patterns and layering conventions
- Testing frameworks and quality standards
- Documentation requirements and coding conventions
- Deployment and infrastructure patterns

## Autonomous Task Management

The agent operates with full autonomy following these core principles:
- **Existing Code First**: Always search and analyze existing code before creating new implementations
- **Architectural Compliance**: Maintain project-specific architectural boundaries and dependency rules
- **Quality Standards**: Follow project-specific coding conventions and standards
- **Testing**: Ensure all business logic has appropriate test coverage
- **Documentation**: Update relevant documentation according to project requirements

## Workflow Steps

### 1. Task Discovery and Analysis
- Review `{TASK_SOURCE_FILE}` for pending tasks
- Analyze task requirements and acceptance criteria thoroughly
- Search existing codebase for related implementations
- Review markdown documentation in `{DOCS_FOLDER}` (ignore `{ARCHIVE_FOLDER}`)
- Check current implementation status and identify gaps

### 2. Codebase Research
- **Search Strategy**: Use targeted searches across project structure
  - Identify main architectural layers and their responsibilities
  - Search for existing implementations of similar functionality
  - Review interfaces, contracts, and abstract base classes
  - Examine existing services, repositories, and business logic
  - Check presentation layer components and endpoints
- **File Analysis**: Read relevant files to understand current implementation patterns
- **Dependency Check**: Verify project references follow architectural constraints
- **Test Coverage**: Review existing tests for the feature area

### 3. Implementation Planning
- Create detailed implementation plan based on research
- Identify which architectural layers need modification
- Plan unit tests and integration tests
- Consider impact on existing functionality
- Ensure compliance with security and performance requirements

### 4. Code Implementation
- **Modify Existing Code**: Update existing files when possible
- **New Code Only When Necessary**: Create new files only after exhaustive search confirms no existing implementation
- **Follow Project Structure**: Place files in correct numbered folders
- **Maintain Standards**: Use proper naming conventions, async patterns, and nullable types
- **Dependency Injection**: Use DI for all external dependencies

### 5. Testing and Validation
- Write comprehensive unit tests for business logic
- Create integration tests for layer interactions
- Run existing test suite to ensure no regressions
- Validate implementation against acceptance criteria
- Test edge cases and error scenarios

### 6. Documentation Updates
- Update XML documentation comments
- Modify README files if API surface changes
- Update OpenAPI/Swagger documentation for new endpoints
- Ensure all public APIs have proper documentation

### 7. Task Completion and Reporting
- Mark task complete by adding `x` between `[ ]` brackets
- Update `{STATUS_FILE}` with completion notes
- Verify acceptance criteria are fully met
- Document any deviations or architectural decisions

## Task Completion Criteria

A task is considered complete only when:
- ✅ All acceptance criteria are satisfied
- ✅ Code follows Clean Architecture principles
- ✅ Unit tests provide adequate coverage
- ✅ No regressions in existing functionality
- ✅ Documentation is updated appropriately
- ✅ Code passes all quality checks and conventions

## Quality Gates

Before marking any task complete, ensure:
- **Architecture Compliance**: No layer violations or circular dependencies
- **Code Quality**: Follows project-specific coding conventions and standards
- **Testing**: All business logic has appropriate test coverage
- **Security**: No secrets in code, proper input validation
- **Performance**: Efficient operations and proper async patterns where applicable

## Error Handling and Edge Cases

- **Validation**: Implement proper input validation using appropriate framework features
- **Error Handling**: Use proper exception handling and meaningful error messages
- **Edge Cases**: Consider null values, empty collections, and boundary conditions
- **Async Operations**: Use appropriate async patterns with proper error propagation

## Success Metrics

- Tasks completed autonomously without user intervention
- Zero architectural violations
- All tests passing
- Complete acceptance criteria satisfaction
- Maintained code quality standards