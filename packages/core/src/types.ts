export type NodeRole = "manager" | "worker";
export type HostKeyCheckingMode = "strict" | "accept-new" | "insecure";
export type KeepalivedState = "MASTER" | "BACKUP";

export interface KeepalivedNodeOverride {
  interface?: string;
  priority?: number;
  state?: KeepalivedState;
}

export interface KeepalivedConfig {
  enabled: boolean;
  interface: string;
  routerId: string;
  virtualRouterId: number;
  advertisementInterval: number;
}

export interface SwarmNode {
  id: string;
  host: string;
  username: string;
  roles: NodeRole[];
  labels?: Record<string, string>;
  keepalived?: KeepalivedNodeOverride;
}

export interface SwarmConfig {
  version: 1;
  clusterName: string;
  vip: string;
  nodes: SwarmNode[];
  keepalived: KeepalivedConfig;
  ssh: {
    port: number;
    strictHostKeyChecking: HostKeyCheckingMode;
  };
  redaction: {
    hideIps: boolean;
    storeCommandHistory: boolean;
  };
}

export interface RuntimeSecrets {
  vrrpPassword?: string;
  tailscaleAuthKey?: string;
}

export interface ConfigBuilderNodeInput {
  id: string;
  host: string;
  username: string;
  roles: NodeRole[];
  keepalivedPriority?: number;
  keepalivedState?: KeepalivedState;
  keepalivedInterface?: string;
}

export interface ConfigBuilderInput {
  configPath: string;
  envPath: string;
  clusterName: string;
  vip: string;
  nodes: ConfigBuilderNodeInput[];
  keepalivedEnabled: boolean;
  keepalivedInterface: string;
  keepalivedRouterId: string;
  keepalivedVirtualRouterId: number;
  keepalivedAdvertisementInterval: number;
  sshPort: number;
  sshMode: HostKeyCheckingMode;
  hideIps: boolean;
  storeCommandHistory: boolean;
  vrrpPassword?: string;
  tailscaleAuthKey?: string;
}

export interface ConfigBuilderDefaults {
  hasExistingConfig: boolean;
  input: ConfigBuilderInput;
}

export interface ConfigBuilderSaveResult {
  configPath: string;
  envPath: string;
  config: SwarmConfig;
  savedSecretKeys: string[];
}

export interface HealthSnapshot {
  generatedAt: string;
  clusterName: string;
  vip: string;
  nodeCount: number;
  warnings: string[];
}

export type CommandGroupId =
  | "observability"
  | "configuration"
  | "operations"
  | "maintenance"
  | "security";
export type CommandOptionKind = "text" | "textarea" | "checkbox" | "picklist";
export type ActivityStatus = "pending" | "success" | "error";

export interface PicklistOption {
  value: string;
  label: string;
  description?: string;
}

export interface PicklistDefinition {
  id: string;
  label: string;
  options: PicklistOption[];
}

export interface CommandGroupDefinition {
  id: CommandGroupId;
  label: string;
  description: string;
}

export interface CommandOptionDefinition {
  id: string;
  label: string;
  description: string;
  kind: CommandOptionKind;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | boolean;
  picklistId?: string;
}

export interface CommandDefinition {
  id: string;
  label: string;
  summary: string;
  groupId: CommandGroupId;
  options: CommandOptionDefinition[];
}

export interface CommandCatalog {
  appName: string;
  pageTitle: string;
  groups: CommandGroupDefinition[];
  picklists: PicklistDefinition[];
  commands: CommandDefinition[];
}

export interface CommandExecutionRequest {
  commandId: string;
  values?: Record<string, string | boolean>;
}

export interface CommandExecutionResult {
  commandId: string;
  label: string;
  summary: string;
  output: string;
  payload?: unknown;
}

export interface ActivityEntry {
  id: string;
  commandId: string;
  label: string;
  status: ActivityStatus;
  summary: string;
  startedAt: string;
  finishedAt?: string;
  values?: Record<string, string | boolean>;
  commandLine?: string;
  output?: string;
}
