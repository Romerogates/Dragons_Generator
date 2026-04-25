// core/models/Handicaps/handicap-rules.ts

export interface HandicapRules {
  maxHandicaps: number;
  compensation: {
    oneHandicap: HandicapCompensation;
    twoHandicaps: HandicapCompensation;
  };
}

export interface HandicapCompensation {
  options: HandicapCompensationOption[];
}

export interface HandicapCompensationOption {
  type: 'abilityIncrease' | 'extraProficiencies' | 'feat';
  value?: number;
  count?: number;
  note?: string;
}
