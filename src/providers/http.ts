import { ProviderError } from "./types.js";

export function requireTrustedEndpoint(input:string, authenticated:boolean) {
  const url = new URL(input);
  const loopback = ["localhost","127.0.0.1","[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash ||
      !["http:","https:"].includes(url.protocol) || (authenticated && url.protocol!=="https:" && !loopback)) {
    throw new ProviderError("configuration");
  }
  return url;
}

export function httpFailure(response:Response):ProviderError {
  if (response.status===401 || response.status===403) return new ProviderError("authentication");
  if (response.status===429) {
    const header=response.headers.get("retry-after");
    const delay=header === null ? NaN : /^\d+$/.test(header) ? Number(header)*1000 : Date.parse(header)-Date.now();
    return new ProviderError("rate_limit",Number.isFinite(delay)?Math.max(0,Math.min(delay,3_600_000)):undefined);
  }
  if (response.status===400 || response.status===404 || response.status===422) return new ProviderError("configuration");
  return new ProviderError("error");
}

export async function readProviderJson(response:Response,limit=2_000_000):Promise<unknown> {
  const reader=response.body?.getReader();
  if (!reader) throw new ProviderError("schema_mismatch");
  const decoder=new TextDecoder();
  const parts:string[]=[];
  let bytes=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if (done) break;
      bytes+=value.byteLength;
      if (bytes>limit) {
        void reader.cancel().catch(()=>undefined);
        throw new ProviderError("schema_mismatch");
      }
      parts.push(decoder.decode(value,{stream:true}));
    }
    parts.push(decoder.decode());
    try { return JSON.parse(parts.join("")) as unknown; }
    catch { throw new ProviderError("schema_mismatch"); }
  } finally { reader.releaseLock(); }
}
