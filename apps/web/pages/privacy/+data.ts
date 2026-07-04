import { fetchManifest } from "../../lib/server-api";

export type Data = {
  dataLastUpdated: string | null;
};

export async function data(): Promise<Data> {
  try {
    const manifest = await fetchManifest();
    return { dataLastUpdated: manifest.dataLastUpdated };
  } catch (err) {
    console.warn("[privacy/+data] failed to load manifest", err);
    return { dataLastUpdated: null };
  }
}
