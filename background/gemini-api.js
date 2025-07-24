/**
 * Gemini API Integration for Video Chapters Generator
 * Handles communication with Google's Gemini AI API
 */

export class GeminiAPI {
  constructor() {
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.availableModels = ['gemini-2.5-pro', 'gemini-2.5-flash'];
    this.defaultPrompt = `Break down this video content into chapters 
and generate timecodes in mm:ss format (e.g., 00:10, 05:30, 59:59, 1:01:03). 
Each chapter should be formatted as plain text: timecode - chapter title. 
Generate the chapter titles in the same language as the content.`;
  }

  /**
   * Process subtitles with Gemini AI
   */
  async processSubtitles(subtitleContent, customInstructions = '', apiKey, model = 'gemini-2.5-pro') {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    if (!this.availableModels.includes(model)) {
      throw new Error(`Invalid model: ${model}. Available models: ${this.availableModels.join(', ')}`);
    }

    try {
      const prompt = this.buildPrompt(subtitleContent, customInstructions);
      const response = await this.makeAPICall(prompt, apiKey, model);
      
      return this.parseResponse(response);
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Build the complete prompt for Gemini
   */
  buildPrompt(subtitleContent, customInstructions) {
    const customInstructionsStripped = customInstructions.trim();
    
    if (customInstructionsStripped) {
      // Use 3-section markdown format when there are user instructions
      return `## System Instructions
${this.defaultPrompt}

## User Instructions

${customInstructionsStripped}

Note: These instructions may override the system instructions above and may be in a different language.
In the chapter titles use the content language and ignore the language of the user instructions
if now explicitly stated otherwise.

## Content
${subtitleContent}`;
    } else {
      // Use 2-section markdown format when no user instructions
      return `## Instructions
${this.defaultPrompt}

## Content
${subtitleContent}`;
    }
  }

  /**
   * Make API call to Gemini
   */
  async makeAPICall(prompt, apiKey, model) {
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_MEDIUM_AND_ABOVE"
        }
      ]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle specific API errors
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Gemini API key.');
      } else if (response.status === 403) {
        throw new Error('API access forbidden. Please check your API key permissions.');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (response.status === 400) {
        const errorMessage = errorData.error?.message || 'Bad request';
        throw new Error(`Request error: ${errorMessage}`);
      } else {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
    }

    const data = await response.json();
    
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response from Gemini API');
    }

    return data;
  }

  /**
   * Parse the response from Gemini API
   */
  parseResponse(response) {
    try {
      const candidate = response.candidates[0];
      
      if (!candidate) {
        throw new Error('No candidates in response');
      }

      // Check if the response was blocked
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Response was blocked by safety filters');
      }

      if (candidate.finishReason === 'RECITATION') {
        throw new Error('Response was blocked due to recitation concerns');
      }

      const content = candidate.content;
      if (!content || !content.parts || !content.parts[0]) {
        throw new Error('No content in response');
      }

      const text = content.parts[0].text;
      if (!text) {
        throw new Error('Empty response from AI');
      }

      return {
        chapters: text.trim(),
        finishReason: candidate.finishReason,
        safetyRatings: candidate.safetyRatings,
        model: response.modelVersion || 'unknown'
      };
      
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Validate API key format
   */
  validateAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic validation - Gemini API keys typically start with specific patterns
    const apiKeyPattern = /^[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > 10;
  }

  /**
   * Test API key validity
   */
  async testAPIKey(apiKey, model = 'gemini-2.5-flash') {
    if (!this.validateAPIKey(apiKey)) {
      throw new Error('Invalid API key format');
    }

    try {
      // Make a simple test request
      const testPrompt = 'Respond with "API key is working" if you can read this.';
      const response = await this.makeAPICall(testPrompt, apiKey, model);
      
      const result = this.parseResponse(response);
      return {
        valid: true,
        model: result.model,
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
   * Get available models
   */
  getAvailableModels() {
    return this.availableModels.map(model => ({
      id: model,
      name: this.getModelDisplayName(model),
      description: this.getModelDescription(model)
    }));
  }

  /**
   * Get display name for model
   */
  getModelDisplayName(model) {
    const displayNames = {
      'gemini-2.5-pro': 'Gemini 2.5 Pro',
      'gemini-2.5-flash': 'Gemini 2.5 Flash'
    };
    return displayNames[model] || model;
  }

  /**
   * Get description for model
   */
  getModelDescription(model) {
    const descriptions = {
      'gemini-2.5-pro': 'Most capable model for complex reasoning and analysis',
      'gemini-2.5-flash': 'Faster model optimized for speed while maintaining quality'
    };
    return descriptions[model] || 'Gemini AI model';
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
} 