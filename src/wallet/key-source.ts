import { createPublicKey } from "node:crypto";
import { withSecret } from "../config/secrets.js";
import { GetPublicKeyCommand, KMSClient, SignCommand } from "@aws-sdk/client-kms";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { bytesToHex, hexToBytes, keccak256, recoverAddress, serializeTransaction, toHex } from "viem";
import type { Hex, TransactionSerializableEIP1559 } from "viem";
import { privateKeyToAccount, publicKeyToAddress } from "viem/accounts";
import { p2wpkh, TEST_NETWORK, NETWORK } from "@scure/btc-signer";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import type { Transaction } from "@scure/btc-signer";
import type { WalletConfig } from "../../schemas/wallet-config.js";

export interface EvmKey {
  address: Hex;
  sign(tx: TransactionSerializableEIP1559): Promise<Hex>;
}

async function scrub<T>(fn: () => T | Promise<T>, message: string): Promise<T> {
  try { return await fn(); }
  catch { throw new Error(message); }
}

const scalarOrder = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

function decodeDer(der: Uint8Array) {
  if (der[0] !== 48 || der[1] !== der.length - 2) throw new Error("Invalid DER");
  let offset = 2;
  function integer() {
    if (der[offset++] !== 2) throw new Error("Invalid DER");
    const length = der[offset++]!;
    if (length < 1 || length > 33 || offset + length > der.length) throw new Error("Invalid DER");
    const value = BigInt(bytesToHex(der.slice(offset,offset+length)));
    offset += length;
    if (value <= 0n || value >= scalarOrder) throw new Error("Invalid scalar");
    return value;
  }
  const r = integer();
  const s = integer();
  if (offset !== der.length) throw new Error("Invalid DER");
  return {r:toHex(r,{size:32}),s:toHex(s > scalarOrder/2n ? scalarOrder-s : s,{size:32})};
}

export async function evmKey(config: Pick<WalletConfig,"mode">, env: NodeJS.ProcessEnv,
  createKms = () => new KMSClient({})): Promise<EvmKey> {
  return scrub(async () => {
    if (config.mode === "env") {
      return withSecret(env,"EVM_PRIVATE_KEY",bytes=>{
        const key=bytes?.toString("utf8").trim();
        if (!key || !/^0x[0-9a-f]{64}$/i.test(key)) throw new Error();
        const account=privateKeyToAccount(key as Hex);
        return {address:account.address,sign:(tx:TransactionSerializableEIP1559)=>
          scrub(() => account.signTransaction(tx),"SIGNING_FAILED")};
      },"EVM_KEY_FILE");
    }
    const keyId = env.AWS_KMS_KEY_ID;
    if (!keyId) throw new Error();
    const kms = createKms();
    const key = await kms.send(new GetPublicKeyCommand({KeyId:keyId}));
    if (key.KeySpec !== "ECC_SECG_P256K1" || key.KeyUsage !== "SIGN_VERIFY" || !key.PublicKey) throw new Error();
    const jwk = createPublicKey({key:Buffer.from(key.PublicKey),type:"spki",format:"der"}).export({format:"jwk"});
    if (!jwk.x || !jwk.y || jwk.crv !== "secp256k1") throw new Error();
    const address = publicKeyToAddress(bytesToHex(Buffer.concat([Buffer.of(4),
      Buffer.from(jwk.x,"base64url"),Buffer.from(jwk.y,"base64url")])));
    return {address,sign:tx => scrub(async () => {
      const hash = keccak256(serializeTransaction(tx));
      const result = await kms.send(new SignCommand({KeyId:key.KeyId ?? keyId,Message:hexToBytes(hash),
        MessageType:"DIGEST",SigningAlgorithm:"ECDSA_SHA_256"}));
      if (!result.Signature) throw new Error();
      const {r,s} = decodeDer(result.Signature);
      for (const yParity of [0,1] as const) {
        const signature = {r,s,yParity};
        if (await recoverAddress({hash,signature}) === address) return serializeTransaction(tx,signature);
      }
      throw new Error();
    },"SIGNING_FAILED")};
  },"EVM_KEY_UNAVAILABLE");
}

export async function solanaKey(env: NodeJS.ProcessEnv) {
  return scrub(() => withSecret(env,"SOLANA_PRIVATE_KEY",raw=>{
    const values:unknown=JSON.parse(raw?.toString("utf8") ?? "");
    if (!Array.isArray(values) || values.length !== 64 ||
        values.some(b=>!Number.isInteger(b)||b<0||b>255)) throw new Error();
    const bytes=Uint8Array.from(values);
    values.fill(0);
    try {
      const key=Keypair.fromSecretKey(bytes.slice());
      return {address:key.publicKey,sign:(tx:VersionedTransaction)=>scrub(()=>tx.sign([key]),"SIGNING_FAILED")};
    } finally { bytes.fill(0); }
  },"SOLANA_KEY_FILE"),"SOLANA_KEY_UNAVAILABLE");
}

export async function bitcoinKey(env: NodeJS.ProcessEnv, testnet: boolean) {
  return scrub(async ()=>{
    function signer(key:Uint8Array) {
      const payment=p2wpkh(secp256k1.getPublicKey(key,true),testnet ? TEST_NETWORK : NETWORK);
      return {address:payment.address,script:payment.script,sign:(tx:Transaction)=>
        scrub(()=>{ if (!tx.sign(key)) throw new Error(); tx.finalize(); },"SIGNING_FAILED")};
    }
    return withSecret(env,"BITCOIN_PRIVATE_KEY",bytes=>{
      const raw=bytes?.toString("utf8").trim();
      if (!raw || !/^[0-9a-f]{64}$/i.test(raw)) throw new Error();
      const key = hexToBytes(("0x"+raw) as Hex);
      try { return signer(key.slice()); } finally { key.fill(0); }
    },"BITCOIN_KEY_FILE");
  },"BITCOIN_KEY_UNAVAILABLE");
}
