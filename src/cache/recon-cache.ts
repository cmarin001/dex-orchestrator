import type { Target } from "../../schemas/common.js";
import type { ReconSnapshot } from "../../schemas/recon-snapshot.js";
import { NEW_TTL_MS, WATCHED_TTL_MS, merge, reconKey, targetKey } from "./merge.js";

import type { ReconStore } from "./contract.js";

export class ReconCache implements ReconStore {
  private readonly entries = new Map<string, { target: Target; watched: boolean; snapshot?: ReconSnapshot }>();
  private readonly rejected = new Set<string>();

  track(target: Target, watched: boolean) {
    const key = reconKey(target);
    const previous = this.entries.get(key);
    this.entries.set(key, { target, watched, snapshot: previous && targetKey(previous.target) === targetKey(target) ? previous.snapshot : undefined });
  }

  remove(target: Target) { this.entries.delete(reconKey(target)); }
  list() { return [...this.entries.values()].map(({ target }) => target); }

  put(snapshot: ReconSnapshot) {
    const entry = this.entries.get(reconKey(snapshot.target));
    if (entry && targetKey(entry.target) === targetKey(snapshot.target) && !this.isRejected(snapshot.target)) entry.snapshot = snapshot;
  }

  read(identity: Parameters<typeof merge>[0], now = Date.now()) {
    const entry = this.entries.get(reconKey(identity));
    return merge(identity, entry?.snapshot, entry?.watched ? WATCHED_TTL_MS : NEW_TTL_MS, now);
  }

  reject(target: Pick<Target,"chain"|"token">) {
    const key = reconKey(target);
    this.rejected.add(key);
    const entry = this.entries.get(key);
    if (entry) entry.snapshot = undefined;
  }

  isRejected(target: Target) {
    return this.rejected.has(reconKey(target));
  }
}
