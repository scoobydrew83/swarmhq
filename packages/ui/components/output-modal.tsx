"use client";

import { useEffect } from "react";
import type { CommandExecutionResult } from "@swarmhq/core";

interface OutputModalProps {
  result: CommandExecutionResult | null;
  error: string | null;
  onClose: () => void;
}

export function OutputModal({ result, error, onClose }: OutputModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const content = error
    ? `Error: ${error}`
    : result
    ? result.output || result.summary
    : "";

  const label = error ? "Error" : result?.summary ?? "Output";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="output-dots">
            <span className="output-dot rd" />
            <span className="output-dot am" />
            <span className="output-dot gn" />
          </div>
          <span className="modal-title">{label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto" }}>
            {result && !error ? (
              <span className="output-connected">● connected</span>
            ) : null}
            <button className="icon-btn" type="button" onClick={onClose} title="Close (Esc)">
              <span className="ms" style={{ fontSize: "1.1rem" }}>close</span>
            </button>
          </div>
        </div>
        <div className="modal-body">
          <pre className={`output-pre${error ? " output-error" : ""}`}>{content}</pre>
        </div>
      </div>
    </div>
  );
}
