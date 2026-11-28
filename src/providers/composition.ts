import { secretText } from "../config/secrets.js";
import type { Settings } from "../mode/config.js";
import { OpenAICompatProvider } from "./adapter.js";
import { requireTrustedEndpoint } from "./http.js";
import { ProviderError, type ReasoningProvider } from "./types.js";

const credentialOrigins=new Map<string,string>([
  ["OPENAI_API_KEY","https://api.openai.com"],
  ["DEEPSEEK_API_KEY","https://api.deepseek.com"],
  ["XAI_API_KEY","https://api.x.ai"],
  ["KIMI_API_KEY","https://api.moonshot.ai"],
  ["GLM_API_KEY","https://api.z.ai"],
  ["ZAI_API_KEY","https://api.z.ai"],
  ["ANTHROPIC_API_KEY","https://api.anthropic.com"],
  ["GEMINI_API_KEY","https://generativelanguage.googleapis.com"],
]);

export async function reasoningProviders(settings:Settings, env:NodeJS.ProcessEnv, request:typeof fetch=fetch) {
  const entries = await Promise.all(Object.entries(settings.definitions).map(async ([id, definition]) => {
    const ref=definition.apiKeyEnv;
    const endpoint=requireTrustedEndpoint(definition.baseUrl,Boolean(ref));
    if (ref) {
      const origin=credentialOrigins.get(ref);
      if (origin ? origin!==endpoint.origin : !/^MODEL_[A-Z0-9_]+_API_KEY$/.test(ref)) {
        throw new ProviderError("configuration");
      }
    }
    const key=ref ? await secretText(env,ref) : undefined;
    if (definition.apiKeyEnv && !key) return null;
    return [id,new OpenAICompatProvider(id,definition,key,request)] as const;
  }));
  return new Map<string,ReasoningProvider>(entries.filter(row=>row!==null));
}
