/**
 * Breeze 时间向 Intl 类型。
 *
 * 对应宿主：
 * - `js/07_intl.js`
 * - `src/web_runtime/intl.rs`（jiff 时区 + ICU4X locale 格式化）
 *
 * 已实现：
 * - `Intl.DateTimeFormat`（format / formatToParts / resolvedOptions）
 * - `Intl.DateTimeFormat.supportedLocalesOf`（最小实现）
 * - `Intl.supportedValuesOf("timeZone" | "calendar")`
 * - `Intl.getCanonicalLocales`（最小实现）
 * - `Date.prototype.toLocaleString` / `toLocaleDateString` / `toLocaleTimeString`
 *
 * 未实现：Collator / NumberFormat / 货币 / 排序 / 其它非时间 Intl；
 * 非公历日历完整语义不保证。
 */

/// <reference lib="es2020.intl" />
/// <reference lib="es2021.intl" />

export {}

declare global {
  namespace Intl {
    /**
     * Breeze 已实现 `supportedValuesOf` 的 key。
     * 其它 key（currency / collation / unit / numberingSystem 等）运行时会抛错。
     */
    type BreezeSupportedValuesOfKey = 'timeZone' | 'calendar'

    /**
     * Breeze 推荐用于日期显示的日历 id。
     * 非 `iso8601` / `gregory` 不保证运算与 format 路径完全正确。
     */
    type BreezeCalendarId =
      | 'iso8601'
      | 'gregory'
      | 'buddhist'
      | 'chinese'
      | 'coptic'
      | 'dangi'
      | 'ethioaa'
      | 'ethiopic'
      | 'hebrew'
      | 'indian'
      | 'islamic'
      | 'islamic-civil'
      | 'islamic-rgsa'
      | 'islamic-tbla'
      | 'islamic-umalqura'
      | 'japanese'
      | 'persian'
      | 'roc'
      | (string & {})

    /**
     * 时间向 DateTimeFormat 选项。
     *
     * 运行时行为：
     * - `dateStyle` / `timeStyle` 与字段选项（含 `timeZoneName`）互斥，否则抛 TypeError
     * - 支持 lone option（如仅 `{ year: "numeric" }`）
     * - `hourCycle: "h24"` 午夜小时为 24
     * - 时区支持 IANA 与固定 offset（如 `+00:00`）；常见 link 会 canonicalize
     */
    interface DateTimeFormatOptions {
      localeMatcher?: 'lookup' | 'best fit' | undefined
      weekday?: 'long' | 'short' | 'narrow' | undefined
      era?: 'long' | 'short' | 'narrow' | undefined
      year?: 'numeric' | '2-digit' | undefined
      month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow' | undefined
      day?: 'numeric' | '2-digit' | undefined
      hour?: 'numeric' | '2-digit' | undefined
      minute?: 'numeric' | '2-digit' | undefined
      second?: 'numeric' | '2-digit' | undefined
      timeZoneName?:
        | 'short'
        | 'long'
        | 'shortOffset'
        | 'longOffset'
        | 'shortGeneric'
        | 'longGeneric'
        | undefined
      formatMatcher?: 'basic' | 'best fit' | undefined
      hour12?: boolean | undefined
      /** Breeze 支持 `h11` / `h12` / `h23` / `h24`（h24 午夜为 24）。 */
      hourCycle?: 'h11' | 'h12' | 'h23' | 'h24' | undefined
      /** IANA 名或固定 offset（如 `Asia/Shanghai`、`+00:00`）。 */
      timeZone?: string | undefined
      /** 推荐 `iso8601` / `gregory`。 */
      calendar?: BreezeCalendarId | undefined
      numberingSystem?: string | undefined
      dateStyle?: 'full' | 'long' | 'medium' | 'short' | undefined
      timeStyle?: 'full' | 'long' | 'medium' | 'short' | undefined
      dayPeriod?: 'narrow' | 'short' | 'long' | undefined
      fractionalSecondDigits?: 1 | 2 | 3 | undefined
    }

    interface ResolvedDateTimeFormatOptions {
      locale: string
      calendar: string
      numberingSystem: string
      timeZone: string
      hourCycle?: 'h11' | 'h12' | 'h23' | 'h24'
      hour12?: boolean
      weekday?: 'long' | 'short' | 'narrow'
      era?: 'long' | 'short' | 'narrow'
      year?: 'numeric' | '2-digit'
      month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
      day?: 'numeric' | '2-digit'
      hour?: 'numeric' | '2-digit'
      minute?: 'numeric' | '2-digit'
      second?: 'numeric' | '2-digit'
      timeZoneName?:
        | 'short'
        | 'long'
        | 'shortOffset'
        | 'longOffset'
        | 'shortGeneric'
        | 'longGeneric'
      dateStyle?: 'full' | 'long' | 'medium' | 'short'
      timeStyle?: 'full' | 'long' | 'medium' | 'short'
      dayPeriod?: 'narrow' | 'short' | 'long'
      fractionalSecondDigits?: 1 | 2 | 3
    }

    type DateTimeFormatPartTypes =
      | 'day'
      | 'dayPeriod'
      | 'era'
      | 'fractionalSecond'
      | 'hour'
      | 'literal'
      | 'minute'
      | 'month'
      | 'relatedYear'
      | 'second'
      | 'timeZoneName'
      | 'weekday'
      | 'year'
      | 'yearName'
      | 'unknown'

    interface DateTimeFormatPart {
      type: DateTimeFormatPartTypes
      value: string
    }

    /**
     * Breeze 时间向 `Intl.DateTimeFormat`。
     * 宿主有实现：`format` / `formatToParts` / `resolvedOptions`。
     * `formatRange` / `formatRangeToParts` 可能不存在，勿依赖。
     */
    interface DateTimeFormat {
      format(date?: Date | number | bigint): string
      formatToParts(date?: Date | number | bigint): DateTimeFormatPart[]
      resolvedOptions(): ResolvedDateTimeFormatOptions
    }

    interface DateTimeFormatConstructor {
      new (
        locales?: LocalesArgument,
        options?: DateTimeFormatOptions,
      ): DateTimeFormat
      (
        locales?: LocalesArgument,
        options?: DateTimeFormatOptions,
      ): DateTimeFormat
      readonly prototype: DateTimeFormat
      supportedLocalesOf(
        locales: LocalesArgument,
        options?: DateTimeFormatOptions,
      ): string[]
    }

    /**
     * 构造时间向 DateTimeFormat。
     * @example
     * new Intl.DateTimeFormat("zh-CN", {
     *   dateStyle: "long",
     *   timeZone: "Asia/Shanghai",
     * }).format(Date.now())
     */
    var DateTimeFormat: DateTimeFormatConstructor

    /**
     * Breeze 实现了时间向 `supportedValuesOf`。
     * 仅保证 `"timeZone"` / `"calendar"`；其它 key 运行时抛错。
     */
    function supportedValuesOf(key: BreezeSupportedValuesOfKey): string[]
    function supportedValuesOf(key: string): string[]

    /** 最小实现：把输入规范成字符串数组。 */
    function getCanonicalLocales(locales: string | readonly string[]): string[]
  }

  interface Date {
    toLocaleString(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ): string
    toLocaleDateString(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ): string
    toLocaleTimeString(
      locales?: Intl.LocalesArgument,
      options?: Intl.DateTimeFormatOptions,
    ): string
  }
}
