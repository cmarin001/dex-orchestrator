import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, copyFile, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { mnemonicToSeedSync } from "@scure/bip39";
import { derive, signerAddress } from "../../deploy/cicd/lib/derive-address.mjs";

// Public BIP39 reference vector only. Never use this phrase for funds.
const mnemonic = "abandon ".repeat(11) + "about";
const run = (file, args, input = mnemonic, preload) => spawnSync(process.execPath,
  [...(preload ? ["--import", preload] : []), file, ...args], { input, encoding: "utf8", timeout: 10_000 });
const source = fileURLToPath(new URL("../../deploy/cicd/lib/derive-address.mjs", import.meta.url));

const paths = {
  evm: "m/44'/60'/0'/0/0",
  solana: "m/44'/501'/0'/0'",
  bitcoin_segwit: "m/84'/0'/0'/0/0",
  bitcoin_taproot: "m/86'/0'/0'/0/0",
};
const addresses = {
  // Public reference for Phantom's default EVM path, also used by MetaMask.
  evm: "0x9858EfFD232B4033E47d90003D41EC34EcaEda94",
  // Public fixture checked against Phantom's default hardened grouping.
  solana: "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk",
  bitcoin_segwit: "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
  bitcoin_taproot: "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
};

test("BIP39 seed, Phantom-compatible paths, BIP84, and BIP86 public addresses", async () => {
  const reference = mnemonicToSeedSync(mnemonic, "TREZOR");
  assert.equal(Buffer.from(reference).toString("hex"),
    "c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04");
  reference.fill(0);
  const seed = mnemonicToSeedSync(mnemonic);
  try {
    for (const kind of Object.keys(paths)) assert.deepEqual(await derive(seed, kind, paths[kind]), { address: addresses[kind] });
    await assert.rejects(derive(seed, "solana", "m/44'/501'/0'/0"));
  } finally { seed.fill(0); }
});

test("CLI matches the correct path and never prints derived key material", async t => {
  const tmp = await mkdtemp(join(fileURLToPath(new URL("../../", import.meta.url)), ".test-wallet-"));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const lib = join(tmp, "lib");
  await import("node:fs/promises").then(fs => fs.mkdir(lib));
  const validator = join(lib, "derive-address.mjs");
  await copyFile(source, validator);
  const manifest = Object.fromEntries(Object.entries(paths).map(([kind, derivation_path]) => [kind, { address: addresses[kind], derivation_path }]));
  manifest.solana.candidate_paths = ["m/44'/501'/0'", paths.solana, "m/44'/501'/0'/0'/0'"];
  const manifestFile = join(tmp, "addresses.json");
  await writeFile(manifestFile, JSON.stringify(manifest));
  const guard = join(tmp, "guard.mjs");
  await writeFile(guard, `
    import net from "node:net";
    import http from "node:http";
    import https from "node:https";
    import dns from "node:dns";
    import { syncBuiltinESMExports } from "node:module";
    const deny = () => process.exit(97);
    globalThis.fetch = deny;
    net.connect = net.createConnection = net.Socket.prototype.connect = http.request = http.get = https.request = https.get = dns.lookup = dns.resolve = dns.promises.lookup = deny;
    syncBuiltinESMExports();
  `);
  const result = run(validator, ["validate"], mnemonic, guard);
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /MATCH m\/44'\/501'\/0'\/0'/);
  assert.ok(!result.stdout.includes(mnemonic));
  assert.equal(run(validator, ["evm"], "", guard).status, 1);
  assert.equal(run(validator, ["unknown"], mnemonic, guard).status, 1);

  for (const kind of ["evm", "solana", "bitcoin_segwit"]) {
    const file = join(tmp, kind);
    const args = ["write-secret", "--kind", kind, "--path", file];
    const written = run(validator, args, mnemonic, guard);
    assert.equal(written.status, 0);
    assert.equal(written.stdout, "OK " + addresses[kind] + "\n");
    assert.equal(written.stderr, "");
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    const bytes = await readFile(file);
    try { assert.equal(await signerAddress(kind, bytes), addresses[kind]); }
    finally { bytes.fill(0); }
    assert.equal(run(validator, args, mnemonic, guard).status, 1);
    const link = file + ".link";
    await symlink(file, link);
    assert.equal(run(validator, [...args.slice(0, -1), link], mnemonic, guard).status, 1);
  }
  assert.equal(run(validator, ["write-secret", "--kind", "bitcoin_taproot", "--path", join(tmp, "taproot")],
    mnemonic, guard).status, 1);

  manifest.solana.address = "unmatched";
  await writeFile(manifestFile, JSON.stringify(manifest));
  const miss = run(validator, ["solana"], mnemonic, guard);
  assert.equal(miss.status, 1);
  assert.equal(miss.stdout.trim().split("\n").length, 4);
  assert.match(miss.stdout, /^NO_MATCH\n/);
});

