/**
 * Breeze 运行时注入的 Buffer 类型声明。
 *
 * 对应运行时 `js/00_bootstrap.js` 中通过 `buffer` polyfill 挂载到
 * `globalThis.Buffer` 的类。这里只声明插件开发中常用的子集，
 * 与 Node.js Buffer API 基本兼容。
 */

export class Buffer extends Uint8Array {
  constructor(str: string, encoding?: string);
  constructor(size: number);
  constructor(array: Uint8Array);
  constructor(arrayBuffer: ArrayBuffer);
  constructor(array: readonly number[]);
  constructor(buffer: Buffer);

  write(
    string: string,
    offset?: number,
    length?: number,
    encoding?: string,
  ): number;
  toString(encoding?: string, start?: number, end?: number): string;
  toJSON(): { type: "Buffer"; data: number[] };
  equals(otherBuffer: Uint8Array): boolean;
  compare(
    otherBuffer: Uint8Array,
    targetStart?: number,
    targetEnd?: number,
    sourceStart?: number,
    sourceEnd?: number,
  ): number;
  copy(
    targetBuffer: Buffer,
    targetStart?: number,
    sourceStart?: number,
    sourceEnd?: number,
  ): number;
  slice(start?: number, end?: number): Buffer;
  fill(
    value: string | number | Uint8Array,
    offset?: number,
    end?: number,
  ): this;
  indexOf(
    value: string | number | Uint8Array,
    byteOffset?: number,
    encoding?: string,
  ): number;
  lastIndexOf(
    value: string | number | Uint8Array,
    byteOffset?: number,
    encoding?: string,
  ): number;
  includes(
    value: string | number | Uint8Array,
    byteOffset?: number,
    encoding?: string,
  ): boolean;

  readUInt8(offset: number): number;
  readUInt16LE(offset: number): number;
  readUInt16BE(offset: number): number;
  readUInt32LE(offset: number): number;
  readUInt32BE(offset: number): number;
  readUIntLE(offset: number, byteLength: number): number;
  readUIntBE(offset: number, byteLength: number): number;

  readInt8(offset: number): number;
  readInt16LE(offset: number): number;
  readInt16BE(offset: number): number;
  readInt32LE(offset: number): number;
  readInt32BE(offset: number): number;
  readIntLE(offset: number, byteLength: number): number;
  readIntBE(offset: number, byteLength: number): number;

  readBigUInt64LE(offset: number): bigint;
  readBigUInt64BE(offset: number): bigint;
  readBigInt64LE(offset: number): bigint;
  readBigInt64BE(offset: number): bigint;

  readFloatLE(offset: number): number;
  readFloatBE(offset: number): number;
  readDoubleLE(offset: number): number;
  readDoubleBE(offset: number): number;

  writeUInt8(value: number, offset: number): number;
  writeUInt16LE(value: number, offset: number): number;
  writeUInt16BE(value: number, offset: number): number;
  writeUInt32LE(value: number, offset: number): number;
  writeUInt32BE(value: number, offset: number): number;
  writeUIntLE(value: number, offset: number, byteLength: number): number;
  writeUIntBE(value: number, offset: number, byteLength: number): number;

  writeInt8(value: number, offset: number): number;
  writeInt16LE(value: number, offset: number): number;
  writeInt16BE(value: number, offset: number): number;
  writeInt32LE(value: number, offset: number): number;
  writeInt32BE(value: number, offset: number): number;
  writeIntLE(value: number, offset: number, byteLength: number): number;
  writeIntBE(value: number, offset: number, byteLength: number): number;

  writeBigUInt64LE(value: bigint, offset: number): number;
  writeBigUInt64BE(value: bigint, offset: number): number;
  writeBigInt64LE(value: bigint, offset: number): number;
  writeBigInt64BE(value: bigint, offset: number): number;

  writeFloatLE(value: number, offset: number): number;
  writeFloatBE(value: number, offset: number): number;
  writeDoubleLE(value: number, offset: number): number;
  writeDoubleBE(value: number, offset: number): number;

  swap16(): this;
  swap32(): this;
  swap64(): this;

  static from(array: readonly number[]): Buffer;
  static from(
    arrayBuffer: ArrayBuffer,
    byteOffset?: number,
    length?: number,
  ): Buffer;
  static from(buffer: Uint8Array): Buffer;
  static from(str: string, encoding?: string): Buffer;
  static isBuffer(obj: unknown): obj is Buffer;
  static isEncoding(encoding: string): boolean;
  static byteLength(string: string, encoding?: string): number;
  static concat(list: readonly Uint8Array[], totalLength?: number): Buffer;
  static compare(buf1: Uint8Array, buf2: Uint8Array): number;
  static alloc(
    size: number,
    fill?: string | number | Uint8Array,
    encoding?: string,
  ): Buffer;
  static allocUnsafe(size: number): Buffer;
  static allocUnsafeSlow(size: number): Buffer;
}
