import type {Handoff,Target} from "../../schemas/common.js";
import type {ReconSnapshot} from "../../schemas/recon-snapshot.js";
import type {Merged} from "./merge.js";

export interface ReconStore {
  track(target:Target,watched:boolean):void;
  remove(target:Target):void;
  list():Target[];
  put(snapshot:ReconSnapshot):void;
  read(identity:Handoff,now?:number):Merged;
  reject(target:Pick<Target,"chain"|"token">):void;
  isRejected(target:Target):boolean;
}
