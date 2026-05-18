import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PartyService } from '../../core/services/party.service';
import { Party } from '../../core/models/party.model';

@Component({
  selector: 'app-party-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="detail-page">
      <!-- Top accent -->
      <div class="page-accent-bar"></div>

      <!-- Topbar -->
      <div class="topbar">
        <button class="back-btn" (click)="goBack()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 18-6-6 6-6"/></svg>
          Back to results
        </button>
        @if (party()) {
          <div class="topbar-actions">
            <button class="btn-secondary" [routerLink]="['/party', party()!.id, 'graph']">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Show Graph
            </button>
          </div>
        }
      </div>

      @if (loading()) {
        <div class="loading-state">
          <div class="spinner"></div> Loading party…
        </div>
      } @else if (error()) {
        <div class="error-state">⚠ {{ error() }}</div>
      } @else { @if (party(); as p) {
        <div class="detail-content">

          <!-- Hero -->
          <div class="party-hero">
            <div class="hero-left">
              <div class="party-avatar" [class]="'t-' + getTier(p)">
                {{ p.name.substring(0, 2).toUpperCase() }}
              </div>
              <div class="hero-text">
                <h1 class="party-title">{{ p.name }}</h1>
                <div class="party-meta">
                  <span class="meta-chip type-chip" [class]="'tc-' + p.partyType.toLowerCase()">{{ p.partyType }}</span>
                  @if (p.legalForm) { <span class="meta-chip">{{ p.legalForm }}</span> }
                  @if (p.countryCode) { <span class="meta-chip">{{ p.countryCode }}</span> }
                  <span class="status-chip" [class.active]="p.status === 'ACTIVE'">
                    <span class="status-dot"></span>{{ p.status }}
                  </span>
                  @if (p.sourceSystem === 'MOCK') {
                    <span class="mock-badge">Mock</span>
                  }
                </div>
              </div>
            </div>
            <div class="hero-stats">
              <div class="stat-card">
                <span class="stat-val">{{ p.roles.length }}</span>
                <span class="stat-label">Roles</span>
              </div>
              <div class="stat-card">
                <span class="stat-val">{{ p.accounts.length }}</span>
                <span class="stat-label">Accounts</span>
              </div>
            </div>
          </div>

          <!-- Grid: Identifiers + System Info -->
          <div class="two-col">
            <section class="detail-section">
              <h2 class="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Identifiers
              </h2>
              <div class="id-grid">
                <div class="id-card highlight">
                  <span class="id-label">CRDS Code</span>
                  <span class="id-value mono green">{{ p.crdsCode || '—' }}</span>
                </div>
                <div class="id-card highlight">
                  <span class="id-label">LEI</span>
                  <span class="id-value mono" style="font-size:11px;word-break:break-all">{{ p.lei || '—' }}</span>
                </div>
                <div class="id-card">
                  <span class="id-label">Party Type</span>
                  <span class="id-value">{{ p.partyType }}</span>
                </div>
                <div class="id-card">
                  <span class="id-label">Legal Form</span>
                  <span class="id-value">{{ p.legalForm || '—' }}</span>
                </div>
                <div class="id-card">
                  <span class="id-label">Country</span>
                  <span class="id-value">{{ p.countryCode || '—' }}</span>
                </div>
                <div class="id-card">
                  <span class="id-label">Status</span>
                  <span class="id-value" [style.color]="p.status === 'ACTIVE' ? '#009B77' : '#6b7280'">{{ p.status }}</span>
                </div>
              </div>
            </section>

            <section class="detail-section">
              <h2 class="section-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="m8 21 4-4 4 4"/></svg>
                System Info
              </h2>
              <div class="id-grid">
                <div class="id-card">
                  <span class="id-label">Source System</span>
                  <span class="id-value mono">{{ p.sourceSystem }}</span>
                </div>
                <div class="id-card">
                  <span class="id-label">Source ID</span>
                  <span class="id-value mono">{{ p.sourceIdentifier }}</span>
                </div>
                <div class="id-card">
                  <span class="id-label">Effective From</span>
                  <span class="id-value">{{ p.effectiveFrom }}</span>
                </div>
                @if (p.effectiveTo) {
                  <div class="id-card">
                    <span class="id-label">Effective To</span>
                    <span class="id-value">{{ p.effectiveTo }}</span>
                  </div>
                }
              </div>
            </section>
          </div>

          <!-- Roles -->
          <section class="detail-section">
            <h2 class="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Roles
              <span class="count-badge">{{ p.roles.length }}</span>
            </h2>
            @if (p.roles.length === 0) {
              <p class="empty-text">No roles defined</p>
            } @else {
              <div class="roles-grid">
                @for (role of p.roles; track role.roleType) {
                  <div class="role-card">
                    <div class="role-indicator"></div>
                    <div class="role-body">
                      <div class="role-header">
                        <span class="role-type">{{ role.roleType }}</span>
                        <span class="status-chip small" [class.active]="role.status === 'ACTIVE'">
                          <span class="status-dot"></span>{{ role.status }}
                        </span>
                      </div>
                      <div class="role-meta">
                        @if (role.regulatoryJurisdiction) {
                          <span class="meta-item">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            Jurisdiction: <strong>{{ role.regulatoryJurisdiction }}</strong>
                          </span>
                        }
                        @if (role.startDate) {
                          <span class="meta-item">From: <strong>{{ role.startDate }}</strong></span>
                        }
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </section>

          <!-- Accounts -->
          <section class="detail-section">
            <h2 class="section-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
              Accounts
              <span class="count-badge">{{ p.accounts.length }}</span>
            </h2>
            @if (p.accounts.length === 0) {
              <div class="empty-section">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1e3a2e" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                <p class="empty-text">No accounts linked to this party</p>
              </div>
            } @else {
              <table class="accounts-table">
                <thead>
                  <tr>
                    <th>Account Code</th>
                    <th>Type</th>
                    <th>Currency</th>
                    <th>Status</th>
                    <th>Opening Date</th>
                  </tr>
                </thead>
                <tbody>
                  @for (acc of p.accounts; track acc.accountCode) {
                    <tr>
                      <td>
                        <span class="acc-code-badge">{{ acc.accountCode }}</span>
                      </td>
                      <td style="color:#7a9186;font-size:12px">{{ acc.accountType }}</td>
                      <td class="mono-sm">{{ acc.currency }}</td>
                      <td>
                        <span class="status-chip small" [class.active]="acc.status === 'ACTIVE'">
                          <span class="status-dot"></span>{{ acc.status }}
                        </span>
                      </td>
                      <td style="color:#3a5a4e;font-size:12px">{{ acc.openingDate || '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </section>

          <!-- Graph CTA -->
          <section class="graph-cta">
            <div class="cta-glow"></div>
            <div class="cta-content">
              <div class="cta-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#009B77" stroke-width="1.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              </div>
              <div>
                <h3 class="cta-title">Relationship Graph</h3>
                <p class="cta-desc">Visualise this party's clearing chain and membership structure</p>
              </div>
              <button class="btn-primary" [routerLink]="['/party', p.id, 'graph']">
                Open Graph View →
              </button>
            </div>
          </section>

        </div>
      }}
    </div>
  `,
  styles: [`
    .detail-page { min-height: 100vh; background: #0b0f18; color: #e8e6e1; }

    .page-accent-bar { height: 2px; background: linear-gradient(90deg, #009B77, transparent); }

    .topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 36px;
      border-bottom: 1px solid rgba(0,155,119,0.08);
      background: #0d1120;
    }

    .back-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; color: #3a5a4e;
      cursor: pointer; font-size: 13px; font-family: inherit;
      padding: 6px 10px; border-radius: 6px; transition: all 0.15s;
    }
    .back-btn:hover { color: #009B77; background: rgba(0,155,119,0.06); }

    .topbar-actions { display: flex; gap: 8px; }

    .btn-secondary {
      display: flex; align-items: center; gap: 6px;
      background: rgba(0,155,119,0.06);
      border: 1px solid rgba(0,155,119,0.2);
      color: #009B77; padding: 8px 16px; border-radius: 8px;
      cursor: pointer; font-size: 13px; font-family: inherit; transition: all 0.15s;
    }
    .btn-secondary:hover { background: rgba(0,155,119,0.12); border-color: #009B77; }

    .loading-state, .error-state {
      display: flex; align-items: center; gap: 12px;
      padding: 60px 40px; color: #3a5a4e; font-size: 14px;
    }
    .error-state { color: #f87171; }

    .spinner {
      width: 18px; height: 18px;
      border: 2px solid rgba(0,155,119,0.1);
      border-top-color: #009B77;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .detail-content { padding: 28px 36px; max-width: 960px; }

    /* Hero */
    .party-hero {
      display: flex; align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 32px;
      padding-bottom: 28px;
      border-bottom: 1px solid rgba(0,155,119,0.08);
    }
    .hero-left { display: flex; align-items: center; gap: 18px; }

    .party-avatar {
      width: 54px; height: 54px; border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; font-weight: 800; flex-shrink: 0;
    }
    .t-market { background: rgba(0,155,119,0.12); color: #009B77; border: 1px solid rgba(0,155,119,0.25); }
    .t-ccp    { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
    .t-firm   { background: rgba(59,130,246,0.1); color: #60a5fa; border: 1px solid rgba(59,130,246,0.2); }
    .t-client { background: rgba(168,85,247,0.1); color: #c084fc; border: 1px solid rgba(168,85,247,0.2); }
    .t-default { background: rgba(255,255,255,0.04); color: #9ca3af; border: 1px solid rgba(255,255,255,0.08); }

    .party-title { font-size: 24px; font-weight: 800; color: #f1f0eb; margin-bottom: 8px; letter-spacing: -0.02em; }
    .party-meta { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }

    .meta-chip {
      font-size: 11px; padding: 3px 9px; border-radius: 4px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #5a7a6e;
    }
    .type-chip.tc-market { background: rgba(0,155,119,0.08); border-color: rgba(0,155,119,0.2); color: #009B77; }
    .type-chip.tc-firm   { background: rgba(59,130,246,0.08); border-color: rgba(59,130,246,0.2); color: #60a5fa; }
    .type-chip.tc-client { background: rgba(168,85,247,0.08); border-color: rgba(168,85,247,0.2); color: #c084fc; }
    .type-chip.tc-ccp    { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.2); color: #f59e0b; }

    .status-chip {
      display: inline-flex; align-items: center; gap: 5px;
      font-size: 11px; padding: 3px 9px; border-radius: 4px;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #5a7a6e;
    }
    .status-chip.active { background: rgba(0,155,119,0.08); border-color: rgba(0,155,119,0.2); color: #009B77; }
    .status-chip.small { font-size: 10px; padding: 2px 7px; }
    .status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

    .mock-badge {
      font-size: 10px; padding: 2px 7px; border-radius: 3px;
      background: rgba(0,155,119,0.06); border: 1px solid rgba(0,155,119,0.15); color: #009B77;
      font-family: 'JetBrains Mono', monospace;
    }

    .hero-stats { display: flex; gap: 12px; }
    .stat-card {
      background: rgba(0,155,119,0.06);
      border: 1px solid rgba(0,155,119,0.12);
      border-radius: 10px; padding: 12px 20px;
      text-align: center; min-width: 80px;
    }
    .stat-val { display: block; font-size: 22px; font-weight: 800; color: #009B77; line-height: 1; margin-bottom: 4px; }
    .stat-label { font-size: 10px; color: #1e3a2e; text-transform: uppercase; letter-spacing: 0.07em; }

    /* Layout */
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }

    .detail-section { margin-bottom: 28px; }

    .section-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px; font-weight: 600; color: #1e3a2e;
      text-transform: uppercase; letter-spacing: 0.08em;
      margin-bottom: 14px;
    }
    .section-title svg { color: #009B77; }
    .count-badge {
      background: rgba(0,155,119,0.08); border: 1px solid rgba(0,155,119,0.15);
      color: #009B77; font-size: 10px; padding: 1px 7px; border-radius: 10px; font-weight: 500;
    }

    .id-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .id-card {
      background: #0d1120; border: 1px solid rgba(255,255,255,0.04);
      border-radius: 8px; padding: 12px 14px;
      display: flex; flex-direction: column; gap: 3px;
    }
    .id-card.highlight { border-color: rgba(0,155,119,0.15); }
    .id-label { font-size: 10px; color: #1e3a2e; text-transform: uppercase; letter-spacing: 0.06em; }
    .id-value { font-size: 13px; color: #e8e6e1; }
    .id-value.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; }
    .id-value.green { color: #009B77; }

    /* Roles */
    .roles-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 10px; }
    .role-card {
      display: flex;
      background: #0d1120; border: 1px solid rgba(255,255,255,0.04);
      border-radius: 10px; overflow: hidden;
    }
    .role-indicator { width: 3px; background: linear-gradient(180deg, #009B77, #007a5e); flex-shrink: 0; }
    .role-body { padding: 12px 14px; flex: 1; }
    .role-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .role-type { font-weight: 600; font-size: 13px; color: #e8e6e1; }
    .role-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 11px; color: #3a5a4e; }
    .role-meta strong { color: #5a7a6e; }
    .meta-item { display: flex; align-items: center; gap: 4px; }
    .empty-text { color: #1e3a2e; font-size: 13px; }
    .empty-section { display: flex; align-items: center; gap: 10px; }

    /* Accounts table */
    .accounts-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .accounts-table th {
      text-align: left; padding: 9px 12px;
      color: #1e3a2e; font-size: 10px; text-transform: uppercase; letter-spacing: 0.07em;
      border-bottom: 1px solid rgba(0,155,119,0.08); font-weight: 600;
    }
    .accounts-table td { padding: 11px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); vertical-align: middle; }
    .accounts-table tbody tr:hover { background: rgba(0,155,119,0.03); }
    .acc-code-badge {
      font-family: 'JetBrains Mono', monospace; font-size: 12px;
      background: rgba(0,155,119,0.08); border: 1px solid rgba(0,155,119,0.2);
      color: #009B77; padding: 3px 8px; border-radius: 5px;
    }
    .mono-sm { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #5a7a6e; }

    /* Graph CTA */
    .graph-cta {
      position: relative;
      background: #0d1120;
      border: 1px solid rgba(0,155,119,0.2);
      border-radius: 14px;
      padding: 24px 28px;
      overflow: hidden;
      margin-top: 8px;
    }
    .cta-glow {
      position: absolute;
      top: -20px; right: -20px;
      width: 120px; height: 120px;
      background: radial-gradient(circle, rgba(0,155,119,0.15) 0%, transparent 70%);
      pointer-events: none;
    }
    .cta-content { display: flex; align-items: center; gap: 20px; position: relative; }
    .cta-icon {
      width: 48px; height: 48px; flex-shrink: 0;
      background: rgba(0,155,119,0.1); border: 1px solid rgba(0,155,119,0.2);
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
    }
    .cta-title { font-size: 15px; font-weight: 700; color: #e8e6e1; margin-bottom: 3px; }
    .cta-desc { font-size: 12px; color: #3a5a4e; }
    .btn-primary {
      display: flex; align-items: center; gap: 8px;
      margin-left: auto; flex-shrink: 0;
      background: linear-gradient(135deg, #007a5e, #009B77);
      border: none; color: #fff;
      padding: 11px 22px; border-radius: 8px;
      cursor: pointer; font-size: 13px; font-family: inherit;
      font-weight: 600; transition: opacity 0.15s;
      box-shadow: 0 0 20px rgba(0,155,119,0.25);
    }
    .btn-primary:hover { opacity: 0.88; }
  `]
})
export class PartyDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private partyService = inject(PartyService);

  party = signal<Party | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.partyService.getById(id).subscribe({
      next: p => { this.party.set(p); this.loading.set(false); },
      error: err => { this.error.set(err?.message ?? 'Not found'); this.loading.set(false); }
    });
  }

  getTier(p: Party): string {
    const t = p.partyType?.toLowerCase() ?? '';
    if (t === 'market') return 'market';
    if (t === 'ccp') return 'ccp';
    if (t === 'firm') return 'firm';
    if (t === 'client') return 'client';
    return 'default';
  }

  goBack() {
    const q = this.route.snapshot.queryParamMap.get('q');
    this.router.navigate(['/search'], { queryParams: q ? { q } : {} });
  }
}
