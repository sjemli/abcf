export interface PartyRole {
  roleType: string;
  status: string;
  regulatoryJurisdiction?: string;
  startDate?: string;
  endDate?: string;
}

export interface PartyAccount {
  accountCode: string;
  accountType: string;
  currency: string;
  status: string;
  openingDate?: string;
}

export interface Party {
  id: string;
  name: string;
  crdsCode: string;
  lei: string;
  partyType: string;
  status: 'ACTIVE' | 'INACTIVE';
  legalForm?: string;
  countryCode?: string;
  sourceSystem: string;
  sourceIdentifier: string;
  effectiveFrom: string;
  effectiveTo?: string;
  roles: PartyRole[];
  accounts: PartyAccount[];
  attributesJson?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  label: string;
  role: string;
  tier: 'market' | 'firm' | 'client' | 'account';
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  type: 'clears' | 'member' | 'agreement';
}

export interface PartyGraph {
  id: string;
  title: string;
  partyIds: string[];
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface SearchResult {
  party: Party;
  matchedOn: 'name' | 'lei' | 'crds';
}

export interface PagedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
