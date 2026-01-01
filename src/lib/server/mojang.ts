export type MojangProfile = {
  id: string;
  name: string;
};

export async function fetchMojangProfile(uuid: string) {
  const normalized = uuid.replace(/-/g, "");
  const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${normalized}`);
  if (!response.ok) {
    return null;
  }
  const profile = (await response.json()) as MojangProfile;
  if (!profile?.id || !profile?.name) return null;
  return profile;
}
