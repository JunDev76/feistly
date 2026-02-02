import assert from "node:assert/strict";
import test from "node:test";
import {
  Feistly,
  InvalidConfigError,
  InvalidIdError,
  InvalidTokenError,
} from "../src/index.ts";

test("encrypt/decrypt roundtrip", () => {
  const feistly = new Feistly({ masterKey: "test-key" });

  const token = feistly.encrypt("user", 12345);
  const id = feistly.decrypt("user", token);

  assert.equal(id, "12345");
});

test("supports string and bigint ids", () => {
  const feistly = new Feistly({ masterKey: "test-key" });

  const tokenFromString = feistly.encrypt("order", "999");
  const tokenFromBigint = feistly.encrypt("order", 999n);

  assert.equal(feistly.decrypt("order", tokenFromString), "999");
  assert.equal(feistly.decrypt("order", tokenFromBigint), "999");
});

test("deterministic output", () => {
  const feistly = new Feistly({ masterKey: "test-key" });

  const token1 = feistly.encrypt("user", 42);
  const token2 = feistly.encrypt("user", 42);

  assert.equal(token1, token2);
});

test("domain separation", () => {
  const feistly = new Feistly({ masterKey: "test-key" });

  const userToken = feistly.encrypt("user", 100);
  const orderToken = feistly.encrypt("order", 100);

  assert.notEqual(userToken, orderToken);
});

test("verify validates tokens", () => {
  const feistly = new Feistly({ masterKey: "test-key" });

  const token = feistly.encrypt("user", 7);

  assert.equal(feistly.verify("user", token), true);
  assert.equal(feistly.verify("user", token.slice(1) + "A"), false);
});

test("invalid config throws typed errors", () => {
  assert.throws(() => new Feistly({ masterKey: "x", rounds: 0 }), InvalidConfigError);
  assert.throws(() => new Feistly({ masterKey: "x", tagLength: 0 }), InvalidConfigError);
  assert.throws(() => new Feistly({ masterKey: "x", minLength: -1 }), InvalidConfigError);
  assert.throws(() => new Feistly({ masterKey: "x", alphabet: "aa" }), InvalidConfigError);

  const noKey = new Feistly({ masterKey: "" });
  assert.throws(() => noKey.encrypt("user", 1), InvalidConfigError);

  const feistly = new Feistly({ masterKey: "x" });
  assert.throws(() => feistly.encrypt("", 1), InvalidConfigError);
});

test("invalid ids throw typed errors", () => {
  const feistly = new Feistly({ masterKey: "test-key" });

  assert.throws(() => feistly.encrypt("user", -1), InvalidIdError);
  assert.throws(() => feistly.encrypt("user", 12.3), InvalidIdError);
  assert.throws(() => feistly.encrypt("user", "12a"), InvalidIdError);
  assert.throws(() => feistly.encrypt("user", Number.MAX_SAFE_INTEGER + 1), InvalidIdError);
});

test("invalid tokens throw typed errors", () => {
  const feistly = new Feistly({ masterKey: "test-key" });

  assert.throws(() => feistly.decrypt("user", ""), InvalidTokenError);

  const token = feistly.encrypt("user", 55);
  const tampered = token.slice(0, 1) + "Z" + token.slice(2);

  assert.throws(() => feistly.decrypt("user", tampered), InvalidTokenError);
});
