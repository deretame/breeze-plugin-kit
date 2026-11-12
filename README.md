# breeze-plugin-kit

Breeze 插件开发工具包，提供运行时 API 类型声明与常用工具函数。

插件开发相关文档请参阅：https://breeze-project-org.github.io/plugin-dev-docs/

## 安装

```bash
pnpm add breeze-plugin-kit
```

## 内容

- **类型声明**：Breeze 运行时 API（`bridge`、`crypto`、`native` 等）与插件契约类型（`InfoContract`、`SearchResultContract`、`ComicDetailContract` 等）。`fs` 仅有类型声明，运行时不会注入。
- **工具函数**：
  - `cache` — 进程内缓存
  - `pluginConfig` — 持久化配置存储
  - `authConfig` — 带编解码的持久化配置读写，登录 helper（`readLoginValues` / `buildLoginBundle` / `buildUnauthorizedError`）
  - `runtime` — 运行时工具（gc、任务取消检查等）
  - `opencc` — 简繁转换
  - `flutterTools` — Flutter 宿主交互（获取版本、Toast 等）
  - `setFrontHosts` / `getFrontHosts` / `clearFrontHosts` / `probeFrontHosts` / `rankFrontHosts` — 域名前置（IP 直连）与延迟探测
  - `setEchHosts` / `getEchHosts` / `clearEchHosts` — ECH（加密 SNI），适合必须看 SNI 的 Cloudflare 站点

## 使用示例

```ts
import type { InfoContract } from "breeze-plugin-kit";
import { cache, pluginConfig } from "breeze-plugin-kit";

async function init() {
  await cache.set("key", { value: 1 });
  const data = await cache.get<{ value: number }>("key", { value: 0 });

  await pluginConfig.save("site", "example");
}
```

域名前置（IP 直连）与延迟探测：

```ts
import {
  pickBestFrontIps,
  probeFrontHosts,
  setFrontHosts,
} from "breeze-plugin-kit";

setFrontHosts({ "e-hentai.org": ["172.66.132.196"] });

const report = await probeFrontHosts({
  host: "e-hentai.org",
  ips: ["172.66.132.196", "172.66.140.62"],
  samples: 2,
});
const best = pickBestFrontIps(report);
if (best.length > 0) setFrontHosts({ "e-hentai.org": best });
```

`fetch` 响应上的 `res.hostMeta` 提供本次请求的实际 IP 与分段耗时（`ip` / `host` / `peerIp` / `bytes` / `ttfbMs` / `bodyMs`），可用于被动测速。

## 开发

```bash
pnpm install
pnpm run typecheck
pnpm run build
```
