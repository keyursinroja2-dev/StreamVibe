import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import VideoCard from "@/components/features/VideoCard";
import { Clock, Bookmark, ThumbsUp, Upload, Trash2 } from "lucide-react";
import type { Video } from "@/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tabs = [
  { id: "history", label: "History", icon: Clock },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "liked", label: "Liked", icon: ThumbsUp },
  { id: "uploads", label: "My Videos", icon: Upload },
];

export default function Library() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") || "history";
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchVideos();
  }, [tab, user]);

  async function fetchVideos() {
    setLoading(true);
    let data: Video[] = [];

    if (tab === "history") {
      const { data: h } = await supabase
        .from("watch_history")
        .select("videos(*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name))")
        .eq("user_id", user!.id)
        .order("watched_at", { ascending: false })
        .limit(50);
      data = (h || []).map((r: any) => r.videos).filter(Boolean) as Video[];
    } else if (tab === "saved") {
      const { data: s } = await supabase
        .from("saved_videos")
        .select("videos(*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      data = (s || []).map((r: any) => r.videos).filter(Boolean) as Video[];
    } else if (tab === "liked") {
      const { data: l } = await supabase
        .from("likes")
        .select("videos(*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name))")
        .eq("user_id", user!.id)
        .eq("is_like", true)
        .order("created_at", { ascending: false });
      data = (l || []).map((r: any) => r.videos).filter(Boolean) as Video[];
    } else if (tab === "uploads") {
      const { data: u } = await supabase
        .from("videos")
        .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      data = (u || []) as Video[];
    }

    setVideos(data);
    setLoading(false);
  }

  async function clearHistory() {
    await supabase.from("watch_history").delete().eq("user_id", user!.id);
    setVideos([]);
    toast.success("History cleared");
  }

  async function deleteVideo(video: Video) {
    // Delete from Supabase Storage
    if (video.video_url) {
      const match = video.video_url.match(/\/storage\/v1\/object\/public\/videos\/(.+)/);
      if (match?.[1]) {
        await supabase.storage.from("videos").remove([decodeURIComponent(match[1])]);
      }
    }
    if (video.thumbnail_url) {
      const match = video.thumbnail_url.match(/\/storage\/v1\/object\/public\/thumbnails\/(.+)/);
      if (match?.[1]) {
        await supabase.storage.from("thumbnails").remove([decodeURIComponent(match[1])]);
      }
    }
    // Remove from database
    const { error } = await supabase.from("videos").delete().eq("id", video.id).eq("user_id", user!.id);
    if (error) {
      toast.error("Failed to delete video");
      return;
    }
    setVideos((v) => v.filter((x) => x.id !== video.id));
    toast.success("Video deleted");
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="font-display font-bold text-2xl mb-4 sm:mb-6">Library</h1>

      <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSearchParams({ tab: id })}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors shrink-0",
              tab === id ? "bg-primary text-white" : "bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "history" && videos.length > 0 && (
        <div className="flex justify-end mb-4">
          <button
            onClick={clearHistory}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive transition-colors py-2"
          >
            <Trash2 className="w-4 h-4" /> Clear history
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="aspect-video rounded-xl shimmer-bg" />
              <div className="h-4 rounded shimmer-bg" />
            </div>
          ))}
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">Nothing here yet</p>
          <p className="text-sm mt-1">
            {tab === "history" ? "Videos you watch will appear here" :
             tab === "saved" ? "Save videos to watch later" :
             tab === "liked" ? "Videos you like will appear here" :
             "Upload your first video!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((v) => (
            <div key={v.id} className="relative group">
              <VideoCard video={v} />
              {tab === "uploads" && (
                <button
                  onClick={() => deleteVideo(v)}
                  className="absolute top-2 right-2 p-2 bg-black/80 rounded-lg text-white opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 active:opacity-100 transition-opacity hover:bg-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
                  title="Delete video"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
