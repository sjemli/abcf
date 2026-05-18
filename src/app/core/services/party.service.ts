import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Party, SearchResult, PartyGraph, PagedResponse } from '../models/party.model';
import { MOCK_PARTIES, MOCK_GRAPHS } from '../mock-data';
import { environment } from '../../../environments/environment';

export type SearchField = 'name' | 'lei' | 'crds';

@Injectable({ providedIn: 'root' })
export class PartyService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  /**
   * Search parties by a specific field.
   * Mock data is checked first; falls back to the API only when no mock matches.
   *
   * API endpoints used:
   *   GET /parties/search?name=&page=&pageSize=
   *   GET /parties/search?lei=&page=&pageSize=
   *   GET /parties/search?crds=&page=&pageSize=
   */
  search(
    query: string,
    field: SearchField,
    page = 1,
    pageSize = 20,
  ): Observable<PagedResponse<SearchResult>> {
    const q = query.trim().toLowerCase();
    if (!q) return of({ data: [], total: 0, page, pageSize });

    // ── Mock-first: only match the chosen field ──────────────────────
    const hits = MOCK_PARTIES
      .filter(p => {
        switch (field) {
          case 'name': return p.name.toLowerCase().includes(q);
          case 'lei':  return p.lei.toLowerCase().includes(q);
          case 'crds': return p.crdsCode.toLowerCase().includes(q);
        }
      })
      .map(p => ({ party: p, matchedOn: field }));

    if (hits.length > 0) {
      const start = (page - 1) * pageSize;
      return of({
        data: hits.slice(start, start + pageSize),
        total: hits.length,
        page,
        pageSize,
      });
    }

    // ── API fallback ─────────────────────────────────────────────────
    const params = new HttpParams()
      .set(field, query.trim())   // e.g. ?name=BNPP  or  ?lei=R0M…  or  ?crds=BEDUPAR
      .set('page', page)
      .set('pageSize', pageSize);

    return this.http
      .get<PagedResponse<SearchResult>>(`${this.base}/parties/search`, { params })
      .pipe(catchError(err => throwError(() => err)));
  }

  getById(id: string): Observable<Party> {
    const mock = MOCK_PARTIES.find(p => p.id === id);
    if (mock) return of(mock);
    return this.http
      .get<Party>(`${this.base}/parties/${id}`)
      .pipe(catchError(err => throwError(() => err)));
  }

  getGraphsForParty(partyId: string): Observable<PartyGraph[]> {
    const mockHits = MOCK_GRAPHS.filter(g => g.partyIds.includes(partyId));
    if (mockHits.length > 0) return of(mockHits);
    return this.http
      .get<PartyGraph[]>(`${this.base}/parties/${partyId}/graphs`)
      .pipe(catchError(() => of([])));
  }
}
