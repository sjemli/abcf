import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-top-bar"></div>
        <div class="sidebar-logo">
          <div class="logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">
              <circle cx="11" cy="11" r="7"/>
              <path d="m21 21-4.35-4.35"/>
              <path d="M8 11h6M11 8v6" stroke-width="2"/>
            </svg>
          </div>
          <div class="logo-text-wrap">
            <span class="logo-caar">CAAR</span>
            <span class="logo-sub">Party Registry</span>
          </div>
        </div>
        <div class="sidebar-section-label">NAVIGATION</div>
        <nav class="sidebar-nav">
          <a routerLink="/search" routerLinkActive="active" class="nav-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <span>Party Search</span>
          </a>
        </nav>
        <div class="sidebar-divider"></div>
        <div class="sidebar-section-label">SYSTEM</div>
        <nav class="sidebar-nav">
          <div class="nav-info-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Mock + API Mode</span>
          </div>
        </nav>
        <div class="sidebar-footer">
          <div class="bnpp-branding">
            <span class="bnpp-logo">BNP PARIBAS</span>
            <span class="bnpp-sub">Global Markets</span>
          </div>
        </div>
      </aside>
      <main class="main-content">
        <router-outlet/>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; }
    .app-shell { display: flex; height: 100vh; background: #0b0f18; color: #e8e6e1; font-family: 'DM Sans', 'Segoe UI', sans-serif; }
    .sidebar { width: 220px; min-width: 220px; background: #0d1120; border-right: 1px solid rgba(0,155,119,0.15); display: flex; flex-direction: column; }
    .sidebar-top-bar { height: 3px; background: linear-gradient(90deg, #009B77, #00c896); flex-shrink: 0; }
    .sidebar-logo { display: flex; align-items: center; gap: 12px; padding: 20px 18px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .logo-icon { width: 38px; height: 38px; background: linear-gradient(135deg, #007a5e, #009B77); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 0 18px rgba(0,155,119,0.3); }
    .logo-text-wrap { display: flex; flex-direction: column; gap: 1px; }
    .logo-caar { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: 0.12em; line-height: 1; }
    .logo-sub { font-size: 10px; color: #009B77; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500; }
    .sidebar-section-label { font-size: 10px; font-weight: 600; color: #1e3a2e; letter-spacing: 0.1em; padding: 16px 18px 6px; }
    .sidebar-nav { padding: 0 10px 8px; }
    .nav-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 8px; color: #5a7a6e; text-decoration: none; font-size: 13px; font-weight: 500; transition: all 0.15s; border: 1px solid transparent; }
    .nav-item:hover { background: rgba(0,155,119,0.08); color: #e8e6e1; }
    .nav-item.active { background: rgba(0,155,119,0.12); color: #00c896; border-color: rgba(0,155,119,0.25); }
    .nav-info-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; color: #1e3a2e; font-size: 11px; }
    .sidebar-divider { height: 1px; background: rgba(255,255,255,0.04); margin: 8px 18px; }
    .sidebar-footer { margin-top: auto; padding: 16px 18px; border-top: 1px solid rgba(0,155,119,0.1); }
    .bnpp-branding { display: flex; flex-direction: column; gap: 2px; }
    .bnpp-logo { font-size: 11px; font-weight: 800; color: #009B77; letter-spacing: 0.14em; }
    .bnpp-sub { font-size: 10px; color: #1e3a2e; letter-spacing: 0.04em; }
    .main-content { flex: 1; overflow: auto; }
  `],
})
export class AppComponent {}
