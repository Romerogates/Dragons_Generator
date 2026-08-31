import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { fromEvent } from 'rxjs';
import { auditTime } from 'rxjs/operators';
import {
  GUIDE_ALL_NAV,
  GUIDE_NAV_GROUPS,
  GUIDE_ARSENAL_FLOW,
  GUIDE_BLOG_POSTS,
  GUIDE_CAMPAIGN_MJ_FLOW,
  GUIDE_CAMPAIGN_PLAYER_FLOW,
  GUIDE_CHARACTER_STEPS,
  GUIDE_COMBAT_FLOW,
  GUIDE_DM_CHECKLIST,
  GUIDE_DUNGEON_EDITOR_TOOLS,
  GUIDE_DUNGEON_GEN_STEPS,
  GUIDE_DUNGEON_THEMES,
  GUIDE_FAQ_ITEMS,
  GUIDE_FEATURE_INDEX,
  GUIDE_FLASH_CARDS,
  GUIDE_GLOSSARY,
  GUIDE_NOTIFICATION_EVENTS,
  GUIDE_ONESHOT_STEPS,
  GUIDE_PLAYER_CHECKLIST,
  GUIDE_PROPOSAL_FLOW,
  GUIDE_QUICK_CARDS,
  GUIDE_START_STEPS,
  GUIDE_TABLE_PLAY_STEPS,
  GUIDE_TIPS,
  GUIDE_UPDATED_AT,
  GUIDE_VERSION,
} from './guide-content';

export type {
  GuideAudience,
  GuideBlogPost,
  GuideChecklistItem,
  GuideFaqItem,
  GuideFlashCard,
  GuideGlossaryItem,
  GuideIndexItem,
  GuideNavItem,
  GuideOneshotStep,
  GuideQuickCard,
  GuideStep,
} from './guide.types';

import type { GuideAudience, GuideChecklistItem, GuideNavItem, GuideQuickCard, GuideStep } from './guide.types';
import { GuidePreferencesService } from '@core/services/guide-preferences.service';

