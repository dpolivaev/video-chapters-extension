# Changelog

All notable changes to the Video Chapters Generator extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.2]

### Added
- **Interactive Linked Timecodes**: Timecodes in results page are now clickable links that jump directly to YouTube video timestamps
- **Smart Clipboard Functionality**: Copy button now provides both HTML and plain text formats for compatibility with rich text editors
- **Clickable Video URL**: Video URL at top of results page is now a clickable link
- **Selection-Aware Copying**: Copy button respects user text selections - copies selected text if any, otherwise copies entire content

### Changed
- **Results Display**: Replaced plain textarea with HTML display for chapters to enable interactive links
- **URL Handling**: Video URL now displays separately from AI-generated chapters (cleaner architecture)
- **Copy Behavior**: Enhanced copy functionality works seamlessly with RTF editors, YouTube descriptions, and plain text applications

### Fixed
- **Line Spacing**: Improved line spacing in results display to match original formatting
- **Cross-Browser Compatibility**: Modern clipboard API implementation works reliably on Chrome, Firefox, and Edge

### Technical
- Removed URL prepending from ChapterGenerator (now handled in UI layer)
- Added development build workflow documentation
- Updated tests to reflect new architecture

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