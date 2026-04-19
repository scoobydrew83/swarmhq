const IPV4_PATTERN = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

export function redactText(input: string, hideIps = false): string {
  let output = input
    .replace(/tskey-[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/(SWARM_VRRP_PASSWORD=)([^\s]+)/g, "$1[REDACTED]")
    .replace(/(SWARM_TAILSCALE_AUTHKEY=)([^\s]+)/g, "$1[REDACTED]")
    .replace(/("vrrpPassword"\s*:\s*")([^"]+)(")/g, '$1[REDACTED]$3')
    .replace(/("tailscaleAuthKey"\s*:\s*")([^"]+)(")/g, '$1[REDACTED]$3');

  if (hideIps) {
    output = output.replace(IPV4_PATTERN, "[REDACTED_IP]");
  }

  return output;
}
