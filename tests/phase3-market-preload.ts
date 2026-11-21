import { id,securityProvider } from "./agent-fixture.js";

const started=Date.now();
globalThis.fetch=async (url,options)=>{
  const address=String(url);
  if (address.includes("api.geckoterminal.com")) {
    return Response.json({data:[{attributes:{address:id.pair,reserve_in_usd:"100000",volume_usd:{h1:"20000"},
      pool_created_at:new Date(started-900_000).toISOString()},
    relationships:{base_token:{data:{id:"base_"+id.token}}}}]});
  }
  if(address.includes("api.dexscreener.com")) {
    return Response.json({pairs:[{chainId:"base",pairAddress:id.pair,baseToken:{address:id.token},
      priceUsd:"2",volume:{h1:20000,h24:24000},liquidity:{usd:100000}}]});
  }
  if (address.includes("api.gopluslabs.io") || address.includes("api.honeypot.is")) {
    return securityProvider(url,options);
  }
  process.stderr.write("Unexpected external request\n");
  process.exit(71);
};
