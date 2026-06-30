import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import VideoCard from "@/components/features/VideoCard";
import type { Video, Category } from "@/types";
import { TrendingUp, Clock, Star, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "recommended", label: "Recommended", icon: Star },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "latest", label: "Latest", icon: Clock },
  { id: "popular", label: "Popular", icon: Flame },
];

const PAGE_SIZE = 16;

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState("recommended");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver>();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => {
    setVideos([]);
    setPage(0);
    pageRef.current = 0;
    setHasMore(true);
    hasMoreRef.current = true;
    fetchVideos(0, true);
  }, [activeTab, activeCategory]);

  // Real-time: new video published
  useEffect(() => {
    const channel = supabase
      .channel("home-new-videos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "videos" },
        (payload) => {
          if (payload.new.status !== "published") return;
          // Re-fetch first page to include new video
          fetchVideos(0, true);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeTab, activeCategory]);

  async function fetchVideos(pageNum: number, reset = false) {
    if (pageNum === 0) setLoading(true);
    else {
      if (loadingMoreRef.current) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    let q = supabase
      .from("videos")
      .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
      .eq("status", "published")
      .range(pageNum * PAGE_SIZE, pageNum * PAGE_SIZE + PAGE_SIZE - 1);

    if (activeCategory) q = q.eq("category_id", activeCategory);

    switch (activeTab) {
      case "trending": q = q.order("views", { ascending: false }); break;
      case "latest":   q = q.order("created_at", { ascending: false }); break;
      case "popular":  q = q.order("likes_count", { ascending: false }); break;
      default:         q = q.order("created_at", { ascending: false }); break;
    }

    const { data, error } = await q;

    if (error) {
      console.error("Videos fetch error:", error.message);
    } else if (data) {
      if (reset) setVideos(data as Video[]);
      else setVideos((prev) => {
        // Deduplicate
        const ids = new Set(prev.map((v) => v.id));
        return [...prev, ...(data as Video[]).filter((v) => !ids.has(v.id))];
      });

      const more = data.length >= PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
    }

    setLoading(false);
    setLoadingMore(false);
    loadingMoreRef.current = false;
  }

  const loadNext = useCallback(() => {
    if (!hasMoreRef.current || loadingMoreRef.current) return;
    const next = pageRef.current + 1;
    pageRef.current = next;
    setPage(next);
    fetchVideos(next);
  }, [activeTab, activeCategory]);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadNext();
      },
      { rootMargin: "200px", threshold: 0.01 }
    );
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);
    return () => observerRef.current?.disconnect();
  }, [loadNext]);

  return (
    <div className="px-4 py-5 max-w-screen-2xl mx-auto">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-3 overflow-x-auto scrollbar-hide pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0",
              activeTab === id
                ? "bg-primary text-white"
                : "bg-surface text-muted-foreground hover:text-foreground hover:bg-surface-2"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Categories */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
            !activeCategory
              ? "bg-foreground text-background"
              : "bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id === activeCategory ? null : c.id)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors shrink-0",
              activeCategory === c.id
                ? "bg-foreground text-background"
                : "bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-video rounded-xl shimmer-bg" />
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full shimmer-bg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 rounded shimmer-bg w-full" />
                  <div className="h-3 rounded shimmer-bg w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <p className="text-lg font-medium">No videos yet</p>
          <p className="text-sm mt-1">Be the first to upload!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => <VideoCard key={v.id} video={v} />)}
        </div>
      )}

      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      <div ref={sentinelRef} className="h-4" />
    </div>
  );
}
