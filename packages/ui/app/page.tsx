"use client";

import { useEffect, useState } from "react";
import type {
  ActivityEntry,
  CommandCatalog,
  CommandExecutionResult,
  HealthSnapshot,
  PicklistDefinition,
  SwarmConfig,
} from "@swarmhq/core";
import { ActivityFeed } from "../components/activity-feed";
import { CommandCenter, SidebarNav } from "../components/command-center";
import { CompletionsPanel } from "../components/completions-panel";
import { NodeRoster } from "../components/node-roster";
import { OutputModal } from "../components/output-modal";
import { ResultViewer } from "../components/result-viewer";
import { ThemeToggle } from "../components/theme-toggle";

type SessionPayload = {
  token: string;
  configPath: string;
  envPath?: string;
  appName: string;
};

type ConfigPayload = {
  config: SwarmConfig;
  configPath: string;
};

type HealthPayload = {
  snapshot: HealthSnapshot;
};

type ActivityPayload = {
  activities: ActivityEntry[];
};

type CommandResponsePayload = {
  result?: CommandExecutionResult;
  error?: string;
};

type VersionPayload = { version: string };
type UpgradeCheckPayload = { current: string; latest: string; updateAvailable: boolean };
type UpgradeApplyPayload = { upgraded: boolean; version?: string; message: string };
type ServicesPayload = { services: Array<{ name: string; image: string }> };

type ActivityStreamPayload =
  | { type: "snapshot"; activities: ActivityEntry[] }
  | { type: "activity"; activity: ActivityEntry }
  | { type: "heartbeat" };

function buildHeaders(token: string): HeadersInit {
  return { "content-type": "application/json", "x-swarm-session": token };
}

function mergeActivityEntry(activities: ActivityEntry[], activity: ActivityEntry): ActivityEntry[] {
  const next = activities.filter((e) => e.id !== activity.id);
  next.unshift(activity);
  return next.slice(0, 30);
}

function buildDefaultValues(
  catalog: CommandCatalog | null,
  commandId: string,
): Record<string, string | boolean> {
  const command = catalog?.commands.find((c) => c.id === commandId);
  if (!command) return {};
  return Object.fromEntries(
    command.options
      .filter((o) => o.defaultValue !== undefined)
      .map((o) => [o.id, o.defaultValue as string | boolean]),
  );
}

