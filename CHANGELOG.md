# Changelog

All notable changes to the Chaptotek extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.2]

### Changed
- Replace LLM gemini 2.5 flash by gemini 3 flash preview

## [1.5.1]

### Fixed
- Transcript extraction now reads YouTube’s updated timestamp markup, avoids blank “()” lines, and stops with a clear “no timestamps available.” message when most timestamps are missing.

## [1.5.0]

### Changed
- Transcript extraction now mirrors the native YouTube workflow: the extension briefly opens the transcript panel, reads the rendered text, and closes it again, so Chrome and Firefox always pull transcripts without relying on private YouTube APIs.

## [1.4.7]

### Changed
- Improve prompt to always include timecode 00:00

## [1.4.6]

### Fixed
- Chat requests now include the originating session payload so the background can answer immediately after waking up without needing a rehydration handshake.
## [1.4.5]

### Fixed
- Eliminated intermittent “Session not found” chat error after background restart. Results tabs now re‑register automatically and chat requests fail gracefully instead of throwing.
- Results pages opened from history show a clear "No session data available" state (no errors), with chat and copy actions disabled until a new session exists.

## [1.4.4]

### Changed
- Rename extension to "Chaptotek"

## [1.4.3]

### Added
- Support for YouTube live videos (`youtube.com/live/...`).

## [1.4.1]

### Added
- Editable instruction name field in the popup header.

### Changed
- Model picker shows price information in tokens per 0.01$

## [1.4.0]

### Added
- Interactive chat interface for follow-up questions about generated chapters
- Complete conversation history tracking with AI model responses
- Token usage tracking showing cumulative input/output tokens across entire conversation
- Professional chat styling with message threading and timestamps

### Changed
- Unified API architecture with single processConversation method for both string prompts and conversation arrays
- Enhanced session management to preserve conversation context and token counts
- Improved cross-provider support for both Gemini and OpenRouter models

## [1.3.19]

### Fixed
- Settings loss bug where API keys and language preferences were lost when modifying instruction history limit
- Options page redesigned with single SAVE button for cleaner user experience

## [1.3.17]

### Fixed
- Model selection routing bug where OpenRouter failed for Gemini models


## [1.3.14]

### Added
- Language selector in options to override browser language settings
- Localized disclaimer in generated chapters showing extension name and AI model used
- Clickable "Chaptotek" link in disclaimer leading to project website

## [1.3.13]

### Fixed
- Race condition in instruction name editing that could cause data loss when rapidly switching between different names

## [1.3.12]

### Added
- Edit instruction names in the history

## [1.3.11]

### Fixed
- Free model access through OpenRouter API
- Chapter generation prompt quality with better formatting rules

### Changed
- Updated extension descriptions for web store submissions

## [1.3.10]

### Added
- Portuguese, Arabic, and Korean language support

## [1.3.9]

### Fixed
- Updated instruction example text for better clarity across all languages

## [1.3.8]

### Fixed
- Fixed instruction history limit setting

## [1.3.7]

### Added
- Interactive linked timecodes - click timecodes in results to jump to video timestamps
- Comprehensive help page with instruction examples and API key guidance
- Multi-language support for help system

### Changed
- Improved copy functionality - works better with rich text editors
- Enhanced results display with clickable links
- Clearer instruction examples across all languages

### Fixed
- Extension settings layout on smaller screens
- Various clipboard and session data bugs
- Firefox compatibility issues

## [1.3.1]

### Added
- Cross-browser extension for generating AI-powered chapter timecodes for YouTube videos
- Support for multiple AI providers:
  - Google Gemini API (direct integration)
  - OpenRouter API (supporting DeepSeek, Claude, GPT-4o, Llama models)
- Automatic subtitle extraction from YouTube videos
- Session-based storage (no persistent data for privacy)
- Localization support for multiple languages
- Smart tab management and navigation
- Comprehensive error handling with retry logic
- Clean, modern UI with popup and results pages
