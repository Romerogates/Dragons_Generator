import { shouldShowPlayerInitiativePrompt } from './campaign-initiative.util';

describe('campaign-initiative.util', () => {
  const openBoard = {
    open: true,
    code: 'ABCD',
    combatants: [
      { memberUserId: 'u1', hasRoll: false },
      { memberUserId: 'u2', hasRoll: true },
    ],
  };

  it('hides when board is closed or has no code', () => {
    expect(shouldShowPlayerInitiativePrompt({ open: false, code: 'X', combatants: [] }, 'u1')).toBeFalse();
    expect(shouldShowPlayerInitiativePrompt({ open: true, code: '', combatants: openBoard.combatants }, 'u1')).toBeFalse();
    expect(shouldShowPlayerInitiativePrompt(null, 'u1')).toBeFalse();
  });

  it('hides when the player is not linked to any combatant', () => {
    expect(shouldShowPlayerInitiativePrompt(openBoard, 'stranger')).toBeFalse();
    expect(shouldShowPlayerInitiativePrompt(openBoard, null)).toBeFalse();
  });

  it('shows only when the player still has a missing roll', () => {
    expect(shouldShowPlayerInitiativePrompt(openBoard, 'u1')).toBeTrue();
    expect(shouldShowPlayerInitiativePrompt(openBoard, 'u2')).toBeFalse();
  });

  it('does not fall back to the full combatant list for unlinked players', () => {
    const board = {
      open: true,
      code: 'ZZ',
      combatants: [{ memberUserId: 'mj-npc', hasRoll: false }],
    };
    expect(shouldShowPlayerInitiativePrompt(board, 'player-x')).toBeFalse();
  });
});
