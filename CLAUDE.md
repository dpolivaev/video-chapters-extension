# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Note**: This file is git ignored (project-specific instructions only).

## Commands

### Build Commands
```bash
# Development builds (preferred for testing)
npm run build:firefox -- --dev && npm run build:chrome -- --dev

# Production builds
npm run build           # Build for both Chrome and Firefox
npm run build:chrome    # Build Chrome extension (Manifest V3)
npm run build:firefox   # Build Firefox extension (Manifest V2)
```

### Development Workflow Rule
**MANDATORY**: Always run lint check and development builds after any code changes:
```bash
npm run lint && npm run build:chrome -- --dev && npm run build:firefox -- --dev
```
This ensures code quality standards are met and changes are immediately testable in the browser extension.

### Development Commands
```bash
npm run dev             # Start development server with hot reload
npm run lint            # Run ESLint
npm run format          # Format code with Prettier
npm run test            # Run tests
```

### Packaging & Validation
```bash
npm run package         # Create packages for both browsers
npm run validate        # Run lint + test + build (comprehensive validation)
npm run clean           # Clean build artifacts
```

### Icon Generation
```bash
npm run generate-icons  # Generate icons from high-res source
```

## Architecture Overview

This is a cross-browser extension that generates AI-powered chapter timecodes for YouTube videos. The extension uses a modular architecture to support multiple AI providers (Google Gemini direct API and OpenRouter for multiple models).

### Key Architectural Decisions

1. **Cross-Browser Build System**: Separate manifests for Chrome (V3) and Firefox (V2) with a unified codebase using browser polyfill for API compatibility.

2. **Modular LLM Architecture**:
   - `background/llm.js`: Base class with shared functionality (error handling, response parsing, token estimation)
   - `background/gemini-api.js`: Direct Google Gemini API integration
   - `background/openrouter-api.js`: OpenRouter API supporting multiple models (DeepSeek, Claude, GPT-4o, Llama)
   - `background/prompt-generator.js`: Centralized prompt building for consistency

3. **Session-Based Storage**: Results are stored only during the browser session using background script as relay, with no persistent storage for privacy.

4. **Smart Tab Management**: Tracks video tabs and results tabs for intelligent navigation between them.

### Component Communication Flow

1. **Content Script** (`content/content.js`) extracts video ID and subtitles from YouTube pages
2. **Background Service Worker** (`background/background.js`) handles:
   - API communication with selected LLM provider
   - Session storage management
   - Message routing between components
3. **Popup** (`popup/popup.js`) provides UI for model selection and triggering generation
4. **Results Page** (`results/results.js`) displays generated chapters with export options

### Build System Details

The build system (`scripts/build.js`) handles:
- Copying appropriate manifest based on target browser
- Minifying JavaScript files while preserving license headers
- Handling browser-specific polyfills
- Creating separate dist folders for Chrome and Firefox

### Localization

The extension supports multiple languages with message catalogs in `src/_locales/`. When adding new UI strings, update all language files to maintain consistency.

### Error Handling

The extension implements retry logic for AI API calls:
- Up to 3 retries for 5xx server errors
- Exponential backoff between retries
- Provider-specific error categorization for better user feedback

### Testing Approach

Use `npm run test` to validate the build process and icon generation. Manual testing is required for browser-specific functionality.

### Cross-Browser Extension Learnings

**Critical Lesson: Manifest V2 vs V3 Script Loading**

Firefox (Manifest V2) and Chrome (Manifest V3) handle background script loading completely differently:

- **Firefox (Manifest V2)**: ALL background scripts must be explicitly listed in `manifest.json` `background.scripts` array. Scripts are loaded automatically in order. `importScripts()` calls will fail if scripts aren't pre-listed.

- **Chrome (Manifest V3)**: Uses service workers with dynamic `importScripts()` loading. Only the main background script needs to be in the manifest.

**Solution Pattern**:
```javascript
if (typeof importScripts !== "undefined") {
  if (typeof SessionRepository === "undefined") {
    importScripts(/* domain layer scripts */);
  }
}
```

This checks if classes are already loaded (Firefox case) before calling `importScripts()` (Chrome case).

**Debug Strategy**: When classes appear undefined in Firefox, first check the manifest - missing scripts from `background.scripts` array is the most common cause. Firefox's debugger only shows successfully loaded scripts.

## Error Fixing Protocol

**MANDATORY TEST COVERAGE RULE**: Runtime errors usually indicate insufficient test coverage. Before fixing any runtime error, ALWAYS write tests that cover the missing functionality. This ensures:

1. **Coverage Gap Identification**: The test fails, confirming insufficient coverage exists
2. **Fix Validation**: The test passes after the fix, proving the solution works  
3. **Future Prevention**: Proper test coverage prevents the same error from reoccurring

**Process**:
1. Identify the error and its root cause (usually missing test coverage)
2. Write normal tests that cover the missing functionality (tests should fail)
3. Implement the fix to make tests pass
4. Verify all tests pass
5. Run full test suite to ensure no regressions

**Key Insight**: Don't create special "regression" test files - runtime errors reveal missing tests that should have existed from the beginning. Add these as normal tests alongside the code.

**Example**: For `this.promptGenerator.buildPrompt is not a function` error:
- Add test coverage for buildPrompt method in PromptGenerator.test.js
- Implement the missing method
- Commit fix with proper test coverage

## Code Quality Standards

### Mandatory Pre-Commit Checks

**CRITICAL RULE**: Before any git commit, ALWAYS run:
```bash
npm run lint
```

**MANDATORY USER APPROVAL RULE**: Always wait for explicit user approval before executing ANY git commit operations, unless the user gives different instructions. This includes:
- `git commit` (any variant)
- `git commit --amend`  
- `git push`
- `git rebase`
- `git reset --hard`
- Any other history-modifying git commands

**Enforcement**: All code changes must pass ESLint validation before being committed. This ensures:
- Consistent code formatting and style
- Early detection of potential bugs and code smells
- Adherence to project coding standards
- Prevention of trailing spaces and other formatting issues

**Process Integration**: The lint check has been integrated into the mandatory development workflow above. Never skip this step.