const AUDIENCE_KEY = 'dragons-guide-audience';
const FEEDBACK_KEY = 'dragons-guide-feedback';
const GUIDE_PATH = '/guide';
const SCROLL_OFFSET_PX = 88;

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guide.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class GuidePage implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroyRef = inject(DestroyRef);
  private readonly guidePrefs = inject(GuidePreferencesService);
  private observer: IntersectionObserver | null = null;
  private readonly prefetched = new Set<string>();

  readonly guideUpdatedAt = GUIDE_UPDATED_AT;
  readonly guideVersion = GUIDE_VERSION;

  readonly audience = signal<GuideAudience>('all');
  readonly activeSection = signal('parcours');
  readonly openFaqId = signal<string | null>(null);
  readonly characterExpanded = signal(false);
  readonly checklistDone = signal<Record<string, boolean>>({});
  readonly searchQuery = signal('');
  readonly scrollProgress = signal(0);
  readonly showBackToTop = signal(false);
  readonly copyToast = signal<string | null>(null);
  readonly sectionFeedback = signal<Record<string, 'yes' | 'no'>>({});
  readonly collapsedGroups = signal<Record<string, true>>({});
  readonly sommaireFadeTop = signal(false);
  readonly sommaireFadeBottom = signal(true);

  readonly tipOfDay = computed(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    return GUIDE_TIPS[day % GUIDE_TIPS.length];
  });

  readonly allNav = GUIDE_ALL_NAV;
  readonly quickCards = GUIDE_QUICK_CARDS;
  readonly blogPosts = GUIDE_BLOG_POSTS;
  readonly oneshotSteps = GUIDE_ONESHOT_STEPS;
  readonly flashCards = GUIDE_FLASH_CARDS;
  readonly startSteps = GUIDE_START_STEPS;
  readonly characterSteps = GUIDE_CHARACTER_STEPS;
  readonly campaignMjFlow = GUIDE_CAMPAIGN_MJ_FLOW;
  readonly campaignPlayerFlow = GUIDE_CAMPAIGN_PLAYER_FLOW;
  readonly proposalFlow = GUIDE_PROPOSAL_FLOW;
  readonly arsenalFlow = GUIDE_ARSENAL_FLOW;
  readonly combatFlow = GUIDE_COMBAT_FLOW;
  readonly notificationEvents = GUIDE_NOTIFICATION_EVENTS;
  readonly tablePlaySteps = GUIDE_TABLE_PLAY_STEPS;
  readonly dungeonGenSteps = GUIDE_DUNGEON_GEN_STEPS;
  readonly dungeonEditorTools = GUIDE_DUNGEON_EDITOR_TOOLS;
  readonly dungeonThemes = GUIDE_DUNGEON_THEMES;
  readonly dmChecklist = GUIDE_DM_CHECKLIST;
  readonly playerChecklist = GUIDE_PLAYER_CHECKLIST;
  readonly faqItems = GUIDE_FAQ_ITEMS;
  readonly glossary = GUIDE_GLOSSARY;
  readonly featureIndex = GUIDE_FEATURE_INDEX;

  readonly visibleBlogPosts = computed(() => {
    const read = this.guidePrefs.readNewsIds();
    return this.blogPosts.filter((post) => !read[post.id]);
  });

  readonly unreadNewsCount = computed(() => this.visibleBlogPosts().length);

  readonly nav = computed(() => {
    const a = this.audience();
    const q = this.searchQuery().trim().toLowerCase();
    return this.allNav.filter((item) => {
      if (!this.matchesAudience(item.audience, a)) return false;
      if (!q) return true;
      return item.label.toLowerCase().includes(q);
    });
  });

  readonly navGroups = computed(() => {
    const items = this.nav();
    const byId = new Map(items.map((item) => [item.id, item]));
    return GUIDE_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.sectionIds
        .map((id) => byId.get(id))
        .filter((item): item is GuideNavItem => !!item),
      unreadCount: group.sectionIds.filter(
        (id) => byId.has(id) && this.guidePrefs.isSectionUnread(id),
      ).length,
    })).filter((group) => group.items.length > 0);
  });

  readonly unreadSectionsCount = computed(() =>
    this.nav().filter((item) => this.guidePrefs.isSectionUnread(item.id)).length,
  );

  readonly prevChapter = computed(() => {
    const items = this.nav();
    const idx = items.findIndex((item) => item.id === this.activeSection());
    if (idx <= 0) return null;
    return items[idx - 1];
  });

  readonly nextChapter = computed(() => {
    const items = this.nav();
    const idx = items.findIndex((item) => item.id === this.activeSection());
    if (idx < 0 || idx >= items.length - 1) return null;
    return items[idx + 1];
  });

  readonly chapterPosition = computed(() => {
    const items = this.nav();
    const idx = items.findIndex((item) => item.id === this.activeSection());
    if (idx < 0) return null;
    return { current: idx + 1, total: items.length };
  });

  readonly filteredFlashCards = computed(() => {
    const a = this.audience();
    const q = this.searchQuery().trim().toLowerCase();
    return this.flashCards.filter((c) => {
      if (!this.matchesAudience(c.audience, a)) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.bullets.some((b) => b.toLowerCase().includes(q))
      );
    });
  });

  readonly filteredStartSteps = computed(() => {
    const a = this.audience();
    return this.startSteps.filter((s) => {
      if (a === 'all') return true;
      if (!s.badge || s.badge === 'Tous') return true;
      if (a === 'dm') return s.badge !== 'Joueur';
      return s.badge !== 'MJ';
    });
  });

  readonly filteredFaq = computed(() => {
    const a = this.audience();
    const q = this.searchQuery().trim().toLowerCase();
    return this.faqItems.filter((f) => {
      if (!this.matchesAudience(f.audience, a)) return false;
      if (!q) return true;
      return f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    });
  });

  readonly filteredGlossary = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.glossary;
    return this.glossary.filter(
      (g) => g.term.toLowerCase().includes(q) || g.definition.toLowerCase().includes(q),
    );
  });

  readonly filteredIndex = computed(() => {
    const a = this.audience();
    const q = this.searchQuery().trim().toLowerCase();
    return this.featureIndex.filter((i) => {
      if (!this.matchesAudience(i.audience, a)) return false;
      if (!q) return true;
      return i.label.toLowerCase().includes(q) || i.description.toLowerCase().includes(q);
    });
  });

  readonly searchHitCount = computed(() => {
    const q = this.searchQuery().trim();
    if (!q) return 0;
    return (
      this.filteredFaq().length +
      this.filteredGlossary().length +
      this.filteredIndex().length +
      this.filteredFlashCards().length +
      this.nav().length
    );
  });

  readonly showDm = computed(() => this.audience() !== 'player');
  readonly showPlayer = computed(() => this.audience() !== 'dm');

  ngOnInit(): void {
    try {
      const fb = localStorage.getItem(FEEDBACK_KEY);
      if (fb) this.sectionFeedback.set(JSON.parse(fb) as Record<string, 'yes' | 'no'>);
    } catch {
      /* ignore */
    }
    void this.guidePrefs.load().then(() => {
      this.audience.set(this.guidePrefs.audience());
    });
  }

  markNewsRead(newsId: string): void {
    this.guidePrefs.markRead(newsId);
  }

  markNewsUnread(newsId: string): void {
    this.guidePrefs.markUnread(newsId);
  }

  markAllNewsRead(): void {
    this.guidePrefs.markAllNews(this.blogPosts.map((post) => post.id));
  }

  readonly readPosts = computed(() => this.guidePrefs.readPosts());

  ngAfterViewInit(): void {
    this.setupScrollSpy();
    fromEvent(window, 'hashchange')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const id = location.hash.replace('#', '');
        if (id) this.navigateToHash(id, false);
      });

    fromEvent(window, 'scroll')
      .pipe(auditTime(40), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateScrollChrome());

    this.updateScrollChrome();

    const hash = location.hash.replace('#', '');
    if (hash) {
      queueMicrotask(() => this.navigateToHash(hash, false));
    }
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  setAudience(value: GuideAudience): void {
    this.audience.set(value);
    this.guidePrefs.setAudience(value);
    queueMicrotask(() => {
      this.setupScrollSpy();
      const hash = location.hash.replace('#', '');
      if (hash) this.scrollToHash(hash);
    });
  }

  onSearchInput(ev: Event): void {
    this.searchQuery.set((ev.target as HTMLInputElement).value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
  }

  toggleFaq(id: string): void {
    this.openFaqId.update((cur) => (cur === id ? null : id));
  }

  toggleCharacterExpanded(): void {
    this.characterExpanded.update((v) => !v);
  }

  toggleChecklist(id: string): void {
    this.checklistDone.update((m) => ({ ...m, [id]: !m[id] }));
  }

  checklistProgress(items: GuideChecklistItem[]): { done: number; total: number } {
    const done = items.filter((i) => this.checklistDone()[i.id]).length;
    return { done, total: items.length };
  }

  async copySectionLink(sectionId: string): Promise<void> {
    const url = `${location.origin}${GUIDE_PATH}#${sectionId}`;
    try {
      await navigator.clipboard.writeText(url);
      this.copyToast.set('Lien copié');
    } catch {
      this.copyToast.set('Impossible de copier');
    }
    setTimeout(() => this.copyToast.set(null), 1800);
  }

  sectionHref(sectionId: string): string {
    return `#${sectionId}`;
  }

  setSectionFeedback(sectionId: string, value: 'yes' | 'no'): void {
    this.sectionFeedback.update((m) => {
      const next = { ...m, [sectionId]: value };
      try {
        localStorage.setItem(FEEDBACK_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  supportQuery(sectionLabel: string): { subject: string; message: string } {
    return {
      subject: `Guide — retour sur « ${sectionLabel} »`,
      message: `La section « ${sectionLabel} » du guide ne m’a pas aidé.\n\nCe qui n’était pas clair :\n`,
    };
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  scrollToSection(sectionId: string, event?: Event): void {
    event?.preventDefault();
    if (!sectionId.startsWith('faq-')) {
      this.guidePrefs.markSectionRead(sectionId);
    }
    this.navigateToHash(sectionId, true);
  }

  jumpToSection(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = select.value;
    if (id) this.scrollToSection(id);
    select.value = '';
  }

  isSectionUnread(sectionId: string): boolean {
    return this.guidePrefs.isSectionUnread(sectionId);
  }

  toggleNavGroup(groupId: string): void {
    this.collapsedGroups.update((current) => {
      const next = { ...current };
      if (next[groupId]) delete next[groupId];
      else next[groupId] = true;
      return next;
    });
  }

  isGroupCollapsed(groupId: string): boolean {
    return !!this.collapsedGroups()[groupId];
  }

  onSommaireScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const atTop = el.scrollTop < 6;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 6;
    this.sommaireFadeTop.set(!atTop);
    this.sommaireFadeBottom.set(!atBottom);
  }

  private navigateToHash(sectionId: string, updateHistory: boolean): void {
    this.ensureSectionVisible(sectionId);
    this.applyHash(sectionId);
    if (updateHistory) {
      const url = `${GUIDE_PATH}#${sectionId}`;
      history.replaceState(null, '', url);
    }
    queueMicrotask(() => this.scrollToHash(sectionId));
  }

  private ensureSectionVisible(sectionId: string): void {
    if (sectionId.startsWith('faq-')) return;
    const item = this.allNav.find((n) => n.id === sectionId);
    if (item?.audience === 'dm' && this.audience() === 'player') {
      this.guidePrefs.setAudience('all');
      this.audience.set('all');
      queueMicrotask(() => this.setupScrollSpy());
    }
  }

  private applyHash(sectionId: string): void {
    if (sectionId.startsWith('faq-')) {
      this.openFaqId.set(sectionId);
      this.activeSection.set('faq');
      return;
    }
    if (this.allNav.some((n) => n.id === sectionId)) {
      this.activeSection.set(sectionId);
    }
  }

  private scrollToHash(sectionId: string, attempt = 0): void {
    const el = document.getElementById(sectionId);
    if (!el) {
      if (attempt < 12) {
        window.setTimeout(() => this.scrollToHash(sectionId, attempt + 1), 50);
      }
      return;
    }
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX;
    window.scrollTo({ top: Math.max(0, top), behavior: attempt === 0 ? 'smooth' : 'auto' });
  }

  prefetch(key?: GuideQuickCard['prefetch']): void {
    if (!key || this.prefetched.has(key)) return;
    this.prefetched.add(key);
    switch (key) {
      case 'campaigns':
        void import('../campaigns/campaigns');
        break;
      case 'create':
        void import('../character-creation/character-creation');
        break;
      case 'support':
        void import('../support/support');
        break;
      case 'species':
        void import('@features/data/species/species.routes');
        break;
    }
  }

  badgeClass(badge?: GuideStep['badge']): string {
    if (badge === 'MJ') return 'bg-violet-950/50 text-violet-300 border-violet-800/50';
    if (badge === 'Joueur') return 'bg-sky-950/50 text-sky-300 border-sky-800/50';
    return 'bg-slate-800/50 text-slate-400 border-slate-700/50';
  }

  matchesAudience(item: GuideAudience, current: GuideAudience): boolean {
    if (current === 'all' || item === 'all') return true;
    return item === current;
  }

  private updateScrollChrome(): void {
    const doc = document.documentElement;
    const scrollTop = doc.scrollTop || document.body.scrollTop;
    const height = doc.scrollHeight - doc.clientHeight;
    this.scrollProgress.set(height > 0 ? Math.min(100, (scrollTop / height) * 100) : 0);
    this.showBackToTop.set(scrollTop > 480);
  }

  private setupScrollSpy(): void {
    this.observer?.disconnect();
    const ids = this.nav().map((n) => n.id);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);

    if (!elements.length) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const id = visible[0]?.target?.id;
        if (!id) return;
        this.activeSection.set(id);
        if (!id.startsWith('faq-')) {
          this.guidePrefs.markSectionRead(id);
        }
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0.1, 0.25, 0.5] },
    );

    for (const el of elements) this.observer.observe(el);
  }
}
