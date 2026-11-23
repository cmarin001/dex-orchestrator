export interface ReflectionEntry {
  route: string;
  path: string;
  module: string;
  tier: string;
  revision: string;
  last_modified: string;
  exports: readonly { name: string; kind: string; signature: string | null }[];
  dependencies: readonly string[];
  dependents: readonly string[];
  mcp_allowed: boolean;
}
