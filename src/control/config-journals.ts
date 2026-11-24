import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Command } from "./commands.js";
import type { Phase3Command } from "../../schemas/control-plane.js";

const names:Partial<Record<Phase3Command["type"],string>>={
  mode:"mode.jsonl",chain:"chain.jsonl",budget:"budget.jsonl",provider:"providers.jsonl",provider_order:"providers.jsonl",
  strategy:"strategies.jsonl",reload:"strategies.jsonl",
};

/** A revision is applied only after its durable worker audit receipt. */
export class ConfigJournals {
  constructor(private directory:string,private budgetPath:string) {}
  async record(request:Command, extra?:object) {
    const action=request.action;
    if (action.type!=="phase3") return;
    const name=names[action.command.type];
    if (!name) return;
    const path=action.command.type==="budget" ? this.budgetPath : join(this.directory,name);
    const content=await readFile(path,"utf8").catch(error=>{
      if ((error as NodeJS.ErrnoException).code==="ENOENT") return "";
      throw error;
    });
    if (content && !content.endsWith("\n")) throw new Error("Incomplete configuration journal");
    for (const line of content.split("\n").filter(Boolean)) {
      const row=JSON.parse(line) as {kind?:string;request_id?:string};
      if (row.kind==="revision" && row.request_id===request.id) return;
    }
    await mkdir(dirname(path),{recursive:true});
    await appendFile(path,JSON.stringify({kind:"revision",request_id:request.id,actor:request.actor,
      as_of:request.at,command:action.command,...extra})+"\n",{mode:0o600,flush:true});
  }
}
