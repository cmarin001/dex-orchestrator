import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const repo=fileURLToPath(new URL("../../",import.meta.url));
const files=(folder:string):string[]=>readdirSync(resolve(repo,folder),{withFileTypes:true}).flatMap(entry=>{
  const path=join(folder,entry.name);
  return entry.isDirectory()?files(path):entry.name.endsWith(".ts")?[path]:[];
});
function imports(path:string) {
  const content=readFileSync(resolve(repo,path),"utf8");
  return ts.preProcessFile(content,true,true).importedFiles.map(item=>item.fileName);
}
function local(path:string,specifier:string) {
  return relative(repo,resolve(repo,dirname(path),specifier.replace(/\.js$/,".ts")));
}

test("domain and typed contracts are independent of application and infrastructure",()=>{
  for (const path of [...files("src/domain"),"src/agent-runtime/contract.ts","src/decisions/contract.ts"]) {
    assert.ok(imports(path).every(name=>name==="zod"),path);
  }
});

test("intelligence and offline learning have no dependency path to signing, execution or control-plane writes",()=>{
  const roots=["src/agent-runtime","src/decisions","src/learning","src/providers"];
  const forbidden=/^src\/(wallet|exec|execution|control|dashboard-api|mcp)\//;
  const visited=new Set<string>();
  function visit(path:string,stack:string[]) {
    assert.ok(!forbidden.test(path),[...stack,path].join(" -> "));
    assert.ok(!stack.includes(path),[...stack,path].join(" -> "));
    if (visited.has(path)) return;
    for (const specifier of imports(path).filter(value=>value.startsWith("."))) {
      const target=local(path,specifier);
      if (existsSync(resolve(repo,target))) visit(target,[...stack,path]);
    }
    visited.add(path);
  }
  for (const root of roots) for (const path of files(root)) visit(path,[]);
});

test("trade orchestration consumes execution and recon ports without importing concrete adapters",()=>{
  for (const path of ["src/orchestrator/pipeline.ts","src/orchestrator/loop.ts","src/orchestrator/recon-refresh.ts","src/exits/watcher.ts","src/control/worker.ts","src/execution/port.ts","src/cache/contract.ts"]) {
    for (const specifier of imports(path).filter(value=>value.startsWith("."))) {
      const target=local(path,specifier);
      assert.doesNotMatch(target,/^src\/(wallet|cache\/recon-cache\.ts)/,path);
    }
  }
});
