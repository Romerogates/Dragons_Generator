// core/models/Handicaps/handicap.ts
//
// Suit le pattern { id, name, data } de CharacterClass.

export interface Handicap {
  id: string;
  name: string;
  data: HandicapData;
}

export interface HandicapData {
  desc: string;
  mechanics?: Record<string, unknown>;
  module?: string;
  stackable?: boolean;
  stackedName?: string;
  stackedDesc?: string;
}
