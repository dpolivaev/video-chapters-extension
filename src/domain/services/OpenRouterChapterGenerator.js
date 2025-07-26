/**
 * OpenRouter Chapter Generator - Pure Domain Logic
 * Contains all OpenRouter API business logic without framework dependencies
 *
 * Copyright (C) 2025 Dimitry Polivaev
 * Licensed under GPL3 or later
 */

class OpenRouterChapterGenerator {
  constructor(networkCommunicator, promptGenerator) {
    this.networkCommunicator = networkCommunicator;
    this.promptGenerator = promptGenerator;
    this.baseUrl = "https://openrouter.ai/api/v1";
    this.availableModels = [
      {
        id: "deepseek/deepseek-r1-0528:free",
        displayName: "DeepSeek R1 0528 (Free)",
        description: "Latest DeepSeek R1 model - Free to use, no API key required",
        isFree: true,
        category: "reasoning",
        capabilities: ["reasoning", "coding", "analysis"]
      },
      {
        id: "deepseek/deepseek-r1-0528",
        displayName: "DeepSeek R1 0528",
        description: "Latest DeepSeek R1 model with advanced reasoning capabilities",
        isFree: false,
        category: "reasoning",
        capabilities: ["reasoning", "coding", "analysis"]
      },
      {
        id: "deepseek/deepseek-r1",
        displayName: "DeepSeek R1",
        description: "Original DeepSeek R1 with performance on par with OpenAI o1",
        isFree: false,
        category: "reasoning",
        capabilities: ["reasoning", "coding", "analysis"]
      },
      {
        id: "deepseek/deepseek-r1-distill-qwen-1.5b",
        displayName: "DeepSeek R1 Distill 1.5B",
        description: "Smaller, efficient model that outperforms GPT-4o on math",
        isFree: false,
        category: "fast",
        capabilities: ["math", "reasoning", "efficiency"]
      },
      {
        id: "google/gemini-2.5-pro",
        displayName: "Gemini 2.5 Pro (OpenRouter)",
        description: "Google Gemini 2.5 Pro via OpenRouter - Most capable model for complex reasoning",
        isFree: false,
        category: "premium",
        capabilities: ["reasoning", "coding", "analysis", "multimodal"]
      },
      {
        id: "google/gemini-2.5-flash",
        displayName: "Gemini 2.5 Flash (OpenRouter)",
        description: "Google Gemini 2.5 Flash via OpenRouter - Faster model optimized for speed",
        isFree: false,
        category: "fast",
        capabilities: ["speed", "general", "multimodal"]
      },
      {
        id: "anthropic/claude-3.5-sonnet",
        displayName: "Claude 3.5 Sonnet",
        description: "Anthropic Claude 3.5 Sonnet - Excellent for analysis and reasoning",
        isFree: false,
        category: "premium",
        capabilities: ["reasoning", "analysis", "writing", "coding"]
      },
      {
        id: "anthropic/claude-3.5-haiku",
        displayName: "Claude 3.5 Haiku",
        description: "Anthropic Claude 3.5 Haiku - Fast and efficient for most tasks",
        isFree: false,
        category: "fast",
        capabilities: ["speed", "general", "analysis"]
      },
      {
        id: "openai/gpt-4o",
        displayName: "GPT-4o",
        description: "OpenAI GPT-4o - Advanced multimodal model with reasoning",
        isFree: false,
        category: "premium",
        capabilities: ["reasoning", "multimodal", "coding", "analysis"]
      },
      {
        id: "openai/gpt-4o-mini",
        displayName: "GPT-4o Mini",
        description: "OpenAI GPT-4o Mini - Faster, more affordable version of GPT-4o",
        isFree: false,
        category: "fast",
        capabilities: ["speed", "general", "coding"]
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        displayName: "Llama 3.3 70B Instruct",
        description: "Meta Llama 3.3 70B - Advanced open-source model with strong performance",
        isFree: false,
        category: "general",
        capabilities: ["reasoning", "coding", "general"]
      }
    ];
  }

  validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== "string") {
      return false;
    }
    const apiKeyPattern = /^sk-or-[A-Za-z0-9_-]+$/;
    return apiKeyPattern.test(apiKey) && apiKey.length > 20;
  }

  validateModel(model) {
    return this.availableModels.some(m => m.id === model);
  }

  isModelFree(model) {
    const modelInfo = this.availableModels.find(m => m.id === model);
    return modelInfo ? modelInfo.isFree : false;
  }

  getAvailableModels() {
    return [...this.availableModels];
  }

  getModelsByCategory() {
    const categories = {
      free: this.availableModels.filter(m => m.isFree),
      reasoning: this.availableModels.filter(m => m.category === "reasoning" && !m.isFree),
      premium: this.availableModels.filter(m => m.category === "premium"),
      fast: this.availableModels.filter(m => m.category === "fast" && !m.isFree),
      general: this.availableModels.filter(m => m.category === "general")
    };

    Object.keys(categories).forEach(key => {
      if (categories[key].length === 0) {
        delete categories[key];
      }
    });

    return categories;
  }

  getModelProvider(modelId) {
    if (modelId.startsWith("deepseek/")) return "DeepSeek";
    if (modelId.startsWith("google/")) return "Google";
    if (modelId.startsWith("anthropic/")) return "Anthropic";
    if (modelId.startsWith("openai/")) return "OpenAI";
    if (modelId.startsWith("meta-llama/")) return "Meta";
    return "Unknown";
  }

  getModelRequirements(modelId) {
    const model = this.getModel(modelId);
    if (!model) return {};
    
    return {
      requiresApiKey: !model.isFree,
      estimatedCost: model.isFree ? "Free" : "Pay-per-use",
      category: model.category,
      capabilities: model.capabilities
    };
  }

  getModel(modelId) {
    return this.availableModels.find(m => m.id === modelId);
  }

  buildRequestUrl() {
    return `${this.baseUrl}/chat/completions`;
  }

  buildHttpHeaders(apiKey, model) {
    const headers = {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/dimitry-polivaev/timecodes-browser-extension",
      "X-Title": "Video Chapters Generator"
    };

    if (!this.isModelFree(model) && apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    return headers;
  }

  buildRequestBody(prompt, model) {
    return {
      model: model,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 8192,
      top_p: 0.95
    };
  }

  categorizeHttpError(status, errorData, model) {
    if (status === 401) {
      if (this.isModelFree(model)) {
        return new Error("Free model access denied. The model may be temporarily unavailable.");
      } else {
        return new Error("Invalid API key. Please check your OpenRouter API key.");
      }
    } else if (status === 403) {
      if (this.isModelFree(model)) {
        return new Error("Free model access forbidden. The model may have usage limits.");
      } else {
        return new Error("API access forbidden. Please check your API key permissions.");
      }
    } else if (status === 429) {
      return new Error("Rate limit exceeded. Please try again later.");
    } else if (status === 400) {
      const errorMessage = errorData.error?.message || "Bad request";
      return new Error(`Request error: ${errorMessage}`);
    } else {
      return new Error(`API request failed: ${status}`);
    }
  }

  validateHttpResponse(responseData) {
    if (!responseData.choices || !responseData.choices[0] || !responseData.choices[0].message) {
      throw new Error("Invalid response from OpenRouter API");
    }
    return responseData;
  }

  parseApiResponse(responseData) {
    const choice = responseData.choices[0];
    if (!choice) {
      throw new Error("No choices in response");
    }

    const message = choice.message;
    if (!message || !message.content) {
      throw new Error("No content in response");
    }

    const text = message.content;
    if (!text) {
      throw new Error("Empty response from AI");
    }

    return {
      chapters: text.trim(),
      finishReason: choice.finish_reason,
      model: responseData.model || "unknown"
    };
  }

  async processSubtitles(subtitleContent, customInstructions, apiKey, model = "deepseek/deepseek-r1-0528:free") {
    const isFreeModel = this.isModelFree(model);
    if (!isFreeModel && !apiKey) {
      throw new Error("API key is required for paid models");
    }

    if (!this.validateModel(model)) {
      const availableIds = this.availableModels.map(m => m.id);
      throw new Error(`Invalid model: ${model}. Available models: ${availableIds.join(", ")}`);
    }

    const prompt = this.promptGenerator.buildPrompt(subtitleContent, customInstructions);
    const url = this.buildRequestUrl();
    const headers = this.buildHttpHeaders(apiKey, model);
    const body = this.buildRequestBody(prompt, model);

    try {
      const responseData = await this.networkCommunicator.post(url, headers, body);
      this.validateHttpResponse(responseData);
      return this.parseApiResponse(responseData);
    } catch (error) {
      if (error.isHttpError) {
        throw this.categorizeHttpError(error.status, error.responseData, model);
      }
      throw new Error(`AI processing failed: ${error.message}`);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = OpenRouterChapterGenerator;
}