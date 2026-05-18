import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { PartyService, SearchField } from '../../core/services/party.service';
import { SearchResult } from '../../core/models/party.model';

interface FieldOption {
  key: SearchField;
  label: string;
  placeholder: string;
  hint: string;
  examples: string[];
  icon: string; // inline SVG path data
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <div class="page">

      <!-- ══ Header ══ -->
      <header class="hdr">
        <div class="hdr-inner">
          <div class="eyebrow"><span class="edot"></span>Counterparty &amp; Account Registry</div>
          <h1 class="title">Find a Party</h1>
          <p class="sub">Select a search field, enter your query and hit Search</p>

          <!-- ── Field selector ── -->
          <div class="field-tabs">
            @for (f of fields; track f.key) {
              <button
                class="ftab"
                [class.active]="field() === f.key"
                (click)="setField(f.key)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2"
                     [innerHTML]="f.icon">
                </svg>
                {{ f.label }}
              </button>
            }
          </div>

          <!-- ── Search bar ── -->
          <div class="sbar-wrap">
            <svg class="sico" width="15" height="15" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              class="sbar"
              #inp
              type="text"
              autocomplete="off"
              spellcheck="false"
              [(ngModel)]="query"
              [placeholder]="activePlaceholder()"
              (keydown.enter)="submit()"
              (ngModelChange)="onType($event)"
            />
            @if (query) {
              <button class="clr" (click)="clear()">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            }
            <button class="search-btn" (click)="submit()" [disabled]="!query.trim()">
              Search
            </button>
          </div>

          <!-- ── Field hint + examples ── -->
          <div class="field-hint">
            <span class="hint-text">{{ activeHint() }}</span>
            <span class="hint-sep">·</span>
            <span class="hint-eg">e.g.</span>
            @for (ex of activeExamples(); track ex) {
              <button class="ex-chip" (click)="use(ex)">{{ ex }}</button>
            }
          </div>
        </div>
      </header>

      <!-- ══ Results area ══ -->
      <div class="body">

