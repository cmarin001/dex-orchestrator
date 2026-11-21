import { createHash } from "node:crypto";

export class ResponseCache {
  private readonly entries=new Map<string,{value:unknown;expiresAt:number}>();
  constructor(private clock=Date.now,private ttl=60_000) {}
  key(stage:string,system:string,tools:unknown,schema:unknown,input:unknown) {
    if (stage!=="scanner" && stage!=="rug-check") return null;
    return createHash("sha256").update(JSON.stringify([stage,system,tools,schema,input])).digest("hex");
  }
  get(key:string|null) {
    if (!key) return undefined;
    const stored=this.entries.get(key);
    if (stored && stored.expiresAt<=this.clock()) { this.entries.delete(key); return undefined; }
    return stored?.value;
  }
  set(key:string|null,value:unknown) {
    if (!key) return;
    if (this.entries.size>=1000) this.entries.delete(this.entries.keys().next().value!);
    this.entries.set(key,{value,expiresAt:this.clock()+this.ttl});
  }
}
