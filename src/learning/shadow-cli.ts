import { readJournal } from "../logging/logger.js";
import { evaluateShadow } from "./calibration.js";

const [path, cutoff, threshold="0.5"]=process.argv.slice(2);
if (!path || !cutoff) throw new Error("Usage: npm run research:calibrate -- SHADOW_JOURNAL ISO_CUTOFF THRESHOLD");
const events=await readJournal(path,true);
process.stdout.write(JSON.stringify(evaluateShadow(events,Date.parse(cutoff),Number(threshold)),null,2)+"\n");
