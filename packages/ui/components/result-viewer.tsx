import type { CommandExecutionResult } from "@swarmhq/core";

interface ResultViewerProps {
  result: CommandExecutionResult | null;
  error: string | null;
  onExpand?: () => void;
}

export function ResultViewer({ result, error, onExpand }: ResultViewerProps) {
  const hasContent = !!(result || error);

  return (
    <div className="output-section">
      <div className="output-header">
        <div className="output-dots">
          <span className="output-dot rd" />
          <span className="output-dot am" />
          <span className="output-dot gn" />
        </div>
        <span className="output-title">Output Terminal</span>
        <div className="output-title-right">
          {result && !error ? (
            <span className="output-connected">● connected</span>
          ) : null}
          {hasContent && onExpand ? (
            <button className="output-expand-btn" type="button" onClick={onExpand} title="Expand output">
              <span className="ms" style={{ fontSize: "1rem" }}>open_in_full</span>
            </button>
          ) : null}
        </div>
      </div>

      <div className="output-body">
        {error ? (
          <pre className="output-pre output-error">Error: {error}</pre>
        ) : result ? (
          <pre className="output-pre">{result.output || result.summary}</pre>
        ) : (
          <span className="output-empty">Run a command to see output here.</span>
        )}
      </div>
    </div>
  );
}
