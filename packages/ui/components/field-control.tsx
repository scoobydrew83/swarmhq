import type { CommandOptionDefinition, PicklistDefinition } from "@swarmhq/core";

interface FieldControlProps {
  option: CommandOptionDefinition;
  picklist?: PicklistDefinition;
  value: string | boolean | undefined;
  disabled?: boolean;
  onChange: (value: string | boolean) => void;
  /** When true, renders without a wrapping label/group (for inline cmd-bar usage). */
  inline?: boolean;
}

export function FieldControl({ option, picklist, value, disabled, onChange, inline }: FieldControlProps) {
  const inputEl =
    option.kind === "text" ? (
      <input
        className="field-input"
        type="text"
        value={typeof value === "string" ? value : ""}
        placeholder={option.placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inline ? { width: 160 } : undefined}
      />
    ) : option.kind === "textarea" ? (
      <textarea
        className="field-input field-textarea"
        value={typeof value === "string" ? value : ""}
        placeholder={option.placeholder}
        disabled={disabled}
        rows={6}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : option.kind === "picklist" ? (
      <select
        className="field-input field-select"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={inline ? { width: 120 } : undefined}
      >
        {(picklist?.options ?? []).map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.label}
          </option>
        ))}
      </select>
    ) : option.kind === "checkbox" ? (
      <label className="checkbox-wrap">
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{Boolean(value) ? "Enabled" : "Disabled"}</span>
      </label>
    ) : null;

  if (inline) return inputEl;

  return (
    <div className="field-group">
      <span className="field-label">{option.label}</span>
      {option.description ? <span className="field-hint">{option.description}</span> : null}
      {inputEl}
    </div>
  );
}
