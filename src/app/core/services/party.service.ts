import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
      .set(field, query.trim())
      .set('page', page)
      .set('pageSize', pageSize);

    return this.http
      .get<PagedResponse<SearchResult>>(`${this.base}/parties/search`, { params })
      .pipe(catchError(err => throwError(() => err)));
  }

  /**
   * Returns a synchronous slice of the local mock array.
   * Used to populate the UI instantly on screen launch before
   * the real API responds.
   *
   * GET (local only — no HTTP call)
   */
  getMockParties(
    page = 1,
    pageSize = 20,
  ): PagedResponse<SearchResult> {
    const start = (page - 1) * pageSize;
    const data  = MOCK_PARTIES
      .slice(start, start + pageSize)
      .map(p => ({ party: { ...p, sourceSystem: 'MOCK' }, matchedOn: 'name' as SearchField }));

    return {
      data,
      total: MOCK_PARTIES.length,
      page,
      pageSize,
    };
  }

  /**
   * Fetches every party from the live API (paginated).
   * Called in the background after mocks are already displayed.
   * The component shows a "Backend Unreachable" popup when this errors.
   *
   * API endpoint used:
   *   GET /parties?page=&pageSize=
   */
  getAll(
    page = 1,
    pageSize = 20,
  ): Observable<PagedResponse<SearchResult>> {
    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    return this.http
      .get<PagedResponse<SearchResult>>(`${this.base}/parties`, { params })
      .pipe(
        // Normalise: if the API returns raw Party[] instead of SearchResult[],
        // wrap each item so the component always gets { party, matchedOn }
        map(res => ({
          ...res,
          data: res.data.map(item =>
            'party' in item
              ? item
              : ({ party: item, matchedOn: 'name' } as unknown as SearchResult)
          ),
        })),
        catchError(err => throwError(() => err)),
      );
  }

  /**
   * Fetch a single party by ID.
   * Mock-first, then API.
   *
   * API endpoint used:
   *   GET /parties/:id
   */
  getById(id: string): Observable<Party> {
    const mock = MOCK_PARTIES.find(p => p.id === id);
    if (mock) return of(mock);
    return this.http
      .get<Party>(`${this.base}/parties/${id}`)
      .pipe(catchError(err => throwError(() => err)));
  }

  /**
   * Fetch all graphs for a given party.
   * Mock-first, then API. Silently returns [] on API error.
   *
   * API endpoint used:
   *   GET /parties/:partyId/graphs
   */
  getGraphsForParty(partyId: string): Observable<PartyGraph[]> {
    const mockHits = MOCK_GRAPHS.filter(g => g.partyIds.includes(partyId));
    if (mockHits.length > 0) return of(mockHits);
    return this.http
      .get<PartyGraph[]>(`${this.base}/parties/${partyId}/graphs`)
      .pipe(catchError(() => of([])));
  }
}