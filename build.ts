#!/usr/bin/env node
/**
 * @breeze/plugin-kit 构建脚本
 *
 * 作用：
 * 1. 清理旧的 dist 目录
 * 2. 使用 tsconfig.build.json 编译 TypeScript
 * 3. 把 src/types 下的 .d.ts 声明文件复制到 dist/types
 *
 * 用法：
 *   pnpm build
 * 或
 *   tsx build.ts
 */

import { cpSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

function reportDiagnostics(diagnostics: readonly ts.Diagnostic[]): void {
  for (const diagnostic of diagnostics) {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start!,
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n",
      );
      console.error(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`,
      );
    } else {
      console.error(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      );
    }
  }
}

function compile(): void {
  const configPath = resolve(ROOT, "tsconfig.build.json");
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    reportDiagnostics([configFile.error]);
    process.exit(1);
  }

  const parsed = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    ROOT,
  );

  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const emitResult = program.emit();
  const diagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  reportDiagnostics(diagnostics);

  if (emitResult.emitSkipped || diagnostics.length > 0) {
    process.exit(1);
  }
}

function main(): void {
  // 1. 清理旧产物
  const distPath = resolve(ROOT, "dist");
  if (existsSync(distPath)) {
    console.log("Cleaning dist...");
    rmSync(distPath, { recursive: true, force: true });
  }

  // 2. 编译 TypeScript
  console.log("Compiling TypeScript...");
  compile();

  // 3. 复制类型声明文件（src/types 里的 .d.ts 不通过 tsc 输出，需要手动复制）
  console.log("Copying type declarations...");
  cpSync(resolve(ROOT, "src/types"), resolve(ROOT, "dist/types"), {
    recursive: true,
    force: true,
  });

  console.log("Build succeeded.");
}

main();
