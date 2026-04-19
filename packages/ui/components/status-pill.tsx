type Tone = "neutral" | "success" | "warning" | "danger";

interface StatusPillProps {
  tone: Tone;
  label: string;
}

export function StatusPill({ tone, label }: StatusPillProps) {
  return <span className={`status-pill ${tone}`}>{label}</span>;
}
