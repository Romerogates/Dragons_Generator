/** Compare ISO timestamps — true si remote est strictement plus récent. */
export function isRemoteNewer(remoteIso: string, localIso: string): boolean {
  const remote = Date.parse(remoteIso);
  const local = Date.parse(localIso);
  if (Number.isNaN(remote) || Number.isNaN(local)) return remoteIso > localIso;
  return remote > local;
}
