import { describe, it, expect } from "vitest";
import { redactText } from "../redact.js";

describe("redactText", () => {
  it("redacts Tailscale auth keys", () => {
    const input = "key: tskey-auth-abc123XYZ";
    const result = redactText(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("tskey-auth-abc123XYZ");
  });

  it("redacts SWARM_VRRP_PASSWORD env assignment", () => {
    const input = "SWARM_VRRP_PASSWORD=s3cr3tpassword";
    const result = redactText(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("s3cr3tpassword");
    expect(result).toContain("SWARM_VRRP_PASSWORD=");
  });

  it("redacts SWARM_TAILSCALE_AUTHKEY env assignment", () => {
    const input = "SWARM_TAILSCALE_AUTHKEY=tskey-auth-secret";
    const result = redactText(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("tskey-auth-secret");
  });

  it('redacts JSON "vrrpPassword" field value', () => {
    const input = '{"vrrpPassword": "myvrrppass"}';
    const result = redactText(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("myvrrppass");
  });

  it('redacts JSON "tailscaleAuthKey" field value', () => {
    const input = '{"tailscaleAuthKey": "tskey-abc"}';
    const result = redactText(input);
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("tskey-abc");
  });

  it("does not redact IPv4 addresses when hideIps is false", () => {
    const input = "host: 192.168.1.100";
    const result = redactText(input, false);
    expect(result).toContain("192.168.1.100");
  });

  it("redacts IPv4 addresses when hideIps is true", () => {
    const input = "host: 192.168.1.100 and vip: 10.0.0.1";
    const result = redactText(input, true);
    expect(result).not.toContain("192.168.1.100");
    expect(result).not.toContain("10.0.0.1");
    expect(result).toContain("[REDACTED_IP]");
  });

  it("returns text unchanged when there is nothing to redact", () => {
    const input = "no secrets here, just plain text";
    const result = redactText(input);
    expect(result).toBe(input);
  });

  it("handles empty string input", () => {
    expect(redactText("")).toBe("");
  });

  it("handles multiple secrets in one string", () => {
    const input = "SWARM_VRRP_PASSWORD=pass1\ntskey-auth-xyz\n192.168.1.1";
    const result = redactText(input, true);
    expect(result).not.toContain("pass1");
    expect(result).not.toContain("tskey-auth-xyz");
    expect(result).not.toContain("192.168.1.1");
    expect((result.match(/\[REDACTED\]/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
