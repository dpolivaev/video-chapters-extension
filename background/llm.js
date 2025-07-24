/**
 * Base LLM Class for Video Chapters Generator
 * Provides shared logic and interface for all LLM provider integrations
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

class BaseLLM {
  constructor(providerName) {
    this.providerName = providerName;
    this.promptGenerator = new PromptGenerator();
    this.availableModels = [];
    this.baseUrl = '';
  }

  /**
   * Process subtitles with AI - must be implemented by subclasses
   */
  async processSubtitles(subtitleContent, customInstructions = '', apiKey, model) {
    throw new Error('processSubtitles must be implemented by subclass');
  }

  /**
   * Make API call - must be implemented by subclasses
   */
  async makeAPICall(prompt, apiKey, model) {
    throw new Error('makeAPICall must be implemented by subclass');
  }

  /**
   * Parse response - must be implemented by subclasses
   */
  parseResponse(response) {
    throw new Error('parseResponse must be implemented by subclass');
  }

  /**
   * Validate API key format - can be overridden by subclasses
   */
  validateAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }
    return apiKey.length > 10;
  }

  /**
   * Get available models with metadata
   */
  getAvailableModels() {
    return this.availableModels.map(model => ({
      id: model.id,
      name: this.getModelDisplayName(model.id),
      description: this.getModelDescription(model.id),
      provider: this.providerName,
      isFree: model.isFree || false,
      category: model.category || 'general',
      capabilities: model.capabilities || []
    }));
  }

  /**
   * Get display name for model - can be overridden by subclasses
   */
  getModelDisplayName(modelId) {
    const model = this.availableModels.find(m => m.id === modelId);
    return model?.displayName || modelId;
  }

  /**
   * Get description for model - can be overridden by subclasses
   */
  getModelDescription(modelId) {
    const model = this.availableModels.find(m => m.id === modelId);
    return model?.description || 'AI language model';
  }

  /**
   * Check if model is free
   */
  isModelFree(modelId) {
    const model = this.availableModels.find(m => m.id === modelId);
    return model?.isFree || false;
  }

  /**
   * Get model by ID
   */
  getModel(modelId) {
    return this.availableModels.find(m => m.id === modelId);
  }

  /**
   * Categorize errors for better user feedback
   */
  categorizeError(errorMessage, model) {
    if (errorMessage.includes('Invalid API key') || errorMessage.includes('Unauthorized')) {
      return {
        category: 'invalid_api_key',
        suggestion: `Please check your ${this.providerName} API key in the extension options.`
      };
    } else if (errorMessage.includes('Rate limit') || errorMessage.includes('429')) {
      return {
        category: 'rate_limit',
        suggestion: 'Please wait a moment and try again.'
      };
    } else if (errorMessage.includes('Free model access denied') || errorMessage.includes('Free model access forbidden')) {
      return {
        category: 'free_model_unavailable',
        suggestion: this.isModelFree(model) ? 'Try switching to a paid model or try again later.' : 'Model temporarily unavailable.'
      };
    } else if (errorMessage.includes('context length') || errorMessage.includes('too long')) {
      return {
        category: 'content_too_long',
        suggestion: 'The video content is too long. Try with a shorter video or split the content.'
      };
    } else if (errorMessage.includes('safety') || errorMessage.includes('blocked')) {
      return {
        category: 'content_filtered',
        suggestion: 'Content was filtered by safety systems. Try with different content.'
      };
    } else {
      return {
        category: 'general_error',
        suggestion: 'Please try again or switch to a different model.'
      };
    }
  }

  /**
   * Build prompt using shared prompt generator
   */
  buildPrompt(subtitleContent, customInstructions = '', promptType = 'chapter') {
    const prompt = this.promptGenerator.buildChapterPrompt(subtitleContent, customInstructions);
    return this.promptGenerator.adaptPromptForProvider(prompt, this.providerName.toLowerCase(), null);
  }

  /**
   * Test API key validity
   */
  async testAPIKey(apiKey, model = null) {
    // Use the first available model if none specified
    const testModel = model || this.availableModels[0]?.id;
    
    if (!testModel) {
      throw new Error('No models available for testing');
    }

    if (!this.validateAPIKey(apiKey)) {
      throw new Error('Invalid API key format');
    }

    try {
      const testPrompt = this.promptGenerator.buildTestPrompt();
      const response = await this.makeAPICall(testPrompt, apiKey, testModel);
      const result = this.parseResponse(response);
      
      return {
        valid: true,
        model: result.model || testModel,
        message: 'API key is valid'
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Format chapters for different outputs
   */
  formatChapters(chaptersText, format = 'text') {
    const chapters = this.parseChaptersText(chaptersText);
    
    switch (format) {
      case 'json':
        return JSON.stringify(chapters, null, 2);
      case 'csv':
        return this.formatAsCSV(chapters);
      case 'srt':
        return this.formatAsSRT(chapters);
      case 'youtube':
        return this.formatForYouTube(chapters);
      default:
        return chaptersText;
    }
  }

  /**
   * Parse chapters text into structured data
   */
  parseChaptersText(chaptersText) {
    const lines = chaptersText.split('\n').filter(line => line.trim());
    const chapters = [];
    
    for (const line of lines) {
      const match = line.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–]\s*(.+)$/);
      if (match) {
        chapters.push({
          timestamp: match[1],
          title: match[2].trim(),
          seconds: this.timestampToSeconds(match[1])
        });
      }
    }
    
    return chapters;
  }

  /**
   * Convert timestamp to seconds
   */
  timestampToSeconds(timestamp) {
    const parts = timestamp.split(':').map(Number);
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
  }

  /**
   * Format chapters as CSV
   */
  formatAsCSV(chapters) {
    const header = 'Timestamp,Title,Seconds\n';
    const rows = chapters.map(chapter => 
      `"${chapter.timestamp}","${chapter.title}",${chapter.seconds}`
    ).join('\n');
    return header + rows;
  }

  /**
   * Format chapters as SRT
   */
  formatAsSRT(chapters) {
    return chapters.map((chapter, index) => {
      const start = this.secondsToSRTTime(chapter.seconds);
      const nextChapter = chapters[index + 1];
      const end = nextChapter ? 
        this.secondsToSRTTime(nextChapter.seconds) : 
        this.secondsToSRTTime(chapter.seconds + 300); // Default 5 minutes
      
      return `${index + 1}\n${start} --> ${end}\n${chapter.title}\n`;
    }).join('\n');
  }

  /**
   * Convert seconds to SRT time format
   */
  secondsToSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
  }

  /**
   * Format chapters for YouTube description
   */
  formatForYouTube(chapters) {
    return chapters.map(chapter => 
      `${chapter.timestamp} ${chapter.title}`
    ).join('\n');
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: this.providerName,
      baseUrl: this.baseUrl,
      modelCount: this.availableModels.length,
      freeModels: this.availableModels.filter(m => m.isFree).length
    };
  }
} 