/**
 * Unit tests for auth module — RED/GREEN
 */
import {
  setCredentials,
  getCredentials,
  clearCredentials,
  isAuthenticated,
  validateEndpoint,
} from "../../src/lib/auth";

describe("auth credentials", () => {
  afterEach(() => clearCredentials());

  it("starts unauthenticated", () => {
    expect(isAuthenticated()).toBe(false);
    expect(getCredentials()).toBeNull();
  });

  it("stores credentials in memory", () => {
    setCredentials({ baseUrl: "https://iris.example.invalid", token: "tok_abc" });
    expect(isAuthenticated()).toBe(true);
    const c = getCredentials();
    expect(c).not.toBeNull();
    expect(c!.baseUrl).toBe("https://iris.example.invalid");
    expect(c!.token).toBe("tok_abc");
  });

  it("trims trailing slash from baseUrl", () => {
    setCredentials({ baseUrl: "https://iris.example.invalid/", token: "tok_x" });
    expect(getCredentials()!.baseUrl).toBe("https://iris.example.invalid");
  });

  it("clears credentials on logout", () => {
    setCredentials({ baseUrl: "https://iris.example.invalid", token: "tok_abc" });
    clearCredentials();
    expect(isAuthenticated()).toBe(false);
    expect(getCredentials()).toBeNull();
  });

  it("returns false when token is empty string", () => {
    setCredentials({ baseUrl: "https://iris.example.invalid", token: "" });
    expect(isAuthenticated()).toBe(false);
  });
});

describe("validateEndpoint", () => {
  it("accepts https URL", () => {
    expect(validateEndpoint("https://iris.example.invalid")).toBe(
      "https://iris.example.invalid"
    );
  });

  it("accepts https URL with path", () => {
    expect(validateEndpoint("https://iris.example.invalid/api/v1")).toBe(
      "https://iris.example.invalid/api/v1"
    );
  });

  it("strips trailing slash from https URL", () => {
    expect(validateEndpoint("https://iris.example.invalid/")).toBe(
      "https://iris.example.invalid"
    );
  });

  it("accepts http://localhost", () => {
    const result = validateEndpoint("http://localhost:8080");
    expect(result).toContain("http://localhost");
  });

  it("accepts http://127.0.0.1", () => {
    const result = validateEndpoint("http://127.0.0.1:9999");
    expect(result).toContain("http://127.0.0.1");
  });

  it("accepts Tailscale CGNAT IP 100.64.x.x", () => {
    const result = validateEndpoint("http://100.64.1.50:8080");
    expect(result).toContain("http://100.64.1.50");
  });

  it("accepts Tailscale CGNAT IP 100.127.x.x", () => {
    const result = validateEndpoint("http://100.127.255.1");
    expect(result).toContain("http://100.127.255.1");
  });

  it("accepts Tailscale MagicDNS *.ts.net", () => {
    const result = validateEndpoint("http://iris-server.tailnet-name.ts.net");
    expect(result).toContain("http://iris-server.tailnet-name.ts.net");
  });

  it("rejects http:// to non-tailscale IP (e.g. 192.168.x.x)", () => {
    expect(() => validateEndpoint("http://192.168.1.10")).toThrow();
  });

  it("rejects http:// *.local (not a tailnet proof)", () => {
    expect(() => validateEndpoint("http://iris.local:8080")).toThrow();
  });

  it("rejects http:// *.internal (not a tailnet proof)", () => {
    expect(() => validateEndpoint("http://iris.internal")).toThrow();
  });

  it("rejects http:// non-loopback arbitrary host", () => {
    expect(() => validateEndpoint("http://iris.example.invalid")).toThrow();
  });

  it("rejects ftp://", () => {
    expect(() => validateEndpoint("ftp://iris.example.invalid")).toThrow();
  });

  it("rejects URL with username", () => {
    expect(() => validateEndpoint("https://user@iris.example.invalid")).toThrow();
  });

  it("rejects URL with password", () => {
    expect(() =>
      validateEndpoint("https://user:pass@iris.example.invalid")
    ).toThrow();
  });

  it("rejects URL with query string (potential token leak)", () => {
    expect(() =>
      validateEndpoint("https://iris.example.invalid?token=abc")
    ).toThrow();
  });

  it("rejects URL with fragment", () => {
    expect(() =>
      validateEndpoint("https://iris.example.invalid#section")
    ).toThrow();
  });

  it("rejects non-URL garbage", () => {
    expect(() => validateEndpoint("not-a-url")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => validateEndpoint("")).toThrow();
  });
});

// Independent review regression: hostname spelling is not a CGNAT IP.
it("rejects a public HTTP hostname beginning with Tailscale-like octets", () => {
  expect(() => validateEndpoint("http://100.64.attacker.com")).toThrow();
});
