# 0003 Keep agent configuration in the repository

The nine files in `prompts/` are versioned with the code and passed directly to the API. Tool implementations, tool access, output schemas, observability, and local keys are owned by the TypeScript process. The entry point requires an OpenAI API key and a compatible model. Deployment requires no Custom GPT, plugin runtime, or Assistants API file store.
