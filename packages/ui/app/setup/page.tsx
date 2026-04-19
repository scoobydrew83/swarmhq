"use client";

import { useEffect, useState } from "react";
import type { ConfigBuilderDefaults, ConfigBuilderInput, ConfigBuilderSaveResult, NodeRole } from "@swarm-cli/core";
import { ThemeToggle } from "../../components/theme-toggle";

type SessionPayload = {
  token: string;
  configPath: string;
  envPath: string;
  appName: string;
};

type DefaultsPayload = {
  defaults: ConfigBuilderDefaults;
};

type SavePayload = {
  result?: ConfigBuilderSaveResult;
  error?: string;
};

function buildHeaders(token: string): HeadersInit {
  return { "content-type": "application/json", "x-swarm-session": token };
}

function parseRoles(input: string): NodeRole[] {
  const roles = input.split(",").map((r) => r.trim()).filter(Boolean) as NodeRole[];
  return roles.length ? roles : ["worker"];
}

const STEPS = ["Files", "Core", "Keepalived", "Nodes", "Secrets", "Save"] as const;

export default function SetupPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [input, setInput] = useState<ConfigBuilderInput | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<ConfigBuilderSaveResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [showVrrp, setShowVrrp] = useState(false);
  const [showTailscale, setShowTailscale] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const sessionResponse = await fetch("/api/session");
        if (!sessionResponse.ok) throw new Error(`Failed to create session (${sessionResponse.status})`);
        const nextSession = (await sessionResponse.json()) as SessionPayload;
        const defaultsResponse = await fetch("/api/setup/defaults", {
          headers: buildHeaders(nextSession.token),
        });
        if (!defaultsResponse.ok) throw new Error(`Failed to load setup defaults (${defaultsResponse.status})`);
        const defaults = (await defaultsResponse.json()) as DefaultsPayload;
        if (cancelled) return;
        setSession(nextSession);
        setInput(defaults.defaults.input);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  async function save() {
    if (!session || !input) return;
    try {
      setSaving(true);
      setSaveError(null);
      const response = await fetch("/api/setup/save", {
        method: "POST",
        headers: buildHeaders(session.token),
        body: JSON.stringify({ input, overwrite: true }),
      });
      const payload = (await response.json()) as SavePayload;
      if (!response.ok || !payload.result) throw new Error(payload.error ?? `Save failed with status ${response.status}`);
      setSaveResult(payload.result);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  const filledSections = input ? [
    input.configPath && input.envPath,
    input.clusterName && input.vip,
    true,
    input.nodes.length > 0,
    true,
  ] : [];

  return (
    <div className="setup-shell">
      {/* ── TOP NAV ──────────────────────────────────────────────── */}
      <header className="setup-topnav">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="wordmark">swarm-cli</span>
          <div className="nav-sep" />
          <span style={{ fontFamily: "var(--font-ui)", fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-muted)" }}>
            Setup Wizard
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ThemeToggle />
          <a className="btn-outline" href="/" style={{ height: 32, fontSize: "0.6875rem" }}>
            <span className="ms" style={{ fontSize: "0.875rem" }}>arrow_back</span>
            Dashboard
          </a>
        </div>
      </header>

      <div className="setup-body">
        {/* ── HEADER ───────────────────────────────────────────────── */}
        <p className="setup-title">Cluster Config Wizard</p>
        <p className="setup-sub">
          Define nodes, keepalived defaults, and local secrets in one place. Non-secret topology
          goes to the config file; secret values go to the env file.
        </p>

        {/* ── STEP BAR ─────────────────────────────────────────────── */}
        <div className="step-bar">
          {STEPS.map((step, i) => (
            <>
              <div
                key={step}
                className={`step-item${i === STEPS.length - 1 && saveResult ? " done" : filledSections[i] ? " done" : ""}`}
              >
                <span className="step-num">{i + 1}</span>
                <span className="step-name">{step}</span>
              </div>
              {i < STEPS.length - 1 && <div key={`sep-${i}`} className="step-connector" />}
            </>
          ))}
        </div>

        {/* ── LOAD ERROR ────────────────────────────────────────────── */}
        {loadError ? (
          <div className="banner danger" style={{ marginBottom: "16px" }}>
            <span className="ms" style={{ fontSize: "1rem", flexShrink: 0 }}>error_outline</span>
            {loadError}
          </div>
        ) : null}

        {input ? (
          <>
            <div className="setup-grid">
              {/* ── FILES ──────────────────────────────────────────── */}
              <div className="setup-panel">
                <div className="setup-panel-head">
                  <span className="setup-panel-title">
                    <span className="ms setup-panel-icon">folder_open</span>
                    Save Targets
                  </span>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="configPath">Config File</label>
                  <input
                    id="configPath"
                    className="field-input"
                    value={input.configPath}
                    onChange={(e) => setInput({ ...input, configPath: e.target.value })}
                  />
                  <span className="field-hint">Non-secret swarm topology and keepalived defaults.</span>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="envPath">Secrets Env File</label>
                  <input
                    id="envPath"
                    className="field-input"
                    value={input.envPath}
                    onChange={(e) => setInput({ ...input, envPath: e.target.value })}
                  />
                  <span className="field-hint">Stores SWARM_VRRP_PASSWORD and optional tokens.</span>
                </div>
              </div>

              {/* ── CORE SETTINGS ──────────────────────────────────── */}
              <div className="setup-panel">
                <div className="setup-panel-head">
                  <span className="setup-panel-title">
                    <span className="ms setup-panel-icon">settings_ethernet</span>
                    Core Settings
                  </span>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="clusterName">Cluster Name</label>
                  <input
                    id="clusterName"
                    className="field-input"
                    value={input.clusterName}
                    onChange={(e) => setInput({ ...input, clusterName: e.target.value })}
                  />
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="vip">Virtual IP</label>
                  <input
                    id="vip"
                    className="field-input"
                    value={input.vip}
                    onChange={(e) => setInput({ ...input, vip: e.target.value })}
                  />
                </div>

                <div className="two-up">
                  <div className="field-group">
                    <label className="field-label" htmlFor="sshPort">SSH Port</label>
                    <input
                      id="sshPort"
                      className="field-input"
                      type="number"
                      value={input.sshPort}
                      onChange={(e) => setInput({ ...input, sshPort: Number(e.target.value) || input.sshPort })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="sshMode">SSH Mode</label>
                    <select
                      id="sshMode"
                      className="field-input field-select"
                      value={input.sshMode}
                      onChange={(e) => setInput({ ...input, sshMode: e.target.value as ConfigBuilderInput["sshMode"] })}
                    >
                      <option value="strict">Strict</option>
                      <option value="accept-new">Accept New</option>
                      <option value="insecure">Insecure</option>
                    </select>
                  </div>
                </div>

                <div className="two-up">
                  <label className="checkbox-wrap">
                    <input type="checkbox" checked={input.hideIps} onChange={(e) => setInput({ ...input, hideIps: e.target.checked })} />
                    <span>Hide IPs in output</span>
                  </label>
                  <label className="checkbox-wrap">
                    <input type="checkbox" checked={input.storeCommandHistory} onChange={(e) => setInput({ ...input, storeCommandHistory: e.target.checked })} />
                    <span>Store command history</span>
                  </label>
                </div>
              </div>

              {/* ── KEEPALIVED ─────────────────────────────────────── */}
              <div className="setup-panel">
                <div className="setup-panel-head">
                  <span className="setup-panel-title">
                    <span className="ms setup-panel-icon">monitor_heart</span>
                    VIP Failover
                  </span>
                  <label className="checkbox-wrap">
                    <input
                      type="checkbox"
                      checked={input.keepalivedEnabled}
                      onChange={(e) => setInput({ ...input, keepalivedEnabled: e.target.checked })}
                    />
                    <span>Enabled</span>
                  </label>
                </div>

                <div className="two-up">
                  <div className="field-group">
                    <label className="field-label" htmlFor="kvInterface">Interface</label>
                    <input
                      id="kvInterface"
                      className="field-input"
                      value={input.keepalivedInterface}
                      onChange={(e) => setInput({ ...input, keepalivedInterface: e.target.value })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="kvRouterId">Router ID</label>
                    <input
                      id="kvRouterId"
                      className="field-input"
                      value={input.keepalivedRouterId}
                      onChange={(e) => setInput({ ...input, keepalivedRouterId: e.target.value })}
                    />
                  </div>
                </div>

                <div className="two-up">
                  <div className="field-group">
                    <label className="field-label" htmlFor="kvVrid">Virtual Router ID</label>
                    <input
                      id="kvVrid"
                      className="field-input"
                      type="number"
                      value={input.keepalivedVirtualRouterId}
                      onChange={(e) => setInput({ ...input, keepalivedVirtualRouterId: Number(e.target.value) || input.keepalivedVirtualRouterId })}
                    />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor="kvAdvInterval">Advert Interval</label>
                    <input
                      id="kvAdvInterval"
                      className="field-input"
                      type="number"
                      value={input.keepalivedAdvertisementInterval}
                      onChange={(e) => setInput({ ...input, keepalivedAdvertisementInterval: Number(e.target.value) || input.keepalivedAdvertisementInterval })}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="kvAuthEnv">Auth Password Env Var</label>
                  <input
                    id="kvAuthEnv"
                    className="field-input"
                    value={input.keepalivedAuthPassEnv}
                    onChange={(e) => setInput({ ...input, keepalivedAuthPassEnv: e.target.value })}
                  />
                  <span className="field-hint">The config stores the env var name; the secret value goes into the env file.</span>
                </div>
              </div>

              {/* ── SECRETS ────────────────────────────────────────── */}
              <div className="setup-panel">
                <div className="setup-panel-head">
                  <span className="setup-panel-title">
                    <span className="ms setup-panel-icon">key</span>
                    Local Secrets
                  </span>
                </div>

                <div className="field-warn">
                  <span className="ms" style={{ fontSize: "1rem", flexShrink: 0 }}>info</span>
                  Secret values are written to the env file only — never to the config JSON.
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="vrrpPw">VRRP Password</label>
                  <div className="secret-wrap">
                    <input
                      id="vrrpPw"
                      className="field-input"
                      type={showVrrp ? "text" : "password"}
                      value={input.vrrpPassword ?? ""}
                      onChange={(e) => setInput({ ...input, vrrpPassword: e.target.value })}
                    />
                    <button type="button" className="reveal-btn" onClick={() => setShowVrrp((v) => !v)}>
                      {showVrrp ? "hide" : "show"}
                    </button>
                  </div>
                </div>

                <div className="field-group">
                  <label className="field-label" htmlFor="tsKey">Tailscale Auth Key</label>
                  <div className="secret-wrap">
                    <input
                      id="tsKey"
                      className="field-input"
                      type={showTailscale ? "text" : "password"}
                      value={input.tailscaleAuthKey ?? ""}
                      onChange={(e) => setInput({ ...input, tailscaleAuthKey: e.target.value })}
                    />
                    <button type="button" className="reveal-btn" onClick={() => setShowTailscale((v) => !v)}>
                      {showTailscale ? "hide" : "show"}
                    </button>
                  </div>
                </div>
              </div>

              {/* ── NODE INVENTORY ─────────────────────────────────── */}
              <div className="setup-panel full-width">
                <div className="setup-panel-head">
                  <span className="setup-panel-title">
                    <span className="ms setup-panel-icon">hub</span>
                    Node Inventory
                    {input.nodes.length > 0 && (
                      <span className="pane-badge" style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", marginLeft: "6px" }}>
                        {input.nodes.length} node{input.nodes.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    className="btn-outline"
                    style={{ height: 28, fontSize: "0.6875rem" }}
                    onClick={() =>
                      setInput({
                        ...input,
                        nodes: [
                          ...input.nodes,
                          { id: `node-${input.nodes.length + 1}`, host: "", username: "admin", roles: ["worker"] },
                        ],
                      })
                    }
                  >
                    <span className="ms" style={{ fontSize: "0.875rem" }}>add</span>
                    Add Node
                  </button>
                </div>

                {input.nodes.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                    No nodes configured yet. Click Add Node to get started.
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="node-inv-table">
                      <thead>
                        <tr>
                          <th>Node ID</th>
                          <th>Host / IP</th>
                          <th>Username</th>
                          <th>Roles</th>
                          <th>KA Priority</th>
                          <th>KA State</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {input.nodes.map((node, index) => (
                          <tr key={`${node.id}-${index}`}>
                            <td>
                              <input
                                className="field-input"
                                placeholder="node-1"
                                value={node.id}
                                onChange={(e) => {
                                  const nodes = [...input.nodes];
                                  nodes[index] = { ...node, id: e.target.value };
                                  setInput({ ...input, nodes });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="field-input"
                                placeholder="192.168.1.10"
                                value={node.host}
                                onChange={(e) => {
                                  const nodes = [...input.nodes];
                                  nodes[index] = { ...node, host: e.target.value };
                                  setInput({ ...input, nodes });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="field-input"
                                placeholder="admin"
                                value={node.username}
                                onChange={(e) => {
                                  const nodes = [...input.nodes];
                                  nodes[index] = { ...node, username: e.target.value };
                                  setInput({ ...input, nodes });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="field-input"
                                placeholder="manager,worker"
                                value={node.roles.join(",")}
                                onChange={(e) => {
                                  const nodes = [...input.nodes];
                                  nodes[index] = { ...node, roles: parseRoles(e.target.value) };
                                  setInput({ ...input, nodes });
                                }}
                              />
                            </td>
                            <td>
                              <input
                                className="field-input"
                                type="number"
                                placeholder="100"
                                value={node.keepalivedPriority ?? ""}
                                onChange={(e) => {
                                  const nodes = [...input.nodes];
                                  nodes[index] = { ...node, keepalivedPriority: e.target.value ? Number(e.target.value) : undefined };
                                  setInput({ ...input, nodes });
                                }}
                              />
                            </td>
                            <td>
                              <select
                                className="field-input field-select"
                                value={node.keepalivedState ?? ""}
                                onChange={(e) => {
                                  const nodes = [...input.nodes];
                                  nodes[index] = {
                                    ...node,
                                    keepalivedState: e.target.value
                                      ? (e.target.value as ConfigBuilderInput["nodes"][number]["keepalivedState"])
                                      : undefined,
                                  };
                                  setInput({ ...input, nodes });
                                }}
                              >
                                <option value="">—</option>
                                <option value="MASTER">MASTER</option>
                                <option value="BACKUP">BACKUP</option>
                              </select>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="tbl-action-btn delete"
                                title="Remove node"
                                onClick={() =>
                                  setInput({ ...input, nodes: input.nodes.filter((_, i) => i !== index) })
                                }
                              >
                                <span className="ms" style={{ fontSize: "1rem" }}>delete_outline</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── ACTION BAR ─────────────────────────────────────────── */}
            <div className="setup-action-bar">
              <div>
                {saveError ? (
                  <div className="setup-err">
                    <span className="ms" style={{ fontSize: "1rem" }}>error_outline</span>
                    {saveError}
                  </div>
                ) : saveResult ? (
                  <div className="save-result">
                    ✓ Config saved to <strong>{saveResult.configPath}</strong>
                    {" · "}Env saved to <strong>{saveResult.envPath}</strong>
                  </div>
                ) : (
                  <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                    {input.configPath} · {input.envPath}
                  </span>
                )}
              </div>
              <div className="setup-btn-group">
                <a className="btn-outline" href="/">
                  <span className="ms" style={{ fontSize: "0.875rem" }}>open_in_browser</span>
                  Open Dashboard
                </a>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void save()}
                >
                  <span className="ms" style={{ fontSize: "0.875rem" }}>save</span>
                  {saving ? "Saving…" : "Save Configuration"}
                </button>
              </div>
            </div>
          </>
        ) : !loadError ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            {[80, 100, 60].map((w, i) => (
              <div key={i} className="skeleton-line" style={{ width: `${w}%`, height: "32px", background: "var(--s3)", borderRadius: "var(--radius)", animation: "pulse 1.5s ease-in-out infinite" }} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
