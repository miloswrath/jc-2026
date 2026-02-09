import { describe, expect, it } from "vitest";
import { buildWsUrl } from "../ws";

describe("buildWsUrl", () => {
  it("prefers env override", () => {
    const result = buildWsUrl({
      envUrl: "ws://10.0.0.5:9000",
      location: { protocol: "http:", hostname: "ignored" }
    });
    expect(result).toBe("ws://10.0.0.5:9000");
  });

  it("builds ws url from location", () => {
    const result = buildWsUrl({
      envUrl: null,
      location: { protocol: "http:", hostname: "192.168.1.50" }
    });
    expect(result).toBe("ws://192.168.1.50:8088");
  });

  it("returns null when hostname is missing", () => {
    const result = buildWsUrl({
      envUrl: null,
      location: { protocol: "http:", hostname: "" }
    });
    expect(result).toBeNull();
  });
});
