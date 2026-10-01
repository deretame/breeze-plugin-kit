import type {
  LoginBundleContract,
  LoginField,
  LoginSubmitPayload,
  StringMap,
  UnauthorizedErrorPayload,
} from "./types/index.js";
import { pluginConfig } from "./tools.js";

type StringMapLike = Record<string, unknown>;

function asRecord(value: unknown): StringMapLike {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StringMapLike;
  }
  return {};
}

function decodeConfigString(raw: unknown, fallback = ""): string {
  if (raw === undefined || raw === null) {
    return fallback;
  }
  if (typeof raw === "object") {
    const map = raw as StringMapLike;
    if (map.ok === true && "value" in map) {
      return decodeConfigString(map.value, fallback);
    }
    return fallback;
  }
  const text = String(raw);
  if (!text.trim()) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(text.trim());
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as StringMapLike).ok === true &&
      "value" in (parsed as StringMapLike)
    ) {
      return decodeConfigString((parsed as StringMapLike).value, fallback);
    }
    if (
      typeof parsed === "string" ||
      typeof parsed === "number" ||
      typeof parsed === "boolean"
    ) {
      return String(parsed);
    }
  } catch {
    // 使用原文
  }
  return text;
}

/**
 * 登录表单值提取：读 `core.values` 中的表单值。
 */
export function readLoginValues(
  payload: LoginSubmitPayload = {},
): Record<string, string> {
  const merged = {
    ...asRecord(payload.values),
  };
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(merged)) {
    if (key === "values" || key === "extern") {
      continue;
    }
    result[key] = decodeConfigString(value, "");
  }
  return result;
}

/**
 * 构造登录表单 bundle，宿主按 scheme 渲染输入框。
 */
export type LoginBundleInit = {
  title: string;
  fields: LoginField[];
  submitFnPath: string;
  submitText?: string;
  values?: StringMap;
};

export function buildLoginBundle(
  source: string,
  init: LoginBundleInit,
): LoginBundleContract {
  return {
    source,
    scheme: {
      version: "1.0.0",
      type: "login",
      title: init.title,
      fields: init.fields,
      action: {
        fnPath: init.submitFnPath,
        submitText: init.submitText ?? "登录",
      },
    },
    data: {
      values: init.values ?? {},
    },
  };
}

/**
 * 抛给宿主的 need-login 错误：只带插件身份与提示文案。
 * 宿主确认登录后调 getLoginBundle 现取表单。
 */
export function buildUnauthorizedError(
  source: string,
  message = "登录过期，请重新登录",
): Error {
  const payload: UnauthorizedErrorPayload = {
    type: "unauthorized",
    source,
    message,
  };
  return new Error(JSON.stringify(payload));
}

/**
 * 带 JSON 编解码的持久化配置读写（pluginConfig.load 返回 ok 信封）。
 * 存取账号密码等字符串时无需手写 JSON.parse / JSON.stringify。
 */
export const authConfig = {
  async load(key: string, fallback = ""): Promise<string> {
    const raw = await pluginConfig.load(key, JSON.stringify(fallback));
    try {
      if (raw && typeof raw === "object") {
        const map = raw as StringMapLike;
        if (map.ok === true && "value" in map) {
          return decodeConfigString(map.value, fallback);
        }
      }
      const decoded = JSON.parse(String(raw));
      if (decoded && typeof decoded === "object" && decoded.ok === true) {
        return decodeConfigString(decoded.value, fallback);
      }
    } catch {
      // 回退到原文
    }
    return decodeConfigString(raw, fallback);
  },

  async save(key: string, value: string): Promise<void> {
    await pluginConfig.save(key, decodeConfigString(value, ""));
  },
};
