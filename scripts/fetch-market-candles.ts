import { targetSchema, normalizeAddress } from "../schemas/common.js";
import { geckoMinuteCandles } from "../src/tools/geckoterminal.js";

const value=targetSchema.parse(JSON.parse(process.argv[2] ?? "{}"));
const target={chain:value.chain,token:normalizeAddress(value.chain,value.token),pair:normalizeAddress(value.chain,value.pair)};
const asOf=Date.now();
process.env.MCP_STDIO_LOGS="true";
const candles=await geckoMinuteCandles(target,asOf);
console.log(JSON.stringify({target,observedAt:Date.now(),source:"geckoterminal",candles}));
