import { Injector } from '@angular/core';
import type { CampaignPdfService } from './campaign-pdf.service';

/** Charge CampaignPdfService + jspdf uniquement à la demande (impression / aperçu). */
export async function getCampaignPdfService(injector: Injector): Promise<CampaignPdfService> {
  const mod = await import('./campaign-pdf.service');
  return injector.get(mod.CampaignPdfService);
}
