/**
 * Prompt Generator for Video Chapters Generator
 * Centralizes prompt building for LLM providers and use cases
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Video Chapters Generator.
 *
 * Video Chapters Generator is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Video Chapters Generator is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Video Chapters Generator. If not, see <https://www.gnu.org/licenses/>.
 */
class PromptGenerator {
  constructor() {
    this.defaultPrompt = 'Break down this video content into chapters \nand generate timecodes in mm:ss format (e.g., 00:10, 05:30, 59:59, 1:01:03). \nEach chapter should be formatted as plain text: timecode - chapter title. \nGenerate the chapter titles in the same language as the content.';
  }
  buildChapterPrompt(subtitleContent, customInstructions = '', options = {}) {
    const customInstructionsStripped = customInstructions.trim();
    if (customInstructionsStripped) {
      return `## System Instructions\n${this.defaultPrompt}\n\n**User instructions override system instructions in case of conflict.**\n\n## User Instructions\n\n${customInstructionsStripped}\n\n## Content\n${subtitleContent}`;
    } else {
      return `## Instructions\n${this.defaultPrompt}\n\n## Content\n${subtitleContent}`;
    }
  }
  buildFormatPrompt(chapters, targetFormat, options = {}) {
    const formatInstructions = this.getFormatInstructions(targetFormat);
    return `## Instructions\n${formatInstructions}\n\n## Input Chapters\n${chapters}\n\n## Output\nConvert the above chapters to the specified format:`;
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
    return `## Instructions\n${instruction}\n\n## Content\n${content}`;
  }
  adaptPromptForProvider(prompt, provider, model) {
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
  getTokenLimits(provider, model) {
    const limits = {
      gemini: {
        'gemini-2.5-pro': {
          input: 1e6,
          output: 8192
        },
        'gemini-2.5-flash': {
          input: 1e6,
          output: 8192
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
