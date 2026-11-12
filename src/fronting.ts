/**
 * 域名前置（IP 直连）与延迟探测的封装。
 *
 * 宿主优先暴露 `fronting` 对象（`setHosts` / `getHosts` / `clearHosts` / `probe`）；
 * 早期构建只有内部 `__http_*` 函数，这里做兼容，调用方不需要关心是哪一种。
 *
 * 宿主两者都没有时返回 `{ ok: false, error: "fronting-unsupported" }`，不抛错。
 *
 * 完整语义见文档「域名前置与网络测量」。
 */

import type {
  ClearEchHostsResult,
  ClearFrontHostsResult,
  EchHostTable,
  FrontHostTable,
  FrontingApi,
  GetEchHostsResult,
  GetFrontHostsResult,
  ProbeFrontHostsOptions,
  ProbeFrontHostsPayload,
  ProbeFrontHostResult,
  ProbeFrontHostsResult,
  SetEchHostsResult,
  SetFrontHostsResult,
} from "./types/index.js";

export type { ProbeFrontHostsOptions } from "./types/index.js";

/** 宿主未提供前置能力时的错误码。 */
export const FRONTING_UNSUPPORTED = "fronting-unsupported";

const INVALID_HOST_RESPONSE = "invalid-host-response";

type FrontingGlobal = Partial<FrontingApi>;

type LegacyFrontingGlobals = {
  __http_set_front_hosts?: (payloadJson: string) => string;
  __http_get_front_hosts?: () => string;
  __http_clear_front_hosts?: () => string;
  __http_probe_front_hosts?: (payloadJson: string) => Promise<string>;
  __http_set_ech_hosts?: (payloadJson: string) => string;
  __http_get_ech_hosts?: () => string;
  __http_clear_ech_hosts?: () => string;
  __http_request_cancel?: (id: number) => string;
};

function runtimeFronting(): FrontingGlobal | undefined {
  const value = (globalThis as { fronting?: FrontingGlobal }).fronting;
  return value && typeof value === "object" ? value : undefined;
}

function legacyGlobals(): LegacyFrontingGlobals {
  return globalThis as LegacyFrontingGlobals;
}

