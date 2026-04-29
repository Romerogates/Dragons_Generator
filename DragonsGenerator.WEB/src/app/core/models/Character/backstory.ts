export interface GenerateBackstoryRequest {
  name: string;
  sex: 'M' | 'F' | 'X'; // <-- AJOUTÉ
  speciesName: string;
  subspeciesName?: string | null;
  civilizationName: string;
  className: string;
  traits?: string | null;
  bonds?: string | null;
  flaws?: string | null;
  alignment?: string | null;
  background?: string | null;
}

export interface GenerateBackstoryResponse {
  story: string;
}
