import { createHmac } from "node:crypto";
import { open, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { pathToFileURL } from "node:url";
import { HDKey } from "@scure/bip32";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { p2tr, p2wpkh } from "@scure/btc-signer";
import { getPublicKeyAsync } from "@noble/ed25519";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { privateKeyToAccount } from "viem/accounts";
import bs58 from "bs58";

export const kinds = ["evm", "solana", "bitcoin_segwit", "bitcoin_taproot"];
const secretKinds = kinds.slice(0, 3);
const manifestPath = new URL(import.meta.url.includes("/tools/derive/") ? "./addresses.json" : "../addresses.json", import.meta.url);
const defaultManifest = () => readFile(manifestPath, "utf8").then(JSON.parse);
const hex = bytes => Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("hex");
const hmac = (key, bytes) => createHmac("sha512", key).update(bytes).digest();
const argsError = "Invalid validator arguments.";
const operationId = /^[a-f0-9-]{36}$/.test(process.env.DEX_WALLET_OPERATION_ID ?? "")
  ? process.env.DEX_WALLET_OPERATION_ID : undefined;
const validatorStarted = performance.now();
function trace(level, stage, outcome, reason, kind) {
  if (!operationId) return;
  console.error(JSON.stringify({ at: new Date().toISOString(), level, event: "wallet.derivation",
    component: "offline_validator", operation_id: operationId, stage, outcome, reason, kind,
    duration_ms: Math.round(performance.now() - validatorStarted) }));
}

function slip10(seed, path) {
  if (!/^m(?:\/[0-9]+')+$/.test(path)) throw Error(argsError);
  let node = hmac("ed25519 seed", seed);
  const data = Buffer.alloc(37);
  try {
    for (const part of path.slice(2).split("/")) {
      const index = Number(part.slice(0, -1));
      if (!Number.isSafeInteger(index) || index >= 0x80000000) throw Error(argsError);
      node.copy(data, 1, 0, 32);
      data.writeUInt32BE(index + 0x80000000, 33);
      const next = hmac(node.subarray(32), data);
      node.fill(0);
      node = next;
    }
    return Uint8Array.from(node.subarray(0, 32));
  } finally {
    data.fill(0);
    node.fill(0);
  }
}

export async function derive(seed, kind, path, addressesOnly = true) {
  if (kind === "solana") {
    const key = slip10(seed, path);
    try {
      const publicKey = await getPublicKeyAsync(key);
      return { address: bs58.encode(publicKey), ...(addressesOnly ? {} : { secret: Uint8Array.from([...key, ...publicKey]) }) };
    } finally { key.fill(0); }
  }
  if (!/^m(?:\/[0-9]+'?)+$/.test(path)) throw Error(argsError);
  const root = HDKey.fromMasterSeed(seed);
  let child = root;
  try {
    for (const segment of path.slice(2).split("/")) {
      if (!/^[0-9]+'?$/.test(segment)) throw Error(argsError);
      const index = Number(segment.replace("'", ""));
      if (!Number.isSafeInteger(index) || index >= 0x80000000) throw Error(argsError);
      const next = child.deriveChild(index + (segment.endsWith("'") ? 0x80000000 : 0));
      if (child !== root) child.wipePrivateData();
      child = next;
    }
    const key = child.privateKey;
    const publicKey = child.publicKey;
    if (!key || !publicKey) throw Error(argsError);
    let address;
    if (kind === "evm") address = privateKeyToAccount("0x" + hex(key)).address;
    else if (kind === "bitcoin_segwit") address = p2wpkh(publicKey).address;
    else if (kind === "bitcoin_taproot") address = p2tr(publicKey.slice(1)).address;
    else throw Error(argsError);
    return { address, ...(addressesOnly ? {} : { secret: Uint8Array.from(key) }) };
  } finally {
    root.wipePrivateData();
    if (child !== root) child.wipePrivateData();
  }
}

const same = (kind, a, b) => kind === "evm" ? a.toLowerCase() === b.toLowerCase() : a === b;

async function probeSolana(seed, manifest) {
  const results = [];
  for (const path of manifest.solana.candidate_paths) {
    const { address } = await derive(seed, "solana", path);
    if (address === manifest.solana.address) {
      trace("info", "address_check", "ok", "slip10_ed25519_match", "solana");
      return { path, results };
    }
    results.push(path + " " + address);
  }
  trace("warn", "address_check", "failed", "slip10_ed25519_no_matching_path", "solana");
  return { results };
}

function printProbe(probe) {
  console.log(probe.path ? "MATCH " + probe.path : "NO_MATCH\n" + probe.results.join("\n"));
}

async function validate(seed, manifest) {
  let valid = true;
  for (const kind of kinds) {
    let matched;
    if (kind === "solana") {
      const probe = await probeSolana(seed, manifest);
      printProbe(probe);
      matched = !!probe.path;
    } else {
      const { address } = await derive(seed, kind, manifest[kind].derivation_path);
      matched = same(kind, address, manifest[kind].address);
      trace(matched ? "info" : "warn", "address_check", matched ? "ok" : "failed",
        matched ? "manifest_address_matched" : "manifest_address_mismatch", kind);
    }
    if (!matched) valid = false;
    console.log((matched ? "OK " : "FAIL ") + manifest[kind].address);
  }
  return valid;
}

async function writeKey(path, kind, key) {
  const file = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    const content = kind === "solana" ? JSON.stringify(Array.from(key)) : (kind === "evm" ? "0x" : "") + hex(key);
    await file.writeFile(content + "\n");
    await file.sync();
  } finally { await file.close(); }
}

async function readInput() {
  if (process.stdin.isTTY) throw Error("Pipe input through stdin.");
  // Bound the input before allocating the final secret buffer.
  const parts = [];
  let size = 0;
  try {
    for await (const part of process.stdin) {
      parts.push(part);
      if ((size += part.length) > 2048) throw Error("Invalid secret input.");
    }
    return Buffer.concat(parts);
  } finally { for (const part of parts) part.fill(0); }
}

export async function signerAddress(kind, input) {
  const value = input.toString("utf8").trim();
  if (kind === "solana") {
    const bytes = JSON.parse(value);
    if (!Array.isArray(bytes) || bytes.length !== 64 || bytes.some(b => !Number.isInteger(b) || b < 0 || b > 255)) throw Error(argsError);
    const key = Uint8Array.from(bytes.slice(0, 32));
    try {
      const publicKey = await getPublicKeyAsync(key);
      if (publicKey.some((b, i) => b !== bytes[i + 32])) throw Error(argsError);
      return bs58.encode(publicKey);
    } finally { key.fill(0); bytes.fill(0); }
  }
  if (kind === "evm" && /^0x[a-f0-9]{64}$/i.test(value)) return privateKeyToAccount(value).address;
  if (kind !== "bitcoin_segwit" || !/^[a-f0-9]{64}$/i.test(value)) throw Error(argsError);
  const key = Buffer.from(value, "hex");
  try { return p2wpkh(secp256k1.getPublicKey(key, true)).address; }
  finally { key.fill(0); }
}

async function main([mode, ...args]) {
  if (!(["validate", "write-secret", "check-secret", ...kinds].includes(mode))) throw Error(argsError);
  const kind = args[1];
  if (mode === "write-secret") {
    if (args.length !== 4 || args[0] !== "--kind" || !secretKinds.includes(kind) || args[2] !== "--path" || !args[3]) throw Error(argsError);
  } else if (mode === "check-secret") {
    if (args.length !== 2 || args[0] !== "--kind" || !secretKinds.includes(kind)) throw Error(argsError);
  } else if (args.length) throw Error(argsError);
  const manifest = await defaultManifest();
  const input = await readInput();
  let seed;
  try {
    if (mode === "check-secret") {
      const address = await signerAddress(kind, input);
      if (!same(kind, address, manifest[kind].address)) {
        trace("warn", "signer_check", "failed", "manifest_address_mismatch", kind);
        throw Error("Public address mismatch.");
      }
      trace("info", "signer_check", "ok", "manifest_address_matched", kind);
      console.log("OK " + address);
      return;
    }
    const mnemonic = input.toString("utf8").trim().replace(/\s+/g, " ");
    if (!validateMnemonic(mnemonic, wordlist)) {
      trace("warn", "input_check", "failed", "invalid_bip39_input");
      throw Error("Invalid BIP39 phrase.");
    }
    seed = mnemonicToSeedSync(mnemonic);
    if (mode === "validate") {
      if (!await validate(seed, manifest)) process.exitCode = 1;
      return;
    }
    const target = mode === "write-secret" ? kind : mode;
    let path = manifest[target].derivation_path;
    if (target === "solana") {
      const probe = await probeSolana(seed, manifest);
      path = probe.path;
      if (mode !== "write-secret") printProbe(probe);
      if (!path) { process.exitCode = 1; return; }
      if (mode !== "write-secret") return;
    }
    const result = await derive(seed, target, path, mode !== "write-secret");
    try {
      if (mode !== "write-secret") { console.log(result.address); return; }
      if (!same(target, result.address, manifest[target].address)) throw Error("Public address mismatch.");
      await writeKey(args[3], target, result.secret);
      console.log("OK " + result.address);
    } finally { result.secret?.fill(0); }
  } finally { input.fill(0); seed?.fill(0); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try { await main(process.argv.slice(2)); }
  catch (error) {
    const reason = ({ EEXIST: "destination_exists", EACCES: "permission_denied", ENOSPC: "disk_full",
      ELOOP: "unsafe_destination", ENOENT: "input_or_destination_missing" })[error?.code] ?? "validation_or_write_failed";
    trace("error", "validator", "failed", reason);
    console.error("Wallet validation failed. Check input, mode, file permissions, and manifest.");
    process.exitCode = 1;
  }
}
