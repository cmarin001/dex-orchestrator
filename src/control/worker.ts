import { isClose } from "../logging/types.js";
import { tradeKey } from "../../schemas/common.js";
import type { ReconCache } from "../cache/recon-cache.js";
import type { Audit } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import type { Positions } from "../state/positions.js";
import { appendRisk, readRisk } from "../state/risk-config.js";
import { commandSchema, type Command, Inbox } from "./commands.js";
import type { ControlPlane } from "./plane.js";
import { SafetyGate } from "./safety.js";
import { transition } from "../mode/switch.js";
import type { ConfigJournals } from "./config-journals.js";

export class WorkerControls {
  private entriesPaused = false;
  readonly safety: SafetyGate;
  get paused() { return this.entriesPaused || this.safety.state() !== "normal"; }
  private liveEnabled = false;
  get liveExecutionEnabled() { return this.liveConfigured && this.liveEnabled && this.safety.state() === "normal"; }
  get liveExitEnabled() { return this.liveConfigured && this.safety.state() !== "disarmed"; }
  readonly exits = new Set<string>();
  private readonly completed = new Set<string>();
  constructor(private inbox: Inbox, private riskPath: string, private cache: ReconCache, private audit: Audit,
    private readonly liveConfigured = false, private readonly plane?:ControlPlane, private readonly revisions?:ConfigJournals) { this.safety = new SafetyGate(inbox.path); }
  private apply(command: Command) {
    const action = command.action;
    if (action.type === "phase3") this.plane?.apply(action.command, command.id);
    if (action.type === "live-execution") this.liveEnabled = action.enabled;
    if (action.type === "pause" || action.type === "resume") this.entriesPaused = action.type === "pause";
    if (action.type === "reject") this.cache.reject(action.target);
    if (action.type === "exit") this.exits.add(tradeKey(action.position));
  }
  replay(event: JournalEvent) {
    if (isClose(event.status) && event.position) this.exits.delete(tradeKey(event.position));
    if (event.stage !== "control") return;
    const command = commandSchema.parse(event.detail);
    this.completed.add(command.id);
    if (event.status === "ok" && command.action.type !== "phase3") this.apply(command);
  }
  async drain(positions: Positions) {
    await this.plane?.expire();
    for (const cmd of await this.inbox.pending()) {
      if (!this.completed.has(cmd.id)) {
        const a = cmd.action;
        const position = a.type === "exit" ? positions.get(a.position) : undefined;
        const gap = a.type === "phase3" ? (this.plane ? this.plane.validate(a.command) : "control_plane_unconfigured")
          : a.type === "exit" && (!position?.exit_policy || tradeKey(position) !== tradeKey(a.position))
          ? "position_closed_or_ineligible"
          : a.type === "live-execution" && a.enabled && !this.liveConfigured ? "live_execution_not_configured" : null;
        if (a.type === "risk") {
          const revision = {config:a.config, actor:cmd.actor, as_of:cmd.at};
          const current = await readRisk(this.riskPath);
          if (!current || current.as_of !== cmd.at || current.actor !== cmd.actor ||
              JSON.stringify(current.config) !== JSON.stringify(a.config)) await appendRisk(this.riskPath,revision);
        }
        if (!gap && a.type === "phase3" && this.plane) {
          if (a.command.type === "reload") await this.plane.registry.reload();
          const change = transition(this.plane.settings,a.command);
          await this.revisions?.record(cmd,change);
          if (change) await this.audit({stage:"mode_switch",status:"ok",gaps:[],detail:{...change,actor:cmd.actor,as_of:cmd.at}});
        }
        await this.audit({stage:"control",status:gap?"failed":"ok",detail:cmd,gaps:gap?[gap]:[]});
        if (!gap) this.apply(cmd);
        this.completed.add(cmd.id);
      }
      await this.inbox.finish(cmd.id);
    }
  }
}
