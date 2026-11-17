export type PlayStageEventKind = 'scene' | 'combat' | 'chat';

export interface PlayStageEvent {
  id: string;
  kind: PlayStageEventKind;
  text: string;
}

export interface PlayStageEventInput {
  pin: string | null | undefined;
  combatLog: readonly string[] | null | undefined;
  chat: readonly { id?: string; body?: string; authorName?: string }[] | null | undefined;
}

/** Fil unique « ce qui se passe » : scène épinglée, journal, derniers messages. */
export function buildPlayStageEvents(input: PlayStageEventInput, limit = 8): PlayStageEvent[] {
  const out: PlayStageEvent[] = [];
  const pin = input.pin?.trim();
  if (pin) {
    out.push({ id: 'scene-pin', kind: 'scene', text: pin });
  }
  const logs = [...(input.combatLog ?? [])].reverse();
  for (let i = 0; i < logs.length && out.length < limit; i++) {
    const text = logs[i]?.trim();
    if (!text) continue;
    out.push({ id: `combat-${i}-${text.slice(0, 24)}`, kind: 'combat', text });
  }
  const chat = [...(input.chat ?? [])].reverse();
  for (let i = 0; i < chat.length && out.length < limit; i++) {
    const row = chat[i]!;
    const body = row.body?.trim();
    if (!body) continue;
    const who = row.authorName?.trim();
    out.push({
      id: row.id || `chat-${i}`,
      kind: 'chat',
      text: who ? `${who} : ${body}` : body,
    });
  }
  return out.slice(0, limit);
}

export function isWaitingPlayKind(kind: string | null | undefined): boolean {
  return (
    kind === 'wait_approval' ||
    kind === 'wait_table' ||
    kind === 'wait_initiative' ||
    kind === 'wait_turn' ||
    kind === 'wait_session'
  );
}
