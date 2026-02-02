import { Feistly } from "../src/index";

const feistly = new Feistly({
  masterKey: process.env.FEISTLY_MASTER_KEY ?? "dev-secret",
});

const token = feistly.encrypt("user", "12345");
const id = feistly.decrypt("user", token);

console.log({ token, id });
