import assert from "node:assert/strict";
import { createPublicKey, randomBytes } from "node:crypto";
import { test } from "node:test";
import { GetPublicKeyCommand, SignCommand } from "@aws-sdk/client-kms";
import type { KMSClient } from "@aws-sdk/client-kms";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { bytesToHex, hexToBytes, keccak256, recoverTransactionAddress, serializeTransaction } from "viem";
import { publicKeyToAddress } from "viem/accounts";
import { bitcoinKey, evmKey, solanaKey } from "../../src/wallet/key-source.js";
import { transactionIntentSchema } from "../../schemas/transaction-intent.js";
import { intent } from "../wallet-fixture.js";

test("invalid credentials never enter returned objects or error messages", async ()=>{
  for (let trial=0;trial<30;trial++) {
    const secret = "invalid-"+randomBytes(12).toString("hex");
    const env = {EVM_PRIVATE_KEY:secret,SOLANA_PRIVATE_KEY:secret,BITCOIN_PRIVATE_KEY:secret};
    for (const get of [()=>evmKey({mode:"env"},env),()=>solanaKey(env),()=>bitcoinKey(env,false)]) {
      await assert.rejects(get(),(error: Error)=>!String(error.stack).includes(secret) && error.cause === undefined);
    }
  }
  const secret = "0x"+randomBytes(32).toString("hex");
  const key = await evmKey({mode:"env"},{EVM_PRIVATE_KEY:secret});
  assert.deepEqual(Object.keys(key).sort(),["address","sign"]);
  assert.ok(!JSON.stringify(key).includes(secret));
  for (const field of ["private_key","signed_tx","raw_tx","broadcast"]) {
    assert.equal(transactionIntentSchema.safeParse({...intent,[field]:secret}).success,false);
  }
});

test("KMS signs the unsigned EVM transaction digest and yields a signature for the KMS address", async () => {
  const secret = hexToBytes(bytesToHex(Uint8Array.of(1, ...new Uint8Array(31))));
  const uncompressed = secp256k1.getPublicKey(secret,false);
  const der = createPublicKey({key:{kty:"EC",crv:"secp256k1",
    x:Buffer.from(uncompressed.subarray(1,33)).toString("base64url"),
    y:Buffer.from(uncompressed.subarray(33)).toString("base64url")},format:"jwk"})
    .export({type:"spki",format:"der"});
  const tx = {type:"eip1559",chainId:8453,nonce:8,gas:25_000n,maxFeePerGas:3n,maxPriorityFeePerGas:1n,
    to:"0x0000000000000000000000000000000000000011",value:1n} as const;
  const digest = hexToBytes(keccak256(serializeTransaction(tx)));
  const commands: string[] = [];
  const mocked = {async send(command:GetPublicKeyCommand|SignCommand) {
    if (command instanceof GetPublicKeyCommand) {
      commands.push("public");
      return {KeyId:"fixed-key",KeySpec:"ECC_SECG_P256K1",KeyUsage:"SIGN_VERIFY",PublicKey:der};
    }
    commands.push("sign");
    assert.deepEqual(command.input.Message,digest);
    assert.equal(command.input.MessageType,"DIGEST");
    assert.equal(command.input.KeyId,"fixed-key");
    return {Signature:secp256k1.sign(digest,secret,{format:"der",prehash:false,lowS:false})};
  }};
  const key = await evmKey({mode:"kms"},{AWS_KMS_KEY_ID:"alias/phase2-test"},()=>mocked as unknown as KMSClient);
  assert.equal(key.address,publicKeyToAddress(bytesToHex(uncompressed)));
  const serialized = await key.sign(tx);
  assert.ok(serialized.startsWith("0x02"));
  assert.equal(await recoverTransactionAddress({serializedTransaction:serialized as `0x02${string}`}),key.address);
  assert.deepEqual(commands,["public","sign"]);
});
