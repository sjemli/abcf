import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'search',
    pathMatch: 'full',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search/search.component').then(m => m.SearchComponent),
  },
  {
    path: 'party/:id',
    loadComponent: () =>
      import('./features/party-detail/party-detail.component').then(m => m.PartyDetailComponent),
  },
  {
    path: 'party/:id/graph',
    loadComponent: () =>
      import('./features/party-graph/party-graph.component').then(m => m.PartyGraphComponent),
  },
  { path: '**', redirectTo: 'search' },
];
