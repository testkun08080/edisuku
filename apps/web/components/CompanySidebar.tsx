"use client";

import { useState, useEffect } from "react";
import { usePageContext } from "vike-react/usePageContext";
import { useFilters } from "./FilterContext.js";
import { useFavorites } from "./FavoritesContext.js";
import { useRecentCompanies } from "./RecentCompaniesContext.js";
import logoUrl from "../assets/logo.png";
import { api } from "../lib/api";
import { SITE_NAME, SITE_TAGLINE } from "../lib/brand";
import { SCREENER, analyzePath } from "../lib/routes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarRail,
} from "./ui/sidebar";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Search, Star, Clock, Home, BarChart3, SlidersHorizontal, Trash2, Shield, Mail } from "lucide-react";
import { DynamicFilterPanel } from "./DynamicFilterPanel.js";

type CompanyItem = { secCode: string; filerName: string };

function formatDisplayName(name: string): string {
  return name.replace(/^株式会社\s*|\s*株式会社$/g, "").trim() || name;
}

export function AppSidebar() {
  const pageContext = usePageContext();
  const urlPathname = pageContext?.urlPathname ?? "/";
  const { filters, setFilter, clearFilters } = useFilters();
  const { favorites } = useFavorites();
  const { recent } = useRecentCompanies();
  const [searchResults, setSearchResults] = useState<CompanyItem[]>([]);
  const [analyzeSearchQuery, setAnalyzeSearchQuery] = useState("");

  const isAnalyzePage = urlPathname.startsWith(`${SCREENER}/analyze/`);
  /** スクリーニング用フィルターは企業一覧でのみ表示 */
  const isCompanyListPage = urlPathname === SCREENER;

  useEffect(() => {
    if (!isAnalyzePage) return;
    const q = analyzeSearchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      api.api.search
        .$get({ query: { q } })
        .then(async (res) => {
          if (!res.ok) {
            setSearchResults([]);
            return;
          }
          const data = (await res.json()) as {
            results: Array<{ secCode: string | null; filerName: string }>;
          };
          setSearchResults(
            (data.results ?? [])
              .filter((r) => r.secCode)
              .map((r) => ({ secCode: r.secCode!, filerName: r.filerName }))
              .slice(0, 15),
          );
        })
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [isAnalyzePage, analyzeSearchQuery]);

  const analyzeSearchResults = searchResults;

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={SITE_NAME}>
              <a href={SCREENER}>
                <img src={logoUrl} alt="" className="size-8 shrink-0 rounded-lg object-contain" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold">{SITE_NAME}</span>
                  <span className="truncate text-xs text-muted-foreground">{SITE_TAGLINE}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>ナビゲーション</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={urlPathname === SCREENER} tooltip="企業一覧">
                  <a href={SCREENER}>
                    <Home className="size-4" />
                    <span>企業一覧</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(isAnalyzePage || isCompanyListPage) && <SidebarSeparator />}

        {isAnalyzePage && (
          <>
            {/* アイコン幅では Input が潰れるため非表示（一覧ページのフィルターと同様） */}
            <div className="group-data-[collapsible=icon]:hidden">
              <SidebarGroup>
                <SidebarGroupLabel>
                  <Search className="mr-1.5 size-3.5" />
                  企業検索
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <div className="px-2">
                    <Input
                      placeholder="会社名・銘柄コードで検索"
                      value={analyzeSearchQuery}
                      onChange={(e) => setAnalyzeSearchQuery(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  {analyzeSearchResults.length > 0 && (
                    <ScrollArea className="max-h-48 mt-1">
                      <SidebarMenu>
                        {analyzeSearchResults.map((c) => (
                          <SidebarMenuItem key={c.secCode}>
                            <SidebarMenuButton asChild size="sm">
                              <a href={analyzePath(c.secCode)}>
                                <BarChart3 className="size-3.5" />
                                <span className="truncate">{formatDisplayName(c.filerName)}</span>
                                <Badge variant="outline" className="ml-auto text-[10px]">
                                  {c.secCode}
                                </Badge>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </ScrollArea>
                  )}
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarSeparator />
            </div>

            {/* Favorites */}
            <SidebarGroup>
              <SidebarGroupLabel>
                <Star className="mr-1.5 size-3.5" />
                お気に入り
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {Array.from(favorites).length === 0 ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled>
                        <span className="text-muted-foreground text-xs">お気に入りがありません</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    Array.from(favorites).map((secCode) => (
                      <SidebarMenuItem key={secCode}>
                        <SidebarMenuButton asChild size="sm">
                          <a href={analyzePath(secCode)}>
                            <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                            <span>{secCode}</span>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            {/* Recent */}
            <SidebarGroup>
              <SidebarGroupLabel>
                <Clock className="mr-1.5 size-3.5" />
                履歴
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {recent.length === 0 ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled>
                        <span className="text-muted-foreground text-xs">履歴がありません</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    recent.map((c) => (
                      <SidebarMenuItem key={c.secCode}>
                        <SidebarMenuButton asChild size="sm">
                          <a href={analyzePath(c.secCode)}>
                            <Clock className="size-3.5" />
                            <span className="truncate">{formatDisplayName(c.filerName)}</span>
                            <Badge variant="outline" className="ml-auto text-[10px]">
                              {c.secCode}
                            </Badge>
                          </a>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {isCompanyListPage && (
          <div className="group-data-[collapsible=icon]:hidden">
            {/* Search filters for company list page — アイコン幅時は全体を非表示 */}
            <SidebarGroup>
              <SidebarGroupLabel>
                <Search className="mr-1.5 size-3.5" />
                検索
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div className="space-y-2 px-2">
                  <Input
                    placeholder="会社名"
                    value={filters.searchName}
                    onChange={(e) => setFilter("searchName", e.target.value)}
                    className="h-8"
                  />
                  <Input
                    placeholder="銘柄コード（例: 13760）"
                    value={filters.searchCode}
                    onChange={(e) => setFilter("searchCode", e.target.value)}
                    className="h-8"
                  />
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            {/* Filters */}
            <SidebarGroup>
              <SidebarGroupLabel>
                <SlidersHorizontal className="mr-1.5 size-3.5" />
                数値フィルター
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <DynamicFilterPanel />
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        )}

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>情報</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={urlPathname === "/privacy"}
                  size="sm"
                  tooltip="プライバシーポリシー"
                >
                  <a href="/privacy">
                    <Shield className="size-3.5" />
                    <span>プライバシーポリシー</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={urlPathname === "/contact"} size="sm" tooltip="お問い合わせ">
                  <a href="/contact">
                    <Mail className="size-3.5" />
                    <span>お問い合わせ</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {isCompanyListPage && (
        <SidebarFooter className="group-data-[collapsible=icon]:hidden">
          <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
            <Trash2 className="size-3.5 mr-1.5" />
            フィルターをクリア
          </Button>
        </SidebarFooter>
      )}
      <SidebarRail />
    </Sidebar>
  );
}
