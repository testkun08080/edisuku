import { describe, expect, it } from "vitest";
import { officersToApiEntries, parseOfficersFromRaw } from "./parseOfficers.js";

/** Rows shaped like wagatoushi annual TSV (NEC / 共立 / 栗田). */
const tsvFixture: { rows: string[][] } = {
  rows: [
    [
      "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditors",
      "氏名、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000IshizukaHaruhisaMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "石塚　晴久",
    ],
    [
      "jpcrp_cor:OfficialTitleOrPositionInformationAboutDirectorsAndCorporateAuditors",
      "役職名、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000IshizukaHaruhisaMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "代表取締役会長",
    ],
    [
      "jpcrp_cor:DateOfBirthInformationAboutDirectorsAndCorporateAuditors",
      "生年月日、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000IshizukaHaruhisaMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "1947-10-21",
    ],
    [
      "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditors",
      "氏名、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000NakamuraKojiMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "中村　幸治",
    ],
    [
      "jpcrp_cor:OfficialTitleOrPositionInformationAboutDirectorsAndCorporateAuditors",
      "役職名、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000NakamuraKojiMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "代表取締役社長",
    ],
    [
      "jpcrp_cor:DateOfBirthInformationAboutDirectorsAndCorporateAuditors",
      "生年月日、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000NakamuraKojiMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "1962-06-10",
    ],
    // Proposal variant must be ignored
    [
      "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditorsProposal",
      "氏名、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000ProposalPersonMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "提案用太郎",
    ],
    [
      "jpcrp_cor:DateOfBirthInformationAboutDirectorsAndCorporateAuditorsProposal",
      "生年月日、役員の状況（取締役（及び監査役））",
      "FilingDateInstant_jpcrp030000-asr_E04908-000ProposalPersonMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "1970-01-01",
    ],
    // Executive directors (committee-style company, e.g. Kurita)
    [
      "jpcrp_cor:NameInformationAboutExecutiveDirectors",
      "氏名、役員の状況（執行役）",
      "FilingDateInstant_jpcrp030000-asr_E01573-000EjiriHirohikoMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "江尻　裕彦",
    ],
    [
      "jpcrp_cor:OfficialTitleOrPositionInformationAboutExecutiveDirectors",
      "役職名、役員の状況（執行役）",
      "FilingDateInstant_jpcrp030000-asr_E01573-000EjiriHirohikoMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "代表執行役社長",
    ],
    [
      "jpcrp_cor:DateOfBirthInformationAboutExecutiveDirectors",
      "生年月日、役員の状況（執行役）",
      "FilingDateInstant_jpcrp030000-asr_E01573-000EjiriHirohikoMember",
      "提出日時点",
      "その他",
      "時点",
      "－",
      "－",
      "1962-10-06",
    ],
  ],
};

describe("parseOfficersFromRaw", () => {
  it("parses directors and executives, skipping Proposal rows", () => {
    const entries = parseOfficersFromRaw(tsvFixture);
    expect(entries).toHaveLength(3);

    const directors = entries.filter((e) => e.roleGroup === "directors");
    expect(directors).toHaveLength(2);
    expect(directors[0]).toMatchObject({
      name: "石塚　晴久",
      title: "代表取締役会長",
      birthDate: "1947-10-21",
      roleGroup: "directors",
    });
    expect(directors[1]?.name).toBe("中村　幸治");
    expect(directors[1]?.birthDate).toBe("1962-06-10");

    const executives = entries.filter((e) => e.roleGroup === "executive");
    expect(executives).toHaveLength(1);
    expect(executives[0]).toMatchObject({
      name: "江尻　裕彦",
      title: "代表執行役社長",
      birthDate: "1962-10-06",
      roleGroup: "executive",
    });

    expect(entries.some((e) => e.name.includes("提案"))).toBe(false);
  });

  it("officersToApiEntries keeps the stored shape", () => {
    const api = officersToApiEntries(parseOfficersFromRaw(tsvFixture));
    expect(api[0]).toEqual({
      name: "石塚　晴久",
      title: "代表取締役会長",
      birthDate: "1947-10-21",
      roleGroup: "directors",
    });
  });

  it("treats whitespace-padded placeholders as null", () => {
    const entries = parseOfficersFromRaw({
      rows: [
        [
          "jpcrp_cor:NameInformationAboutDirectorsAndCorporateAuditors",
          "",
          "Member1",
          "",
          "",
          "",
          "",
          "",
          "山田　太郎",
        ],
        [
          "jpcrp_cor:OfficialTitleOrPositionInformationAboutDirectorsAndCorporateAuditors",
          "",
          "Member1",
          "",
          "",
          "",
          "",
          "",
          "－ ",
        ],
        [
          "jpcrp_cor:DateOfBirthInformationAboutDirectorsAndCorporateAuditors",
          "",
          "Member1",
          "",
          "",
          "",
          "",
          "",
          " －",
        ],
      ],
    });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      name: "山田　太郎",
      title: null,
      birthDate: null,
      roleGroup: "directors",
    });
  });
});
