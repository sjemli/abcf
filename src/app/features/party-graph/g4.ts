import {
  Component, OnInit, signal, inject,
  ChangeDetectionStrategy, ViewChild
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { FFlowModule, FCanvasComponent, EFConnectionType } from '@foblex/flow';

// ── Relationships API shapes ─────────────────────────────────────────────────
interface ApiParty {
  id: number; name: string; lei: string; countryCode: string;
}
interface ApiRoleType {
  id: number; code: string; name: string;
}
interface ApiRule {
  id: number; relationshipTypeName: string; category: string;
}
interface ApiAgreement {
  id: number; code: string; status: string;
  startDate: string; endDate: string | null;
}
interface ApiRelationship {
  id: number;
  fromPartyRole: { id: number; party: ApiParty; roleType: ApiRoleType };
  toPartyRole:   { id: number; party: ApiParty; roleType: ApiRoleType };
  rule: ApiRule;
  agreement: ApiAgreement | null;
  startDate: string; endDate: string | null; status: string;
}
interface RelationshipsResponse {
  success: boolean;
  data: ApiRelationship[];
}

// ── Accounts API shapes ───────────────────────────────────────────────────────
interface ApiAssignment {
  id: number; accountId: number; partyRoleId: number;
  startDate: string; endDate: string | null;
}
interface ApiPartyRoleFull {
  id: number; roleTypeCode: string; roleTypeName: string;
  regulatoryJurisdiction: string; status: string;
}
interface ApiAccount {
  id: number; code: string; description: string;
  status: string; currencyCode: string; accountTypeCode: string;
  openingDate: string; closingDate: string | null;
  assignmentsFull: ApiAssignment[];
  partyRolesFull: ApiPartyRoleFull[];
}
interface AccountsResponse {
  success: boolean;
  data: { content: ApiAccount[] };
}

// ── Local graph shapes ────────────────────────────────────────────────────────
type NodeKind = 'party' | 'account';
type Tier = 'market' | 'firm' | 'client' | 'ccp';

interface GNode {
  id: string;
  kind: NodeKind;
  partyId?: number;
  accountCode?: string;
  label: string;
  sublabel: string;
  tier: Tier;
  lei?: string;
  countryCode?: string;
  currency?: string;
  accountType?: string;
  status?: string;
  x: number; y: number;
}
interface GEdge {
  id: string;
  from: string; to: string;
  label: string;
  type: 'clears' | 'member' | 'agreement' | 'account';
  agreementCode?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roleToTier(code: string): Tier {
  const c = code.toUpperCase();
  if (c.includes('CCP') || c.includes('MARKET'))              return 'market';
  if (c.includes('CLIENT'))                                    return 'client';
  if (c.includes('CLEARING_MEMBER') || c.includes('BOOKING')) return 'firm';
  return 'firm';
}

function ruleToEdgeType(name: string): GEdge['type'] {
  const n = name.toUpperCase();
  if (n.includes('CLEARS')) return 'clears';
  if (n.includes('MEMBER')) return 'member';
  return 'agreement';
}

function humanLabel(name: string): string {
  return name.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ── Layout: 4-tier vertical ───────────────────────────────────────────────────
function assignPositions(nodes: GNode[]): void {
  const NODE_W = 200, NODE_H = 110, GAP_X = 60, GAP_Y = 140;

  const tierOf = (n: GNode): number => {
    if (n.kind === 'account')                    return 3;
    if (n.tier === 'market' || n.tier === 'ccp') return 0;
    if (n.tier === 'firm')                       return 1;
    return 2; // client
  };

  const byTier = new Map<number, GNode[]>();
  for (const n of nodes) {
    const t = tierOf(n);
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(n);
  }

  byTier.forEach((group, tier) => {
    const totalW = group.length * NODE_W + (group.length - 1) * GAP_X;
    const startX = -totalW / 2;
    group.forEach((n, i) => {
      n.x = startX + i * (NODE_W + GAP_X);
      n.y = tier * (NODE_H + GAP_Y);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
@Component({
  selector: 'app-party-graph',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, FFlowModule],
  template: `
    <div class="gpage">
      <div class="accent"></div>

      <!-- Top bar -->
      <div class="gtop">
        <button class="back" (click)="back()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </button>

        <div class="gtitle">{{ focalName() || 'Relationship Graph' }}</div>

        <div class="legend">
          <span class="leg"><span class="ld market"></span>Market/CCP</span>
          <span class="leg"><span class="ld firm"></span>Firm</span>
          <span class="leg"><span class="ld client"></span>Client</span>
          <span class="leg"><span class="ld account"></span>Account</span>
          <span class="lsep"></span>
          <span class="leg"><span class="ll green"></span>Clears</span>
          <span class="leg"><span class="ll blue"></span>Member</span>
          <span class="leg"><span class="ll purple"></span>Agreement</span>
          <span class="leg"><span class="ll amber"></span>Account</span>
        </div>
      </div>

      <!-- States -->
      @if (loading()) {
        <div class="state"><div class="spin"></div> Loading…</div>
      } @else if (err()) {
        <div class="state error">⚠ {{ err() }}</div>
      } @else if (!nodes().length) {
        <div class="state dim">No relationship data found.</div>
      } @else {
        <div class="canvas-wrap">
          <f-flow fDraggable (fLoaded)="onLoaded()">
            <f-canvas #fCanvas>

              <!-- Edges MUST come before nodes in f-canvas -->
              @for (edge of edges(); track edge.id) {
                <f-connection
                  [fConnectionId]="edge.id"
                  [fOutputId]="edge.from + '-out'"
                  [fInputId]="edge.to + '-in'"
                  [fType]="CT"
                >
                  <div class="elabel" [class]="'el-' + edge.type">
                    {{ edge.label }}{{ edge.agreementCode ? ' · ' + edge.agreementCode : '' }}
                  </div>
                </f-connection>
              }

              @for (node of nodes(); track node.id) {

                @if (node.kind === 'party') {
                  <div
                    fNode fDragHandle
                    [fNodeId]="node.id"
                    [fNodePosition]="{ x: node.x, y: node.y }"
                    class="fnode"
                    [class.focal]="node.id === focalNodeId()"
                    [class]="'fnode fn-' + node.tier"
                    (click)="selected.set(node)"
                  >
                    <div class="fn-bar" [class]="'fnb-' + node.tier"></div>
                    <div class="fn-body">
                      <div class="fn-title">{{ node.label }}</div>
                      <div class="fn-role">{{ node.sublabel }}</div>
                      <div class="fn-meta">
                        {{ node.countryCode }}{{ node.lei ? ' · ' + (node.lei | slice:0:10) + '…' : '' }}
                      </div>
                    </div>
                    <div fNodeOutput [fOutputId]="node.id + '-out'" [fOutputMultiple]="true"></div>
                    <div fNodeInput  [fInputId]="node.id + '-in'"></div>
                  </div>
                }

                @if (node.kind === 'account') {
                  <div
                    fNode fDragHandle
                    [fNodeId]="node.id"
                    [fNodePosition]="{ x: node.x, y: node.y }"
                    class="fnode fnode-acc"
                    (click)="selected.set(node)"
                  >
                    <div class="fn-bar fnb-account"></div>
                    <div class="fn-body">
                      <div class="fn-acc-code">{{ node.accountCode }}</div>
                      <div class="fn-role">{{ node.sublabel }}</div>
                    </div>
                    <div fNodeOutput [fOutputId]="node.id + '-out'" [fOutputMultiple]="true"></div>
                    <div fNodeInput  [fInputId]="node.id + '-in'"></div>
                  </div>
                }

              }
            </f-canvas>
          </f-flow>
        </div>

        <!-- Side panel -->
        @if (selected()) {
          <div class="panel">
            <div class="panel-bar"
              [class]="selected()!.kind === 'account' ? 'pb-account' : 'pb-' + selected()!.tier">
            </div>
            <div class="panel-head">
              <div>
                <span class="ptag"
                  [class]="selected()!.kind === 'account' ? 'pt-account' : 'pt-' + selected()!.tier">
                  {{ selected()!.kind === 'account' ? 'account' : selected()!.tier }}
                </span>
                <div class="ptitle">{{ selected()!.label }}</div>
              </div>
              <button class="close" (click)="selected.set(null)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div class="panel-body">
              @if (selected()!.kind === 'party') {
                <div class="prow">
                  <span class="plbl">Role(s)</span>
                  <span class="pval">{{ selected()!.sublabel || '—' }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">LEI</span>
                  <span class="pval mono small">{{ selected()!.lei || '—' }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">Country</span>
                  <span class="pval">{{ selected()!.countryCode || '—' }}</span>
                </div>
                @if (edgesFor(selected()!.id).length) {
                  <div class="prow col">
                    <span class="plbl">Connections ({{ edgesFor(selected()!.id).length }})</span>
                    <div class="pacc-list">
                      @for (e of edgesFor(selected()!.id); track e.id) {
                        <div class="pacc-row">
                          <span class="pacc-code" [class]="'el-' + e.type">{{ e.label }}</span>
                          <span class="pacc-meta">{{ e.agreementCode ?? '' }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
                <a class="plink" [routerLink]="['/party', selected()!.partyId]">
                  View full details →
                </a>
              }

              @if (selected()!.kind === 'account') {
                <div class="prow">
                  <span class="plbl">Account Code</span>
                  <span class="pval mono">{{ selected()!.accountCode }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">Type</span>
                  <span class="pval">{{ selected()!.accountType }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">Currency</span>
                  <span class="pval">{{ selected()!.currency }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">Status</span>
                  <span class="pval"
                    [style.color]="selected()!.status === 'ACTIVE' ? 'var(--green)' : '#6b7280'">
                    {{ selected()!.status }}
                  </span>
                </div>
                @if (edgesFor(selected()!.id).length) {
                  <div class="prow col">
                    <span class="plbl">Connections ({{ edgesFor(selected()!.id).length }})</span>
                    <div class="pacc-list">
                      @for (e of edgesFor(selected()!.id); track e.id) {
                        <div class="pacc-row">
                          <span class="pacc-code" [class]="'el-' + e.type">{{ e.label }}</span>
                          <span class="pacc-meta">{{ e.agreementCode ?? '' }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .gpage { height:100vh; display:flex; flex-direction:column; background:#090d14; position:relative; }
    .accent { height:2px; background:linear-gradient(90deg,var(--green),transparent); flex-shrink:0; }

    .gtop {
      display:flex; align-items:center; justify-content:space-between;
      padding:9px 22px; border-bottom:1px solid rgba(0,155,119,0.1);
      background:var(--bg-surface); flex-shrink:0; gap:12px; z-index:5;
    }
    .back {
      display:flex; align-items:center; gap:5px; background:none; border:none;
      color:var(--text-muted); cursor:pointer; font-size:12px; font-family:inherit;
      padding:5px 8px; border-radius:5px; transition:all 0.15s; white-space:nowrap;
    }
    .back:hover { color:var(--green); background:var(--green-faint); }
    .gtitle { flex:1; text-align:center; font-size:13px; font-weight:600; color:var(--text-primary); }

    .legend { display:flex; align-items:center; gap:9px; flex-shrink:0; flex-wrap:wrap; justify-content:flex-end; }
    .leg { display:flex; align-items:center; gap:4px; font-size:9px; color:var(--text-dim); white-space:nowrap; }
    .ld { width:7px; height:7px; border-radius:50%; }
    .ld.market  { background:var(--green); }
    .ld.firm    { background:#60a5fa; }
    .ld.client  { background:#c084fc; }
    .ld.account { background:#f59e0b; }
    .ll { width:14px; height:2px; border-radius:1px; }
    .ll.green  { background:var(--green); }
    .ll.blue   { background:#60a5fa; }
    .ll.purple { background:#c084fc; }
    .ll.amber  { background:#f59e0b; }
    .lsep { width:1px; height:12px; background:rgba(0,155,119,0.12); margin:0 1px; }

    .state {
      flex:1; display:flex; align-items:center; justify-content:center;
      gap:12px; color:var(--text-muted); font-size:13px;
    }
    .state.error { color:#f87171; }
    .state.dim   { color:var(--text-dim); }
    .spin {
      width:18px; height:18px;
      border:2px solid var(--green-faint); border-top-color:var(--green);
      border-radius:50%; animation:spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform:rotate(360deg); } }

    .canvas-wrap { flex:1; overflow:hidden; position:relative; }
    f-flow { width:100%; height:100%; display:block; }

    /* ── Party nodes ── */
    .fnode {
      background:var(--bg-surface);
      border:1px solid rgba(255,255,255,0.06);
      border-radius:10px; min-width:168px; max-width:230px;
      cursor:pointer; overflow:hidden;
      transition:border-color 0.15s, box-shadow 0.15s;
    }
    .fnode:hover {
      border-color:rgba(0,155,119,0.35);
      box-shadow:0 0 0 2px rgba(0,155,119,0.08);
    }
    .fnode.focal {
      border-color:var(--green) !important;
      box-shadow:0 0 0 2px rgba(0,155,119,0.2);
    }

    /* ── Account nodes ── */
    .fnode-acc { min-width:120px; max-width:160px; }

    .fn-bar { height:2px; }
    .fnb-market  { background:linear-gradient(90deg,var(--green),var(--green-bright)); }
    .fnb-ccp     { background:linear-gradient(90deg,#d97706,#f59e0b); }
    .fnb-firm    { background:linear-gradient(90deg,#1d4ed8,#60a5fa); }
    .fnb-client  { background:linear-gradient(90deg,#7c3aed,#c084fc); }
    .fnb-account { background:linear-gradient(90deg,#b45309,#f59e0b); }

    .fn-body { padding:9px 12px; }
    .fn-title    { font-size:12px; font-weight:700; color:var(--text-primary); margin-bottom:2px; }
    .fn-acc-code { font-size:13px; font-weight:700; color:#f59e0b; font-family:'JetBrains Mono',monospace; margin-bottom:2px; }
    .fn-role     { font-size:9px; color:var(--text-dim); line-height:1.4; margin-bottom:3px; }
    .fn-meta     { font-size:8px; color:var(--text-dim); margin-top:3px; font-family:'JetBrains Mono',monospace; }

    /* ── Edges ── */
    .elabel {
      background:var(--bg-surface); border:1px solid var(--border-soft);
      font-size:9px; color:var(--text-muted);
      padding:2px 6px; border-radius:3px; white-space:nowrap; pointer-events:none;
    }
    .el-clears    { border-color:rgba(0,155,119,0.3);  color:var(--green); }
    .el-member    { border-color:rgba(59,130,246,0.3);  color:#60a5fa; }
    .el-agreement { border-color:rgba(168,85,247,0.3); color:#c084fc; }
    .el-account   { border-color:rgba(245,158,11,0.3);  color:#f59e0b; }

    /* ── Side panel ── */
    .panel {
      position:absolute; right:0; top:0; bottom:0; width:270px;
      background:var(--bg-surface); border-left:1px solid rgba(0,155,119,0.1);
      overflow-y:auto; z-index:10; animation:slide 0.18s ease;
    }
    @keyframes slide { from { transform:translateX(100%); } to { transform:translateX(0); } }

    .panel-bar { height:3px; }
    .pb-market  { background:linear-gradient(90deg,var(--green),var(--green-bright)); }
    .pb-ccp     { background:linear-gradient(90deg,#d97706,#f59e0b); }
    .pb-firm    { background:linear-gradient(90deg,#1d4ed8,#60a5fa); }
    .pb-client  { background:linear-gradient(90deg,#7c3aed,#c084fc); }
    .pb-account { background:linear-gradient(90deg,#b45309,#f59e0b); }

    .panel-head {
      display:flex; align-items:flex-start; justify-content:space-between;
      padding:14px 15px 10px; border-bottom:1px solid rgba(0,155,119,0.08);
    }
    .ptag {
      display:inline-block; font-size:8px; text-transform:uppercase;
      letter-spacing:0.1em; padding:2px 6px; border-radius:2px;
      margin-bottom:4px; font-weight:600;
    }
    .pt-market  { background:var(--green-faint);          color:var(--green); }
    .pt-ccp     { background:rgba(245,158,11,0.08);       color:#f59e0b; }
    .pt-firm    { background:rgba(59,130,246,0.08);       color:#60a5fa; }
    .pt-client  { background:rgba(168,85,247,0.08);       color:#c084fc; }
    .pt-account { background:rgba(245,158,11,0.08);       color:#f59e0b; }

    .ptitle { font-size:13px; font-weight:700; color:var(--text-primary); }
    .close {
      background:var(--border-soft); border:1px solid var(--border-mid);
      color:var(--text-muted); cursor:pointer; padding:4px; border-radius:4px;
      display:flex; align-items:center; transition:all 0.15s; flex-shrink:0;
    }
    .close:hover { background:var(--green-faint); color:var(--green); border-color:var(--green-border); }

    .panel-body { padding:12px 15px; display:flex; flex-direction:column; gap:9px; }
    .prow { display:flex; flex-direction:column; gap:2px; }
    .prow.col { gap:6px; }
    .plbl { font-size:8px; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.08em; }
    .pval { font-size:12px; color:var(--text-primary); }
    .pval.mono  { font-family:'JetBrains Mono',monospace; font-size:11px; }
    .pval.small { font-size:10px; word-break:break-all; }

    .pacc-list { display:flex; flex-direction:column; gap:3px; }
    .pacc-row {
      display:flex; align-items:center; justify-content:space-between;
      background:rgba(0,155,119,0.04); border:1px solid rgba(0,155,119,0.1);
      border-radius:5px; padding:5px 8px;
    }
    .pacc-code { font-family:'JetBrains Mono',monospace; font-size:11px; }
    .pacc-meta { font-size:9px; color:var(--text-dim); }

    .plink {
      display:inline-block; margin-top:2px;
      color:var(--green); font-size:12px; text-decoration:none; font-weight:500;
    }
    .plink:hover { text-decoration:underline; }
  `]
})
export class PartyGraphComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private http   = inject(HttpClient);

  @ViewChild('fCanvas', { static: false }) fCanvas!: FCanvasComponent;

  nodes       = signal<GNode[]>([]);
  edges       = signal<GEdge[]>([]);
  loading     = signal(true);
  err         = signal<string | null>(null);
  selected    = signal<GNode | null>(null);
  focalName   = signal('');
  focalNodeId = signal('');

  CT = EFConnectionType.STRAIGHT;

  ngOnInit() {
    const id      = this.route.snapshot.paramMap.get('id')!;
    const partyId = Number(id);

    forkJoin({
      rels:     this.http.get<RelationshipsResponse>(
                  `/api/v1/parties/${id}/relationships?direction=ALL`),
      accounts: this.http.get<AccountsResponse>(
                  `/api/v1/accounts?partyId=${id}&expand=partyRoles,assignments`)
    }).subscribe({
      next: ({ rels, accounts }) => {
        const relData = Array.isArray(rels.data) ? rels.data : [];
        const accData = Array.isArray(accounts.data?.content)
                          ? accounts.data.content
                          : [];

        console.log('[Graph] partyId:', partyId,
          '| rels:', relData.length,
          '| accounts:', accData.length);

        this.buildGraph(partyId, relData, accData);
      },
      error: e => {
        this.err.set(e?.message ?? 'Failed to load');
        this.loading.set(false);
      }
    });
  }

  private buildGraph(
    focalPartyId: number,
    rels: ApiRelationship[],
    accounts: ApiAccount[]
  ): void {
    const nodeMap         = new Map<string, GNode>();
    const roleMap         = new Map<number, Set<string>>();
    const roleIdToPartyId = new Map<number, number>();
    const edges: GEdge[]  = [];
    const focalNid        = `p-${focalPartyId}`;

    // ── STEP 1: Always seed focal node (placeholder until overwritten) ────
    nodeMap.set(focalNid, {
      id: focalNid, kind: 'party', partyId: focalPartyId,
      label: `Party ${focalPartyId}`, sublabel: '',
      tier: 'firm', lei: '', countryCode: '',
      x: 0, y: 0
    });

    // ── STEP 2: Build party nodes from both sides of every relationship ───
    for (const r of rels) {
      const sides = [
        { partyRoleId: r.fromPartyRole.id, party: r.fromPartyRole.party, roleType: r.fromPartyRole.roleType },
        { partyRoleId: r.toPartyRole.id,   party: r.toPartyRole.party,   roleType: r.toPartyRole.roleType   },
      ];

      for (const { partyRoleId, party, roleType } of sides) {
        // Always register so account assignments can resolve their owner
        roleIdToPartyId.set(partyRoleId, party.id);

        // Accumulate all roles per party
        if (!roleMap.has(party.id)) roleMap.set(party.id, new Set());
        roleMap.get(party.id)!.add(roleType.name);

        const nid      = `p-${party.id}`;
        const existing = nodeMap.get(nid);

        // Create or overwrite placeholder with real API data
        if (!existing || existing.label.startsWith('Party ')) {
          nodeMap.set(nid, {
            id: nid, kind: 'party', partyId: party.id,
            label: party.name, sublabel: '',
            tier: roleToTier(roleType.code),
            lei: party.lei, countryCode: party.countryCode,
            x: 0, y: 0
          });
        }
      }

      // Relationship edge
      edges.push({
        id:    `e-${r.id}`,
        from:  `p-${r.fromPartyRole.party.id}`,
        to:    `p-${r.toPartyRole.party.id}`,
        label: humanLabel(r.rule.relationshipTypeName),
        type:  ruleToEdgeType(r.rule.relationshipTypeName),
        agreementCode: r.agreement?.code
      });
    }

    // Attach accumulated role strings to every party node
    nodeMap.forEach(n => {
      if (n.kind === 'party' && n.partyId != null) {
        const roles = roleMap.get(n.partyId);
        if (roles?.size) n.sublabel = [...roles].join(', ');
      }
    });

    // ── STEP 3: Account nodes + edges ────────────────────────────────────
    for (const acc of accounts) {
      const anid = `acc-${acc.id}`;

      nodeMap.set(anid, {
        id: anid, kind: 'account',
        accountCode: acc.code,
        label: acc.code,
        sublabel: `${humanLabel(acc.accountTypeCode)} · ${acc.currencyCode}`,
        tier: 'client',
        currency: acc.currencyCode,
        accountType: humanLabel(acc.accountTypeCode),
        status: acc.status,
        x: 0, y: 0
      });

      for (const assignment of acc.assignmentsFull) {
        // Resolve owning party via partyRoleId; fall back to focal
        const ownerPartyId = roleIdToPartyId.get(assignment.partyRoleId) ?? focalPartyId;
        const fromNodeId   = `p-${ownerPartyId}`;

        // Find matching role for edge label
        const matchedRole = acc.partyRolesFull.find(
          pr => pr.id === assignment.partyRoleId
        );

        // If focal node is still a placeholder, enrich from partyRolesFull
        const focalNode = nodeMap.get(focalNid);
        if (matchedRole && focalNode?.label.startsWith('Party ')) {
          focalNode.tier     = roleToTier(matchedRole.roleTypeCode);
          focalNode.sublabel = matchedRole.roleTypeName;
        }

        edges.push({
          id:    `e-acc-${assignment.id}`,
          from:  fromNodeId,
          to:    anid,
          label: matchedRole?.roleTypeName ?? 'Account',
          type:  'account'
        });
      }
    }

    // ── STEP 4: Layout + commit ───────────────────────────────────────────
    const allNodes = [...nodeMap.values()];
    assignPositions(allNodes);

    this.focalName.set(nodeMap.get(focalNid)?.label ?? '');
    this.focalNodeId.set(focalNid);
    this.nodes.set(allNodes);
    this.edges.set(edges);
    this.loading.set(false);
  }

  onLoaded(): void {
    this.fCanvas.resetScaleAndCenter(false);
  }

  edgesFor(nodeId: string): GEdge[] {
    return this.edges().filter(e => e.from === nodeId || e.to === nodeId);
  }

  back() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/party', id]);
  }
}
