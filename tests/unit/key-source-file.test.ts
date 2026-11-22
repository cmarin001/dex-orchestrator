import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp,rm,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { evmKey, bitcoinKey, solanaKey } from "../../src/wallet/key-source.js";
import { withSecret, secretText } from "../../src/config/secrets.js";

test("trimmed EVM file takes precedence, and temporary file bytes are wiped",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"dex-keys-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,"wallet");
  const secret=generatePrivateKey();
  await writeFile(file,"  "+secret+"\n",{mode:0o600});
  const result=await evmKey({mode:"env"},{EVM_KEY_FILE:file,EVM_PRIVATE_KEY:generatePrivateKey()});
  assert.equal(result.address,privateKeyToAccount(secret).address);
  assert.deepEqual(Object.keys(result).sort(),["address","sign"]);
  assert.ok(!JSON.stringify(result).includes(secret));
  assert.equal(await secretText({API_FILE:file},"API"),secret);
  const bytes=await withSecret({API_FILE:file},"API",buf=>buf!);
  assert.ok(bytes.length>0 && bytes.every(value=>value===0));
});

test("unavailable or invalid file fails without exposing data or using an env fallback",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"dex-keys-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,"wallet");
  const fallback=generatePrivateKey();
  await assert.rejects(evmKey({mode:"env"},{EVM_KEY_FILE:file,EVM_PRIVATE_KEY:fallback}),{message:"EVM_KEY_UNAVAILABLE"});
  for (let n=0;n<10;n++) {
    const invalid="invalid-"+randomBytes(12).toString("hex");
    await writeFile(file,invalid,{mode:0o600});
    await assert.rejects(evmKey({mode:"env"},{EVM_KEY_FILE:file,EVM_PRIVATE_KEY:fallback}),error=>{
      assert.ok(error instanceof Error);
      assert.ok(!String(error.stack).includes(invalid));
      assert.ok(!String(error.stack).includes(fallback));
      assert.equal(error.cause,undefined);
      return true;
    });
  }
});

test("Solana retains a signer-owned copy and Bitcoin requires a derived SegWit key file",async t=>{
  const dir=await mkdtemp(join(tmpdir(),"dex-keys-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const file=join(dir,"wallet");
  const kp=Keypair.generate();
  await writeFile(file,JSON.stringify(Array.from(kp.secretKey)),{mode:0o600});
  const key=await solanaKey({SOLANA_KEY_FILE:file});
  const instruction=SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:Keypair.generate().publicKey,lamports:1});
  const message=new TransactionMessage({payerKey:kp.publicKey,recentBlockhash:Keypair.generate().publicKey.toBase58(),
    instructions:[instruction]}).compileToV0Message();
  const signed=new VersionedTransaction(message);
  const expected=new VersionedTransaction(message);
  expected.sign([kp]);
  await key.sign(signed);
  assert.deepEqual(signed.signatures,expected.signatures);

  await writeFile(file, "not a derived key\n", { mode: 0o600 });
  await assert.rejects(bitcoinKey({ BITCOIN_KEY_FILE: file }, true), { message: "BITCOIN_KEY_UNAVAILABLE" });
  await writeFile(file, generatePrivateKey().slice(2) + "\n", { mode: 0o600 });
  const env = { BITCOIN_KEY_FILE: file };
  const wallet = await bitcoinKey(env, true);
  assert.match(wallet.address, /^tb1q/);
  assert.match((await bitcoinKey(env, false)).address, /^bc1q/);
  assert.equal((await bitcoinKey(env, true)).address, wallet.address);
});