function parseHostJson<T>(raw: unknown, fallback: T): T {
  try {
    const parsed: unknown = JSON.parse(String(raw ?? ""));
    if (!parsed || typeof parsed !== "object") return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

/**
 * 下发前置表。
 *
 * - 键是域名（`https://` 前缀与结尾 `/` 会被忽略，大小写不敏感）；
 * - 值必须是 IP 字面量，IPv6 支持裸写与 `[...]` 写法；
 * - 打开「内网拦截」后，内网 / 保留地址会在写入时被拒绝；
 * - 传空对象等于关闭前置。
 *
 * @example
 * ```ts
 * setFrontHosts({ "e-hentai.org": ["172.66.132.196"] });
 * ```
 */
export function setFrontHosts(table: FrontHostTable): SetFrontHostsResult {
  const api = runtimeFronting();
  if (typeof api?.setHosts === "function") {
    return api.setHosts(table ?? {});
  }
  const fn = legacyGlobals().__http_set_front_hosts;
  if (typeof fn !== "function") {
    return { ok: false, error: FRONTING_UNSUPPORTED };
  }
  return parseHostJson<SetFrontHostsResult>(fn(JSON.stringify(table ?? {})), {
    ok: false,
    error: INVALID_HOST_RESPONSE,
  });
}

/**
 * 读回当前前置表与每个 IP 的健康状态。
 *
 * `healthy: false` 表示该 IP 最近一次连接失败，宿主 5 分钟内不会再选它。
 */
export function getFrontHosts(): GetFrontHostsResult {
  const api = runtimeFronting();
  if (typeof api?.getHosts === "function") {
    return api.getHosts();
  }
  const fn = legacyGlobals().__http_get_front_hosts;
  if (typeof fn !== "function") {
    return { ok: false, hosts: {}, error: FRONTING_UNSUPPORTED };
  }
  return parseHostJson<GetFrontHostsResult>(fn(), {
    ok: false,
    hosts: {},
    error: INVALID_HOST_RESPONSE,
  });
}

/** 清空前置表（等于关闭前置）。 */
export function clearFrontHosts(): ClearFrontHostsResult {
  const api = runtimeFronting();
  if (typeof api?.clearHosts === "function") {
    return api.clearHosts();
  }
  const fn = legacyGlobals().__http_clear_front_hosts;
  if (typeof fn !== "function") {
    return { ok: false, error: FRONTING_UNSUPPORTED };
  }
  return parseHostJson<ClearFrontHostsResult>(fn(), {
    ok: false,
    error: INVALID_HOST_RESPONSE,
  });
}

/**
 * 登记走 ECH（Encrypted Client Hello）的域名。
 *
 * 与 `setFrontHosts` 的区别：ECH 保持域名 URL、SNI 加密（外层是 ECHConfig 的
 * `public_name`），适合「必须看 SNI」的 Cloudflare 站点；前置则是「不发 SNI + Host 头」。
 *
 * `ips` / `ech` 都可以省略，宿主会用 DoH 查 `HTTPS`(type 65) 记录补齐。
 *
 * @example
 * ```ts
 * setEchHosts({ "picaapi.part26.art": {} });
 * ```
 */
export function setEchHosts(table: EchHostTable): SetEchHostsResult {
  const api = runtimeFronting();
  if (typeof api?.setEchHosts === "function") {
    return api.setEchHosts(table ?? {});
  }
  const fn = legacyGlobals().__http_set_ech_hosts;
  if (typeof fn !== "function") {
    return { ok: false, error: FRONTING_UNSUPPORTED };
  }
  return parseHostJson<SetEchHostsResult>(fn(JSON.stringify(table ?? {})), {
    ok: false,
    error: INVALID_HOST_RESPONSE,
  });
}

/** 读回当前 ECH 表。 */
export function getEchHosts(): GetEchHostsResult {
  const api = runtimeFronting();
  if (typeof api?.getEchHosts === "function") {
    return api.getEchHosts();
  }
  const fn = legacyGlobals().__http_get_ech_hosts;
  if (typeof fn !== "function") {
    return { ok: false, hosts: {}, error: FRONTING_UNSUPPORTED };
  }
  return parseHostJson<GetEchHostsResult>(fn(), {
    ok: false,
    hosts: {},
    error: INVALID_HOST_RESPONSE,
  });
}

/** 清空 ECH 表。 */
export function clearEchHosts(): ClearEchHostsResult {
  const api = runtimeFronting();
  if (typeof api?.clearEchHosts === "function") {
    return api.clearEchHosts();
  }
  const fn = legacyGlobals().__http_clear_ech_hosts;
  if (typeof fn !== "function") {
    return { ok: false, error: FRONTING_UNSUPPORTED };
  }
  return parseHostJson<ClearEchHostsResult>(fn(), {
    ok: false,
    error: INVALID_HOST_RESPONSE,
  });
}

/**
 * 探测一组 IP 到目标域名的延迟。
 *
 * 宿主对每个 IP 发 `HEAD` 请求（新连接、不读 body、端口与路径固定），
 * 返回 `ttfbMs` / `avgMs` / 采样明细与丢包率。显式传入 `ips` 时不需要
 * 先写进前置表，可以「先测再写回最优」。
 *
 * 限流按插件隔离：4 个并发采样、2 个并发批次、批次令牌桶容量 2
 * （每 5 秒补 1）。超限返回 `probe-busy` / `probe-rate-limited`。
 *
 * @example
 * ```ts
 * const report = await probeFrontHosts({ host: "e-hentai.org", ips: candidates });
 * const best = pickBestFrontIps(report);
 * if (best.length > 0) setFrontHosts({ "e-hentai.org": best });
 * ```
 */
export async function probeFrontHosts(
  payload: ProbeFrontHostsPayload,
  options: ProbeFrontHostsOptions = {},
): Promise<ProbeFrontHostsResult> {
  const api = runtimeFronting();
  if (typeof api?.probe === "function") {
    return api.probe(payload, options);
  }

  const globals = legacyGlobals();
  const fn = globals.__http_probe_front_hosts;
  if (typeof fn !== "function") {
    return { ok: false, error: FRONTING_UNSUPPORTED };
  }
  if (options.signal?.aborted) {
    return { ok: false, canceled: true, error: "request-was-canceled" };
  }

  let promise: Promise<string>;
  try {
    promise = fn(JSON.stringify(payload ?? {}));
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error) };
  }
  if (!promise || typeof promise.then !== "function") {
    return parseHostJson<ProbeFrontHostsResult>(promise, {
      ok: false,
      error: INVALID_HOST_RESPONSE,
    });
  }

  // 取消通道与普通请求共用：Promise 上带 __hostRequestId。
  const requestId = Number((promise as Promise<string> & { __hostRequestId?: number }).__hostRequestId);
  const cancel = globals.__http_request_cancel;
  const canCancel =
    Number.isFinite(requestId) && requestId > 0 && typeof cancel === "function";

  let onAbort: (() => void) | null = null;
  if (canCancel && options.signal) {
    onAbort = () => {
      try {
        cancel(requestId);
      } catch {
        // 取消失败只影响响应速度，不影响结果正确性。
      }
    };
    options.signal.addEventListener("abort", onAbort);
  }

  const cleanup = () => {
    if (onAbort && options.signal) {
      options.signal.removeEventListener("abort", onAbort);
    }
  };

  try {
    return parseHostJson<ProbeFrontHostsResult>(await promise, {
      ok: false,
      error: INVALID_HOST_RESPONSE,
    });
  } catch (error) {
    return { ok: false, error: String((error as Error)?.message ?? error) };
  } finally {
    cleanup();
  }
}

export interface RankFrontHostsOptions {
  /** 允许的最大丢包率，默认 `0.34`。 */
  maxLossRate?: number;
  /** 返回前几个，默认 `3`。 */
  limit?: number;
  /** 排序依据，默认 `"avgMs"`（缺失时回退到 `ttfbMs`）。 */
  by?: "avgMs" | "ttfbMs";
}

function probeScore(
  item: ProbeFrontHostResult,
  by: "avgMs" | "ttfbMs",
): number {
  if (by === "ttfbMs") return item.ttfbMs ?? Number.POSITIVE_INFINITY;
  return item.avgMs ?? item.ttfbMs ?? Number.POSITIVE_INFINITY;
}

/**
 * 从探测结果里挑出可用的 IP，按延迟升序排列。
 *
 * 过滤条件：`ok === true` 且 `lossRate <= maxLossRate`。
 */
export function rankFrontHosts(
  report: ProbeFrontHostsResult,
  options: RankFrontHostsOptions = {},
): ProbeFrontHostResult[] {
  const { maxLossRate = 0.34, limit = 3, by = "avgMs" } = options;
  return (report.results ?? [])
    .filter((item) => item.ok && item.lossRate <= maxLossRate)
    .sort((a, b) => probeScore(a, by) - probeScore(b, by))
    .slice(0, Math.max(0, limit));
}

/** `rankFrontHosts` 的便捷版：只要 IP 字符串。 */
export function pickBestFrontIps(
  report: ProbeFrontHostsResult,
  options: RankFrontHostsOptions = {},
): string[] {
  return rankFrontHosts(report, options).map((item) => item.ip);
}
