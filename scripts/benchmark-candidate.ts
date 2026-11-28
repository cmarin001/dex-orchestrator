import { performance, monitorEventLoopDelay, PerformanceObserver } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { setImmediate as yieldLoop } from "node:timers/promises";

const root=resolve(process.argv[2] ?? process.cwd());
const iterations=Number(process.argv[3] ?? "1500");
if (!Number.isSafeInteger(iterations) || iterations<100 || iterations>50_000) throw new Error("Invalid iterations");
const importFrom=(path:string)=>import(pathToFileURL(resolve(root,path)).href);
const [{fixture},{runCandidate},{Positions},{Equity}]=await Promise.all([
  importFrom("tests/phase3-fixture.ts"),importFrom("src/orchestrator/pipeline.ts"),
  importFrom("src/state/positions.ts"),importFrom("src/state/equity.ts"),
]);
const cleanup:Array<()=>Promise<void>>=[];
const f=await fixture({after(fn:()=>Promise<void>){cleanup.push(fn);}});
f.settings.mode={...f.settings.mode,mode:"ai"};
await f.runtime.beginCycle();
const execute=async()=>{
  const result=await runCandidate(f.snapshot(),{...f.pipeline,positions:new Positions(),equity:new Equity(100_000),
    audit:async()=>undefined});
  if(result!=="paper_fill") throw new Error("Unexpected benchmark outcome: "+result);
};
const gc=new PerformanceObserver(list=>{
  for (const entry of list.getEntries()) gcMs+=entry.duration;
});
let gcMs=0;
const delay=monitorEventLoopDelay({resolution:10});
try {
  for (let i=0;i<100;i++) await execute();
  const samples:number[]=[];
  const before=process.cpuUsage();
  const started=performance.now();
  gc.observe({entryTypes:["gc"]});
  delay.enable();
  for (let i=0;i<iterations;i++) {
    const then=performance.now();
    await execute();
    samples.push(performance.now()-then);
    if (i%20===0) await yieldLoop();
  }
  const wallMs=performance.now()-started;
  const cpu=process.cpuUsage(before);
  await yieldLoop();
  gc.disconnect();
  delay.disable();
  samples.sort((a,b)=>a-b);
  const percentile=(p:number)=>samples[Math.min(samples.length-1,Math.ceil(samples.length*p)-1)];
  console.log(JSON.stringify({node:process.version,iterations,wallMs,perSecond:iterations/(wallMs/1000),
    p50Ms:percentile(.5),p95Ms:percentile(.95),p99Ms:percentile(.99),
    cpuMs:(cpu.user+cpu.system)/1000,cpuUtilization:(cpu.user+cpu.system)/1000/wallMs,
    rssMiB:process.memoryUsage().rss/1024**2,gcMs,eventLoopP99Ms:delay.percentile(99)/1e6},null,2));
} finally {
  gc.disconnect();
  delay.disable();
  for (const dispose of cleanup) await dispose();
}
