import type { SwarmNode } from "@swarmhq/core";
import { StatusPill } from "./status-pill";

interface NodeRosterProps {
  nodes: SwarmNode[];
}

export function NodeRoster({ nodes }: NodeRosterProps) {
  const readyCount = nodes.length;

  return (
    <div className="node-section">
      <div className="pane-header">
        <span className="pane-label">Live Cluster State</span>
        {readyCount > 0 ? (
          <span className="pane-badge">{readyCount} node{readyCount !== 1 ? "s" : ""} ready</span>
        ) : null}
      </div>

      {nodes.length === 0 ? (
        <div className="node-empty">
          No nodes configured yet.{"\n"}
          Use Setup Wizard to add cluster nodes.
        </div>
      ) : (
        <div className="node-table-wrap">
          <table className="node-table">
            <thead>
              <tr>
                <th>Node ID</th>
                <th>Hostname / IP</th>
                <th>Username</th>
                <th>Roles</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td className="node-id">{node.id}</td>
                  <td className="node-host">{node.host}</td>
                  <td>{node.username}</td>
                  <td>
                    {node.roles.map((role) => (
                      <span key={role} className={`role-badge ${role}`}>
                        {role}
                      </span>
                    ))}
                  </td>
                  <td>
                    <StatusPill tone="success" label="Active" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
