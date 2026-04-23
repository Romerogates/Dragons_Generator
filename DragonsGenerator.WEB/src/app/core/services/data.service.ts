import { inject, Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root',
})
export class DataService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  // === Civilisations ===
  getCivilisations(): Observable<Civilisation[]> {
    return this.http.get<Civilisation[]>(`${this.apiUrl}/civilisations`);
  }
  getCivilisationById(id: string): Observable<Civilisation> {
    return this.http.get<Civilisation>(`${this.apiUrl}/civilisations/${id}`);
  }
  getCivilisationsSummary(): Observable<CivilisationSummary[]> {
    return this.http.get<CivilisationSummary[]>(`${this.apiUrl}/civilisations`);
  }

  // === Classes ===
  getClasses(): Observable<CharacterClass[]> {
    return this.http.get<CharacterClass[]>(`${this.apiUrl}/classes`);
  }
  getClassesSummary(): Observable<ClassSummary[]> {
    return this.http.get<ClassSummary[]>(`${this.apiUrl}/classes/summary`);
  }
  getClassById(id: string): Observable<CharacterClass> {
    return this.http.get<CharacterClass>(`${this.apiUrl}/classes/${id}`);
  }

  // === Species ===
  getSpecies(): Observable<Species[]> {
    return this.http.get<Species[]>(`${this.apiUrl}/species`);
  }
  getSpeciesSummary(): Observable<SpeciesSummary[]> {
    return this.http.get<SpeciesSummary[]>(`${this.apiUrl}/species/summary`);
  }
  getSpeciesCodes(): Observable<SpeciesCodesResponse> {
    return this.http.get<SpeciesCodesResponse>(`${this.apiUrl}/species/codes`);
  }
  getSpeciesById(id: string): Observable<Species> {
    return this.http.get<Species>(`${this.apiUrl}/species/${id}`);
  }

  // === Equipments ===
  getEquipments(): Observable<Equipment[]> {
    return this.http.get<Equipment[]>(`${this.apiUrl}/equipments`);
  }
  getEquipmentsSummary(): Observable<EquipmentSummary[]> {
    return this.http.get<EquipmentSummary[]>(`${this.apiUrl}/equipments/summary`);
  }
  getEquipmentById(id: string): Observable<Equipment> {
    return this.http.get<Equipment>(`${this.apiUrl}/equipments/${id}`);
  }
  getEquipmentsByType(type: string): Observable<Equipment[]> {
    return this.http.get<Equipment[]>(`${this.apiUrl}/equipments/type/${type}`);
  }
  getEquipmentTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/equipments/types`);
  }

  // === Spells ===
  getSpells(): Observable<Spell[]> {
    return this.http.get<Spell[]>(`${this.apiUrl}/spells`);
  }
  getSpellsSummary(): Observable<SpellSummary[]> {
    return this.http.get<SpellSummary[]>(`${this.apiUrl}/spells/summary`);
  }
  getSpellSchools(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/spells/schools`);
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

  generateBackstory(request: GenerateBackstoryRequest): Observable<GenerateBackstoryResponse> {
    // Fait correspondre la route avec ton endpoint C# : /api/characters/generate-backstory
    return this.http.post<GenerateBackstoryResponse>(`${this.apiUrl}/generate-backstory`, request);
  }
}
