import "breeze-plugin-kit/node";
import { cache, flutterTools, pluginConfig } from "breeze-plugin-kit";
const bridge = globalThis.bridge;

const results = [];
const check = (name, ok, extra = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " " + extra : ""}`);
};

const md5 = await bridge.call("crypto.md5", "hello");
check("bridge crypto.md5", md5 === "5d41402abc4b2a76b9719d911017c592", md5);

const sha = await globalThis.crypto.sha256("hello");
check(
  "global crypto.sha256",
  sha === "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
);

await cache.set("k", { a: 1 });
check("cache roundtrip", JSON.stringify(await cache.get("k", null)) === '{"a":1}');

await pluginConfig.save("auth.account", "tester");
const raw = await pluginConfig.load("auth.account", "");
check("pluginConfig envelope", JSON.parse(raw).value === "tester", raw);

const ver = await flutterTools.getAppVersion();
check("getAppVersion default", ver === JSON.stringify("9.9.9"), ver);

const gz = await bridge.call("compression.gzip_compress", new TextEncoder().encode("hi"));
const back = await bridge.call("compression.gzip_decompress", gz);
check("gzip roundtrip", new TextDecoder().decode(new Uint8Array(back)) === "hi");

try {
  await bridge.call("native.exec", "noop", 0);
  check("native.exec rejects", false);
} catch (e) {
  check("native.exec rejects", String(e.message).includes("unsupported"));
}

check("uuidv4 shape", /^[0-9a-f-]{36}$/.test(globalThis.uuidv4()));
check(
  "bytesToBase64",
  globalThis.bytesToBase64(new Uint8Array([104, 105])) === "aGk=",
);
check("web bus", typeof globalThis.__web?.bridge?.call === "function");

// AES-CBC roundtrip against node directly
const key = "my2ecret782ecret";
const iv = "my2ecret782ecret";
const enc = await globalThis.crypto.aesCbcPkcs7Encrypt("secret-text", key, iv);
const dec = await globalThis.crypto.aesCbcPkcs7Decrypt(enc, key, iv);
check("aes-cbc roundtrip", new TextDecoder().decode(dec) === "secret-text");

console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
