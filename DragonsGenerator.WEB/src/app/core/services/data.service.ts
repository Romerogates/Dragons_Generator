// core/services/data.service.ts

import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { Civilisation } from '@core/models/Civilisations/civilisations';
import { CivilisationSummary } from '@core/models/Civilisations/civilisation-summary';
import { CharacterClass } from '@core/models/CharacterClasses/character-class';
import { ClassSummary } from '@models/CharacterClasses/class-summary';
import { Species } from '@core/models/Species/species';
import { SpeciesSummary } from '@core/models/Species/species-summary';
import { SpeciesCodesResponse } from '@core/models/Species/species-codes';
import { Equipment } from '@core/models/Equipments/equipment';
import { EquipmentSummary } from '@core/models/Equipments/equipment-summary';
import { Spell } from '@core/models/Spells/spell';
import { SpellSummary } from '@core/models/Spells/spell-summary';
import { GenerateBackstoryRequest, GenerateBackstoryResponse } from '../models/Character/backstory';
import { Background } from '../models/Backgrounds/background';
import { BackgroundSummary } from '../models/Backgrounds/background-summary';
import { Handicap } from '../models/Handicaps/handicap';
import { HandicapRules } from '../models/Handicaps/handicap-rules';
import { LanguageSummary } from '../models/Languages/language-summary';
import { Language } from '../models/Languages/language';

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // =========================================================================
  // CACHE — un seul appel HTTP par ressource pendant toute la session
  // =========================================================================

  private cache = new Map<string, Observable<unknown>>();

  /**
   * Retourne un Observable caché : le premier subscribe déclenche le HTTP,
   * les suivants reçoivent le résultat en mémoire instantanément.
   */
  private cached<T>(key: string, factory: () => Observable<T>): Observable<T> {
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
    return this.http.get<Civilisation>(`${this.apiUrl}/civilisations/${id}`);
  }

  // =========================================================================
  // CLASSES
  // =========================================================================

  getClasses(): Observable<CharacterClass[]> {
    return this.cached('classes', () => this.http.get<CharacterClass[]>(`${this.apiUrl}/classes`));
  }

  getClassesSummary(): Observable<ClassSummary[]> {
    return this.cached('classes-summary', () =>
      this.http.get<ClassSummary[]>(`${this.apiUrl}/classes/summary`),
    );
  }

  getClassById(id: string): Observable<CharacterClass> {
    return this.http.get<CharacterClass>(`${this.apiUrl}/classes/${id}`);
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
    return this.http.get<Equipment>(`${this.apiUrl}/equipments/${id}`);
  }

  getEquipmentsByType(type: string): Observable<Equipment[]> {
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
    return this.http.get<Spell>(`${this.apiUrl}/spells/${id}`);
  }

  getSpellsByLevel(level: number): Observable<Spell[]> {
    return this.http.get<Spell[]>(`${this.apiUrl}/spells/level/${level}`);
  }

  getSpellsBySchool(school: string): Observable<Spell[]> {
    return this.http.get<Spell[]>(`${this.apiUrl}/spells/school/${school}`);
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
    return this.http.get<Language>(`${this.apiUrl}/languages/${id}`);
  }

  getLanguagesByCategory(category: string): Observable<Language[]> {
    return this.http.get<Language[]>(`${this.apiUrl}/languages/category/${category}`);
  }

  // =========================================================================
  // BACKSTORY (POST — jamais caché)
  // =========================================================================

  generateBackstory(request: GenerateBackstoryRequest): Observable<GenerateBackstoryResponse> {
    return this.http.post<GenerateBackstoryResponse>(`${this.apiUrl}/generate-backstory`, request);
  }
}
