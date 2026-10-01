# breeze-plugin-kit

Breeze 插件开发工具包，提供运行时 API 类型声明与常用工具函数。

插件开发相关文档请参阅：https://deretame.github.io/plugin-dev-docs/

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

## 开发

```bash
pnpm install
pnpm run typecheck
pnpm run build
```
