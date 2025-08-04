# Chrome Web Store Listing

## Short Description
Generate customizable AI-powered chapter timecodes for YouTube videos using multiple AI providers.

## Overview
See chrome-web-store-description-en.txt for the complete description.

---

## Categories
- Productivity
- Developer Tools

## Tags
youtube, chapters, timecodes, ai, transcripts, video, productivity, content-creation

## Permissions Justification

**activeTab**: Required to detect YouTube videos and extract transcript data from the current tab.

**storage**: Used to store user preferences (API keys, model selection, custom instructions) locally in the browser.

**tabs**: Needed to manage navigation between video tabs and results tabs, enabling the side-by-side workflow feature.

**Host permissions**:
- **youtube.com**: This permission enables the extension to read video metadata and subtitles which are essential for AI chapter generation.
- **generativelanguage.googleapis.com**: Communication with Google Gemini AI API for chapter generation when users select Gemini models.
- **openrouter.ai**: Communication with OpenRouter API service to access multiple AI models (Claude, GPT-4o, Llama, DeepSeek, etc.) when users select OpenRouter models.
