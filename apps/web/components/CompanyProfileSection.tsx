"use client";

import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { COMPANY_PROFILE_ENABLED } from "../lib/features.js";
import { CardContent } from "./ui/card";

type ProfileFields = {
  address: string | null;
  headOfficeAddress: string | null;
  phone: string | null;
  representative: string | null;
  filerNameEn: string | null;
  filerNameKana: string | null;
  corporateNumber: string | null;
};

type Props = {
  secCode: string;
};

export function CompanyProfileSection({ secCode }: Props) {
  const [profile, setProfile] = useState<ProfileFields | null>(null);

  useEffect(() => {
    if (!COMPANY_PROFILE_ENABLED || !secCode) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.api.companies[":secCode"].$get({ param: { secCode } });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { company?: ProfileFields };
        if (!cancelled && body.company) setProfile(body.company);
      } catch {
        // profile is optional UI; ignore fetch errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [secCode]);

  if (!COMPANY_PROFILE_ENABLED || !profile) return null;

  const rows: Array<[string, string]> = [];
  for (const [label, value] of [
    ["代表者", profile.representative],
    ["本店所在地", profile.headOfficeAddress],
    ["所在地", profile.address],
    ["電話番号", profile.phone],
    ["英字社名", profile.filerNameEn],
    ["ヨミ", profile.filerNameKana],
    ["法人番号", profile.corporateNumber],
  ] as const) {
    if (value) rows.push([label, value]);
  }

  if (rows.length === 0) return null;

  return (
    <CardContent>
      <dl className="mt-3 grid gap-1 text-sm text-muted-foreground">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-foreground/80">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </CardContent>
  );
}
