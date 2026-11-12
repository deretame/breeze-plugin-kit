/**
 * 域名前置（IP 直连）与网络测量相关的运行时 API。
 *
 * 运行时注入 `fronting` 对象（`setHosts` / `getHosts` / `clearHosts` / `probe`），
 * 参数与返回值都是普通对象，不需要自己拼 JSON。
 *
 * 推荐通过 `breeze-plugin-kit` 的封装使用（`setFrontHosts` / `probeFrontHosts` 等），
 * 它补上了默认值与排序工具，并在运行时对象缺失时返回 `{ ok: false }` 而不是抛错。
 *
 * 完整说明见文档「域名前置与网络测量」。
 */

/** 前置表：域名 -> IP 字面量列表（IPv6 裸写或 `[...]` 均可）。 */
export type FrontHostTable = Record<string, string[]>;

/** `fronting.setHosts` 的返回值。 */
export interface SetFrontHostsResult {
  ok: boolean;
  /** 写入后表里的域名数量。 */
  hosts?: number;
  /** 写入后表里的 IP 总数。 */
  ips?: number;
  /** 被拒绝的条目数（非 IP 字面量或当前策略不允许的地址）。 */
  rejected?: number;
  /** 当前是否放行内网 / 保留地址（跟随「内网拦截」设置）。 */
  allowPrivateNetwork?: boolean;
  error?: string;
}

/** 前置表里单个 IP 的健康状态。 */
export interface FrontHostEntry {
  ip: string;
  /** 最近一次连接是否成功；`false` 表示处于 5 分钟冷却中。 */
  healthy: boolean;
}

/** `fronting.getHosts` 的返回值。 */
export interface GetFrontHostsResult {
  ok: boolean;
  hosts: Record<string, FrontHostEntry[]>;
  error?: string;
}

/** `fronting.clearHosts` 的返回值。 */
export interface ClearFrontHostsResult {
  ok: boolean;
  error?: string;
}

/** `fronting.probe` 的请求参数。 */
export interface ProbeFrontHostsPayload {
  /** 目标域名，用于 `Host` 头；不接受 IP、端口、路径、单标签主机与 `localhost`。 */
  host: string;
  /**
   * 候选 IP。
   *
   * 省略时测前置表里该 host 的全部 IP；显式给出时**不需要先写进表**，
   * 可以先测再写回最优结果。最多 32 个。
   */
  ips?: string[];
  /** 探测协议，决定端口（443 / 80），默认 `"https"`。 */
  scheme?: "http" | "https";
  /** 单个采样超时，默认 `3000`，范围 500 ~ 10000。 */
  timeoutMs?: number;
  /** 批次内并发，默认 `4`，范围 1 ~ 4。 */
  concurrency?: number;
  /** 每个 IP 的采样次数，默认 `1`，范围 1 ~ 3。 */
  samples?: number;
}

/** `fronting.probe` 的选项。 */
export interface ProbeFrontHostsOptions {
  /** 取消探测；被取消时返回 `{ ok: false, canceled: true }`。 */
  signal?: AbortSignal;
}

/** 单个 IP 的探测失败原因。 */
export type ProbeFrontHostItemError =
  | "timeout"
  | "connect"
  | "request"
  | "other"
  | "busy"
  | "batch-timeout";

/** 单个 IP 的探测结果。 */
export interface ProbeFrontHostResult {
  ip: string;
  /** 收到过至少一次 HTTP 响应（任何状态码都算可达）。 */
  ok: boolean;
  /** 第一次成功响应的状态码。 */
  status: number | null;
  /** 最快一次采样的耗时（建连 + 握手 + 服务端处理 + 首字节）。 */
  ttfbMs: number | null;
  /** 成功采样的平均耗时。 */
  avgMs: number | null;
  /** 每次成功采样的耗时明细。 */
  samplesMs: number[];
  /** 实际发出的采样次数。 */
  samplesSent: number;
  /** 成功的采样次数。 */
  samplesReceived: number;
  /** `(samplesSent - samplesReceived) / samplesSent`，0 ~ 1，保留两位小数。 */
  lossRate: number;
  error: ProbeFrontHostItemError | null;
}

/** 整批探测的失败原因。 */
export type ProbeFrontHostsError =
  | "invalid-json"
  | "invalid-host"
  | "invalid-scheme"
  | "invalid-ip"
  | "host-not-registered"
  | "no-ips"
  | "too-many-ips"
  | "probe-busy"
  | "probe-rate-limited"
  | "client-build-failed"
  | "request-was-canceled"
  | "request-execution-cancelled";