test("wizard validates before writing, requires explicit overwrite, and keeps the phrase out of output", async t => {
  const base = fileURLToPath(new URL("../../", import.meta.url));
  const tmp = await mkdtemp(join(base, ".test-wizard-"));
  t.after(() => rm(tmp, { recursive: true, force: true }));
  const { mkdir, chmod } = await import("node:fs/promises");
  const cicd = join(tmp, "deploy/cicd");
  const tools = join(tmp, "tools/derive");
  const bin = join(tmp, "bin");
  for (const path of [cicd + "/lib", tools, bin]) await mkdir(path, { recursive: true });
  await copyFile(source, join(cicd, "lib/derive-address.mjs"));
  await copyFile(join(base, "deploy/cicd/lib/wallet-log.sh"), join(cicd, "lib/wallet-log.sh"));
  await symlink(join(base, "node_modules"), join(tools, "node_modules"));
  const setup = await readFile(join(base, "deploy/cicd/setup-secrets.sh"), "utf8");
  if (process.getuid() !== 0) {
    const refusal = spawnSync("bash", [join(base, "deploy/cicd/setup-secrets.sh")], { encoding: "utf8" });
    assert.equal(refusal.status, 1);
    assert.match(refusal.stderr, /Run as root/);
  }
  // Simulate the privileged droplet boundary in a disposable workspace.
  // Preserve validation, lock, staged writes, and overwrite flow.
  const sandbox = setup.split("\n").filter(line => !line.startsWith("[[ $EUID") &&
    !line.startsWith("[[ -t") && !line.startsWith("[[ $repo ==")).join("\n")
    .replaceAll("/var/lock/dex-deploy.lock", tmp + "/lock")
    .replaceAll(" -o deploy -g deploy", "")
    .replace(/^ *(chown deploy:deploy|chgrp deploy) .*\n/gm, "");
  const wizard = join(cicd, "setup-secrets.sh");
  await writeFile(wizard, sandbox);
  await writeFile(join(tmp, "lock"), "");
  const fixtureManifest = Object.fromEntries(Object.entries(paths).map(([kind, derivation_path]) => [kind, { address: addresses[kind], derivation_path }]));
  fixtureManifest.solana.candidate_paths = [paths.solana, "m/44'/501'/0'"];
  const manifestFile = join(cicd, "addresses.json");
  const writeManifest = () => writeFile(manifestFile, JSON.stringify(fixtureManifest));
  await writeManifest();
  for (const [name, content] of Object.entries({
    docker: "exit 0",
    logger: "exit 0",
    runuser: 'shift 3; if [[ $1 != bash || $2 == -c ]]; then exec "$@"; fi',
    whiptail: 'case " $* " in *" --passwordbox "*) IFS= read -r phrase; printf "%s" "$phrase" >&2 ;; *" --inputbox "*) printf "%s" "${CONFIRM:-}" >&2 ;; esac',
  })) await writeFile(join(bin, name), "#!/bin/bash\n" + content + "\n", { mode: 0o700 });

  function runWizard(args, confirm) {
    const result = spawnSync("bash", [wizard, ...args], {
      env: { ...process.env, PATH: bin + ":" + process.env.PATH, CONFIRM: confirm ?? "" },
      input: mnemonic + "\n", encoding: "utf8", timeout: 15_000,
    });
    assert.ok(!(result.stdout + result.stderr).includes(mnemonic));
    return result;
  }
  const names = ["evm_private_key.txt", "solana_private_key.txt", "bitcoin_segwit_private_key.txt"];
  const evmAddress = fixtureManifest.evm.address;
  fixtureManifest.evm.address = "0x" + "0".repeat(40);
  await writeManifest();
  assert.equal(runWizard([]).status, 1);
  for (const name of names) await assert.rejects(stat(join(tmp, "secrets", name)), { code: "ENOENT" });
  fixtureManifest.evm.address = evmAddress;
  await writeManifest();
  const provisioned = runWizard([]);
  assert.equal(provisioned.status, 0);
  const events = provisioned.stderr.split("\n").filter(line => line.startsWith("{")).map(JSON.parse);
  assert.ok(events.some(event => event.reason === "three_signers_and_manifest_published"));
  assert.ok(events.some(event => event.reason === "slip10_ed25519_match"));
  assert.equal(new Set(events.map(event => event.operation_id)).size, 1);
  assert.ok(events.every(event => event.at && event.component && event.duration_ms >= 0));
  const snapshots = await Promise.all(names.map(name => readFile(join(tmp, "secrets", name))));
  try {
    assert.equal(runWizard([]).status, 1);
    assert.equal(runWizard(["--force"], "NO").status, 1);
    assert.equal(runWizard(["--force"], "OVERWRITE").status, 0);
    for (const [i, name] of names.entries()) {
      const file = join(tmp, "secrets", name);
      const actual = await readFile(file);
      try { assert.ok(snapshots[i].equals(actual)); } finally { actual.fill(0); }
      assert.equal((await stat(file)).mode & 0o777, 0o600);
    }
    for (const name of ["master_mnemonic.txt", "bitcoin_mnemonic.txt", "bitcoin_taproot_private_key.txt"]) {
      await assert.rejects(stat(join(tmp, "secrets", name)), { code: "ENOENT" });
    }
    const originalVerify = await readFile(join(base, "deploy/cicd/verify-secrets.sh"), "utf8");
    const verify = join(cicd, "verify-secrets.sh");
    await writeFile(verify, originalVerify.split("\n").filter(line => !line.startsWith("[[ $EUID")).join("\n"));
    const statWrapper = [
      "#!/bin/bash",
      'result=$(/usr/bin/stat "$@") || exit 1',
      'if [[ ${@: -1} == */evm_private_key.txt && ${WRONG_OWNER:-} == 1 ]]; then echo "600:nobody:nogroup"; exit; fi',
      'if [[ $result == *:"$(id -un)":"$(id -gn)" ]]; then result=${result%%:*}:deploy:deploy; fi',
      'printf "%s\\n" "$result"',
    ].join("\n") + "\n";
    await writeFile(join(bin, "stat"), statWrapper, { mode: 0o700 });
    const runVerify = (wrongOwner = "") => spawnSync("bash", [verify], {
      env: { ...process.env, PATH: bin + ":" + process.env.PATH, WRONG_OWNER: wrongOwner },
      encoding: "utf8", timeout: 15_000,
    });
    assert.equal(runVerify().status, 0);
    const evm = join(tmp, "secrets", names[0]);
    await chmod(evm, 0o644);
    assert.equal(runVerify().status, 1);
    await chmod(evm, 0o600);
    assert.equal(runVerify("1").status, 1);
    const verified = JSON.parse(await readFile(join(tmp, "data/wallet-addresses.json"), "utf8"));
    assert.equal(verified.solana.derivation_path, paths.solana);
  } finally { for (const key of snapshots) key.fill(0); }
});
