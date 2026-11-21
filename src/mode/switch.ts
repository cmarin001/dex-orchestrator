import type { Phase3Command } from "../../schemas/control-plane.js";
import type { Settings } from "./config.js";

export function transition(settings:Settings, change:Phase3Command) {
  if (change.type!=="mode") return undefined;
  const previous=settings.mode.mode;
  return {previous,next:change.config.mode,reason:change.reason,
    noop:JSON.stringify(settings.mode)===JSON.stringify(change.config)};
}
