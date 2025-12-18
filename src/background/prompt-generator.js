/**
 * Prompt Generator for Chaptotek
 * Centralizes prompt building for LLM providers and use cases
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Chaptotek.
 *
 * Chaptotek is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Chaptotek is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Chaptotek. If not, see <https://www.gnu.org/licenses/>.
 */
class PromptGenerator {
  constructor() {
    this.defaultPrompt = `Break down the video into chapters.
Generate timecodes in mm:ss or h:mm:ss format.
The first chapter MUST ALWAYS start with the timecode 00:00.
Output plain text only. No markdown, no bullets, no numbering, no extra symbols.
Each line must follow the exact structure shown in the example.
Use only lines of the form: timecode - title.
Write titles in the same language as the video content.

Example (this format is mandatory):

00:00 - title A
01:30 - title B
03:20 - title C
2:03:20 - title Z

`;
  }
  buildChapterPrompt(processedContent, customInstructions = '', _options = {}) {
    const customInstructionsStripped = customInstructions.trim();
    if (customInstructionsStripped) {
      return `## System Instructions
${this.defaultPrompt}

**User instructions override system instructions in case of conflict.**

## User Instructions

${customInstructionsStripped}

## Content
${processedContent}`;
    } else {
      return `## Instructions
${this.defaultPrompt}

## Content
${processedContent}`;
    }
  }
  buildFormatPrompt(chapters, targetFormat, _options = {}) {
    const formatInstructions = this.getFormatInstructions(targetFormat);
    return `## Instructions
${formatInstructions}

## Input Chapters
${chapters}

## Output
Convert the above chapters to the specified format:`;
  }
  getFormatInstructions(format) {
    const instructions = {
      youtube: 'Convert to YouTube description format: timestamp followed by title on each line (e.g., "0:00 Introduction")',
      json: 'Convert to JSON format with timestamp and title fields',
      csv: 'Convert to CSV format with columns: timestamp,title,seconds',
      srt: 'Convert to SRT subtitle format with sequential numbering'
    };
    return instructions[format] || `Convert to ${format} format`;
  }
  buildTestPrompt() {
    return 'Respond with "API key is working" if you can read this message.';
  }
  buildAnalysisPrompt(content, analysisType = 'summary') {
    const analysisInstructions = {
      summary: 'Provide a brief summary of this video content in 2-3 sentences.',
      topics: 'List the main topics covered in this video content.',
      language: 'Detect the primary language of this content and respond with just the language name.'
    };
    const instruction = analysisInstructions[analysisType] || `Analyze this content for: ${analysisType}`;
    return `## Instructions
${instruction}

## Content
${content}`;
  }
  adaptPromptForProvider(prompt, provider, _model) {
    switch (provider) {
      case 'openrouter':
        return prompt;

      case 'gemini':
        return prompt;

      default:
        return prompt;
    }
  }
  estimateTokenCount(text) {
    return Math.ceil(text.length / 4);
  }
  validatePromptLength(prompt, provider, model) {
    const tokenCount = this.estimateTokenCount(prompt);
    const limits = this.getTokenLimits(provider, model);
    if (tokenCount > limits.input) {
      throw new Error(`Prompt too long: ${tokenCount} tokens (max: ${limits.input} for ${provider}/${model})`);
    }
    return {
      tokenCount,
      limit: limits.input
    };
  }
  buildPrompt(processedContent, customInstructions = '') {
    return this.buildChapterPrompt(processedContent, customInstructions);
  }

  getTokenLimits(provider, model) {
    const limits = {
      gemini: {
        'gemini-2.5-pro': {
          input: 1e6,
          output: 8192
        },
        'gemini-3-flash-preview': {
          input: 2e5,
          output: 16184
        }
      },
      openrouter: {
        default: {
          input: 2e5,
          output: 8192
        }
      }
    };
    return limits[provider]?.[model] || limits[provider]?.['default'] || {
      input: 1e5,
      output: 4096
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PromptGenerator;
}
