/**
 * Breeze 运行时类型声明统一入口。
 */

export * from "./base64.js";
export * from "./bridge.js";
export * from "./buffer.js";
export * from "./crypto.js";
export * from "./fs.js";
export * from "./native.js";
export * from "./runtime.js";
export * from "./type.js";

// breeze-html 通过全局声明暴露，不额外导出具体类型。
export type {
  BreezeApi,
  BreezeDocument,
  BreezeHtmlStatic,
  BreezeSelection,
  Cheerio,
  CheerioAPI,
} from "./breeze-html.js";
