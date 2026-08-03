/** Parse EDINET raw TSV JSON for officers (役員の状況). */

export type OfficerRoleGroup = "directors" | "executive";

export type OfficerEntry = {
  name: string;
  title: string | null;
  birthDate: string | null;
  roleGroup: OfficerRoleGroup;
};

const DIRECTORS = {
  name: "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditors",
  title: "jpcrp_cor:OfficialTitleOrPositionInformationAboutDirectorsAndCorporateAuditors",
  birthDate: "jpcrp_cor:DateOfBirthInformationAboutDirectorsAndCorporateAuditors",
  roleGroup: "directors" as const,
};

const EXECUTIVE = {
  name: "jpcrp_cor:NameInformationAboutExecutiveDirectors",
  title: "jpcrp_cor:OfficialTitleOrPositionInformationAboutExecutiveDirectors",
  birthDate: "jpcrp_cor:DateOfBirthInformationAboutExecutiveDirectors",
  roleGroup: "executive" as const,
};

const GROUPS = [DIRECTORS, EXECUTIVE] as const;

type Acc = {
  contextId: string;
  roleGroup: OfficerRoleGroup;
  name?: string;
  title?: string;
  birthDate?: string;
};

function matchGroup(elemId: string): (typeof GROUPS)[number] | null {
  if (!elemId || elemId.includes("Proposal")) return null;
  for (const group of GROUPS) {
    if (elemId === group.name || elemId === group.title || elemId === group.birthDate) {
      return group;
    }
  }
  return null;
}

function fieldFor(
  elemId: string,
  group: (typeof GROUPS)[number],
): "name" | "title" | "birthDate" | null {
  if (elemId === group.name) return "name";
  if (elemId === group.title) return "title";
  if (elemId === group.birthDate) return "birthDate";
  return null;
}

export function parseOfficersFromRaw(raw: { rows?: string[][] }): OfficerEntry[] {
  const rows = raw.rows ?? [];
  const map = new Map<string, Acc>();

  for (const row of rows) {
    const elemId = row[0] ?? "";
    const contextId = row[2] ?? "";
    const value = row[8] ?? "";
    if (!contextId || !contextId.includes("Member")) continue;

    const group = matchGroup(elemId);
    if (!group) continue;
    const field = fieldFor(elemId, group);
    if (!field) continue;

    const key = `${group.roleGroup}:${contextId}`;
    let acc = map.get(key);
    if (!acc) {
      acc = { contextId, roleGroup: group.roleGroup };
      map.set(key, acc);
    }
    acc[field] = value;
  }

  return Array.from(map.values())
    .filter((a): a is Acc & { name: string } => Boolean(a.name?.trim()))
    .map((a) => ({
      name: a.name!.trim(),
      title: a.title?.trim() && a.title !== "－" ? a.title.trim() : null,
      birthDate: a.birthDate?.trim() && a.birthDate !== "－" ? a.birthDate.trim() : null,
      roleGroup: a.roleGroup,
    }));
}

export function officersToApiEntries(entries: OfficerEntry[]): OfficerEntry[] {
  return entries.map((e) => ({
    name: e.name,
    title: e.title,
    birthDate: e.birthDate,
    roleGroup: e.roleGroup,
  }));
}
