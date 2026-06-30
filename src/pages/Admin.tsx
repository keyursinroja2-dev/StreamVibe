import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, Users, Video, Flag, Tag, Trash2, Eye, EyeOff, Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatRelativeTime, formatViews } from "@/lib/utils";
import type { Video as VideoType, Profile, Category } from "@/types";

type Tab = "users" | "videos" | "reports" | "categories";

export default function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("videos");
  const [users, setUsers] = useState<Profile[]>([]);
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (!user.is_admin) { navigate("/"); toast.error("Access denied"); return; }
    fetchData();
  }, [user, tab]);

  async function fetchData() {
    setLoading(true);
    if (tab === "users") {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      setUsers((data || []) as Profile[]);
    } else if (tab === "videos" || tab === "reports") {
      let q = supabase
        .from("videos")
        .select("*, channels(id, name, subscriber_count, user_id, banner_url)")
        .order("created_at", { ascending: false });
      if (tab === "reports") q = q.eq("is_reported", true);
      const { data } = await q;
      setVideos((data || []) as VideoType[]);
    } else if (tab === "categories") {
      const { data } = await supabase.from("categories").select("*").order("name");
      setCategories((data || []) as Category[]);
    }
    setLoading(false);
  }

  async function toggleVideoStatus(id: string, status: string) {
    const newStatus = status === "published" ? "removed" : "published";
    await supabase.from("videos").update({ status: newStatus }).eq("id", id);
    setVideos((v) => v.map((x) => x.id === id ? { ...x, status: newStatus as any } : x));
    toast.success(`Video ${newStatus}`);
  }

  async function deleteVideo(video: VideoType) {
    // Delete files from storage first
    if (video.video_url) {
      const parts = video.video_url.split("/storage/v1/object/public/videos/");
      if (parts[1]) await supabase.storage.from("videos").remove([parts[1]]);
    }
    if (video.thumbnail_url) {
      const parts = video.thumbnail_url.split("/storage/v1/object/public/thumbnails/");
      if (parts[1]) await supabase.storage.from("thumbnails").remove([parts[1]]);
    }
    // Delete from database
    await supabase.from("videos").delete().eq("id", video.id);
    setVideos((v) => v.filter((x) => x.id !== video.id));
    toast.success("Video deleted and files removed");
  }

  async function resolveReport(id: string) {
    await supabase.from("videos").update({ is_reported: false }).eq("id", id);
    setVideos((v) => v.filter((x) => x.id !== id));
    toast.success("Report resolved");
  }

  async function addCategory() {
    if (!newCategory.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: newCategory.trim() });
    if (error) toast.error(error.message);
    else { setNewCategory(""); fetchData(); toast.success("Category added"); }
  }

  async function deleteCategory(id: string) {
    await supabase.from("categories").delete().eq("id", id);
    setCategories((c) => c.filter((x) => x.id !== id));
    toast.success("Category deleted");
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "videos", label: "Videos", icon: Video },
    { id: "reports", label: "Reports", icon: Flag },
    { id: "users", label: "Users", icon: Users },
    { id: "categories", label: "Categories", icon: Tag },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/20 rounded-xl">
          <Shield className="w-6 h-6 text-primary" />
        </div>
        <h1 className="font-display font-bold text-2xl">Admin Panel</h1>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
              tab === id ? "bg-primary text-white" : "bg-surface text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl shimmer-bg" />)}
        </div>
      ) : (
        <>
          {(tab === "videos" || tab === "reports") && (
            <div className="space-y-2">
              {videos.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  {tab === "reports" ? "No reported videos" : "No videos yet"}
                </p>
              ) : (
                videos.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 p-3 sm:p-4 bg-surface rounded-xl">
                    <div className="w-20 sm:w-28 aspect-video rounded-lg overflow-hidden bg-surface-2 shrink-0">
                      {v.thumbnail_url
                        ? <img src={v.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Video className="w-4 h-4 text-muted-foreground" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm line-clamp-1">{v.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {(v as any).channels?.name || "Unknown"} · {formatViews(v.views)} views · {formatRelativeTime(v.created_at)}
                      </p>
                      <span className={cn("inline-block text-xs px-2 py-0.5 rounded-full mt-1", v.status === "published" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                        {v.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {tab === "reports" && (
                        <button
                          onClick={() => resolveReport(v.id)}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                          title="Resolve report"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleVideoStatus(v.id, v.status)}
                        className="p-2 bg-surface-2 rounded-lg hover:bg-surface-2 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title={v.status === "published" ? "Hide" : "Show"}
                      >
                        {v.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteVideo(v)}
                        className="p-2 bg-destructive/20 text-destructive rounded-lg hover:bg-destructive/30 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "users" && (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-4 bg-surface rounded-xl">
                  <img
                    src={u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${u.username}`}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{u.username}</p>
                    <p className="text-xs text-muted-foreground">Joined {formatRelativeTime(u.created_at)}</p>
                  </div>
                  {u.is_admin && <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full shrink-0">Admin</span>}
                </div>
              ))}
            </div>
          )}

          {tab === "categories" && (
            <div>
              <div className="flex gap-2 mb-4">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category name"
                  className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  onKeyDown={(e) => e.key === "Enter" && addCategory()}
                />
                <button
                  onClick={addCategory}
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">Add</span>
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-surface rounded-xl group">
                    <span className="text-sm font-medium">{c.name}</span>
                    <button
                      onClick={() => deleteCategory(c.id)}
                      className="p-1.5 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
