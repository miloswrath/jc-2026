import { describe, expect, it } from "vitest";
import { getServerConfig } from "../src/serverConfig";

describe("getServerConfig", () => {
  it("defaults to 0.0.0.0:8088", () => {
    const config = getServerConfig({});
    expect(config).toEqual({ host: "0.0.0.0", port: 8088 });
  });

  it("accepts explicit host and port", () => {
    const config = getServerConfig({ HOST: "192.168.1.10", PORT: "9090" });
    expect(config).toEqual({ host: "192.168.1.10", port: 9090 });
  });

  it("falls back on invalid port", () => {
    const config = getServerConfig({ PORT: "not-a-number" });
    expect(config.port).toBe(8088);
  });
});
