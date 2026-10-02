import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { GuideTopicPage } from './guide-topic';
import { GuideCommentsService } from '@core/services/guide-comments.service';
import { AuthService } from '@core/services/auth.service';

describe('GuideTopicPage', () => {
  let fixture: ComponentFixture<GuideTopicPage>;
  let component: GuideTopicPage;
  const paramMap$ = new BehaviorSubject(convertToParamMap({ topicId: 'faq' }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GuideTopicPage],
      providers: [
        ...zonelessTestProviders,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() },
        },
        {
          provide: GuideCommentsService,
          useValue: {
            listComments: () => of([]),
            createComment: () => of({}),
            toggleLike: () => of({}),
            deleteComment: () => of(undefined),
          },
        },
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => false,
            user: () => null,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GuideTopicPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads a known topic', () => {
    expect(component.topic()?.id).toBe('faq');
    expect(component.topic()?.title).toContain('FAQ');
  });

  it('shows introuvable for unknown topic id', () => {
    paramMap$.next(convertToParamMap({ topicId: 'topic-inexistant-xyz' }));
    fixture.detectChanges();
    expect(component.topic()).toBeUndefined();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toMatch(/introuvable/i);
  });
});