        @if (loading()) {
          <div class="state">
            <div class="spin"></div>
            <span>Searching by <strong>{{ activeLabel() }}</strong>…</span>
          </div>

        } @else if (error()) {
          <div class="state err">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {{ error() }}
          </div>

        } @else if (searched() && results().length === 0) {
          <div class="state no-results">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                 stroke="var(--text-dim)" stroke-width="1.2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              <line x1="8" y1="11" x2="14" y2="11"/>
            </svg>
            <div>
              <div class="no-title">No results</div>
              <div class="no-sub">
                No parties found with <strong>{{ activeLabel() }}</strong>
                matching <strong>"{{ lastQuery() }}"</strong>
              </div>
            </div>
          </div>

        } @else if (results().length > 0) {
          <div class="res-hdr">
            <div class="res-meta">
              <span class="res-count">{{ total() }} result{{ total() !== 1 ? 's' : '' }}</span>
              <span class="res-q">— {{ activeLabel() }} contains "{{ lastQuery() }}"</span>
            </div>
            <span class="src-badge" [class.live]="!isMock()">
              <span class="src-dot"></span>
              {{ isMock() ? 'Mock data' : 'Live API' }}
            </span>
          </div>

          <div class="tbl-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>CRDS</th>
                  <th>LEI</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Roles</th>
                  <th>Accounts</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (r of results(); track r.party.id) {
                  <tr class="row" (click)="goto(r.party.id)">
                    <td>
                      <div class="name-cell">
                        <div class="av" [class]="'av-' + tier(r.party.partyType)">
                          {{ r.party.name.substring(0,2).toUpperCase() }}
                        </div>
                        <span class="pname" [class.highlighted]="r.matchedOn === 'name'">
                          {{ r.party.name }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span class="tbadge" [class]="'tb-' + tier(r.party.partyType)">
                        {{ r.party.partyType }}
                      </span>
                    </td>
                    <td class="mono" [class.highlighted]="r.matchedOn === 'crds'">
                      {{ r.party.crdsCode }}
                    </td>
                    <td class="mono lei" [class.highlighted]="r.matchedOn === 'lei'"
                        [title]="r.party.lei">
                      {{ r.party.lei || '—' }}
                    </td>
                    <td><span class="ctag">{{ r.party.countryCode }}</span></td>
                    <td>
                      <span class="stag" [class.active]="r.party.status === 'ACTIVE'">
                        <span class="sdot"></span>{{ r.party.status }}
                      </span>
                    </td>
                    <td>
                      @for (role of r.party.roles.slice(0,2); track role.roleType) {
                        <span class="rchip">{{ role.roleType }}</span>
                      }
                      @if (r.party.roles.length > 2) {
                        <span class="more">+{{ r.party.roles.length - 2 }}</span>
                      }
                    </td>
                    <td>
                      @if (r.party.accounts.length) {
                        <span class="acnt">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                               stroke="currentColor" stroke-width="2">
                            <rect x="2" y="5" width="20" height="14" rx="2"/>
                            <path d="M2 10h20"/>
                          </svg>
                          {{ r.party.accounts.length }}
                        </span>
                      } @else {
                        <span class="dim">—</span>
                      }
                    </td>
                    <td class="act-col">
                      <button class="view-btn"
                              (click)="goto(r.party.id); $event.stopPropagation()">
                        View →
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          @if (total() > pageSize) {
            <div class="pager">
              <button [disabled]="page() === 1" (click)="go(page() - 1)">← Prev</button>
              <span>Page {{ page() }} / {{ pages() }}</span>
              <button [disabled]="page() === pages()" (click)="go(page() + 1)">Next →</button>
            </div>
          }

        } @else {
          <!-- ── Empty / welcome state ── -->
          <div class="welcome">
            <div class="w-cards">
              @for (f of fields; track f.key) {
                <div class="w-card" [class.active]="field() === f.key"
                     (click)="setField(f.key)">
                  <div class="w-card-header">
                    <div class="w-icon" [class]="'wi-' + f.key">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                           stroke="currentColor" stroke-width="2"
                           [innerHTML]="f.icon">
                      </svg>
                    </div>
                    <span class="w-label">{{ f.label }}</span>
                  </div>
                  <p class="w-hint">{{ f.hint }}</p>
                  <div class="w-examples">
                    @for (ex of f.examples; track ex) {
                      <button class="ex-chip" (click)="use(ex); $event.stopPropagation()">
                        {{ ex }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
            <p class="w-tip">
              Select a search type above, type your query and press
              <kbd>Enter</kbd> or click <strong>Search</strong>
            </p>
          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; background: var(--bg-base); display: flex; flex-direction: column; }

    /* ── Header ── */
    .hdr {
      background: var(--bg-surface);
      border-bottom: 1px solid var(--green-border);
      padding: 28px 40px 22px;
      position: relative; flex-shrink: 0;
    }
    .hdr::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
      background: linear-gradient(90deg, var(--green), transparent);
    }
    .hdr-inner { max-width: 820px; }

    .eyebrow {
      display: flex; align-items: center; gap: 7px;
      font-size: 10px; color: var(--green);
      text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; margin-bottom: 4px;
    }
    .edot {
      width: 5px; height: 5px; border-radius: 50%; background: var(--green);
      box-shadow: 0 0 8px var(--green-glow);
    }
    .title { font-size: 26px; font-weight: 800; color: #f1f0eb; letter-spacing: -0.025em; margin-bottom: 3px; }
    .sub   { font-size: 12px; color: var(--text-dim); margin-bottom: 18px; }

    /* Field tabs */
    .field-tabs {
      display: flex; gap: 6px; margin-bottom: 14px;
      border-bottom: 1px solid rgba(0,155,119,0.08);
      padding-bottom: 0;
    }
    .ftab {
      display: flex; align-items: center; gap: 7px;
      padding: 8px 16px 10px;
      background: none; border: none; border-bottom: 2px solid transparent;
      color: var(--text-muted); font-size: 13px; font-weight: 500;
      cursor: pointer; font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }
    .ftab:hover { color: var(--text-secondary); }
    .ftab.active {
      color: var(--green);
      border-bottom-color: var(--green);
    }
    .ftab svg { flex-shrink: 0; }

    /* Search bar */
    .sbar-wrap {
      display: flex; align-items: center; gap: 0;
      max-width: 680px; margin-bottom: 10px;
      border: 1px solid rgba(0,155,119,0.22);
      border-radius: 10px; overflow: hidden;
      background: var(--bg-base);
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .sbar-wrap:focus-within {
      border-color: var(--green);
      box-shadow: 0 0 0 3px var(--green-faint);
    }
    .sico {
      flex-shrink: 0; margin-left: 14px; color: var(--green); pointer-events: none;
    }
    .sbar {
      flex: 1; padding: 12px 10px 12px 10px;
      background: transparent; border: none;
      color: var(--text-primary); font-size: 14px;
      font-family: inherit; outline: none;
    }
    .sbar::placeholder { color: var(--text-dim); }
    .clr {
      flex-shrink: 0; margin-right: 6px;
      background: rgba(0,155,119,0.08); border: 1px solid rgba(0,155,119,0.18);
      color: var(--green); cursor: pointer; padding: 4px 5px; border-radius: 5px;
      display: flex; align-items: center; justify-content: center;
    }
    .clr:hover { background: rgba(0,155,119,0.18); }
    .search-btn {
      flex-shrink: 0; align-self: stretch;
      background: linear-gradient(135deg, var(--green-deep), var(--green));
      border: none; color: #fff;
      padding: 0 22px; font-size: 13px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: opacity 0.15s;
      border-left: 1px solid rgba(0,155,119,0.3);
    }
    .search-btn:hover:not(:disabled) { opacity: 0.88; }
    .search-btn:disabled { opacity: 0.35; cursor: default; }

    /* Field hint */
    .field-hint {
      display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
    }
    .hint-text { font-size: 11px; color: var(--text-dim); }
    .hint-sep  { font-size: 11px; color: var(--text-dim); }
    .hint-eg   { font-size: 11px; color: var(--text-dim); }
    .ex-chip {
      background: var(--green-faint); border: 1px solid rgba(0,155,119,0.15);
      color: var(--text-muted); font-size: 11px;
      padding: 2px 9px; border-radius: 20px;
      cursor: pointer; font-family: inherit; transition: all 0.15s;
    }
    .ex-chip:hover { background: var(--green-dim); border-color: var(--green-border); color: var(--green); }

    /* Body */
    .body { flex: 1; padding: 22px 40px; }

    /* States */
    .state {
      display: flex; align-items: center; gap: 14px;
      padding: 52px 0; color: var(--text-muted); font-size: 13px;
    }
    .state strong { color: var(--text-secondary); }
    .state.err { color: #f87171; }
    .state.no-results { align-items: flex-start; padding-top: 44px; }
    .no-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
    .no-sub   { font-size: 12px; color: var(--text-muted); line-height: 1.6; }
    .no-sub strong { color: var(--text-secondary); }

    .spin {
      width: 18px; height: 18px; flex-shrink: 0;
      border: 2px solid var(--green-faint); border-top-color: var(--green);
      border-radius: 50%; animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Results header */
    .res-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .res-meta { display: flex; align-items: center; gap: 8px; }
    .res-count { font-size: 13px; font-weight: 600; color: var(--text-primary); }
    .res-q     { font-size: 12px; color: var(--text-muted); }
    .src-badge {
      display: flex; align-items: center; gap: 5px;
      font-size: 10px; padding: 3px 10px; border-radius: 20px;
      background: var(--green-faint); border: 1px solid var(--green-border);
      color: var(--green); font-family: 'JetBrains Mono', monospace;
    }
    .src-badge.live {
      background: rgba(59,130,246,0.07); border-color: rgba(59,130,246,0.2); color: #60a5fa;
    }
    .src-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

    /* Table */
    .tbl-wrap { overflow-x: auto; }
    .tbl { width: 100%; border-collapse: collapse; font-size: 12px; }
    .tbl thead tr { border-bottom: 1px solid rgba(0,155,119,0.1); }
    .tbl th {
      text-align: left; padding: 8px 11px;
      color: var(--text-dim); font-size: 9px;
      text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;
    }
    .row {
      border-bottom: 1px solid rgba(255,255,255,0.025);
      cursor: pointer; transition: background 0.1s;
    }
    .row:hover { background: rgba(0,155,119,0.03); }
    .tbl td { padding: 10px 11px; vertical-align: middle; }

    .name-cell { display: flex; align-items: center; gap: 9px; }
    .av {
      width: 28px; height: 28px; border-radius: 7px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 700;
    }
    .av-market  { background: var(--green-faint); color: var(--green); border: 1px solid var(--green-border); }
    .av-ccp     { background: rgba(245,158,11,0.08); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
    .av-firm    { background: rgba(59,130,246,0.08); color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }
    .av-client  { background: rgba(168,85,247,0.08); color: #c084fc; border: 1px solid rgba(168,85,247,0.2); }
    .av-default { background: var(--border-soft); color: #9ca3af; border: 1px solid var(--border-mid); }

    .pname { font-weight: 600; color: var(--text-primary); }
    .pname.highlighted,
    .mono.highlighted  { color: var(--green-bright); }

    .tbadge { font-size: 10px; padding: 2px 7px; border-radius: 3px; font-weight: 500; }
    .tb-market  { background: var(--green-faint); border: 1px solid var(--green-border); color: var(--green); }
    .tb-ccp     { background: rgba(245,158,11,0.07); border: 1px solid rgba(245,158,11,0.2); color: #f59e0b; }
    .tb-firm    { background: rgba(59,130,246,0.07); border: 1px solid rgba(59,130,246,0.2); color: #60a5fa; }
    .tb-client  { background: rgba(168,85,247,0.07); border: 1px solid rgba(168,85,247,0.2); color: #c084fc; }
    .tb-default { background: var(--border-soft); border: 1px solid var(--border-mid); color: #9ca3af; }

    .mono {
      font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-muted);
    }
    .lei { max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ctag {
      font-size: 10px; font-family: monospace;
      background: var(--border-soft); border: 1px solid var(--border-mid);
      padding: 2px 6px; border-radius: 3px; color: var(--text-muted);
    }
    .stag {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 10px; padding: 2px 7px; border-radius: 3px;
      background: var(--border-soft); border: 1px solid var(--border-mid); color: var(--text-muted);
    }
    .stag.active {
      background: var(--green-faint); border-color: var(--green-border); color: var(--green);
    }
    .sdot { width: 4px; height: 4px; border-radius: 50%; background: currentColor; }
    .rchip {
      display: inline-block;
      background: var(--border-soft); border: 1px solid var(--border-mid);
      color: var(--text-muted); font-size: 9px; padding: 1px 5px; border-radius: 2px; margin-right: 3px;
    }
    .more { font-size: 9px; color: var(--text-dim); }
    .acnt {
      display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--green);
      background: var(--green-faint); border: 1px solid rgba(0,155,119,0.18);
      padding: 2px 8px; border-radius: 4px;
    }
    .dim { color: var(--text-dim); }
    .act-col { text-align: right; }
    .view-btn {
      background: none; border: 1px solid var(--green-border); color: var(--green);
      padding: 5px 11px; border-radius: 5px; cursor: pointer; font-size: 11px; font-family: inherit;
      transition: all 0.15s;
    }
    .view-btn:hover { background: var(--green-faint); border-color: var(--green); }

    .pager {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 0; color: var(--text-muted); font-size: 12px;
    }
    .pager button {
      background: var(--green-faint); border: 1px solid var(--green-border);
      color: var(--green); padding: 5px 12px; border-radius: 5px;
      cursor: pointer; font-family: inherit; font-size: 11px;
    }
    .pager button:disabled { opacity: 0.3; cursor: default; }

    /* ── Welcome state ── */
    .welcome { padding: 28px 0; }
    .w-cards {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
      max-width: 740px; margin-bottom: 20px;
    }
    .w-card {
      background: var(--bg-surface);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px; padding: 18px;
      cursor: pointer; transition: all 0.15s;
    }
    .w-card:hover { border-color: var(--green-border); background: rgba(0,155,119,0.03); }
    .w-card.active {
      border-color: var(--green); background: rgba(0,155,119,0.06);
      box-shadow: 0 0 0 1px rgba(0,155,119,0.12);
    }
    .w-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .w-icon {
      width: 32px; height: 32px; border-radius: 8px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .wi-name  { background: var(--green-faint); color: var(--green); border: 1px solid var(--green-border); }
    .wi-lei   { background: rgba(59,130,246,0.08); color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }
    .wi-crds  { background: rgba(245,158,11,0.08); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
    .w-label { font-size: 14px; font-weight: 700; color: var(--text-primary); }
    .w-hint  { font-size: 11px; color: var(--text-dim); line-height: 1.5; margin-bottom: 12px; }
    .w-examples { display: flex; flex-wrap: wrap; gap: 5px; }

    .w-tip {
      font-size: 12px; color: var(--text-dim); max-width: 480px; line-height: 1.6;
    }
    .w-tip kbd {
      background: var(--bg-surface); border: 1px solid var(--border-mid);
      color: var(--text-secondary); font-size: 11px; padding: 1px 6px;
      border-radius: 4px; font-family: 'JetBrains Mono', monospace;
    }
    .w-tip strong { color: var(--text-secondary); }
  `],
})
export class SearchComponent implements OnInit, OnDestroy {
  private svc    = inject(PartyService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  // State
  query   = '';
  pageSize = 20;

  field    = signal<SearchField>('name');
  results  = signal<SearchResult[]>([]);
  total    = signal(0);
  page     = signal(1);
  loading  = signal(false);
  error    = signal<string | null>(null);
  isMock   = signal(false);
  searched = signal(false);        // has user triggered at least one search?
  lastQuery = signal('');

  private search$ = new Subject<{ q: string; f: SearchField }>();
  private sub!: Subscription;

  // Field definitions
  readonly fields: FieldOption[] = [
    {
      key: 'name',
      label: 'Legal Name',
      placeholder: 'e.g. BNPP SA Paris, CME Market …',
      hint: 'Searches the full or partial registered legal name',
      examples: ['BNPP', 'AAML', 'CME', 'EUREX'],
      icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    },
    {
      key: 'lei',
      label: 'LEI',
      placeholder: 'e.g. R0MUWSFPU8MPR08K5P83 …',
      hint: 'Legal Entity Identifier – 20-character alphanumeric code',
      examples: ['R0MUWSFPU8MPR08K5P83', '5493000QM2EOMFY1G222'],
      icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4M14 15h4"/>',
    },
    {
      key: 'crds',
      label: 'CRDS Code',
      placeholder: 'e.g. BEDUPAR, PARBLON …',
      hint: 'Internal BNPP CRDS counterparty identifier',
      examples: ['BEDUPAR', 'PARBLON', 'BNABPAR', 'AMMMLON'],
      icon: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2z"/><path d="M7 7h.01"/>',
    },
  ];

  ngOnInit() {
    // Restore from URL
    const q = this.route.snapshot.queryParamMap.get('q') ?? '';
    const f = (this.route.snapshot.queryParamMap.get('field') ?? 'name') as SearchField;
    if (q) {
      this.query = q;
      this.field.set(f);
      this.run(q, f, 1);
    }

    // Debounced auto-search (only fires after 350ms of no typing)
    this.sub = this.search$
      .pipe(
        debounceTime(350),
        distinctUntilChanged((a, b) => a.q === b.q && a.f === b.f),
        switchMap(({ q, f }) => {
          this.loading.set(true);
          this.error.set(null);
          return this.svc.search(q, f, this.page(), this.pageSize);
        }),
      )
      .subscribe({
        next: res => {
          this.results.set(res.data);
          this.total.set(res.total);
          this.isMock.set(res.data.some(r => r.party.sourceSystem === 'MOCK'));
          this.loading.set(false);
        },
        error: err => {
          this.error.set('Search failed: ' + (err?.message ?? 'unknown error'));
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  /** Called on every keystroke – auto-searches after debounce */
  onType(q: string) {
    this.page.set(1);
    if (!q.trim()) { this.results.set([]); this.total.set(0); this.searched.set(false); return; }
    this.search$.next({ q: q.trim(), f: this.field() });
  }

  /** Explicit submit (Enter / Search button) – fires immediately */
  submit() {
    const q = this.query.trim();
    if (!q) return;
    this.page.set(1);
    this.run(q, this.field(), 1);
  }

  run(q: string, f: SearchField, p: number) {
    this.loading.set(true);
    this.error.set(null);
    this.lastQuery.set(q);
    this.searched.set(true);
    this.router.navigate([], { queryParams: { q, field: f }, replaceUrl: true });

    this.svc.search(q, f, p, this.pageSize).subscribe({
      next: res => {
        this.results.set(res.data);
        this.total.set(res.total);
        this.isMock.set(res.data.some(r => r.party.sourceSystem === 'MOCK'));
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.message ?? 'Search failed');
        this.loading.set(false);
      },
    });
  }

  setField(f: SearchField) {
    this.field.set(f);
    // Re-run if there's an active query
    if (this.query.trim()) {
      this.page.set(1);
      this.run(this.query.trim(), f, 1);
    }
  }

  clear() {
    this.query = '';
    this.results.set([]); this.total.set(0);
    this.searched.set(false);
    this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  use(v: string) {
    this.query = v;
    this.submit();
  }

  goto(id: string) {
    this.router.navigate(['/party', id], {
      queryParams: { q: this.lastQuery(), field: this.field() },
    });
  }

  go(p: number) { this.page.set(p); this.run(this.query.trim(), this.field(), p); }
  pages() { return Math.ceil(this.total() / this.pageSize) || 1; }

  activePlaceholder(): string {
    return this.fields.find(f => f.key === this.field())?.placeholder ?? '';
  }
  activeHint(): string {
    return this.fields.find(f => f.key === this.field())?.hint ?? '';
  }
  activeExamples(): string[] {
    return this.fields.find(f => f.key === this.field())?.examples ?? [];
  }
  activeLabel(): string {
    return this.fields.find(f => f.key === this.field())?.label ?? '';
  }

  tier(type: string): string {
    const t = (type ?? '').toLowerCase();
    if (t === 'market') return 'market';
    if (t === 'ccp')    return 'ccp';
    if (t === 'firm')   return 'firm';
    if (t === 'client') return 'client';
    return 'default';
  }
}
