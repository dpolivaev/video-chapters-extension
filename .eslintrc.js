module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  globals: {
    chrome: 'readonly',
    browser: 'readonly',
    importScripts: 'readonly',
    JsModuleImporter: 'readonly',
    VideoUrl: 'readonly',
    ModelId: 'readonly',
    ApiCredentials: 'readonly',
    GenerationProgress: 'readonly',
    VideoTranscript: 'readonly',
    ChapterGeneration: 'readonly',
    BrowserTab: 'readonly',
    SessionRepository: 'readonly',
    TabRegistry: 'readonly',
    SettingsRepository: 'readonly',
    TranscriptExtractor: 'readonly',
    ChapterGenerator: 'readonly',
    MessageCoordinator: 'readonly',
    PromptGenerator: 'writable',
    BaseLLM: 'writable',
    BrowserHttpAdapter: 'readonly',
    NetworkCommunicator: 'readonly',
    GeminiChapterGenerator: 'readonly',
    OpenRouterChapterGenerator: 'readonly',
    GeminiApiAdapter: 'readonly',
    OpenRouterApiAdapter: 'readonly',
    BrowserMessageAdapter: 'readonly',
    ErrorHandler: 'readonly',
    extractVideoId: 'readonly',
    extractVideoIdFromUrl: 'readonly',
    normalizeUrl: 'readonly',
    l10n: 'readonly',
    cleanVideoURL: 'readonly',
    retryHandler: 'writable'
  },
  rules: {
    'no-unused-vars': ['error', {
      vars: 'all',
      args: 'after-used',
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^(_|BaseLLM|retryHandler|GeminiAPI|OpenRouterAPI|PromptGenerator|cleanVideoURL|browser|_backgroundService)$'
    }],
    'no-undef': 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': ['error', 'always'],
    'curly': ['error', 'all'],
    'brace-style': ['error', '1tbs'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'semi': ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'object-shorthand': 'error',
    'arrow-spacing': 'error',
    'space-before-blocks': 'error',
    'keyword-spacing': 'error',
    'space-infix-ops': 'error',
    'no-trailing-spaces': 'error',
    'eol-last': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    'no-unreachable': 'error',
    'no-duplicate-case': 'error',
    'default-case': 'error',
    'no-fallthrough': 'error',
    'consistent-return': 'error',
    'no-return-assign': 'error'
  },
  overrides: [
    {
      files: ['**/*.test.js', '**/test/**/*.js'],
      env: {
        jest: true
      },
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['scripts/**/*.js'],
      env: {
        node: true,
        browser: false
      },
      rules: {
        'no-console': 'off'
      }
    },
    {
      files: ['src/background/**/*.js'],
      globals: {
        self: 'readonly'
      }
    }
  ]
};
