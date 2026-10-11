/**
 * Node.js 测试 polyfill：让插件 bundle 在纯 Node 下直接跑。
 *
 * 用法（仅本地测试，宿主 App 内不需要——宿主已注入全部 API，本文件只补缺失）：
 * ```bash
 * node --import breeze-plugin-kit/node ./dist/bundle.cjs
 * ```
 *
 * 补齐（行为与宿主一致）：
 * - `crypto`：CryptoApi 形状（createHash/createHmac/md5/sha 系/hmac 系/aes 系/randomBytes/
 *   randomUUID/timingSafeEqual/pbkdf2Sync），底层 node:crypto。
 * - `base64` / `bytesToBase64` / `bytesFromBase64`：Buffer 实现。
 * - `uuidv4`：randomUUID。
 * - `fs` / `path`：node:fs/promises + node:path 直通（stat 按 FsStats 裁剪）。
 * - `bridge`：内存路由（cache 系/save_plugin_config/load_plugin_config/
 *   dart.getAppVersion/dart.getLocaleInfo/flutter.showToast/math.add/crypto 系/compression 系）。
 *   kit 的 `pluginConfig` / `flutterTools` / `cache` 调 `bridge.call`，自动生效。
 * - `__web`：指向同一套内存实现的总线别名。
 * - `native` / `native.*` bridge 调用（Rust 内存池/图片管线）。
 * - `opencc`、`runtime.gc` 走 bridge 兜底（未知方法抛 `bridge: unsupported call`）。
 * - `Temporal`（Node 版本自带则天然有，不主动补）。
 */

import type {
  BinaryInput,
  BridgeApi,
  CryptoApi,
  CryptoHash,
  CryptoHmac,
  FsApi,
  HashAlgorithm,
  HostRuntimeApi,
  PathApi,
  TextInput,
} from "./types/index.js";
import nodeCrypto from "node:crypto";
import nodeFs from "node:fs/promises";
import nodePath from "node:path";
import nodeZlib from "node:zlib";

type Builtins = {
  crypto: typeof nodeCrypto;
  fs: typeof nodeFs;
  path: typeof nodePath;
  zlib: typeof nodeZlib;
};

function loadNodeBuiltins(): Builtins {
  return { crypto: nodeCrypto, fs: nodeFs, path: nodePath, zlib: nodeZlib };
}

function readGlobal(name: string): unknown {
  try {
    return Reflect.get(globalThis, name);
  } catch {
    return undefined;
  }
}

function writeGlobal(name: string, value: unknown): void {
  try {
    Reflect.set(globalThis, name, value);
  } catch {
    // 只读全局（如宿主冻结）则跳过，调用方走原有缺失报错。
  }
}

