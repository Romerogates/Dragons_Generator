import type {
  CampaignSession,
  TablePinHistoryEntry,
} from '@core/models/Campaign/campaign';

const PIN_HISTORY_CAP = 10;

function pushPinHistory(
  history: TablePinHistoryEntry[] | undefined,
  body: string,
): TablePinHistoryEntry[] {
  const trimmed = body.trim();
  if (!trimmed) return history ?? [];
  const next: TablePinHistoryEntry = {
    at: new Date().toISOString(),
    body: trimmed.slice(0, 280),
  };
  return [next, ...(history ?? [])].slice(0, PIN_HISTORY_CAP);
}

/** Épingle un message ; archive l’ancien pin dans l’historique. */
export function applyTablePin(
  session: Pick<CampaignSession, 'tablePin' | 'tablePinHistory'>,
  body: string,
  messageId?: string,
): Pick<CampaignSession, 'tablePin' | 'tablePinHistory'> {
  const text = body.trim().slice(0, 280);
  if (!text) {
    return {
      tablePin: session.tablePin,
      tablePinHistory: session.tablePinHistory,
    };
  }
  const prev = session.tablePin?.trim();
  const history = prev
    ? pushPinHistory(session.tablePinHistory, prev)
    : [...(session.tablePinHistory ?? [])];
  if (messageId && history[0] && history[0].body === prev) {
    history[0] = { ...history[0], messageId };
  }
  return { tablePin: text, tablePinHistory: history };
}

/** Retire le pin courant et l’archive (unpin sync via blob). */
export function clearTablePinState(
  session: Pick<CampaignSession, 'tablePin' | 'tablePinHistory'>,
): Pick<CampaignSession, 'tablePin' | 'tablePinHistory'> {
  const prev = session.tablePin?.trim();
  return {
    tablePin: null,
    tablePinHistory: prev
      ? pushPinHistory(session.tablePinHistory, prev)
      : session.tablePinHistory ?? [],
  };
}