function resolvePicklist(
  picklist: PicklistDefinition,
  nodes: SwarmConfig["nodes"],
  services: ServicesPayload["services"],
): PicklistDefinition {
  if (picklist.id === "cluster-nodes") {
    return { ...picklist, options: nodes.map((n) => ({ value: n.id, label: n.id })) };
  }
  if (picklist.id === "cluster-services") {
    return { ...picklist, options: services.map((s) => ({ value: s.name, label: s.name })) };
  }
  return picklist;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_CATALOG: CommandCatalog = {
  appName: "swarmhq",
  pageTitle: "swarmhq",
  groups: [],
  picklists: [],
  commands: [],
};

export default function Page() {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [catalog, setCatalog] = useState<CommandCatalog | null>(null);
  const [config, setConfig] = useState<SwarmConfig | null>(null);
  const [health, setHealth] = useState<HealthSnapshot | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [selectedGroup, setSelectedGroup] = useState("operations");
  const [selectedCommandId, setSelectedCommandId] = useState("");
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [result, setResult] = useState<CommandExecutionResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rightTab, setRightTab] = useState<"activity" | "output" | "completions">("activity");
  const [outputModal, setOutputModal] = useState(false);
  const [services, setServices] = useState<ServicesPayload["services"]>([]);
  const [version, setVersion] = useState<string | null>(null);
  const [upgradeCheck, setUpgradeCheck] = useState<UpgradeCheckPayload | null>(null);
  const [upgradeStatus, setUpgradeStatus] = useState<"idle" | "checking" | "upgrading" | "done" | "error">("idle");
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null);

  // ── Initial data load ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        setLoadError(null);
        const sessionResponse = await fetch("/api/session");
        if (!sessionResponse.ok) throw new Error(`Session error (${sessionResponse.status})`);
        const nextSession = (await sessionResponse.json()) as SessionPayload;
        if (cancelled) return;
        setSession(nextSession);

        const headers = buildHeaders(nextSession.token);
        const [metaRes, configRes, healthRes, activityRes, versionRes, servicesRes] = await Promise.all([
          fetch("/api/meta", { headers }),
          fetch("/api/config", { headers }),
          fetch("/api/health", { headers }),
          fetch("/api/activity", { headers }),
          fetch("/api/version", { headers }),
          fetch("/api/services", { headers }),
        ]);

        if (versionRes.ok) {
          const v = (await versionRes.json()) as VersionPayload;
          if (!cancelled) setVersion(v.version);
        }

        if (servicesRes.ok) {
          const s = (await servicesRes.json()) as ServicesPayload;
          if (!cancelled) setServices(s.services ?? []);
        }


        if (!metaRes.ok) throw new Error("Failed to load command metadata.");
        if (!activityRes.ok) throw new Error("Failed to load activity log.");

        const nextCatalog = (await metaRes.json()) as CommandCatalog;
        const nextActivity = (await activityRes.json()) as ActivityPayload;
        if (cancelled) return;

        setCatalog(nextCatalog);
        setActivities(nextActivity.activities);
        const defaultGroup = "operations";
        setSelectedGroup(defaultGroup);
        const firstId = nextCatalog.commands.find((c) => c.groupId === defaultGroup)?.id ?? nextCatalog.commands[0]?.id ?? "";
        setSelectedCommandId(firstId);
        setValues(buildDefaultValues(nextCatalog, firstId));

        let nextLoadError: string | null = null;
        if (configRes.ok) {
          const c = (await configRes.json()) as ConfigPayload;
          if (!cancelled) setConfig(c.config);
        } else if (!cancelled) {
          setConfig(null);
          nextLoadError = await readErrorMessage(configRes, `No config at ${nextSession.configPath}.`);
        }

        if (healthRes.ok) {
          const h = (await healthRes.json()) as HealthPayload;
          if (!cancelled) setHealth(h.snapshot);
        } else if (!cancelled) {
          setHealth(null);
          nextLoadError = nextLoadError ?? await readErrorMessage(healthRes, "Health checks failed.");
        }

        if (nextLoadError && !cancelled) setLoadError(nextLoadError);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : String(error));
      }
    }

    void loadInitial();
    return () => { cancelled = true; };
  }, []);

  // ── Reset values on command change ─────────────────────────────────
  useEffect(() => {
    if (!catalog) return;
    if (!selectedCommandId) { setValues({}); setCommandError(null); return; }
    setValues(buildDefaultValues(catalog, selectedCommandId));
    setCommandError(null);
  }, [catalog, selectedCommandId]);

  // ── Live activity stream ────────────────────────────────────────────
  useEffect(() => {
    if (!session?.token) return;
    const sessionToken = session.token;
    const decoder = new TextDecoder();
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: number | null = null;

    async function connectStream() {
      controller = new AbortController();
      try {
        const res = await fetch("/api/events", {
          headers: buildHeaders(sessionToken),
          signal: controller.signal,
        });
        if (!res.ok || !res.body || stopped) throw new Error(`Stream failed (${res.status})`);

        const reader = res.body.getReader();
        let buffer = "";
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          while (buffer.includes("\n")) {
            const nl = buffer.indexOf("\n");
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (!line) continue;
            const payload = JSON.parse(line) as ActivityStreamPayload;
            if (payload.type === "snapshot") { setActivities(payload.activities); continue; }
            if (payload.type === "activity") setActivities((cur) => mergeActivityEntry(cur, payload.activity));
          }
        }
        if (!stopped) timer = window.setTimeout(() => void connectStream(), 1500);
      } catch {
        if (!stopped) timer = window.setTimeout(() => void connectStream(), 1500);
      }
    }

    void connectStream();
    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [session]);

  // ── Refresh after command ──────────────────────────────────────────
  async function refreshOverview(token: string) {
    const [cRes, hRes, aRes] = await Promise.all([
      fetch("/api/config",   { headers: buildHeaders(token) }),
      fetch("/api/health",   { headers: buildHeaders(token) }),
      fetch("/api/activity", { headers: buildHeaders(token) }),
    ]);
    if (cRes.ok) { const c = (await cRes.json()) as ConfigPayload;  setConfig(c.config); }
    if (hRes.ok) { const h = (await hRes.json()) as HealthPayload;  setHealth(h.snapshot); }
    if (aRes.ok) { const a = (await aRes.json()) as ActivityPayload; setActivities(a.activities); }
  }

  async function checkUpgrade() {
    if (!session) return;
    setUpgradeStatus("checking");
    setUpgradeMessage(null);
    try {
      const res = await fetch("/api/upgrade/check", { headers: buildHeaders(session.token) });
      const payload = (await res.json()) as UpgradeCheckPayload;
      setUpgradeCheck(payload);
      setUpgradeStatus("idle");
    } catch {
      setUpgradeStatus("error");
      setUpgradeMessage("Could not reach npm registry.");
    }
  }

  async function applyUpgrade() {
    if (!session) return;
    setUpgradeStatus("upgrading");
    setUpgradeMessage(null);
    try {
      const res = await fetch("/api/upgrade/apply", {
        method: "POST",
        headers: buildHeaders(session.token),
      });
      const payload = (await res.json()) as UpgradeApplyPayload | { error: string };
      if (!res.ok) {
        setUpgradeStatus("error");
        setUpgradeMessage("error" in payload ? payload.error : "Upgrade failed.");
      } else {
        const p = payload as UpgradeApplyPayload;
        setUpgradeStatus("done");
        setUpgradeMessage(p.message);
        if (p.upgraded && p.version) {
          setUpgradeCheck((prev) => prev ? { ...prev, updateAvailable: false, current: p.version! } : prev);
        }
      }
    } catch {
      setUpgradeStatus("error");
      setUpgradeMessage("Upgrade request failed.");
    }
  }

  async function runCommand() {
    if (!session || !selectedCommandId) return;
    try {
      setBusy(true);
      setCommandError(null);
      const res = await fetch("/api/commands/execute", {
        method: "POST",
        headers: buildHeaders(session.token),
        body: JSON.stringify({ commandId: selectedCommandId, values }),
      });
      const payload = (await res.json()) as CommandResponsePayload;
      if (!res.ok || !payload.result) throw new Error(payload.error ?? `Command failed (${res.status})`);
      setResult(payload.result);
      setRightTab("output");
      await refreshOverview(session.token);
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : String(error));
      setRightTab("output");
      if (session) await refreshOverview(session.token);
    } finally {
      setBusy(false);
    }
  }

  // ── Group switch ──────────────────────────────────────────────────
  function handleGroupChange(groupId: string) {
    setSelectedGroup(groupId);
    const firstInGroup = catalog?.commands.find((c) => c.groupId === groupId)?.id ?? "";
    setSelectedCommandId(firstInGroup);
  }

  // ── Derived health values ──────────────────────────────────────────
  const warningCount = health?.warnings.length ?? 0;
  const isHealthy = health && warningCount === 0;
  const nodes = config?.nodes ?? [];
  const hasOutput = !!(result || commandError);

  const resolvedCatalog: CommandCatalog = catalog
    ? {
        ...catalog,
        picklists: catalog.picklists.map((pl) => resolvePicklist(pl, nodes, services)),
      }
    : EMPTY_CATALOG;

  return (
    <div className="app-shell">
      {/* ── TOP NAV ──────────────────────────────────────────────── */}
      <header className="top-nav">
        <div className="top-nav-left">
          <span className="wordmark">swarmhq</span>
          <div className="nav-sep" />
          <div className="nav-meta">
            {health ? (
              <>
                <span className="nav-chip">{health.clusterName}</span>
                <span className="nav-dot" />
                <span className="nav-chip">{health.vip}</span>
                <span className="nav-dot" />
                <span className={`nav-chip ${isHealthy ? "healthy" : "warning"}`}>
                  {isHealthy ? "● Healthy" : `⚠ ${warningCount} warning${warningCount > 1 ? "s" : ""}`}
                </span>
                <span className="nav-dot" />
                <span className="nav-chip">{health.nodeCount} node{health.nodeCount !== 1 ? "s" : ""}</span>
              </>
            ) : loadError ? (
              <span className="nav-chip danger">⚠ Setup needed</span>
            ) : (
              <span className="nav-chip">Connecting…</span>
            )}
          </div>
        </div>

        <div className="top-nav-right">
          {version ? (
            <span
              className={`nav-chip${upgradeCheck?.updateAvailable ? " warning" : ""}`}
              style={{ cursor: "default", userSelect: "none" }}
              title={upgradeCheck?.updateAvailable ? `v${upgradeCheck.latest} available` : undefined}
            >
              v{version}
            </span>
          ) : null}
          {upgradeCheck?.updateAvailable && upgradeStatus === "idle" ? (
            <button
              type="button"
              className="icon-btn"
              title={`Update to v${upgradeCheck.latest}`}
              onClick={() => void applyUpgrade()}
            >
              <span className="ms">system_update_alt</span>
            </button>
          ) : upgradeStatus === "upgrading" ? (
            <span className="nav-chip" style={{ cursor: "default" }}>Upgrading…</span>
          ) : upgradeStatus === "done" ? (
            <span className="nav-chip healthy" style={{ cursor: "default" }} title={upgradeMessage ?? undefined}>Restart needed</span>
          ) : upgradeStatus === "error" ? (
            <span className="nav-chip danger" style={{ cursor: "default" }} title={upgradeMessage ?? undefined}>Update failed</span>
          ) : upgradeStatus === "checking" ? (
            <span className="nav-chip" style={{ cursor: "default" }}>Checking…</span>
          ) : version ? (
            <button
              type="button"
              className="icon-btn"
              title="Check for updates"
              onClick={() => void checkUpgrade()}
            >
              <span className="ms">update</span>
            </button>
          ) : null}
          <ThemeToggle />
          <a className="icon-btn" href="/setup" title="Setup Wizard">
            <span className="ms">settings</span>
          </a>
        </div>
      </header>

      {/* ── SUB-NAV ──────────────────────────────────────────────── */}
      {catalog ? (
        <div className="sub-nav">
          {catalog.groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={`sub-nav-tab${group.id === selectedGroup ? " active" : ""}`}
              onClick={() => handleGroupChange(group.id)}
              title={group.description}
            >
              {group.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="sub-nav">
          <div className="skeleton-line" style={{ width: 240, margin: "0 16px" }} />
        </div>
      )}

      {/* ── BODY ─────────────────────────────────────────────────── */}
      <div className="app-body">
        {/* ── SIDEBAR ──────────────────────────────────────────── */}
        <aside className="sidebar">
          <div className="sidebar-head">
            <p className="sidebar-label">Commands</p>
            <p className="sidebar-sub">
              {catalog?.groups.find((g) => g.id === selectedGroup)?.label ?? "Operations"}
            </p>
          </div>

          {catalog ? (
            <SidebarNav
              catalog={catalog}
              selectedCommandId={selectedCommandId}
              onSelectCommand={setSelectedCommandId}
              selectedGroup={selectedGroup}
            />
          ) : (
            <div style={{ padding: "12px 16px" }}>
              <div className="skeleton-line" style={{ width: "80%" }} />
            </div>
          )}

          <div className="sidebar-footer">
            <a className="setup-link" href="/setup">
              <span className="ms" style={{ fontSize: "1rem" }}>settings</span>
              <span>Setup Wizard</span>
            </a>
          </div>
        </aside>

        {/* ── MAIN CANVAS ──────────────────────────────────────── */}
        <main className="main-canvas">
          {loadError ? (
            <div className="banner danger" style={{ margin: "8px", borderRadius: "var(--radius)" }}>
              {loadError} —{" "}
              <a href="/setup" style={{ color: "inherit", textDecoration: "underline" }}>
                Open Setup Wizard
              </a>
            </div>
          ) : null}

          <CommandCenter
            catalog={resolvedCatalog}
            selectedCommandId={selectedCommandId}
            values={values}
            busy={busy}
            onSelectCommand={setSelectedCommandId}
            onChangeValue={(optionId, value) =>
              setValues((cur) => ({ ...cur, [optionId]: value }))
            }
            onExecute={() => void runCommand()}
          />

          <div className="content-area">
            {/* Left pane: node table + compact output terminal */}
            <div className="content-left">
              <NodeRoster nodes={nodes} />
              <ResultViewer
                result={result}
                error={commandError}
                onExpand={() => setOutputModal(true)}
              />
            </div>

            {/* Right pane: tabs → activity feed or full output */}
            <div className="content-right">
              <div className="pane-tabs">
                <button
                  type="button"
                  className={`pane-tab${rightTab === "activity" ? " active" : ""}`}
                  onClick={() => setRightTab("activity")}
                >
                  <span className="ms" style={{ fontSize: "0.875rem" }}>bolt</span>
                  Live Activity
                </button>
                <button
                  type="button"
                  className={`pane-tab${rightTab === "output" ? " active" : ""}${hasOutput ? " has-dot" : ""}`}
                  onClick={() => setRightTab("output")}
                >
                  <span className="ms" style={{ fontSize: "0.875rem" }}>terminal</span>
                  Output
                  {hasOutput && rightTab !== "output" ? <span className="tab-dot" /> : null}
                </button>
                <button
                  type="button"
                  className={`pane-tab${rightTab === "completions" ? " active" : ""}`}
                  onClick={() => setRightTab("completions")}
                >
                  <span className="ms" style={{ fontSize: "0.875rem" }}>code</span>
                  Completions
                </button>
              </div>

              {rightTab === "activity" ? (
                <ActivityFeed activities={activities} />
              ) : rightTab === "completions" ? (
                <CompletionsPanel token={session?.token ?? ""} />
              ) : (
                <div className="tab-output-pane">
                  <div className="output-body" style={{ flex: 1, overflow: "auto", padding: "14px" }}>
                    {commandError ? (
                      <pre className="output-pre output-error">Error: {commandError}</pre>
                    ) : result ? (
                      <pre className="output-pre">{result.output || result.summary}</pre>
                    ) : (
                      <span className="output-empty">Run a command to see output here.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── OUTPUT MODAL ─────────────────────────────────────────── */}
      {outputModal ? (
        <OutputModal
          result={result}
          error={commandError}
          onClose={() => setOutputModal(false)}
        />
      ) : null}
    </div>
  );
}
