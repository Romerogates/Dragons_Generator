import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { environment } from '@env/environment';
import { GuideCommentsService } from './guide-comments.service';

describe('GuideCommentsService', () => {
  let service: GuideCommentsService;
  let http: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...zonelessTestProviders, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(GuideCommentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists topic stats', () => {
    let got: unknown;
    service.listStats().subscribe((v) => (got = v));
    const req = http.expectOne(`${api}/guide/topics/stats`);
    expect(req.request.method).toBe('GET');
    req.flush([{ topicId: 'faq', commentCount: 2, lastCommentAt: null }]);
    expect(got).toEqual([{ topicId: 'faq', commentCount: 2, lastCommentAt: null }]);
  });

  it('creates a comment with optional parent', () => {
    service.createComment('faq', 'Hello', 'parent-1').subscribe();
    const req = http.expectOne(`${api}/guide/topics/faq/comments`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ body: 'Hello', parentId: 'parent-1' });
    req.flush({
      id: 'c1',
      topicId: 'faq',
      userId: 'u1',
      authorName: 'A',
      body: 'Hello',
      parentId: 'parent-1',
      createdAt: new Date().toISOString(),
      likeCount: 0,
      likedByMe: false,
    });
  });

  it('toggles like', () => {
    service.toggleLike('c1').subscribe();
    const req = http.expectOne(`${api}/guide/comments/c1/like`);
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'c1',
      topicId: 'faq',
      userId: 'u1',
      authorName: 'A',
      body: 'x',
      parentId: null,
      createdAt: new Date().toISOString(),
      likeCount: 1,
      likedByMe: true,
    });
  });
});
