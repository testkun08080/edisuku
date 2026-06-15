"use client";

import { useState } from "react";
import { BUILTIN_PRESETS, useFilters } from "./FilterContext";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Input } from "./ui/input";
import { Zap, Save, Trash2 } from "lucide-react";

const BUILTIN_DESCRIPTIONS: Record<string, string> = {
  "ROE が高い": "ROE 15% 以上・自己資本比率 40% 以上",
  堅実な企業: "ROE 10% 以上・自己資本比率 50% 以上",
  成長中: "売上高 50,000 百万円以上",
};

export function PresetScreeners() {
  const { applyPreset, clearFilters, savePreset, deletePreset, presets } = useFilters();
  const [saveOpen, setSaveOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSave = () => {
    savePreset(presetName);
    setPresetName("");
    setSaveOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Zap className="size-4" />
            <span className="hidden sm:inline">プリセット</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">組み込み</DropdownMenuLabel>
          {BUILTIN_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.name}
              onSelect={() => applyPreset(preset)}
              className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
            >
              <span className="font-medium text-sm">{preset.name}</span>
              <span className="text-xs text-muted-foreground">{BUILTIN_DESCRIPTIONS[preset.name]}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => clearFilters()} className="cursor-pointer">
            すべてリセット
          </DropdownMenuItem>

          {presets.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">保存済み</DropdownMenuLabel>
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onSelect={() => applyPreset(preset)}
                  className="flex items-center justify-between gap-2 py-2 cursor-pointer group"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-medium text-sm truncate">{preset.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {preset.rules.filter((r) => r.min || r.max).length} 条件
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deletePreset(preset.id);
                    }}
                    aria-label={`${preset.name} を削除`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setSaveOpen(true)}
            className="gap-2 cursor-pointer"
          >
            <Save className="size-4" />
            現在の条件を保存…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>プリセットを保存</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="プリセット名"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={!presetName.trim()}>
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
