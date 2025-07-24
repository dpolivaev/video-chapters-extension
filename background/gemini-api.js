/**
 * Gemini API Integration for Video Chapters Generator
 * Handles communication with Google's Gemini AI API for chapter generation
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

class GeminiAPI extends BaseLLM {
  constructor() {
    super('Gemini');
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.availableModels = [
      {
        id: 'gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro',
        description: 'Most capable model for complex reasoning and analysis',
        isFree: false,
        category: 'premium',
        capabilities: ['reasoning', 'coding', 'analysis']
      },
      {
        id: 'gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash',
        description: 'Faster model optimized for speed while maintaining quality',
        isFree: false,
        category: 'fast',
        capabilities: ['speed', 'general']
      }
    ];
  }

  /**
   * Process subtitles with Gemini AI
   */
  async processSubtitles(subtitleContent, customInstructions = '', apiKey, model = 'gemini-2.5-pro') {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    const modelExists = this.availableModels.some(m => m.id === model);
    if (!modelExists) {
      const availableIds = this.availableModels.map(m => m.id);
      throw new Error(`Invalid model: ${model}. Available models: ${availableIds.join(', ')}`);
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
   * Validate API key format for Gemini
   */
  validateAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // Basic validation - Gemini API keys typically start with specific patterns
    const apiKeyPattern = /^[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > 10;
  }



}