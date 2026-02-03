import crypto from "crypto";

export const DEFAULT_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const MAX_UINT64 = 0xffffffffffffffffn;

export class FeistlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeistlyError";
  }
}

export class InvalidConfigError extends FeistlyError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidConfigError";
  }
}

export class InvalidIdError extends FeistlyError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIdError";
  }
}

export class InvalidTokenError extends FeistlyError {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTokenError";
  }
}

export type FeistlyConfig = {
  masterKey: string;
  rounds?: number;
  tagLength?: number;
  alphabet?: string;
  minLength?: number;
};

export type FeistlyOptions = {
  rounds?: number;
  tagLength?: number;
  alphabet?: string;
  minLength?: number;
};

type NormalizedOptions = Required<FeistlyOptions>;

function normalizeOptions(base: FeistlyOptions, overrides?: FeistlyOptions): NormalizedOptions {
  const merged: FeistlyOptions = { ...base, ...overrides };
  const rounds = merged.rounds ?? 10;
  const tagLength = merged.tagLength ?? 2;
  const alphabet = merged.alphabet ?? DEFAULT_ALPHABET;
  const minLength = merged.minLength ?? 0;

  if (!Number.isInteger(rounds) || rounds <= 0) {
    throw new InvalidConfigError("rounds must be a positive integer");
  }
  if (!Number.isInteger(tagLength) || tagLength <= 0) {
    throw new InvalidConfigError("tagLength must be a positive integer");
  }
  if (!Number.isInteger(minLength) || minLength < 0) {
    throw new InvalidConfigError("minLength must be a non-negative integer");
  }
  if (alphabet.length < 2) throw new InvalidConfigError("alphabet must have at least 2 characters");
  if (new Set(alphabet).size !== alphabet.length) {
    throw new InvalidConfigError("alphabet must contain unique characters");
  }

  return { rounds, tagLength, alphabet, minLength };
}

function toUint64(value: string | number | bigint): bigint {
  let v: bigint;
  if (typeof value === "bigint") {
    v = value;
  } else if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new InvalidIdError("id must be an integer");
    if (value < 0) throw new InvalidIdError("id must be non-negative");
    if (value > Number.MAX_SAFE_INTEGER) throw new InvalidIdError("id exceeds MAX_SAFE_INTEGER");
    v = BigInt(value);
  } else {
    if (!/^\d+$/.test(value)) throw new InvalidIdError("id must be a numeric string");
    v = BigInt(value);
  }

  if (v < 0n || v > MAX_UINT64) throw new InvalidIdError("id out of 64-bit range");
  return v & MAX_UINT64;
}

function deriveKey(masterKey: string, domain: string): Buffer {
  if (!masterKey) throw new InvalidConfigError("masterKey is required");
  if (!domain) throw new InvalidConfigError("domain is required");
  return crypto.createHmac("sha256", Buffer.from(masterKey, "utf8")).update(`feistly:${domain}`).digest();
}

function prf(key: Buffer, r: number, round: number): number {
  const buf = Buffer.alloc(5);
  buf.writeUInt32BE(r >>> 0, 0);
  buf.writeUInt8(round & 0xff, 4);
  const h = crypto.createHmac("sha256", key).update(buf).digest();
  return h.readUInt32BE(0) >>> 0;
}

function split64To32(value: bigint): { left: number; right: number } {
  const right = Number(value & 0xffffffffn) >>> 0;
  const left = Number((value >> 32n) & 0xffffffffn) >>> 0;
  return { left, right };
}

function join32To64(left: number, right: number): bigint {
  return ((BigInt(left >>> 0) & 0xffffffffn) << 32n) | (BigInt(right >>> 0) & 0xffffffffn);
}

function feistelEncrypt64(value: bigint, key: Buffer, rounds: number): bigint {
  let { left: L, right: R } = split64To32(value);
  for (let i = 0; i < rounds; i++) {
    const F = prf(key, R, i);
    const newL = R;
    const newR = (L ^ F) >>> 0;
    L = newL;
    R = newR;
  }
  return join32To64(L, R);
}

