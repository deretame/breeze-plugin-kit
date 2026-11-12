#!/usr/bin/env node
/**
 * @breeze/plugin-kit 构建脚本
 *
 * 作用：
 * 1. 清理旧的 dist 目录
 * 2. 用 tsc 编译（tsconfig.build.json）
 * 3. 把 src/types 下的 .d.ts 声明文件复制到 dist/types
 *
 * 注意：TypeScript 7 不再暴露 JS 编译器 API（`ts.createProgram` 等），
 * 所以这里走 tsc CLI，而不是在脚本里 `import * as ts from "typescript"`。
 *
 * 用法：
 *   pnpm build
 * 或
 *   tsx build.ts
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(ROOT, "dist");
const TSC = resolve(ROOT, "node_modules/typescript/bin/tsc");

function compile(): void {
  if (!existsSync(TSC)) {
    console.error(`找不到 tsc：${TSC}`);
    console.error("先执行 pnpm install。");
    process.exit(1);
  }

  const result = spawnSync(
    process.execPath,
    [TSC, "-p", "tsconfig.build.json"],
    { cwd: ROOT, stdio: "inherit" },
  );

  if (result.error) {
    console.error(`tsc 启动失败：${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main(): void {
  // 1. 清理旧产物
  if (existsSync(DIST)) {
    console.log("Cleaning dist...");
    rmSync(DIST, { recursive: true, force: true });
  }

  // 2. 编译 TypeScript
  console.log("Compiling TypeScript...");
  compile();

  // 3. 复制类型声明文件（src/types 里的 .d.ts 不通过 tsc 输出，需要手动复制）
  console.log("Copying type declarations...");
  cpSync(resolve(ROOT, "src/types"), resolve(DIST, "types"), {
    recursive: true,
    force: true,
  });

  console.log("Build succeeded.");
}

main();
