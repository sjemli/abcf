import { Component, OnInit, signal, inject, ChangeDetectionStrategy, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  FFlowModule,
  FCanvasComponent,
  EFConnectionType,
} from '@foblex/flow';
import { PartyService } from '../../core/services/party.service';
import { PartyGraph, GraphNode } from '../../core/models/party.model';
import { MOCK_PARTIES } from '../../core/mock-data';

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

        <div class="gtabs">
          @for (g of graphs(); track g.id; let i = $index) {
            <button class="gtab"
              [class.active]="activeIdx() === i"
              (click)="setGraph(i)">
              {{ g.title }}
            </button>
          }
        </div>

        <div class="legend">
          <span class="leg"><span class="ld market"></span>Market/CCP</span>
          <span class="leg"><span class="ld firm"></span>Firm</span>
          <span class="leg"><span class="ld client"></span>Client</span>
          <span class="lsep"></span>
          <span class="leg"><span class="ll green"></span>Clears</span>
          <span class="leg"><span class="ll blue"></span>Member</span>
          <span class="leg"><span class="ll purple"></span>Agreement</span>
        </div>
      </div>

      <!-- States -->
      @if (loading()) {
        <div class="state"><div class="spin"></div> Loading…</div>
      } @else if (err()) {
        <div class="state error">⚠ {{ err() }}</div>
      } @else if (!graphs().length) {
        <div class="state dim">No graph data for this party.</div>
      } @else {
        <!-- @let requires Angular 18.1+. If on 18.0 use the activeGraph() getter directly in sub-expressions -->
        @let g = activeGraph()!;

        <div class="canvas-wrap">
          <!-- fDraggable is an attribute directive — never bind as [fDraggable]="true" -->
          <!-- (fLoaded) + resetScaleAndCenter() is required for connections to resolve positions -->
          <f-flow fDraggable (fLoaded)="onLoaded()">
            <f-canvas #fCanvas>

              <!-- CONNECTIONS MUST BE DECLARED BEFORE NODES inside f-canvas -->
              @for (edge of g.edges; track edge.id) {
                <f-connection
                  [fConnectionId]="edge.id"
                  [fOutputId]="edge.from + '-out'"
                  [fInputId]="edge.to + '-in'"
                  [fType]="CT"
                >
                  <div class="elabel" [class]="'el-' + edge.type">{{ edge.label }}</div>
                </f-connection>
              }

              @for (node of g.nodes; track node.id) {
                <div
                  fNode
                  fDragHandle
                  [fNodeId]="node.id"
                  [fNodePosition]="{ x: node.x, y: node.y }"
                  class="fnode"
                  [class]="'fn-' + node.tier"
                  (click)="clickNode(node)"
                >
                  <div class="fn-bar" [class]="'fnb-' + node.tier"></div>
                  <div class="fn-body">
                    <div class="fn-title">{{ node.label }}</div>
                    <div class="fn-role">{{ node.role }}</div>
                    @if (nodeAccounts(node.id).length) {
                      <div class="fn-accs">
                        @for (a of nodeAccounts(node.id); track a) {
                          <span class="fn-acc">{{ a }}</span>
                        }
                      </div>
                    }
                  </div>
                  <!-- fNodeOutput / fNodeInput are attribute directives on plain divs -->
                  <!-- fOutputMultiple must be true or only the first edge per output renders -->
                  <div fNodeOutput [fOutputId]="node.id + '-out'" [fOutputMultiple]="true"></div>
                  <div fNodeInput  [fInputId]="node.id + '-in'"></div>
                </div>
              }

            </f-canvas>
          </f-flow>
        </div>

        <!-- Side panel -->
        @if (selected()) {
          <div class="panel">
            <div class="panel-bar" [class]="'pb-' + selected()!.tier"></div>
            <div class="panel-head">
              <div>
                <span class="ptag" [class]="'pt-' + selected()!.tier">{{ selected()!.tier }}</span>
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
              <div class="prow">
                <span class="plbl">Role(s)</span>
                <span class="pval">{{ selected()!.role }}</span>
              </div>
              @if (partyOf(selected()!.id); as p) {
                <div class="prow">
                  <span class="plbl">CRDS</span>
                  <span class="pval mono">{{ p.crdsCode || '—' }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">LEI</span>
                  <span class="pval mono small">{{ p.lei || '—' }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">Country</span>
                  <span class="pval">{{ p.countryCode }}</span>
                </div>
                <div class="prow">
                  <span class="plbl">Status</span>
                  <span class="pval" [style.color]="p.status==='ACTIVE' ? 'var(--green)' : '#6b7280'">
                    {{ p.status }}
                  </span>
                </div>
                @if (p.accounts.length) {
                  <div class="prow col">
                    <span class="plbl">Accounts ({{ p.accounts.length }})</span>
                    <div class="pacc-list">
                      @for (a of p.accounts; track a.accountCode) {
                        <div class="pacc-row">
                          <span class="pacc-code">{{ a.accountCode }}</span>
                          <span class="pacc-meta">{{ a.accountType }} · {{ a.currency }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
                <a class="plink" [routerLink]="['/party', p.id]">View full details →</a>
              }
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .gpage {
      height: 100vh; display: flex; flex-direction: column;
      background: #090d14; position: relative;
    }
    .accent { height: 2px; background: linear-gradient(90deg, var(--green), transparent); flex-shrink: 0; }

    .gtop {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 22px;
      border-bottom: 1px solid rgba(0,155,119,0.1);
      background: var(--bg-surface); flex-shrink: 0; gap: 12px; z-index: 5;
    }
    .back {
      display: flex; align-items: center; gap: 5px;
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; font-size: 12px; font-family: inherit;
      padding: 5px 8px; border-radius: 5px; transition: all 0.15s; white-space: nowrap;
    }
    .back:hover { color: var(--green); background: var(--green-faint); }

    .gtabs { display: flex; gap: 4px; flex: 1; justify-content: center; }
    .gtab {
      background: none; border: 1px solid rgba(0,155,119,0.1);
      color: var(--text-muted); padding: 4px 13px; border-radius: 5px;
      cursor: pointer; font-size: 11px; font-family: inherit; transition: all 0.15s;
    }
    .gtab:hover { border-color: var(--green-border); color: var(--text-secondary); }
    .gtab.active { border-color: var(--green); color: var(--green-bright); background: rgba(0,155,119,0.08); }

    .legend { display: flex; align-items: center; gap: 9px; flex-shrink: 0; }
    .leg { display: flex; align-items: center; gap: 4px; font-size: 9px; color: var(--text-dim); white-space: nowrap; }
    .ld { width: 7px; height: 7px; border-radius: 50%; }
    .ld.market { background: var(--green); }
    .ld.firm   { background: #60a5fa; }
    .ld.client { background: #c084fc; }
    .ll { width: 14px; height: 2px; border-radius: 1px; }
    .ll.green  { background: var(--green); }
    .ll.blue   { background: #60a5fa; }
    .ll.purple { background: #c084fc; }
    .lsep { width: 1px; height: 12px; background: rgba(0,155,119,0.12); margin: 0 1px; }

    .state {
      flex: 1; display: flex; align-items: center; justify-content: center;
      gap: 12px; color: var(--text-muted); font-size: 13px;
    }
    .state.error { color: #f87171; }
    .state.dim { color: var(--text-dim); }
    .spin {
      width: 18px; height: 18px;
      border: 2px solid var(--green-faint); border-top-color: var(--green);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .canvas-wrap { flex: 1; overflow: hidden; position: relative; }

    f-flow { width: 100%; height: 100%; display: block; }

    /* ── Nodes ── */
    .fnode {
      background: var(--bg-surface);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 10px; min-width: 168px; max-width: 230px;
      cursor: pointer; overflow: hidden;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .fnode:hover {
      border-color: rgba(0,155,119,0.35);
      box-shadow: 0 0 0 2px rgba(0,155,119,0.08);
    }

    .fn-bar { height: 2px; }
    .fnb-market { background: linear-gradient(90deg, var(--green), var(--green-bright)); }
    .fnb-ccp    { background: linear-gradient(90deg, #d97706, #f59e0b); }
    .fnb-firm   { background: linear-gradient(90deg, #1d4ed8, #60a5fa); }
    .fnb-client { background: linear-gradient(90deg, #7c3aed, #c084fc); }

    .fn-body { padding: 9px 12px; }
    .fn-title { font-size: 12px; font-weight: 700; color: var(--text-primary); margin-bottom: 2px; }
    .fn-role  { font-size: 9px;  color: var(--text-dim);  line-height: 1.4; margin-bottom: 5px; }
    .fn-accs  { display: flex; flex-wrap: wrap; gap: 3px; }
    .fn-acc {
      font-size: 8px; font-family: 'JetBrains Mono', monospace;
      background: var(--green-faint); border: 1px solid var(--green-border);
      color: var(--green); padding: 1px 4px; border-radius: 2px;
    }

    /* ── Edges ── */
    .elabel {
      background: var(--bg-surface); border: 1px solid var(--border-soft);
      font-size: 9px; color: var(--text-muted);
      padding: 2px 6px; border-radius: 3px; white-space: nowrap;
      pointer-events: none;
    }
    .el-clears    { border-color: rgba(0,155,119,0.3);  color: var(--green); }
    .el-member    { border-color: rgba(59,130,246,0.3);  color: #60a5fa; }
    .el-agreement { border-color: rgba(168,85,247,0.3); color: #c084fc; }

    /* ── Side panel ── */
    .panel {
      position: absolute; right: 0; top: 0; bottom: 0;
      width: 270px; background: var(--bg-surface);
      border-left: 1px solid rgba(0,155,119,0.1);
      overflow-y: auto; z-index: 10;
      animation: slide 0.18s ease;
    }
    @keyframes slide { from { transform: translateX(100%); } to { transform: translateX(0); } }

    .panel-bar { height: 3px; }
    .pb-market { background: linear-gradient(90deg, var(--green), var(--green-bright)); }
    .pb-ccp    { background: linear-gradient(90deg, #d97706, #f59e0b); }
    .pb-firm   { background: linear-gradient(90deg, #1d4ed8, #60a5fa); }
    .pb-client { background: linear-gradient(90deg, #7c3aed, #c084fc); }

    .panel-head {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding: 14px 15px 10px;
      border-bottom: 1px solid rgba(0,155,119,0.08);
    }
    .ptag {
      display: inline-block;
      font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em;
      padding: 2px 6px; border-radius: 2px; margin-bottom: 4px; font-weight: 600;
    }
    .pt-market { background: var(--green-faint);            color: var(--green); }
    .pt-ccp    { background: rgba(245,158,11,0.08);         color: #f59e0b; }
    .pt-firm   { background: rgba(59,130,246,0.08);         color: #60a5fa; }
    .pt-client { background: rgba(168,85,247,0.08);         color: #c084fc; }
    .ptitle { font-size: 13px; font-weight: 700; color: var(--text-primary); }
    .close {
      background: var(--border-soft); border: 1px solid var(--border-mid);
      color: var(--text-muted); cursor: pointer; padding: 4px;
      border-radius: 4px; display: flex; align-items: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    .close:hover { background: var(--green-faint); color: var(--green); border-color: var(--green-border); }

    .panel-body { padding: 12px 15px; display: flex; flex-direction: column; gap: 9px; }
    .prow { display: flex; flex-direction: column; gap: 2px; }
    .prow.col { gap: 6px; }
    .plbl { font-size: 8px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.08em; }
    .pval { font-size: 12px; color: var(--text-primary); }
    .pval.mono  { font-family: 'JetBrains Mono', monospace; font-size: 11px; }
    .pval.small { font-size: 10px; word-break: break-all; }

    .pacc-list { display: flex; flex-direction: column; gap: 3px; }
    .pacc-row {
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(0,155,119,0.04); border: 1px solid rgba(0,155,119,0.1);
      border-radius: 5px; padding: 5px 8px;
    }
    .pacc-code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--green); }
    .pacc-meta { font-size: 9px; color: var(--text-dim); }

    .plink {
      display: inline-block; margin-top: 2px;
      color: var(--green); font-size: 12px; text-decoration: none; font-weight: 500;
    }
    .plink:hover { text-decoration: underline; }
  `],
})
export class PartyGraphComponent implements OnInit {
  private route  = inject(ActivatedRoute);
  private router = inject(Router);
  private svc    = inject(PartyService);

  @ViewChild('fCanvas', { static: false })
  fCanvas!: FCanvasComponent;

  graphs    = signal<PartyGraph[]>([]);
  activeIdx = signal(0);
  loading   = signal(true);
  err       = signal<string | null>(null);
  selected  = signal<GraphNode | null>(null);

  // EFConnectionBehavior removed in v18 — dropped entirely
  // fType replaces fConnectionType on <f-connection>
  CT = EFConnectionType.STRAIGHT;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.svc.getGraphsForParty(id).subscribe({
      next:  gs => { this.graphs.set(gs); this.loading.set(false); },
      error: e  => { this.err.set(e?.message ?? 'Error'); this.loading.set(false); },
    });
  }

  // Required: (fLoaded) fires once f-flow has finished its internal init.
  // Without resetScaleAndCenter() the canvas never finalises layout and
  // connections cannot resolve their endpoint positions — edges stay invisible.
  onLoaded(): void {
    this.fCanvas.resetScaleAndCenter(false);
  }

  activeGraph(): PartyGraph | null {
    return this.graphs()[this.activeIdx()] ?? null;
  }

  setGraph(i: number) { this.activeIdx.set(i); this.selected.set(null); }

  clickNode(n: GraphNode) { this.selected.set(n); }

  partyOf(id: string) { return MOCK_PARTIES.find(p => p.id === id) ?? null; }

  nodeAccounts(id: string): string[] {
    return this.partyOf(id)?.accounts.map(a => a.accountCode) ?? [];
  }

  back() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.router.navigate(['/party', id]);
  }
}
