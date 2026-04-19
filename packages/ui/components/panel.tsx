import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  icon?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** General-purpose panel used on the setup page. */
export function Panel({ title, icon, actions, className, children }: PanelProps) {
  return (
    <div className={["setup-panel", className].filter(Boolean).join(" ")}>
      <div className="setup-panel-head">
        <span className="setup-panel-title">
          {icon ? <span className="ms setup-panel-icon">{icon}</span> : null}
          {title}
        </span>
        {actions ?? null}
      </div>
      {children}
    </div>
  );
}