function feistelDecrypt64(value: bigint, key: Buffer, rounds: number): bigint {
  let { left: L, right: R } = split64To32(value);
  for (let i = rounds - 1; i >= 0; i--) {
    const F = prf(key, L, i);
    const newR = L;
    const newL = (R ^ F) >>> 0;
    R = newR;
    L = newL;
  }
  return join32To64(L, R);
}

function baseEncode(value: bigint, alphabet: string, minLength = 0): string {
  if (value < 0n) throw new InvalidIdError("cannot encode negative values");
  if (value === 0n) return alphabet[0].repeat(Math.max(1, minLength));
  const base = BigInt(alphabet.length);
  let v = value;
  let out = "";
  while (v > 0n) {
    const rem = Number(v % base);
    out = alphabet[rem] + out;
    v = v / base;
  }
  if (out.length < minLength) out = alphabet[0].repeat(minLength - out.length) + out;
  return out;
}

function baseDecode(text: string, alphabet: string): bigint {
  if (!text) throw new InvalidTokenError("invalid token body");
  const base = BigInt(alphabet.length);
  let v = 0n;
  for (let i = 0; i < text.length; i++) {
    const idx = alphabet.indexOf(text[i]);
    if (idx === -1) throw new InvalidTokenError("invalid character in token");
    v = v * base + BigInt(idx);
  }
  return v;
}

function computeTag(key: Buffer, cipher64: bigint, alphabet: string, tagLength: number): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Number((cipher64 >> 32n) & 0xffffffffn) >>> 0, 0);
  buf.writeUInt32BE(Number(cipher64 & 0xffffffffn) >>> 0, 4);
  const mac = crypto.createHmac("sha256", key).update(Buffer.from("tag:", "utf8")).update(buf).digest();
  const val = mac.readUInt32BE(0) >>> 0;
  const base = BigInt(alphabet.length);
  const mod = base ** BigInt(tagLength);
  const tagValue = BigInt(val) % mod;
  return baseEncode(tagValue, alphabet, tagLength);
}

export class Feistly {
  private readonly masterKey: string;
  private readonly baseOptions: FeistlyOptions;

  constructor(config: FeistlyConfig) {
    this.masterKey = config.masterKey;
    this.baseOptions = {
      rounds: config.rounds,
      tagLength: config.tagLength,
      alphabet: config.alphabet,
      minLength: config.minLength,
    };
    normalizeOptions(this.baseOptions);
  }

  encrypt(domain: string, id: string | number | bigint, options?: FeistlyOptions): string {
    const opts = normalizeOptions(this.baseOptions, options);
    const key = deriveKey(this.masterKey, domain);
    const plain64 = toUint64(id);
    const cipher64 = feistelEncrypt64(plain64, key, opts.rounds);
    const tag = computeTag(key, cipher64, opts.alphabet, opts.tagLength);
    const body = baseEncode(cipher64, opts.alphabet, opts.minLength);
    return `${tag}${body}`;
  }

  decrypt(domain: string, token: string, options?: FeistlyOptions): string {
    const opts = normalizeOptions(this.baseOptions, options);
    if (!token || token.length <= opts.tagLength) throw new InvalidTokenError("malformed token");
    const key = deriveKey(this.masterKey, domain);
    const tag = token.slice(0, opts.tagLength);
    const body = token.slice(opts.tagLength);
    const cipher64 = baseDecode(body, opts.alphabet);
    const expected = computeTag(key, cipher64, opts.alphabet, opts.tagLength);
    if (tag !== expected) throw new InvalidTokenError("invalid key or token");
    const plain64 = feistelDecrypt64(cipher64, key, opts.rounds);
    return plain64.toString(10);
  }

  verify(domain: string, token: string, options?: FeistlyOptions): boolean {
    try {
      this.decrypt(domain, token, options);
      return true;
    } catch {
      return false;
    }
  }
}

export function createFeistly(config: FeistlyConfig): Feistly {
  return new Feistly(config);
}
