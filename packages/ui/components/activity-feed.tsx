import type { ActivityEntry } from "@swarmhq/core";
import { StatusPill } from "./status-pill";

interface ActivityFeedProps {
  activities: ActivityEntry[];
}

type Tone = "neutral" | "success" | "warning" | "danger";

function toTone(status: ActivityEntry["status"]): Tone {
  if (status === "success") return "success";
  if (status === "error") return "danger";
  return "warning";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <>
      <div className="activity-header">
        <span className="pane-label">Live Activity</span>
        <span className="live-badge">
          <span className="live-dot" />
          Live
        </span>
      </div>

      <div className="activity-list">
        {activities.length === 0 ? (
          <div className="activity-item" style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
            No commands run yet in this session.
          </div>
        ) : (
          activities.map((activity) => (
            <div className="activity-item" key={activity.id}>
              <div className="activity-top">
                <span className="activity-cmd">{activity.commandLine ?? activity.label}</span>
                <StatusPill tone={toTone(activity.status)} label={activity.status} />
              </div>
              <div className="activity-summary">
                {activity.summary}
                {activity.finishedAt
                  ? ` · ${relativeTime(activity.finishedAt)}`
                  : activity.startedAt
                  ? ` · ${relativeTime(activity.startedAt)}`
                  : ""}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
