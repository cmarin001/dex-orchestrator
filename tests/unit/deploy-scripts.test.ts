import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp,rm,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

test("outside verification creates a receipt only after SSH, ports and HTTPS checks pass",async t=>{
  const bin=await mkdtemp(join(tmpdir(),"dex-verifier-"));
  t.after(()=>rm(bin,{recursive:true,force:true}));
  await writeFile(join(bin,"ssh"),`#!/bin/sh
echo 'Permission denied (publickey).' >&2
exit 255
`,{mode:0o700});
  await writeFile(join(bin,"curl"),`#!/bin/sh
case "$*" in
  *:8787/*) if [ "$FAKE_PUBLIC" = 1 ]; then printf 1; exit 28; fi; printf 0; exit 7;;
  *:3001/*) printf 0; exit 28;;
  *-fsSI*) printf 'Strict-Transport-Security: max-age=31536000; includeSubDomains\\r\\n';;
esac
`,{mode:0o700});
  const verify=(open:boolean)=>spawnSync("bash",["deploy/scripts/99-verify.sh","--external","dex.example.test","192.0.2.4"],{
    env:{...process.env,PATH:bin+":"+process.env.PATH,FAKE_PUBLIC:open?"1":"0"},encoding:"utf8",
  });
  const success=verify(false);
  assert.equal(success.status,0,success.stderr);
  assert.match(success.stdout,/^external-v1 dex\.example\.test 192\.0\.2\.4 \d+\n$/);
  assert.match(success.stderr,/PASS: Public HSTS/);
  const failure=verify(true);
  assert.equal(failure.status,1);
  assert.equal(failure.stdout,"");
  assert.match(failure.stderr,/FAIL: Public port 8787 blocked/);
});

test("paper settings need only the dashboard token and reject credential assignments",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"dex-settings-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const command=()=>spawnSync("bash",["-c",
    'source deploy/scripts/common.sh; repo="$1"; env_has_no_secrets && required_secrets',"bash",dir],
    {encoding:"utf8"});
  await writeFile(join(dir,".env"),"OPERATING_MODE=strategies\nEXECUTION_MODE=paper\n");
  assert.equal(command().stdout,"dashboard_api_token\n");
  await writeFile(join(dir,".env"),"OPERATING_MODE=strategies\nEXECUTION_MODE=paper\nOPENAI_API_KEY=\n");
  assert.notEqual(command().status,0);
});
