/**
 * URL state of the unified "Profile & documents" page (/profile).
 *
 *   /profile                          → profile tab, professional section
 *   /profile?tab=profile&section=prefs → profile tab, preferences section
 *   /profile?tab=documents            → CVs + document vault
 *
 * Old links keep working: ?tab=pro / ?tab=prefs (profile sections) and ?tab=cvs (documents),
 * and /documents redirects to ?tab=documents.
 */
export const PROFILE_TABS = ["profile", "documents"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number];
export const PROFILE_SECTIONS = ["pro", "prefs"] as const;
export type ProfileSection = (typeof PROFILE_SECTIONS)[number];

export type ProfileView = { tab: ProfileTab; section: ProfileSection };

const LEGACY: Record<string, ProfileView> = {
  pro: { tab: "profile", section: "pro" },
  prefs: { tab: "profile", section: "prefs" },
  cvs: { tab: "documents", section: "pro" },
};

export function resolveProfileView(sp: { tab?: string | string[]; section?: string | string[] }): ProfileView {
  const tab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const section = Array.isArray(sp.section) ? sp.section[0] : sp.section;
  if (tab && LEGACY[tab]) return LEGACY[tab];
  return {
    tab: (PROFILE_TABS as readonly string[]).includes(tab ?? "") ? (tab as ProfileTab) : "profile",
    section: (PROFILE_SECTIONS as readonly string[]).includes(section ?? "") ? (section as ProfileSection) : "pro",
  };
}

export function profileHref(tab: ProfileTab, section?: ProfileSection): string {
  if (tab === "documents") return "/profile?tab=documents";
  return section && section !== "pro" ? `/profile?tab=profile&section=${section}` : "/profile?tab=profile";
}

/** Canonical link for an old tab key (pro / prefs / cvs), e.g. from the completeness checklist. */
export function legacyProfileHref(key: "pro" | "prefs" | "cvs"): string {
  const v = LEGACY[key];
  return profileHref(v.tab, v.section);
}
