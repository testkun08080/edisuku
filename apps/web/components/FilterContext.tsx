"use client";

import type { NumericFilterRule, SavedFilterPreset } from "@edinet/types";
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  createEmptyRule,
  deserializeRules,
  legacyParamsToRules,
  serializeRules,
} from "../lib/filterEngine.js";

export type FilterState = {
  searchName: string;
  searchCode: string;
  rules: NumericFilterRule[];
  showOnlyFavorites: boolean;
  itemCount: string;
};

const PRESETS_STORAGE_KEY = "edisuku:filter-presets";

const defaultFilters: FilterState = {
  searchName: "",
  searchCode: "",
  rules: [],
  showOnlyFavorites: false,
  itemCount: "50",
};

export const BUILTIN_PRESETS: Omit<SavedFilterPreset, "id" | "createdAt">[] = [
  {
    name: "ROE が高い",
    searchName: "",
    searchCode: "",
    showOnlyFavorites: false,
    rules: [
      { id: "builtin-roe", fieldId: "ROE", min: "15", max: "" },
      { id: "builtin-eq", fieldId: "equityRatio", min: "40", max: "" },
    ],
  },
  {
    name: "堅実な企業",
    searchName: "",
    searchCode: "",
    showOnlyFavorites: false,
    rules: [
      { id: "builtin-roe2", fieldId: "ROE", min: "10", max: "" },
      { id: "builtin-eq2", fieldId: "equityRatio", min: "50", max: "" },
    ],
  },
  {
    name: "成長中",
    searchName: "",
    searchCode: "",
    showOnlyFavorites: false,
    rules: [{ id: "builtin-sales", fieldId: "sales", min: "50000", max: "" }],
  },
];

function loadPresetsFromStorage(): SavedFilterPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedFilterPreset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: SavedFilterPreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
}

function parseFiltersFromUrl(): Partial<FilterState> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const result: Partial<FilterState> = {};

  if (params.has("searchName")) result.searchName = params.get("searchName") || "";
  if (params.has("searchCode")) result.searchCode = params.get("searchCode") || "";
  if (params.has("favorites")) result.showOnlyFavorites = params.get("favorites") === "1";
  if (params.has("itemCount")) result.itemCount = params.get("itemCount") || "50";

  if (params.has("rules")) {
    result.rules = deserializeRules(params.get("rules") || "");
  } else {
    const legacyRules = legacyParamsToRules(params);
    if (legacyRules.length > 0) result.rules = legacyRules;
  }

  return result;
}

type FilterContextValue = {
  filters: FilterState;
  presets: SavedFilterPreset[];
  setFilter: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  addRule: (fieldId?: string) => void;
  updateRule: (
    id: string,
    patch: Partial<Pick<NumericFilterRule, "fieldId" | "min" | "max">>,
  ) => void;
  removeRule: (id: string) => void;
  clearFilters: () => void;
  applyPreset: (
    preset: Pick<SavedFilterPreset, "searchName" | "searchCode" | "rules" | "showOnlyFavorites">,
  ) => void;
  savePreset: (name: string) => void;
  deletePreset: (id: string) => void;
  getShareableUrl: () => string;
};

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [presets, setPresets] = useState<SavedFilterPreset[]>([]);

  useEffect(() => {
    const fromUrl = parseFiltersFromUrl();
    if (Object.keys(fromUrl).length > 0) {
      setFilters((prev) => ({ ...prev, ...fromUrl }));
    }
    setPresets(loadPresetsFromStorage());
  }, []);

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const addRule = useCallback((fieldId?: string) => {
    setFilters((prev) => ({
      ...prev,
      rules: [...prev.rules, createEmptyRule(fieldId ?? "ROE")],
    }));
  }, []);

  const updateRule = useCallback(
    (id: string, patch: Partial<Pick<NumericFilterRule, "fieldId" | "min" | "max">>) => {
      setFilters((prev) => ({
        ...prev,
        rules: prev.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }));
    },
    [],
  );

  const removeRule = useCallback((id: string) => {
    setFilters((prev) => ({
      ...prev,
      rules: prev.rules.filter((r) => r.id !== id),
    }));
  }, []);

  const clearFilters = useCallback(() => setFilters({ ...defaultFilters }), []);

  const applyPreset = useCallback(
    (
      preset: Pick<SavedFilterPreset, "searchName" | "searchCode" | "rules" | "showOnlyFavorites">,
    ) => {
      setFilters((prev) => ({
        ...prev,
        searchName: preset.searchName,
        searchCode: preset.searchCode,
        showOnlyFavorites: preset.showOnlyFavorites,
        rules: preset.rules.map((r) => ({
          ...r,
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `rule-${Date.now()}-${r.fieldId}`,
        })),
      }));
    },
    [],
  );

  const savePreset = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset: SavedFilterPreset = {
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `preset-${Date.now()}`,
        name: trimmed,
        createdAt: new Date().toISOString(),
        searchName: filters.searchName,
        searchCode: filters.searchCode,
        rules: filters.rules.map(({ fieldId, min, max }) => ({
          id: `saved-${fieldId}`,
          fieldId,
          min,
          max,
        })),
        showOnlyFavorites: filters.showOnlyFavorites,
      };
      setPresets((prev) => {
        const next = [...prev, preset];
        savePresetsToStorage(next);
        return next;
      });
    },
    [filters],
  );

  const deletePreset = useCallback((id: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePresetsToStorage(next);
      return next;
    });
  }, []);

  const getShareableUrl = useCallback(() => {
    const params = new URLSearchParams();
    const f = filters;

    if (f.searchName) params.append("searchName", f.searchName);
    if (f.searchCode) params.append("searchCode", f.searchCode);
    const rulesJson = serializeRules(f.rules);
    if (rulesJson !== "[]") params.append("rules", rulesJson);
    if (f.showOnlyFavorites) params.append("favorites", "1");
    if (f.itemCount && f.itemCount !== "50") params.append("itemCount", f.itemCount);

    const baseUrl =
      typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    return params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;
  }, [filters]);

  return (
    <FilterContext.Provider
      value={{
        filters,
        presets,
        setFilter,
        addRule,
        updateRule,
        removeRule,
        clearFilters,
        applyPreset,
        savePreset,
        deletePreset,
        getShareableUrl,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