/** `fronting.probe` 的返回值。 */
export interface ProbeFrontHostsResult {
  ok: boolean;
  host?: string;
  scheme?: "http" | "https";
  /** 顺序与请求的 `ips` 一致。 */
  results?: ProbeFrontHostResult[];
  error?: ProbeFrontHostsError | (string & {});
  /** `probe-rate-limited` 时建议等待的毫秒数。 */
  retryAfterMs?: number;
  /** 被取消时为 `true`。 */
  canceled?: boolean;
  /** `invalid-ip` 时回显的非法 IP。 */
  ip?: string;
}

/** ECH 域名表里单个域名的配置。 */
export interface EchHostEntry {
  /** 钉死的 IP；省略时宿主用 DoH 的 `ipv4hint`。 */
  ips?: string[];
  /** ECHConfigList（base64）；省略时宿主用 DoH 的 `ech` 参数。 */
  ech?: string;
}

/**
 * ECH（Encrypted Client Hello）域名表。
 *
 * 值可以是 `{ ips?, ech? }`，也可以直接给 IP 数组。
 * 两者都省略时宿主自己用 DoH 查 `HTTPS`(type 65) 记录补齐。
 */
export type EchHostTable = Record<string, EchHostEntry | string[]>;

/** `fronting.setEchHosts` 的返回值。 */
export interface SetEchHostsResult {
  ok: boolean;
  hosts?: number;
  ips?: number;
  rejected?: number;
  allowPrivateNetwork?: boolean;
  error?: string;
}

/** `fronting.getEchHosts` 的返回值。 */
export interface GetEchHostsResult {
  ok: boolean;
  hosts: Record<string, { ips: string[]; ech: boolean; fresh: boolean }>;
  error?: string;
}

/** `fronting.clearEchHosts` 的返回值。 */
export interface ClearEchHostsResult {
  ok: boolean;
  error?: string;
}

/** 运行时注入的 `fronting` 对象。 */
export interface FrontingApi {
  /** 下发前置表；传空对象等于关闭前置。 */
  setHosts(table: FrontHostTable): SetFrontHostsResult;
  /** 读回前置表与每个 IP 的健康状态。 */
  getHosts(): GetFrontHostsResult;
  /** 清空前置表（等于关闭前置）。 */
  clearHosts(): ClearFrontHostsResult;
  /** 探测一组 IP 到目标域名的延迟。 */
  probe(
    payload: ProbeFrontHostsPayload,
    options?: ProbeFrontHostsOptions,
  ): Promise<ProbeFrontHostsResult>;
  /** 登记走 ECH（加密 SNI）的域名；传空对象等于关闭。 */
  setEchHosts(table: EchHostTable): SetEchHostsResult;
  /** 读回 ECH 表。 */
  getEchHosts(): GetEchHostsResult;
  /** 清空 ECH 表。 */
  clearEchHosts(): ClearEchHostsResult;
}

/**
 * `Response.hostMeta`：宿主对这次请求的测量结果（非标准扩展）。
 *
 * 宿主只测量、不做优选，插件可以据此做被动测速或归因。
 */
export interface HostMeta {
  /** 前置表下发的目标 IP；未走前置时 `null`。 */
  ip: string | null;
  /** 前置目标域名；未走前置时 `null`。 */
  host: string | null;
  /**
   * 实际 TCP 对端 IP：未前置时是 DNS 解析结果，走代理时是代理地址，
   * 非 TCP 传输（unix socket / 命名管道）时为 `null`。
   */
  peerIp: string | null;
  /** 响应体字节数。 */
  bytes: number;
  /** 发出请求 → 收到响应头（含建连、握手、服务端处理、首字节）。 */
  ttfbMs: number;
  /** 响应头 → body 读完。 */
  bodyMs: number;
}

declare global {
  /** 域名前置（IP 直连）与延迟探测。由宿主注入。 */
  var fronting: FrontingApi;

  /**
   * 宿主侧请求测量信息。
   *
   * `fetch` 产生的响应总是带这个字段；非 `fetch` 构造的 `Response`
   * （如 `Response.json()`）为 `null`。
   */
  interface Response {
    hostMeta: HostMeta | null;
  }
}
