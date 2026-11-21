import { isClose } from "../logging/types.js";
import { tradeKey } from "../../schemas/common.js";
import type { ReconCache } from "../cache/recon-cache.js";
import type { Audit } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import type { Positions } from "../state/positions.js";
import { appendRisk, readRisk } from "../state/risk-config.js";
import { commandSchema, type Command, Inbox } from "./commands.js";

export class WorkerControls {
  paused = false;
  readonly exits = new Set<string>();
  private readonly completed = new Set<string>();
  constructor(private inbox: Inbox, private riskPath: string, private cache: ReconCache, private audit: Audit) {}
  private apply(command: Command) {
    const action = command.action;
    if (action.type === "pause" || action.type === "resume") this.paused = action.type === "pause";
    if (action.type === "reject") this.cache.reject(action.target);
    if (action.type === "exit") this.exits.add(tradeKey(action.position));
  }
  replay(event: JournalEvent) {
    if (isClose(event.status) && event.position) this.exits.delete(tradeKey(event.position));
    if (event.stage !== "control") return;
    const command = commandSchema.parse(event.detail);
    this.completed.add(command.id);
    if (event.status === "ok") this.apply(command);
  }
  async drain(positions: Positions) {
    for (const cmd of await this.inbox.pending()) {
      if (!this.completed.has(cmd.id)) {
        const a = cmd.action;
        const position = a.type === "exit" ? positions.get(a.position) : undefined;
        const failed = a.type === "exit" && (!position?.exit_policy || tradeKey(position) !== tradeKey(a.position));
        if (a.type === "risk") {
          const revision = {config:a.config, actor:cmd.actor, as_of:cmd.at};
          const current = await readRisk(this.riskPath);
          if (!current || current.as_of !== cmd.at || current.actor !== cmd.actor ||
              JSON.stringify(current.config) !== JSON.stringify(a.config)) await appendRisk(this.riskPath,revision);
        }
        await this.audit({stage:"control",status:failed?"failed":"ok",detail:cmd,gaps:failed?["position_closed_or_ineligible"]:[]});
        if (!failed) this.apply(cmd);
        this.completed.add(cmd.id);
      }
      await this.inbox.finish(cmd.id);
    }
  }
}
