/**
 * @breeze/plugin-kit
 *
 * Breeze 插件开发工具包：提供运行时 API 类型声明与常用工具函数。
 */

// 运行时 API 封装（含 hostRuntime、getApi、requireApi 等）
export * from "./runtime-api.js";

// 插件常用工具函数（cache、pluginConfig、runtime、opencc、flutterTools）
export * from "./tools.js";

// Breeze 运行时类型声明统一入口
export type * from "./types/index.js";
