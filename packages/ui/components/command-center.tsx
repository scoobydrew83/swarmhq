import type { CommandCatalog, CommandDefinition, PicklistDefinition } from "@swarm-cli/core";
import { FieldControl } from "./field-control";

interface CommandCenterProps {
  catalog: CommandCatalog;
  selectedCommandId: string;
  values: Record<string, string | boolean>;
  busy: boolean;
  onSelectCommand: (commandId: string) => void;
  onChangeValue: (optionId: string, value: string | boolean) => void;
  onExecute: () => void;
}

function findCommand(catalog: CommandCatalog, commandId: string): CommandDefinition | undefined {
  return catalog.commands.find((c) => c.id === commandId);
}

function findPicklist(catalog: CommandCatalog, picklistId?: string): PicklistDefinition | undefined {
  return catalog.picklists.find((p) => p.id === picklistId);
}

function isVisibleOption(optionId: string, values: Record<string, string | boolean>): boolean {
  if (optionId === "customText") return values.source === "custom";
  return true;
}

/** Renders the command bar (name + inline options + execute button) above the main content area. */
export function CommandCenter({
  catalog,
  selectedCommandId,
  values,
  busy,
  onChangeValue,
  onExecute,
}: CommandCenterProps) {
  const command = findCommand(catalog, selectedCommandId);

  return (
    <div className="cmd-bar">
      <div className="cmd-bar-left">
        <span className="cmd-name">{command?.label ?? "—"}</span>
        {command ? (
          <span className="cmd-hint">$ swarm {command.id}</span>
        ) : null}
      </div>

      <form
        className="cmd-bar-right"
        onSubmit={(e) => { e.preventDefault(); onExecute(); }}
      >
        {command?.options
          .filter((opt) => isVisibleOption(opt.id, values) && opt.kind !== "textarea")
          .map((opt) => (
            <div className="cmd-field" key={opt.id}>
              <span className="cmd-field-label">{opt.label}</span>
              <FieldControl
                option={opt}
                picklist={findPicklist(catalog, opt.picklistId)}
                value={values[opt.id]}
                disabled={busy}
                onChange={(v) => onChangeValue(opt.id, v)}
                inline
              />
            </div>
          ))}

        {/* Textarea options get their own row below the bar */}
        {command?.options
          .filter((opt) => isVisibleOption(opt.id, values) && opt.kind === "textarea")
          .map((opt) => (
            <div className="cmd-field" key={opt.id} style={{ width: "100%", flexBasis: "100%" }}>
              <span className="cmd-field-label">{opt.label}</span>
              <FieldControl
                option={opt}
                picklist={findPicklist(catalog, opt.picklistId)}
                value={values[opt.id]}
                disabled={busy}
                onChange={(v) => onChangeValue(opt.id, v)}
              />
            </div>
          ))}

        <button className="btn-primary" type="submit" disabled={busy || !command}>
          <span className="ms" style={{ fontSize: "1rem" }}>play_arrow</span>
          {busy ? "Running…" : "Execute"}
        </button>
      </form>
    </div>
  );
}

/** Command navigation sidebar — rendered separately from the command bar. */
export function SidebarNav({
  catalog,
  selectedCommandId,
  onSelectCommand,
  selectedGroup,
}: Pick<CommandCenterProps, "catalog" | "selectedCommandId" | "onSelectCommand"> & {
  selectedGroup: string;
}) {
  const ICONS: Record<string, string> = {
    health: "monitor_heart",
    nodes: "hub",
    leader: "stars",
    ps: "list",
    services: "settings_input_component",
    service: "publish",
    scale: "reorder",
    config: "settings_ethernet",
    redact: "visibility_off",
    ui: "open_in_browser",
  };

  const commands = catalog.commands.filter((c) => c.groupId === selectedGroup);

  return (
    <nav className="sidebar-nav">
      <div>
        {commands.map((cmd) => (
          <button
            key={cmd.id}
            type="button"
            className={`cmd-link${cmd.id === selectedCommandId ? " active" : ""}`}
            onClick={() => onSelectCommand(cmd.id)}
            title={cmd.summary}
          >
            <span className="ms cmd-icon">
              {ICONS[cmd.id] ?? "terminal"}
            </span>
            <span>{cmd.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
