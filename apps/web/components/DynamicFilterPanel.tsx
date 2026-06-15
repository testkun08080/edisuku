"use client";

import { getFilterFieldsByCategory } from "@edinet/metrics";
import type { FilterInputUnit } from "@edinet/types";
import { Plus, Trash2 } from "lucide-react";
import { useFilters } from "./FilterContext.js";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

const UNIT_HINT: Record<FilterInputUnit, string> = {
  percent: "%",
  millionYen: "百万円",
  yen: "円",
  multiple: "倍",
  count: "",
};

function unitPlaceholder(unit: FilterInputUnit, bound: "min" | "max"): string {
  if (bound === "max") return "上限なし";
  const hint = UNIT_HINT[unit];
  return hint ? `下限 (${hint})` : "下限";
}

export function DynamicFilterPanel() {
  const { filters, addRule, updateRule, removeRule } = useFilters();
  const categories = getFilterFieldsByCategory();

  return (
    <div className="space-y-3 px-2">
      {filters.rules.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">条件を追加して数値で絞り込みできます</p>
      ) : (
        filters.rules.map((rule) => {
          const field = categories.flatMap((c) => c.fields).find((f) => f.id === rule.fieldId);
          const unit = field?.inputUnit ?? "multiple";

          return (
            <div key={rule.id} className="rounded-md border border-border/60 p-2 space-y-1.5">
              <div className="flex items-center gap-1">
                <Select value={rule.fieldId} onValueChange={(v) => updateRule(rule.id, { fieldId: v })}>
                  <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {categories.map((group) => (
                      <SelectGroup key={group.category}>
                        <SelectLabel className="text-xs">{group.label}</SelectLabel>
                        {group.fields.map((f) => (
                          <SelectItem key={f.id} value={f.id} className="text-xs">
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeRule(rule.id)}
                  aria-label="フィルターを削除"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input
                  type="number"
                  step="any"
                  placeholder={unitPlaceholder(unit, "min")}
                  className="h-7 text-xs"
                  value={rule.min}
                  onChange={(e) => updateRule(rule.id, { min: e.target.value })}
                />
                <Input
                  type="number"
                  step="any"
                  placeholder={unitPlaceholder(unit, "max")}
                  className="h-7 text-xs"
                  value={rule.max}
                  onChange={(e) => updateRule(rule.id, { max: e.target.value })}
                />
              </div>
            </div>
          );
        })
      )}
      <Button variant="outline" size="sm" onClick={() => addRule()} className="w-full h-8 text-xs">
        <Plus className="size-3.5 mr-1" />
        フィルターを追加
      </Button>
    </div>
  );
}
