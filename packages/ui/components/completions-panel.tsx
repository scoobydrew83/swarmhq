"use client";

import { useEffect, useState } from "react";

type CompletionsPayload = { bash: string; zsh: string; fish: string };
type Shell = "bash" | "zsh" | "fish";

const INSTALL_HINT: Record<Shell, string> = {
  bash: "echo 'source <(swarmhq completions bash)' >> ~/.bashrc",
  zsh:  "echo 'source <(swarmhq completions zsh)'  >> ~/.zshrc",
  fish: "swarmhq completions fish > ~/.config/fish/completions/swarmhq.fish",
};

export function CompletionsPanel({ token }: { token: string }) {
  const [scripts, setScripts] = useState<CompletionsPayload | null>(null);
  const [shell, setShell] = useState<Shell>("bash");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/completions", { headers: { "x-swarm-session": token } })
      .then((r) => r.json() as Promise<CompletionsPayload>)
      .then(setScripts)
      .catch(() => undefined);
  }, [token]);

  function handleCopy() {
    if (!scripts) return;
    void navigator.clipboard.writeText(scripts[shell]).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const SHELLS: Shell[] = ["bash", "zsh", "fish"];

  return (
    <div className="completions-panel">
      <div className="completions-toolbar">
        <div className="completions-shell-tabs">
          {SHELLS.map((s) => (
            <button
              key={s}
              type="button"
              className={`completions-shell-tab${shell === s ? " active" : ""}`}
              onClick={() => { setShell(s); setCopied(false); }}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-btn"
          title={copied ? "Copied!" : "Copy to clipboard"}
          onClick={handleCopy}
          disabled={!scripts}
        >
          <span className="ms" style={{ fontSize: "1rem" }}>
            {copied ? "check" : "content_copy"}
          </span>
        </button>
      </div>

      <div className="completions-hint">
        <span className="ms" style={{ fontSize: "0.875rem", color: "var(--text-dim)" }}>info</span>
        <code className="completions-hint-code">{INSTALL_HINT[shell]}</code>
      </div>

      <div className="completions-script-wrap">
        {scripts ? (
          <pre className="completions-script">{scripts[shell]}</pre>
        ) : (
          <div style={{ padding: "16px" }}>
            <div className="skeleton-line" style={{ width: "60%" }} />
            <div className="skeleton-line" style={{ width: "80%", marginTop: 8 }} />
            <div className="skeleton-line" style={{ width: "50%", marginTop: 8 }} />
          </div>
        )}
      </div>
    </div>
  );
}
