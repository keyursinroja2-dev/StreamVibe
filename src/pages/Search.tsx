
import { useSearchParams, Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import VideoCard from "@/components/features/VideoCard";
import { formatSubscribers, getAvatarUrl } from "@/lib/utils";
import type { Video, Channel } from "@/types";
import { Search as SearchIcon, Users, Video as VideoIcon, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

const RECENT_SEARCHES_KEY = "sv_recent_searches";
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]"); } catch { return []; }
}
function addRecentSearch(q: string) {
  const prev = getRecentSearches().filter((s) => s !== q);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
function removeRecentSearch(q: string) {
  const prev = getRecentSearches().filter((s) => s !== q);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(prev));
}

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [inputValue, setInputValue] = useState(query);
  const [videos, setVideos] = useState<Video[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"videos" | "channels">("videos");
  const [recentSearches, setRecentSearches] = useState<string[]>(getRecentSearches());
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(query);
    if (!query) return;
    setLoading(true);
    addRecentSearch(query);
    setRecentSearches(getRecentSearches());

    Promise.all([
      supabase
        .from("videos")
        .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
        .eq("status", "published")
        .ilike("title", `%${query}%`)
        .order("views", { ascending: false })
        .limit(30),
      supabase
        .from("channels")
        .select("*, profiles(username, avatar_url)")
        .ilike("name", `%${query}%`)
        .order("subscriber_count", { ascending: false })
        .limit(20),
    ]).then(([{ data: v }, { data: c }]) => {
      setVideos((v || []) as Video[]);
      setChannels((c || []) as Channel[]);
      setLoading(false);
    });
  }, [query]);

  async function fetchSuggestions(value: string) {
    if (!value.trim()) { setSuggestions([]); return; }
    const { data } = await supabase
      .from("videos")
      .select("title")
      .eq("status", "published")
      .ilike("title", `%${value}%`)
      .limit(6);
    setSuggestions((data || []).map((v: { title: string }) => v.title));
  }

  function handleInputChange(v: string) {
    setInputValue(v);
    setShowSuggestions(true);
    if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);
    suggestionsTimer.current = setTimeout(() => fetchSuggestions(v), 220);
  }

  function handleSearch(q: string) {
    if (!q.trim()) return;
    setShowSuggestions(false);
    setSearchParams({ q: q.trim() });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSearch(inputValue);
  }

  if (!query) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto">
        {/* Search bar */}
        <div className="relative mb-8">
          <form onSubmit={handleSubmit}>
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                placeholder="Search videos, channels..."
                className="w-full bg-surface border border-border rounded-2xl pl-12 pr-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
                autoFocus
              />
            </div>
          </form>

          {/* Suggestions dropdown */}
          {showSuggestions && (inputValue ? suggestions.length > 0 : recentSearches.length > 0) && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-popover border border-border rounded-2xl shadow-2xl z-50 overflow-hidden">
              {!inputValue && recentSearches.length > 0 && (
                <>
                  <div className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                    Recent
                  </div>
                  {recentSearches.map((s) => (
                    <div key={s} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface transition-colors group">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <button className="flex-1 text-left text-sm" onClick={() => handleSearch(s)}>{s}</button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRecentSearch(s);
                          setRecentSearches(getRecentSearches());
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1"
                      >
                        <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  ))}
                </>
              )}
              {inputValue && suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-surface transition-colors text-left"
                >
                  <SearchIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent searches list */}
        {recentSearches.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Recent Searches</h2>
              <button
                onClick={() => { localStorage.removeItem(RECENT_SEARCHES_KEY); setRecentSearches([]); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Clear all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {recentSearches.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSearch(s)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-surface hover:bg-surface-2 rounded-full text-sm transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {recentSearches.length === 0 && (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-muted-foreground">
            <SearchIcon className="w-14 h-14 opacity-20" />
            <p className="text-base">Search for videos or channels</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="font-display font-semibold text-lg mb-4">
        Results for <span className="text-primary">"{query}"</span>
      </h1>

      <div className="flex gap-2 mb-6">
        {(["videos", "channels"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors",
              tab === t ? "bg-primary text-white" : "bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "videos" ? <VideoIcon className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-xs">
              {t === "videos" ? videos.length : channels.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-4">
              <div className="w-44 aspect-video rounded-xl shimmer-bg shrink-0" />
              <div className="flex-1 space-y-3 pt-2">
                <div className="h-5 rounded shimmer-bg w-3/4" />
                <div className="h-4 rounded shimmer-bg w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : tab === "videos" ? (
        <div>
          {videos.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No videos found for "{query}"</p>
          ) : (
            <>
              {/* Mobile: grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:hidden">
                {videos.map((v) => <VideoCard key={v.id} video={v} />)}
              </div>
              {/* Desktop: horizontal list */}
              <div className="hidden lg:flex flex-col gap-4">
                {videos.map((v) => <VideoCard key={v.id} video={v} horizontal />)}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {channels.length === 0 ? (
            <p className="text-muted-foreground text-center py-12">No channels found for "{query}"</p>
          ) : channels.map((c) => (
            <Link
              key={c.id}
              to={`/channel/${c.id}`}
              className="flex items-center gap-4 p-4 bg-surface rounded-xl hover:bg-surface-2 transition-colors group"
            >
              <img
                src={c.profiles?.avatar_url || getAvatarUrl(c.name)}
                alt={c.name}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0">
                <h3 className="font-semibold group-hover:text-primary transition-colors truncate">{c.name}</h3>
                <p className="text-sm text-muted-foreground">{formatSubscribers(c.subscriber_count)}</p>
                {c.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{c.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
