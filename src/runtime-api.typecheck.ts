import { getApi, requireApi, requireCryptoLike } from "./runtime-api.js";
import {
  clearEchHosts,
  clearFrontHosts,
  getEchHosts,
  getFrontHosts,
  pickBestFrontIps,
  probeFrontHosts,
  rankFrontHosts,
  setEchHosts,
  setFrontHosts,
} from "./fronting.js";
import type { Buffer } from "./types/buffer.js";
import type {
  ClearEchHostsResult,
  ClearFrontHostsResult,
  FrontingApi,
  GetEchHostsResult,
  GetFrontHostsResult,
  HostMeta,
  ProbeFrontHostResult,
  ProbeFrontHostsResult,
  SetEchHostsResult,
  SetFrontHostsResult,
} from "./types/index.js";

function expectType<T>(_value: T): void {}

const base64 = requireApi("base64");
expectType<string>(base64.encode(new Uint8Array([1, 2, 3])));
expectType<Uint8Array>(base64.decode("AQID"));
expectType<string>(bytesToBase64(new Uint8Array([1, 2, 3])));
expectType<Uint8Array>(bytesFromBase64("AQID"));

const maybeNative = getApi("native");
expectType<Promise<number> | undefined>(maybeNative?.put(new Uint8Array([1])));

const native = requireApi("native");
expectType<Promise<Uint8Array>>(
  native.chain(["invert"], new Uint8Array([1, 2, 3])),
);

const bridge = requireApi("bridge");
expectType<Promise<unknown>>(bridge.call("math.add", 1, 2));

const crypto = requireCryptoLike();
expectType<string>(crypto.createHash("sha1").digest("hex"));
expectType<string>(crypto.createHash("sha-256").digest("hex"));
expectType<string>(crypto.createHash("sha512").digest("hex"));
expectType<string>(crypto.createHmac("sha256", "key").digest("hex"));
expectType<Buffer>(crypto.randomBytes(16));
expectType<string>(crypto.randomUUID());
expectType<boolean>(crypto.timingSafeEqual("a", "b"));
expectType<Promise<string>>(crypto.md5("hello"));
expectType<Promise<string>>(crypto.sha256("hello"));
expectType<Promise<string>>(crypto.hmacSha256("key", "hello"));
expectType<Promise<Uint8Array>>(crypto.aesEcbPkcs7Encrypt("hello", "key"));
expectType<Promise<Uint8Array>>(
  crypto.aesCbcPkcs7Encrypt("hello", "key", "iv"),
);

expectType<FrontingApi>(fronting);
expectType<SetFrontHostsResult>(fronting.setHosts({ "example.com": ["1.2.3.4"] }));
expectType<SetFrontHostsResult>(
  setFrontHosts({ "example.com": ["1.2.3.4"] }),
);
expectType<GetFrontHostsResult>(getFrontHosts());
expectType<ClearFrontHostsResult>(clearFrontHosts());
expectType<Promise<ProbeFrontHostsResult>>(
  probeFrontHosts({ host: "example.com", ips: ["1.2.3.4"], samples: 2 }),
);
expectType<ProbeFrontHostResult[]>(rankFrontHosts({ ok: true }));
expectType<SetEchHostsResult>(setEchHosts({ "picaapi.part26.art": {} }));
expectType<SetEchHostsResult>(
  setEchHosts({ "picaapi.part26.art": { ips: ["104.21.86.93"] } }),
);
expectType<GetEchHostsResult>(getEchHosts());
expectType<ClearEchHostsResult>(clearEchHosts());
expectType<string[]>(pickBestFrontIps({ ok: true }, { limit: 2 }));
expectType<HostMeta | null>(new Response().hostMeta);
