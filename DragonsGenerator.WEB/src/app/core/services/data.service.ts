// core/services/data.service.ts

import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { ConnectivityService } from './connectivity.service';
import { OfflineCodexService } from './offline-codex.service';
import { Civilisation } from '@core/models/Civilisations/civilisations';
import { CivilisationSummary } from '@core/models/Civilisations/civilisation-summary';
import { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { ClassSummary } from '@models/CharacterClasses/class-summary';
import {
  normalizeCharacterClass,
  normalizeCharacterClasses,
} from '@core/utils/class-data.adapter';
import { Species } from '@core/models/Species/species';
import { SpeciesSummary } from '@core/models/Species/species-summary';
import { SpeciesCodesResponse } from '@core/models/Species/species-codes';
import { Equipment } from '@core/models/Equipments/equipment';
import { EquipmentSummary } from '@core/models/Equipments/equipment-summary';
import { Spell } from '@core/models/Spells/spell';
import { SpellSummary } from '@core/models/Spells/spell-summary';
import { GenerateBackstoryRequest, GenerateBackstoryResponse } from '../models/Character/backstory';
import {
  GenerateAdventureRequest,
  GenerateAdventureResponse,
  GenerateCreatureStoryRequest,
  GenerateCreatureStoryResponse,
  GenerateCreatureStoriesBatchRequest,
  GenerateCreatureStoriesBatchResponse,
} from '../models/Story/story';
import { Background } from '../models/Backgrounds/background';
import { BackgroundSummary } from '../models/Backgrounds/background-summary';
import { Handicap } from '../models/Handicaps/handicap';
import { HandicapRules } from '../models/Handicaps/handicap-rules';
import { LanguageSummary } from '../models/Languages/language-summary';
import { Language } from '../models/Languages/language';
import { Skill, SkillSummary } from '../models/Skills/skill';
import { Feat, FeatSummary } from '../models/Feats/feat';
import { Deity, DeitySummary } from '../models/Deities/deity';
import { CombatAction, CombatActionSummary } from '../models/CombatActions/combat-action';
import { Creature } from '../models/Creatures/creature';
import { CreatureSummary } from '../models/Creatures/creature-summary';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private readonly connectivity = inject(ConnectivityService);
  private readonly offlineCodex = inject(OfflineCodexService);

  // =========================================================================
  // CACHE — un seul appel HTTP par ressource pendant toute la session
  // =========================================================================

  private cache = new Map<string, Observable<unknown>>();

  private offlineList<T>(key: string): T | null {
    if (!this.connectivity.isOnline() && this.offlineCodex.isDownloaded()) {
      return this.offlineCodex.getSnapshot<T>(key);
    }
    return null;
  }

  private offlineById<T extends { id?: string }>(listKey: string, id: string): T | null {
    if (!this.connectivity.isOnline() && this.offlineCodex.isDownloaded()) {
      return this.offlineCodex.findById<T>(listKey, id);
    }
    return null;
  }

  /**
   * Retourne un Observable caché : le premier subscribe déclenche le HTTP,
   * les suivants reçoivent le résultat en mémoire instantanément.
   */
  private cached<T>(key: string, factory: () => Observable<T>): Observable<T> {
    const offline = this.offlineList<T>(key);
    if (offline !== null) return of(offline);

    if (!this.cache.has(key)) {
      this.cache.set(key, factory().pipe(shareReplay(1)));
    }
    return this.cache.get(key) as Observable<T>;
  }

  // =========================================================================
  // CIVILISATIONS
  // =========================================================================

  getCivilisations(): Observable<Civilisation[]> {
    return this.cached('civilisations', () =>
      this.http.get<Civilisation[]>(`${this.apiUrl}/civilisations`),
    );
  }

  getCivilisationsSummary(): Observable<CivilisationSummary[]> {
    return this.cached('civilisations-summary', () =>
      this.http.get<CivilisationSummary[]>(`${this.apiUrl}/civilisations/summary`),
    );
  }

  getCivilisationById(id: string): Observable<Civilisation> {
    const offline = this.offlineById<Civilisation>('civilisations', id);
    if (offline) return of(offline);
    return this.http.get<Civilisation>(`${this.apiUrl}/civilisations/${id}`);
  }

  // =========================================================================
  // CLASSES
  // =========================================================================

  getClasses(): Observable<CharacterClass[]> {
    return this.cached('classes', () =>
      this.http
        .get<CharacterClass[]>(`${this.apiUrl}/classes`)
        .pipe(map((list) => normalizeCharacterClasses(list))),
    );
  }

  getClassesSummary(): Observable<ClassSummary[]> {
    return this.cached('classes-summary', () =>
      this.http.get<ClassSummary[]>(`${this.apiUrl}/classes/summary`),
    );
  }

  getClassById(id: string): Observable<CharacterClass> {
    const offline = this.offlineById<CharacterClass>('classes', id);
    if (offline) return of(normalizeCharacterClass(offline));
    return this.http
      .get<CharacterClass>(`${this.apiUrl}/classes/${id}`)
      .pipe(map((cls) => normalizeCharacterClass(cls)));
  }

  // =========================================================================
  // SPECIES
  // =========================================================================

  getSpecies(): Observable<Species[]> {
    return this.cached('species', () => this.http.get<Species[]>(`${this.apiUrl}/species`));
  }

  getSpeciesSummary(): Observable<SpeciesSummary[]> {
    return this.cached('species-summary', () =>
      this.http.get<SpeciesSummary[]>(`${this.apiUrl}/species/summary`),
    );
  }

  getSpeciesCodes(): Observable<SpeciesCodesResponse> {
    return this.cached('species-codes', () =>
      this.http.get<SpeciesCodesResponse>(`${this.apiUrl}/species/codes`),
    );
  }

  getSpeciesById(id: string): Observable<Species> {
    const offline = this.offlineById<Species>('species', id);
    if (offline) return of(offline);
    return this.http.get<Species>(`${this.apiUrl}/species/${id}`);
  }

  // =========================================================================
  // EQUIPMENTS
  // =========================================================================

  getEquipments(): Observable<Equipment[]> {
    return this.cached('equipments', () => this.http.get<Equipment[]>(`${this.apiUrl}/equipments`));
  }

  getEquipmentsSummary(): Observable<EquipmentSummary[]> {
    return this.cached('equipments-summary', () =>
      this.http.get<EquipmentSummary[]>(`${this.apiUrl}/equipments/summary`),
    );
  }

  getEquipmentTypes(): Observable<string[]> {
    return this.cached('equipment-types', () =>
      this.http.get<string[]>(`${this.apiUrl}/equipments/types`),
    );
  }

  getEquipmentById(id: string): Observable<Equipment> {
    const offline = this.offlineById<Equipment>('equipments', id);
    if (offline) return of(offline);
    return this.http.get<Equipment>(`${this.apiUrl}/equipments/${id}`);
  }

  getEquipmentsByType(type: string): Observable<Equipment[]> {
    const offline = this.offlineList<Equipment[]>('equipments');
    if (offline) return of(offline.filter((e) => e.type === type));
    return this.http.get<Equipment[]>(`${this.apiUrl}/equipments/type/${type}`);
  }

  // =========================================================================
  // SPELLS
  // =========================================================================

  getSpells(): Observable<Spell[]> {
    return this.cached('spells', () => this.http.get<Spell[]>(`${this.apiUrl}/spells`));
  }

  getSpellsSummary(): Observable<SpellSummary[]> {
    return this.cached('spells-summary', () =>
      this.http.get<SpellSummary[]>(`${this.apiUrl}/spells/summary`),
    );
  }

  getSpellSchools(): Observable<string[]> {
    return this.cached('spell-schools', () =>
      this.http.get<string[]>(`${this.apiUrl}/spells/schools`),
    );
  }

  getSpellById(id: string): Observable<Spell> {
    const offline = this.offlineById<Spell>('spells', id);
    if (offline) return of(offline);
    return this.http.get<Spell>(`${this.apiUrl}/spells/${id}`);
  }

  getSpellsByLevel(level: number): Observable<Spell[]> {
    const offline = this.offlineList<Spell[]>('spells');
    if (offline) return of(offline.filter((s) => s.level === level));
    return this.http.get<Spell[]>(`${this.apiUrl}/spells/level/${level}`);
  }

  getSpellsBySchool(school: string): Observable<Spell[]> {
    const offline = this.offlineList<Spell[]>('spells');
    if (offline) return of(offline.filter((s) => s.school === school));
    return this.http.get<Spell[]>(`${this.apiUrl}/spells/school/${school}`);
  }

  // =========================================================================
  // CRÉATURES
  // =========================================================================

  getCreatures(): Observable<Creature[]> {
    return this.cached('creatures', () => this.http.get<Creature[]>(`${this.apiUrl}/creatures`));
  }

  getCreaturesSummary(): Observable<CreatureSummary[]> {
    return this.cached('creatures-summary', () =>
      this.http.get<CreatureSummary[]>(`${this.apiUrl}/creatures/summary`),
    );
  }

  getCreatureCategories(): Observable<string[]> {
    return this.cached('creature-categories', () =>
      this.http.get<string[]>(`${this.apiUrl}/creatures/categories`),
    );
  }

  getCreatureById(id: string): Observable<Creature> {
    const offline = this.offlineById<Creature>('creatures', id);
    if (offline) return of(offline);
    return this.http.get<Creature>(`${this.apiUrl}/creatures/${id}`);
  }

  getCreaturesByCategory(category: string): Observable<Creature[]> {
    const offline = this.offlineList<Creature[]>('creatures');
    if (offline) return of(offline.filter((c) => c.category === category));
    return this.http.get<Creature[]>(`${this.apiUrl}/creatures/category/${category}`);
  }

  // =========================================================================
  // BACKGROUNDS
  // =========================================================================

  getBackgrounds(): Observable<Background[]> {
    return this.cached('backgrounds', () =>
      this.http.get<Background[]>(`${this.apiUrl}/backgrounds`),
    );
  }

  getBackgroundsSummary(): Observable<BackgroundSummary[]> {
    return this.cached('backgrounds-summary', () =>
      this.http.get<BackgroundSummary[]>(`${this.apiUrl}/backgrounds/summary`),
    );
  }

  getBackgroundById(id: string): Observable<Background> {
    const offline = this.offlineById<Background>('backgrounds', id);
    if (offline) return of(offline);
    return this.http.get<Background>(`${this.apiUrl}/backgrounds/${id}`);
  }

  // =========================================================================
  // HANDICAPS
  // =========================================================================

  getHandicaps(): Observable<Handicap[]> {
    return this.cached('handicaps', () => this.http.get<Handicap[]>(`${this.apiUrl}/handicaps`));
  }

  getHandicapRules(): Observable<HandicapRules> {
    return this.cached('handicap-rules', () =>
      this.http.get<HandicapRules>(`${this.apiUrl}/handicaps/rules`),
    );
  }

  getHandicapById(id: string): Observable<Handicap> {
    const offline = this.offlineById<Handicap>('handicaps', id);
    if (offline) return of(offline);
    return this.http.get<Handicap>(`${this.apiUrl}/handicaps/${id}`);
  }

  // =========================================================================
  // LANGUAGES
  // =========================================================================

  getLanguages(): Observable<Language[]> {
    return this.cached('languages', () => this.http.get<Language[]>(`${this.apiUrl}/languages`));
  }

  getLanguagesSummary(): Observable<LanguageSummary[]> {
    return this.cached('languages-summary', () =>
      this.http.get<LanguageSummary[]>(`${this.apiUrl}/languages/summary`),
    );
  }

  getLanguageCategories(): Observable<string[]> {
    return this.cached('language-categories', () =>
      this.http.get<string[]>(`${this.apiUrl}/languages/categories`),
    );
  }

  getLanguageById(id: string): Observable<Language> {
    const offline = this.offlineById<Language>('languages', id);
    if (offline) return of(offline);
    return this.http.get<Language>(`${this.apiUrl}/languages/${id}`);
  }

  getLanguagesByCategory(category: string): Observable<Language[]> {
    const offline = this.offlineList<Language[]>('languages');
    if (offline) return of(offline.filter((l) => l.category === category));
    return this.http.get<Language[]>(`${this.apiUrl}/languages/category/${category}`);
  }

  // =========================================================================
  // BACKSTORY (POST — jamais caché)
  // =========================================================================

  generateBackstory(request: GenerateBackstoryRequest): Observable<GenerateBackstoryResponse> {
    return this.http.post<GenerateBackstoryResponse>(`${this.apiUrl}/generate-backstory`, request);
  }

  generateCreatureStory(
    request: GenerateCreatureStoryRequest,
  ): Observable<GenerateCreatureStoryResponse> {
    return this.http.post<GenerateCreatureStoryResponse>(`${this.apiUrl}/generate-creature-story`, request);
  }

  generateCreatureStoriesBatch(
    request: GenerateCreatureStoriesBatchRequest,
  ): Observable<GenerateCreatureStoriesBatchResponse> {
    return this.http.post<GenerateCreatureStoriesBatchResponse>(
      `${this.apiUrl}/generate-creature-stories-batch`,
      request,
    );
  }

  generateAdventure(request: GenerateAdventureRequest): Observable<GenerateAdventureResponse> {
    return this.http.post<GenerateAdventureResponse>(`${this.apiUrl}/generate-adventure`, request);
  }

  // =========================================================================
  // COMPÉTENCES, DONs, DIVINITÉS, ACTIONS DE COMBAT
  // =========================================================================

  getSkills(): Observable<Skill[]> {
    return this.cached('skills', () => this.http.get<Skill[]>(`${this.apiUrl}/skills`));
  }

  getSkillsSummary(): Observable<SkillSummary[]> {
    return this.cached('skills-summary', () =>
      this.http.get<SkillSummary[]>(`${this.apiUrl}/skills/summary`),
    );
  }

  getSkillById(id: string): Observable<Skill> {
    const offline = this.offlineById<Skill>('skills', id);
    if (offline) return of(offline);
    return this.http.get<Skill>(`${this.apiUrl}/skills/${id}`);
  }

  getFeats(): Observable<Feat[]> {
    return this.cached('feats', () => this.http.get<Feat[]>(`${this.apiUrl}/feats`));
  }

  getFeatsSummary(): Observable<FeatSummary[]> {
    return this.cached('feats-summary', () =>
      this.http.get<FeatSummary[]>(`${this.apiUrl}/feats/summary`),
    );
  }

  getFeatById(id: string): Observable<Feat> {
    const offline = this.offlineById<Feat>('feats', id);
    if (offline) return of(offline);
    return this.http.get<Feat>(`${this.apiUrl}/feats/${id}`);
  }

  getDeities(): Observable<Deity[]> {
    return this.cached('deities', () => this.http.get<Deity[]>(`${this.apiUrl}/deities`));
  }

  getDeitiesSummary(): Observable<DeitySummary[]> {
    return this.cached('deities-summary', () =>
      this.http.get<DeitySummary[]>(`${this.apiUrl}/deities/summary`),
    );
  }

  getDeityById(id: string): Observable<Deity> {
    const offline = this.offlineById<Deity>('deities', id);
    if (offline) return of(offline);
    return this.http.get<Deity>(`${this.apiUrl}/deities/${id}`);
  }

  getCombatActions(): Observable<CombatAction[]> {
    return this.cached('combat-actions', () =>
      this.http.get<CombatAction[]>(`${this.apiUrl}/combat-actions`),
    );
  }

  getCombatActionsSummary(): Observable<CombatActionSummary[]> {
    return this.cached('combat-actions-summary', () =>
      this.http.get<CombatActionSummary[]>(`${this.apiUrl}/combat-actions/summary`),
    );
  }

  getCombatActionById(id: string): Observable<CombatAction> {
    const offline = this.offlineById<CombatAction>('combat-actions', id);
    if (offline) return of(offline);
    return this.http.get<CombatAction>(`${this.apiUrl}/combat-actions/${id}`);
  }
}
