import { describe, expect, it } from "vitest";
import { interactionHash, verifyInteractionHash } from "./hash";

describe("interaction hash", () => {
  it("accepts a hash made over the same four values, with or without padding or trailing slash", () => {
    const h = interactionHash("client", "server", "ref", "https://auth.example/");
    expect(verifyInteractionHash(h, "client", "server", "ref", "https://auth.example")).toBe(true);
    expect(verifyInteractionHash(h.replace(/=+$/, ""), "client", "server", "ref", "https://auth.example/")).toBe(true);
  });
  it("rejects a hash when any value differs", () => {
    const h = interactionHash("client", "server", "ref", "https://auth.example/");
    expect(verifyInteractionHash(h, "client", "server", "other-ref", "https://auth.example")).toBe(false);
    expect(verifyInteractionHash(h, "other", "server", "ref", "https://auth.example")).toBe(false);
    expect(verifyInteractionHash("", "client", "server", "ref", "https://auth.example")).toBe(false);
  });
});
