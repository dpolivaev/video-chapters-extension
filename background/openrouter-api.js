/**
 * OpenRouter API Integration for Video Chapters Generator
 * Handles communication with OpenRouter API for various models including DeepSeek R1, Gemini, Claude, GPT-4 and more
 */

class OpenRouterAPI extends BaseLLM {
  constructor() {
    super('OpenRouter');
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.availableModels = [
      // Free Models
      {
        id: 'deepseek/deepseek-r1-0528:free',
        displayName: 'DeepSeek R1 0528 (Free)',
        description: 'Latest DeepSeek R1 model - Free to use, no API key required',
        isFree: true,
        category: 'reasoning',
        capabilities: ['reasoning', 'coding', 'analysis']
      },
      
      // DeepSeek Models (Paid)
      {
        id: 'deepseek/deepseek-r1-0528',
        displayName: 'DeepSeek R1 0528',
        description: 'Latest DeepSeek R1 model with advanced reasoning capabilities',
        isFree: false,
        category: 'reasoning',
        capabilities: ['reasoning', 'coding', 'analysis']
      },
      {
        id: 'deepseek/deepseek-r1',
        displayName: 'DeepSeek R1',
        description: 'Original DeepSeek R1 with performance on par with OpenAI o1',
        isFree: false,
        category: 'reasoning',
        capabilities: ['reasoning', 'coding', 'analysis']
      },
      {
        id: 'deepseek/deepseek-r1-distill-qwen-1.5b',
        displayName: 'DeepSeek R1 Distill 1.5B',
        description: 'Smaller, efficient model that outperforms GPT-4o on math',
        isFree: false,
        category: 'fast',
        capabilities: ['math', 'reasoning', 'efficiency']
      },
      
      // Gemini Models via OpenRouter
      {
        id: 'google/gemini-2.5-pro',
        displayName: 'Gemini 2.5 Pro (OpenRouter)',
        description: 'Google Gemini 2.5 Pro via OpenRouter - Most capable model for complex reasoning',
        isFree: false,
        category: 'premium',
        capabilities: ['reasoning', 'coding', 'analysis', 'multimodal']
      },
      {
        id: 'google/gemini-2.5-flash',
        displayName: 'Gemini 2.5 Flash (OpenRouter)',
        description: 'Google Gemini 2.5 Flash via OpenRouter - Faster model optimized for speed',
        isFree: false,
        category: 'fast',
        capabilities: ['speed', 'general', 'multimodal']
      },
      
      // Claude Models
      {
        id: 'anthropic/claude-3.5-sonnet',
        displayName: 'Claude 3.5 Sonnet',
        description: 'Anthropic Claude 3.5 Sonnet - Excellent for analysis and reasoning',
        isFree: false,
        category: 'premium',
        capabilities: ['reasoning', 'analysis', 'writing', 'coding']
      },
      {
        id: 'anthropic/claude-3.5-haiku',
        displayName: 'Claude 3.5 Haiku',
        description: 'Anthropic Claude 3.5 Haiku - Fast and efficient for most tasks',
        isFree: false,
        category: 'fast',
        capabilities: ['speed', 'general', 'analysis']
      },
      
      // OpenAI Models
      {
        id: 'openai/gpt-4o',
        displayName: 'GPT-4o',
        description: 'OpenAI GPT-4o - Advanced multimodal model with reasoning',
        isFree: false,
        category: 'premium',
        capabilities: ['reasoning', 'multimodal', 'coding', 'analysis']
      },
      {
        id: 'openai/gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        description: 'OpenAI GPT-4o Mini - Faster, more affordable version of GPT-4o',
        isFree: false,
        category: 'fast',
        capabilities: ['speed', 'general', 'coding']
      },
      
      // Meta Models
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        displayName: 'Llama 3.3 70B Instruct',
        description: 'Meta Llama 3.3 70B - Advanced open-source model with strong performance',
        isFree: false,
        category: 'general',
        capabilities: ['reasoning', 'coding', 'general']
      }
    ];
  }

  /**
   * Process subtitles with OpenRouter AI
   */
  async processSubtitles(subtitleContent, customInstructions = '', apiKey, model = 'deepseek/deepseek-r1-0528:free') {
    // Free models don't require API key
    const isFreeModel = this.isModelFree(model);
    
    if (!isFreeModel && !apiKey) {
      throw new Error('API key is required for paid models');
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
      console.error('OpenRouter API error:', error);
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }

  /**
   * Make API call to OpenRouter
   */
  async makeAPICall(prompt, apiKey, model) {
    const url = `${this.baseUrl}/chat/completions`;
    
    const headers = {
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/dimitry-polivaev/timecodes-browser-extension',
      'X-Title': 'Video Chapters Generator'
    };

    // Handle authentication based on model type
    if (this.isModelFree(model)) {
      // Free models don't require API key - no Authorization header at all
    } else if (apiKey) {
      // Paid models require valid API key
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    const requestBody = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 8192,
      top_p: 0.95
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle specific API errors with context about free vs paid models
      if (response.status === 401) {
        if (this.isModelFree(model)) {
          throw new Error('Free model access denied. The model may be temporarily unavailable.');
        } else {
          throw new Error('Invalid API key. Please check your OpenRouter API key.');
        }
      } else if (response.status === 403) {
        if (this.isModelFree(model)) {
          throw new Error('Free model access forbidden. The model may have usage limits.');
        } else {
          throw new Error('API access forbidden. Please check your API key permissions.');
        }
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
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response from OpenRouter API');
    }

    return data;
  }

  /**
   * Parse the response from OpenRouter API
   */
  parseResponse(response) {
    try {
      const choice = response.choices[0];
      
      if (!choice) {
        throw new Error('No choices in response');
      }

      const message = choice.message;
      if (!message || !message.content) {
        throw new Error('No content in response');
      }

      const text = message.content;
      if (!text) {
        throw new Error('Empty response from AI');
      }

      return {
        chapters: text.trim(),
        finishReason: choice.finish_reason,
        model: response.model || 'unknown'
      };
      
    } catch (error) {
      console.error('Error parsing OpenRouter response:', error);
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Validate API key format for OpenRouter
   */
  validateAPIKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string') {
      return false;
    }

    // OpenRouter API keys typically start with sk-or-
    const apiKeyPattern = /^sk-or-[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > 20;
  }

  /**
   * Get models by category for UI grouping
   */
  getModelsByCategory() {
    const categories = {
      free: this.availableModels.filter(m => m.isFree),
      reasoning: this.availableModels.filter(m => m.category === 'reasoning' && !m.isFree),
      premium: this.availableModels.filter(m => m.category === 'premium'),
      fast: this.availableModels.filter(m => m.category === 'fast' && !m.isFree),
      general: this.availableModels.filter(m => m.category === 'general')
    };
    
    // Remove empty categories
    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });
    
    return categories;
  }

  /**
   * Get provider-specific model information
   */
  getModelProvider(modelId) {
    if (modelId.startsWith('deepseek/')) return 'DeepSeek';
    if (modelId.startsWith('google/')) return 'Google';
    if (modelId.startsWith('anthropic/')) return 'Anthropic';
    if (modelId.startsWith('openai/')) return 'OpenAI';
    if (modelId.startsWith('meta-llama/')) return 'Meta';
    return 'Unknown';
  }

  /**
   * Check if model requires special handling
   */
  getModelRequirements(modelId) {
    const model = this.getModel(modelId);
    if (!model) return {};
    
    return {
      requiresApiKey: !model.isFree,
      estimatedCost: model.isFree ? 'Free' : 'Pay-per-use',
      category: model.category,
      capabilities: model.capabilities
    };
  }
} 