function toBytes(input: BinaryInput | string): Uint8Array {
  if (typeof input === "string") return new TextEncoder().encode(input);
  if (input instanceof Uint8Array) return input;
  if (Array.isArray(input)) return Uint8Array.from(input);
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function normalizeAlgo(algo: string): string {
  return algo.toLowerCase().replace(/-/g, "");
}

function toLatin1(input: BinaryInput | string): string {
  return Buffer.from(toBytes(input)).toString("latin1");
}

function buildCryptoApi(nodeCrypto: Record<string, any>): CryptoApi {
  const hash = (algo: string, data: Uint8Array): any =>
    nodeCrypto.createHash(normalizeAlgo(algo)).update(data);
  const hex = (algo: string, input: TextInput): string =>
    hash(algo, toBytes(input)).digest("hex");
  const aesKey = (keyRaw: string): Uint8Array => {
    const bytes = toBytes(keyRaw);
    if (bytes.length !== 16 && bytes.length !== 24 && bytes.length !== 32) {
      throw new Error(`AES key 长度非法：${bytes.length}（需 16/24/32 字节）`);
    }
    return bytes;
  };
  const aesName = (bytes: Uint8Array, mode: string): string =>
    `aes-${bytes.length * 8}-${mode}`;
  const ecb = (decrypt: boolean, input: TextInput, keyRaw: string): Uint8Array => {
    const key = aesKey(keyRaw);
    const fn = decrypt ? nodeCrypto.createDecipheriv : nodeCrypto.createCipheriv;
    const c = fn(aesName(key, "ecb"), key, null);
    c.setAutoPadding(true);
    return Uint8Array.from([...c.update(toBytes(input)), ...c.final()]) as Uint8Array;
  };
  const cbc = (
    decrypt: boolean,
    input: TextInput,
    keyRaw: string,
    ivRaw: string,
  ): Uint8Array => {
    const key = aesKey(keyRaw);
    const iv = toBytes(ivRaw);
    if (iv.length !== 16) throw new Error(`AES-CBC iv 长度非法：${iv.length}（需 16 字节）`);
    const fn = decrypt ? nodeCrypto.createDecipheriv : nodeCrypto.createCipheriv;
    const c = fn(aesName(key, "cbc"), key, iv);
    c.setAutoPadding(true);
    return Uint8Array.from([...c.update(toBytes(input)), ...c.final()]) as Uint8Array;
  };
  // GCM 返回形态与宿主对齐待确认：此处按密文 + 16 字节 tag 拼接。
  const gcm = (
    decrypt: boolean,
    input: TextInput,
    keyRaw: string,
    nonceRaw: string,
    aad?: BinaryInput | string | null,
  ): Uint8Array => {
    const key = aesKey(keyRaw);
    const nonce = toBytes(nonceRaw);
    if (decrypt) {
      const data = toBytes(input);
      if (data.length < 16) throw new Error("AES-GCM 密文过短（缺 auth tag）");
      const c = nodeCrypto.createDecipheriv(aesName(key, "gcm"), key, nonce);
      if (aad) c.setAAD(toBytes(aad));
      c.setAuthTag(data.subarray(data.length - 16));
      return Uint8Array.from([
        ...c.update(data.subarray(0, data.length - 16)),
        ...c.final(),
      ]) as Uint8Array;
    }
    const c = nodeCrypto.createCipheriv(aesName(key, "gcm"), key, nonce);
    if (aad) c.setAAD(toBytes(aad));
    return Uint8Array.from([...c.update(toBytes(input)), ...c.final(), ...c.getAuthTag()]) as Uint8Array;
  };

  return {
    createHash: (algorithm: HashAlgorithm) =>
      nodeCrypto.createHash(normalizeAlgo(algorithm)) as CryptoHash,
    createHmac: (algorithm: HashAlgorithm, key: TextInput) =>
      nodeCrypto.createHmac(normalizeAlgo(algorithm), toBytes(key)) as CryptoHmac,
    md5: async (input) => hex("md5", input),
    sha1: async (input) => hex("sha1", input),
    sha256: async (input) => hex("sha256", input),
    sha512: async (input) => hex("sha512", input),
    hmacSha1: async (key, input) =>
      nodeCrypto.createHmac("sha1", key).update(toBytes(input)).digest("hex") as string,
    hmacSha256: async (key, input) =>
      nodeCrypto.createHmac("sha256", key).update(toBytes(input)).digest("hex") as string,
    hmacSha512: async (key, input) =>
      nodeCrypto.createHmac("sha512", key).update(toBytes(input)).digest("hex") as string,
    aesEcbPkcs7Encrypt: async (input, keyRaw) => ecb(false, input, keyRaw),
    aesEcbPkcs7Decrypt: async (input, keyRaw) => ecb(true, input, keyRaw),
    aesCbcPkcs7Encrypt: async (input, keyRaw, ivRaw) => cbc(false, input, keyRaw, ivRaw),
    aesCbcPkcs7Decrypt: async (input, keyRaw, ivRaw) => cbc(true, input, keyRaw, ivRaw),
    aesGcmEncrypt: async (input, keyRaw, nonceRaw, aad) =>
      gcm(false, input, keyRaw, nonceRaw, aad),
    aesGcmDecrypt: async (input, keyRaw, nonceRaw, aad) =>
      gcm(true, input, keyRaw, nonceRaw, aad),
    randomBytes: (size: number) => nodeCrypto.randomBytes(size),
    randomUUID: () => nodeCrypto.randomUUID(),
    timingSafeEqual: (a, b) => {
      const ab = toBytes(a);
      const bb = toBytes(b);
      if (ab.length !== bb.length) return false;
      return nodeCrypto.timingSafeEqual(ab, bb) as boolean;
    },
    pbkdf2Sync: (password, salt, iterations, keyLen, digest) =>
      nodeCrypto.pbkdf2Sync(toBytes(password), toBytes(salt), iterations, keyLen, digest ?? "sha256"),
  } as CryptoApi;
}

type BridgeHandler = (...args: any[]) => unknown;

function buildBridge(
  nodeCrypto: Record<string, any>,
  nodeZlib: Record<string, any>,
  opts: NodePolyfillOptions,
): BridgeApi {
  const cache = new Map<string, unknown>();
  const configs = new Map<string, string>();
  const crypto = buildCryptoApi(nodeCrypto);
  const routes = new Map<string, BridgeHandler>([
    ["math.add", (a: number, b: number) => Promise.resolve(a + b)],
    ["cache.get", (key: string, fallback: unknown) =>
      Promise.resolve(cache.has(key) ? cache.get(key) : fallback)],
    ["cache.get.sync", (key: string, fallback: unknown) =>
      (cache.has(key) ? cache.get(key) : fallback) as unknown],
    ["cache.set", (key: string, value: unknown) => {
      cache.set(key, value);
      return Promise.resolve(true);
    }],
    ["cache.set.sync", (key: string, value: unknown) => {
      cache.set(key, value);
      return true;
    }],
    ["cache.set_if_absent", (key: string, value: unknown) => {
      if (!cache.has(key)) {
        cache.set(key, value);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }],
    ["cache.compare_and_set", (key: string, expected: unknown, next: unknown) => {
      if (cache.get(key) === expected) {
        cache.set(key, next);
        return Promise.resolve(true);
      }
      return Promise.resolve(false);
    }],
    ["cache.delete", (key: string) => Promise.resolve(cache.delete(key))],
    ["save_plugin_config", (key: string, value: string) => {
      configs.set(key, value);
      return Promise.resolve(value);
    }],
    ["load_plugin_config", (key: string, fallback = "") => {
      const hit = configs.get(key);
      if (hit === undefined) return Promise.resolve(fallback);
      return Promise.resolve(JSON.stringify({ ok: true, value: hit }));
    }],
    ["dart.getAppVersion", () => Promise.resolve(JSON.stringify(opts.appVersion))],
    ["dart.getLocaleInfo", () => Promise.resolve(JSON.stringify(opts.locale))],
    ["flutter.showToast", (payload: string) => {
      try {
        const options = JSON.parse(String(payload)) as { title?: string; message?: string };
        console.log(`[toast] ${options.title ?? ""} ${options.message ?? ""}`.trim());
      } catch {
        console.log(`[toast] ${String(payload)}`);
      }
      return Promise.resolve("ok");
    }],
    ["runtime.gc", () => Promise.resolve(undefined)],
    ["runtime.is_task_group_cancelled", () => Promise.resolve(false)],
    ["crypto.md5", (input: BinaryInput) => crypto.md5(input)],
    ["crypto.sha1", (input: BinaryInput) => crypto.sha1(input)],
    ["crypto.sha256", (input: BinaryInput) => crypto.sha256(input)],
    ["crypto.sha512", (input: BinaryInput) => crypto.sha512(input)],
    ["crypto.hmac_sha1", (key: BinaryInput, input: BinaryInput) =>
      crypto.hmacSha1(toLatin1(key), input)],
    ["crypto.hmac_sha256", (key: BinaryInput, input: BinaryInput) =>
      crypto.hmacSha256(toLatin1(key), input)],
    ["crypto.hmac_sha512", (key: BinaryInput, input: BinaryInput) =>
      crypto.hmacSha512(toLatin1(key), input)],
    ["crypto.aes_ecb_pkcs7_encrypt", (input: BinaryInput, keyRaw: BinaryInput) =>
      crypto.aesEcbPkcs7Encrypt(input, toLatin1(keyRaw))],
    ["crypto.aes_ecb_pkcs7_decrypt", (input: BinaryInput, keyRaw: BinaryInput) =>
      crypto.aesEcbPkcs7Decrypt(input, toLatin1(keyRaw))],
    ["crypto.aes_cbc_pkcs7_encrypt", (input: BinaryInput, keyRaw: BinaryInput, ivRaw: BinaryInput) =>
      crypto.aesCbcPkcs7Encrypt(input, toLatin1(keyRaw), toLatin1(ivRaw))],
    ["crypto.aes_cbc_pkcs7_decrypt", (input: BinaryInput, keyRaw: BinaryInput, ivRaw: BinaryInput) =>
      crypto.aesCbcPkcs7Decrypt(input, toLatin1(keyRaw), toLatin1(ivRaw))],
    ["crypto.aes_gcm_encrypt", (input: BinaryInput, keyRaw: BinaryInput, nonceRaw: BinaryInput, aad?: BinaryInput | null) =>
      crypto.aesGcmEncrypt(input, toLatin1(keyRaw), toLatin1(nonceRaw), aad ?? null)],
    ["crypto.aes_gcm_decrypt", (input: BinaryInput, keyRaw: BinaryInput, nonceRaw: BinaryInput, aad?: BinaryInput | null) =>
      crypto.aesGcmDecrypt(input, toLatin1(keyRaw), toLatin1(nonceRaw), aad ?? null)],
    ["compression.gzip_compress", (input: BinaryInput) =>
      Promise.resolve(Array.from(nodeZlib.gzipSync(toBytes(input)) as Uint8Array))],
    ["compression.gzip_decompress", (input: BinaryInput) =>
      Promise.resolve(Array.from(nodeZlib.gunzipSync(toBytes(input)) as Uint8Array))],
  ]);

  const call = (name: string, ...args: unknown[]): Promise<unknown> => {
    const handler = routes.get(name);
    if (!handler) return Promise.reject(new Error(`bridge: unsupported call ${name}`));
    try {
      return Promise.resolve(handler(...args));
    } catch (error) {
      return Promise.reject(error);
    }
  };
  return {
    gzipCompress: async (input) =>
      nodeZlib.gzipSync(toBytes(input as BinaryInput)) as Uint8Array,
    gzipDecompress: async (input) =>
      nodeZlib.gunzipSync(toBytes(input as BinaryInput)) as Uint8Array,
    call: ((name: string, ...args: unknown[]) => call(name, ...args)) as BridgeApi["call"],
    callSync: ((name: string, ...args: unknown[]) => {
      if (name === "cache.get.sync") return (cache.has(args[0] as string) ? cache.get(args[0] as string) : args[1]) as unknown;
      throw new Error(`bridge: unsupported sync call ${name}`);
    }) as BridgeApi["callSync"],
  };
}

export interface NodePolyfillOptions {
  /** flutterTools.getAppVersion 返回值，默认 "9.9.9"（走新宿主分支）。 */
  appVersion?: string;
  /** dart.getLocaleInfo 返回的 JSON 字符串。 */
  locale?: string;
}

const g = globalThis as Record<string, unknown> & {
  __web?: HostRuntimeApi;
};

/** 安装 Node 测试 polyfill，只补缺失、不覆盖宿主注入。 */
export function installNodePolyfill(options: NodePolyfillOptions = {}): void {
  const opts = { appVersion: "9.9.9", locale: "{}", ...options };
  const { crypto: nodeCrypto, zlib: nodeZlib } = loadNodeBuiltins();
  const cryptoApi = buildCryptoApi(nodeCrypto as unknown as Record<string, any>);
  // Node 的 globalThis.crypto 是 getter-only accessor，直接替换在严格模式下
  // 静默失败；改为原地补方法（WebCrypto 原生无 createHash/md5 等，不冲突），
  // 各方读到的仍是同一个对象。另设 hostCrypto/nodeCryptoCompat 供 requireCryptoLike()。
  const existingCrypto = readGlobal("crypto");
  const cryptoTarget =
    existingCrypto !== null && typeof existingCrypto === "object"
      ? (existingCrypto as Record<string, unknown>)
      : {};
  for (const [key, value] of Object.entries(cryptoApi)) {
    if (typeof cryptoTarget[key] !== "function") {
      cryptoTarget[key] = value;
    }
  }
  if (!readGlobal("hostCrypto")) writeGlobal("hostCrypto", cryptoTarget);
  if (!readGlobal("nodeCryptoCompat")) writeGlobal("nodeCryptoCompat", cryptoTarget);
  const bytesToBase64 = (input: BinaryInput): string =>
    Buffer.from(toBytes(input)).toString("base64");
  const bytesFromBase64 = (text: string): Uint8Array =>
    Uint8Array.from(Buffer.from(String(text), "base64"));
  if (!readGlobal("base64")) writeGlobal("base64", { encode: bytesToBase64, decode: bytesFromBase64 });
  if (!readGlobal("bytesToBase64")) writeGlobal("bytesToBase64", bytesToBase64);
  if (!readGlobal("bytesFromBase64")) writeGlobal("bytesFromBase64", bytesFromBase64);
  if (!readGlobal("uuidv4")) writeGlobal("uuidv4", () => nodeCrypto.randomUUID() as string);
  if (!readGlobal("fs")) {
    const nfs = nodeFs as unknown as Record<string, (...args: any[]) => Promise<any>>;
    writeGlobal("fs", {
      promises: {
        readFile: (path: string, encoding?: string | null) => nfs.readFile(path, ...(encoding ? [encoding] : [])),
        writeFile: (path: string, data: any) => nfs.writeFile(path, data),
        appendFile: (path: string, data: any) => nfs.appendFile(path, data),
        mkdir: (path: string, options?: { recursive?: boolean }) => nfs.mkdir(path, options),
        readdir: (path: string, options?: { withFileTypes?: boolean }) =>
          nfs.readdir(path, options).then((names: any[]) =>
            options?.withFileTypes
              ? names.map((entry: any) => ({
                name: String(entry.name ?? entry),
                isFile: () => entry.isFile?.() ?? true,
                isDirectory: () => entry.isDirectory?.() ?? false,
              }))
              : names.map((entry: any) => String(entry.name ?? entry)),
          ),
        stat: (path: string) =>
          nfs.stat(path).then((st: any) => ({
            size: Number(st.size ?? 0),
            isFile: () => Boolean(st.isFile?.()),
            isDirectory: () => Boolean(st.isDirectory?.()),
          })),
        rm: (path: string, options?: { recursive?: boolean; force?: boolean }) =>
          nfs.rm(path, options),
      },
    } satisfies FsApi);
  }
  if (!readGlobal("path")) {
    const npath = nodePath as unknown as Record<string, any>;
    writeGlobal("path", {
      sep: npath.sep,
      delimiter: npath.delimiter,
      normalize: npath.normalize.bind(npath),
      isAbsolute: npath.isAbsolute.bind(npath),
      join: npath.join.bind(npath),
      resolve: npath.resolve.bind(npath),
      dirname: npath.dirname.bind(npath),
      basename: npath.basename.bind(npath),
      extname: npath.extname.bind(npath),
    } satisfies PathApi);
  }
  // bridge 每次重建：Node 测试可重调 installNodePolyfill 切换 appVersion 等参数。
  // （宿主 App 内不会 import 本入口，无影响。）
  const nodeBridge = buildBridge(nodeCrypto, nodeZlib, opts);
  writeGlobal("bridge", nodeBridge);
  if (!readGlobal("__web")) {
    const bus: HostRuntimeApi = {
      fs: readGlobal("fs") as HostRuntimeApi["fs"],
      FSError: (readGlobal("FSError") ?? class FSError extends Error {}) as HostRuntimeApi["FSError"],
      native: readGlobal("native") as HostRuntimeApi["native"],
      bridge: nodeBridge,
      path: readGlobal("path") as HostRuntimeApi["path"],
      base64: readGlobal("base64") as HostRuntimeApi["base64"],
      crypto: readGlobal("crypto") as HostRuntimeApi["crypto"],
      uuidv4: readGlobal("uuidv4") as HostRuntimeApi["uuidv4"],
      Temporal: (globalThis as Record<string, unknown>).Temporal as HostRuntimeApi["Temporal"],
      Intl: Intl as HostRuntimeApi["Intl"],
    };
    writeGlobal("__web", bus);
  }
}

// 副作用入口：import 即安装默认配置。
installNodePolyfill();
