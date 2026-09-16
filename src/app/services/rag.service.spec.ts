import { TestBed } from '@angular/core/testing';
import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';

import { RagService } from './rag.service';

const SEMANTIC_URL = '/api/rag/search/semantic';
const NAMED_QUERIES_URL = '/api/rag/named-queries';

describe('RagService', () => {

  let httpMock: HttpTestingController;
  let service: RagService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(RagService);
    // AuthService validates any restored session from its constructor; there is none here.
    httpMock.match(() => true).forEach(r => r.flush({}));
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('sendsOnlyTheFieldsTheCallerSetSoAnUntouchedSearchIsUnchanged', async () => {
    const pending = firstValueFrom(service.search('invoices'));
    const request = httpMock.expectOne(SEMANTIC_URL);

    // #135's document budget is opt-in: a request that says nothing about documents must look exactly
    // like the one this UI has always sent, or every existing result set changes.
    expect(request.request.body).toEqual({ query: 'invoices', topK: 10 });

    request.flush({ results: [] });
    await pending;
  });

  it('sendsTheDocumentBudgetAndTheSourceScopeWhenSet', async () => {
    const pending = firstValueFrom(service.search('invoices', {
      sourceType: 'cmis',
      filter: "cin_sourceId = 'cmis:docmgr'",
      namedQuery: 'recent',
      topDocuments: 20,
      chunksPerDocument: 3
    }));

    const request = httpMock.expectOne(SEMANTIC_URL);
    expect(request.request.body).toEqual({
      query: 'invoices',
      topK: 10,
      sourceType: 'cmis',
      filter: "cin_sourceId = 'cmis:docmgr'",
      namedQuery: 'recent',
      topDocuments: 20,
      chunksPerDocument: 3
    });

    request.flush({ results: [] });
    await pending;
  });

  it('carriesTheDocumentCountAndChunkTypeOffTheResponse', async () => {
    const pending = firstValueFrom(service.search('invoices', { topDocuments: 2 }));
    httpMock.expectOne(SEMANTIC_URL).flush({
      searchTimeMs: 42,
      documentCount: 2,
      appliedTopDocuments: 2,
      appliedChunksPerDocument: 3,
      results: [
        {
          rank: 1, score: 0.9, chunkText: '| a | b |',
          sourceDocument: { nodeId: 'n1', name: 'sheet.xlsx', sourceType: 'alfresco' },
          chunkMetadata: { chunkType: 'TABLE' }
        },
        {
          rank: 2, score: 0.8, chunkText: 'prose',
          sourceDocument: { nodeId: 'n2', name: 'memo.pdf', sourceType: 'cmis' }
        }
      ]
    });

    const outcome = await pending;
    expect(outcome.documentCount).toBe(2);
    expect(outcome.appliedTopDocuments).toBe(2);
    expect(outcome.appliedChunksPerDocument).toBe(3);
    expect(outcome.searchTimeMs).toBe(42);

    // A TABLE chunk has to survive the mapping, or the view cannot tell it from prose.
    expect(outcome.results[0].chunkType).toBe('TABLE');
    expect(outcome.results[1].chunkType).toBeUndefined();
    // An unstyled source type reaches the view intact rather than being coerced to a known one.
    expect(outcome.results[1].source).toBe('cmis');
  });

  it('namesAHitFromItsNodeIdWhenTheSourceOmitsTheName', async () => {
    // Measured against a live stack: a connector's hits carry documentId, nodeId and sourceId only, so
    // every one of them rendered as "(untitled)". The nodeId is a path for any connector that walks one.
    const pending = firstValueFrom(service.search('invoices'));
    httpMock.expectOne(SEMANTIC_URL).flush({
      results: [
        { rank: 1, score: 0.9, chunkText: 'x',
          sourceDocument: { nodeId: '/data/connector/quarterly.md', sourceId: 'sample-directory:local' } },
        { rank: 2, score: 0.8, chunkText: 'y',
          sourceDocument: { nodeId: 'opaque-id', sourceId: 'cmis:docmgr' } },
        { rank: 3, score: 0.7, chunkText: 'z',
          sourceDocument: { nodeId: 'n3', name: 'Real Name.pdf', sourceId: 'alfresco:acs' } }
      ]
    });

    const outcome = await pending;
    expect(outcome.results.map(r => r.title)).toEqual(['quarterly.md', 'opaque-id', 'Real Name.pdf']);
    // The type comes off the qualified source id when the field is absent.
    expect(outcome.results.map(r => r.source)).toEqual(['sample-directory', 'cmis', 'alfresco']);
  });

  it('sendsTheSameScopeOnAComparisonSearchAsOnTheMainOne', async () => {
    const headers = new HttpHeaders().set('Authorization', 'Basic dGlja2V0Og==');
    const pending = firstValueFrom(service.searchWithHeaders('invoices', headers, {
      sourceType: 'alfresco',
      filter: "cin_ingestProperties.source_mimeType = 'application/pdf'"
    }));

    const request = httpMock.expectOne(SEMANTIC_URL);
    // Dropping the filter here diffs a filtered search against an unfiltered one and reports
    // facet-excluded documents as ones the other identity cannot see (#12).
    expect(request.request.body).toEqual({
      query: 'invoices',
      topK: 10,
      sourceType: 'alfresco',
      filter: "cin_ingestProperties.source_mimeType = 'application/pdf'"
    });
    expect(request.request.headers.get('Authorization')).toBe('Basic dGlja2V0Og==');

    request.flush({ results: [] });
    await pending;
  });

  it('treatsAFailedNamedQueryListAsNoSavedQueries', async () => {
    // The selector is an optional convenience; its endpoint failing must not surface as an error.
    const pending = firstValueFrom(service.getNamedQueries());
    httpMock.expectOne(NAMED_QUERIES_URL).error(new ProgressEvent('network error'));

    expect(await pending).toEqual([]);
  });

  it('offersNoConnectorRequestWhenNoUrlIsConfigured', () => {
    // /api/connectors is not a rag-service route and nothing proxies it, so with no URL configured the
    // status page must not guess one.
    expect(service.getConnectors()).toBeNull();
  });
});
