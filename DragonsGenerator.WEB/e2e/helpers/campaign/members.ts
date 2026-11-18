import { expect, type Page } from '@playwright/test';
import { type AuthSession } from '../auth';
import { authToken, bearer } from './http';

export async function createJoinLinkAs(
  page: Page,
  owner: AuthSession,
  campaignId: string,
): Promise<{ token: string }> {
  const res = await page.request.post(`/api/me/campaigns/${campaignId}/join-link`, {
    headers: bearer(owner.token),
  });
  expect(res.ok(), `Create join-link failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { token: string | null; enabled: boolean };
  expect(body.enabled, 'join link should be enabled').toBeTruthy();
  expect(body.token, 'join token missing').toBeTruthy();
  return { token: body.token! };
}

/** Désactive le lien public /join (API, MJ). */
export async function revokeJoinLinkAs(
  page: Page,
  owner: AuthSession,
  campaignId: string,
): Promise<void> {
  const res = await page.request.delete(`/api/me/campaigns/${campaignId}/join-link`, {
    headers: bearer(owner.token),
  });
  expect(res.ok(), `Revoke join-link failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** Ami → invitation campagne → acceptation (API). */
/** Ami A → B via API (sans invitation campagne). */
export async function becomeFriendsAs(
  page: Page,
  a: AuthSession,
  b: AuthSession,
): Promise<void> {
  const friendReq = await page.request.post('/api/me/friends/request', {
    headers: bearer(a.token),
    data: { userId: b.user.id },
  });
  expect(friendReq.ok(), `Friend request failed: ${friendReq.status()} ${await friendReq.text()}`).toBeTruthy();

  const pendingRes = await page.request.get('/api/me/friends/requests', {
    headers: bearer(b.token),
  });
  expect(pendingRes.ok()).toBeTruthy();
  const pending = (await pendingRes.json()) as Array<{ id: string }>;
  expect(pending.length).toBeGreaterThan(0);

  const acceptFriend = await page.request.post(`/api/me/friends/requests/${pending[0].id}/accept`, {
    headers: bearer(b.token),
  });
  expect(acceptFriend.ok(), `Accept friend failed: ${acceptFriend.status()}`).toBeTruthy();
}

export async function invitePlayerToCampaign(
  page: Page,
  owner: AuthSession,
  player: AuthSession,
  campaignId: string,
): Promise<void> {
  await becomeFriendsAs(page, owner, player);

  const inviteRes = await page.request.post(`/api/me/campaigns/${campaignId}/invites`, {
    headers: bearer(owner.token),
    data: { userId: player.user.id },
  });
  expect(inviteRes.ok(), `Invite failed: ${inviteRes.status()} ${await inviteRes.text()}`).toBeTruthy();

  const invitesRes = await page.request.get('/api/me/campaign-invites', {
    headers: bearer(player.token),
  });
  expect(invitesRes.ok()).toBeTruthy();
  const invites = (await invitesRes.json()) as Array<{ id: string; campaignId: string }>;
  const invite = invites.find((i) => i.campaignId === campaignId);
  expect(invite, 'campaign invite not found').toBeTruthy();

  const acceptInvite = await page.request.post(`/api/me/campaign-invites/${invite!.id}/accept`, {
    headers: bearer(player.token),
  });
  expect(acceptInvite.ok(), `Accept invite failed: ${acceptInvite.status()}`).toBeTruthy();
}

export async function proposeCharacterAs(
  page: Page,
  player: AuthSession,
  campaignId: string,
  characterId: string,
): Promise<void> {
  const res = await page.request.post(`/api/me/campaigns/${campaignId}/propose-character`, {
    headers: bearer(player.token),
    data: { characterId },
  });
  expect(res.ok(), `Propose failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** MJ valide la fiche proposée (API). */
export async function approveCharacterAs(
  page: Page,
  owner: AuthSession,
  campaignId: string,
): Promise<void> {
  const getRes = await page.request.get(`/api/me/campaigns/${campaignId}`, {
    headers: bearer(owner.token),
  });
  expect(getRes.ok(), `Get campaign failed: ${getRes.status()}`).toBeTruthy();
  const campaign = (await getRes.json()) as {
    members: Array<{ id: string; proposalStatus: string }>;
  };
  const member = campaign.members.find((m) => m.proposalStatus === 'pending');
  expect(member, 'pending member not found').toBeTruthy();

  const res = await page.request.post(
    `/api/me/campaigns/${campaignId}/members/${member!.id}/approve`,
    { headers: bearer(owner.token), data: {} },
  );
  expect(res.ok(), `Approve failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

/** MJ démarre une session active (API PUT data.activeSessionId). */
