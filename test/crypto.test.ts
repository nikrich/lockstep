// Envelope-encryption round-trip for org storage secrets.
import { describe, expect, it } from "vitest";
import { aesEncrypt, aesDecrypt, generateMasterKey } from "../src/lib/crypto";

describe("envelope encryption", () => {
  it("round-trips a secret", async () => {
    const key = generateMasterKey();
    const secret = "7490bb5357cdfcec59642a9ffd351fb6fca370eb4b061c6cddb142fa50895a27";
    const cipher = await aesEncrypt(key, secret);
    expect(cipher).toContain(":"); // iv:ciphertext
    expect(cipher).not.toContain(secret); // not stored in the clear
    expect(await aesDecrypt(key, cipher)).toBe(secret);
  });

  it("produces a different ciphertext each time (random IV)", async () => {
    const key = generateMasterKey();
    const a = await aesEncrypt(key, "same-plaintext");
    const b = await aesEncrypt(key, "same-plaintext");
    expect(a).not.toBe(b);
    expect(await aesDecrypt(key, a)).toBe("same-plaintext");
    expect(await aesDecrypt(key, b)).toBe("same-plaintext");
  });

  it("fails to decrypt with the wrong key", async () => {
    const cipher = await aesEncrypt(generateMasterKey(), "secret");
    await expect(aesDecrypt(generateMasterKey(), cipher)).rejects.toThrow();
  });

  it("rejects a malformed master key", async () => {
    await expect(aesEncrypt("too-short", "x")).rejects.toThrow();
  });
});
