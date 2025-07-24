/**
 * Prompt Generator for Video Chapters Generator
 * Centralized prompt building for different LLM providers and use cases
 */

class PromptGenerator {
  constructor() {
    this.defaultPrompt = `Break down this video content into chapters 
and generate timecodes in mm:ss format (e.g., 00:10, 05:30, 59:59, 1:01:03). 
Each chapter should be formatted as plain text: timecode - chapter title. 
Generate the chapter titles in the same language as the content.`;
  }

  /**
   * Build prompt for chapter generation
   */
  buildChapterPrompt(subtitleContent, customInstructions = '', options = {}) {
    const customInstructionsStripped = customInstructions.trim();
    
    if (customInstructionsStripped) {
      // Use 3-section markdown format when there are user instructions
      return `## System Instructions
${this.defaultPrompt}

**User instructions override system instructions in case of conflict.**

## User Instructions

${customInstructionsStripped}

## Content
${subtitleContent}`;
    } else {
      return `## Instructions
${this.defaultPrompt}

## Content
${subtitleContent}`;
    }
  }

  /**
   * Build prompt for format conversion
   */
  buildFormatPrompt(chapters, targetFormat, options = {}) {
    const formatInstructions = this.getFormatInstructions(targetFormat);
    
    return `## Instructions
${formatInstructions}

## Input Chapters
${chapters}

## Output
Convert the above chapters to the specified format:`;
  }

  /**
   * Get format-specific instructions
   */
  getFormatInstructions(format) {
    const instructions = {
      'youtube': 'Convert to YouTube description format: timestamp followed by title on each line (e.g., "0:00 Introduction")',
      'json': 'Convert to JSON format with timestamp and title fields',
      'csv': 'Convert to CSV format with columns: timestamp,title,seconds',
      'srt': 'Convert to SRT subtitle format with sequential numbering'
    };
    
    return instructions[format] || `Convert to ${format} format`;
  }

  /**
   * Build test prompt for API key validation
   */
  buildTestPrompt() {
    return 'Respond with "API key is working" if you can read this message.';
  }

  /**
   * Build prompt for content analysis
   */
  buildAnalysisPrompt(content, analysisType = 'summary') {
    const analysisInstructions = {
      'summary': 'Provide a brief summary of this video content in 2-3 sentences.',
      'topics': 'List the main topics covered in this video content.',
      'language': 'Detect the primary language of this content and respond with just the language name.'
    };
    
    const instruction = analysisInstructions[analysisType] || `Analyze this content for: ${analysisType}`;
    
    return `## Instructions
${instruction}

## Content
${content}`;
  }

  /**
   * Get provider-specific prompt modifications
   */
  adaptPromptForProvider(prompt, provider, model) {
    // Some providers might need specific formatting or instructions
    switch (provider) {
      case 'openrouter':
        // OpenRouter works well with standard prompts
        return prompt;
        
      case 'gemini':
        // Gemini might benefit from specific formatting
        return prompt;
        
      default:
        return prompt;
    }
  }

  /**
   * Estimate token count for prompt (rough approximation)
   */
  estimateTokenCount(text) {
    // Rough estimation: ~4 characters per token for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Validate prompt length for different providers
   */
  validatePromptLength(prompt, provider, model) {
    const tokenCount = this.estimateTokenCount(prompt);
    const limits = this.getTokenLimits(provider, model);
    
    if (tokenCount > limits.input) {
      throw new Error(`Prompt too long: ${tokenCount} tokens (max: ${limits.input} for ${provider}/${model})`);
    }
    
    return { tokenCount, limit: limits.input };
  }

  /**
   * Get token limits for different providers/models
   */
  getTokenLimits(provider, model) {
    const limits = {
      'gemini': {
        'gemini-2.5-pro': { input: 1000000, output: 8192 },
        'gemini-2.5-flash': { input: 1000000, output: 8192 }
      },
      'openrouter': {
        // Most OpenRouter models have generous limits
        'default': { input: 200000, output: 8192 }
      }
    };
    
    return limits[provider]?.[model] || limits[provider]?.['default'] || { input: 100000, output: 4096 };
  }
} 