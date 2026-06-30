import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import VideoPlayer from "@/components/features/VideoPlayer";
import Comments from "@/components/features/Comments";
import VideoCard from "@/components/features/VideoCard";
import { formatViews, formatRelativeTime, formatSubscribers, getAvatarUrl, cn } from "@/lib/utils";
import {
  ThumbsUp, ThumbsDown, Share2, Bookmark, Flag,
  CheckCircle2, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import type { Video, Like } from "@/types";

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [like, setLike] = useState<Like | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const viewCountedRef = useRef(false);

  useEffect(() => {
    if (!id) return;
    viewCountedRef.current = false;
    fetchVideo();
  }, [id]);

  useEffect(() => {
    if (!user || !id) return;
    checkLike();
    checkSaved();
  }, [id, user]);

  // Real-time: subscribe to video updates (likes, views, comments)
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`video-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "videos", filter: `id=eq.${id}` },
        (payload) => {
          setVideo((v) =>
            v ? {
              ...v,
              views: payload.new.views ?? v.views,
              likes_count: payload.new.likes_count ?? v.likes_count,
              dislikes_count: payload.new.dislikes_count ?? v.dislikes_count,
              comments_count: payload.new.comments_count ?? v.comments_count,
            } : v
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  async function fetchVideo() {
    setLoading(true);
    const { data, error } = await supabase
      .from("videos")
      .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
      .eq("id", id!)
      .single();

    if (error || !data) {
      console.error("Video not found", error);
      navigate("/");
      return;
    }

    setVideo(data as Video);

    // Fraud-protected view count (max 2 per user per video)
    if (!viewCountedRef.current) {
      viewCountedRef.current = true;
      supabase.rpc("increment_view_count", {
        video_id: id,
        user_id: user?.id ?? null,
      }).then(({ error: rpcErr }) => {
        if (rpcErr) console.error("View count error:", rpcErr.message);
      });
    }

    // Track watch history
    if (user) {
      supabase.from("watch_history").upsert(
        { user_id: user.id, video_id: id, watched_at: new Date().toISOString() },
        { onConflict: "user_id,video_id" }
      );
      checkSubscribed(data.channel_id);
    }

    // Related videos
    const { data: rel } = await supabase
      .from("videos")
      .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
      .eq("status", "published")
      .neq("id", id!)
      .order("created_at", { ascending: false })
      .limit(15);

    if (rel) setRelated(rel as Video[]);
    setLoading(false);
  }

  async function checkLike() {
    const { data } = await supabase
      .from("likes").select("*")
      .eq("video_id", id!).eq("user_id", user!.id).maybeSingle();
    setLike(data);
  }

  async function checkSaved() {
    const { data } = await supabase
      .from("saved_videos").select("id")
      .eq("video_id", id!).eq("user_id", user!.id).maybeSingle();
    setSaved(!!data);
  }

  async function checkSubscribed(channelId: string | null) {
    if (!channelId || !user) return;
    const { data } = await supabase
      .from("subscriptions").select("id")
      .eq("channel_id", channelId).eq("subscriber_id", user.id).maybeSingle();
    setSubscribed(!!data);
  }

  async function handleLike(isLike: boolean) {
    if (!user) { toast.error("Sign in to like"); navigate("/login"); return; }
    if (like) {
      if (like.is_like === isLike) {
        await supabase.from("likes").delete().eq("id", like.id);
        setLike(null);
      } else {
        await supabase.from("likes").update({ is_like: isLike }).eq("id", like.id);
        setLike({ ...like, is_like: isLike });
      }
    } else {
      const { data } = await supabase
        .from("likes").insert({ user_id: user.id, video_id: id!, is_like: isLike }).select().single();
      setLike(data);
    }
    // Refresh counts
    const { data } = await supabase
      .from("videos").select("likes_count, dislikes_count").eq("id", id!).single();
    if (data && video) setVideo({ ...video, likes_count: data.likes_count, dislikes_count: data.dislikes_count });
  }

  async function handleSubscribe() {
    if (!user) { navigate("/login"); return; }
    if (!video?.channel_id) return;
    if (subscribed) {
      await supabase.from("subscriptions").delete()
        .eq("channel_id", video.channel_id).eq("subscriber_id", user.id);
      setSubscribed(false);
      setVideo((v) => v && v.channels ? { ...v, channels: { ...v.channels, subscriber_count: Math.max(0, v.channels.subscriber_count - 1) } } : v);
      toast.success("Unsubscribed");
    } else {
      await supabase.from("subscriptions").insert({ channel_id: video.channel_id, subscriber_id: user.id });
      setSubscribed(true);
      setVideo((v) => v && v.channels ? { ...v, channels: { ...v.channels, subscriber_count: v.channels.subscriber_count + 1 } } : v);
      toast.success("Subscribed!");
    }
  }

  async function handleSave() {
    if (!user) { navigate("/login"); return; }
    if (saved) {
      await supabase.from("saved_videos").delete().eq("video_id", id!).eq("user_id", user.id);
      setSaved(false);
      toast.success("Removed from saved");
    } else {
      await supabase.from("saved_videos").insert({ user_id: user.id, video_id: id! });
      setSaved(true);
      toast.success("Saved!");
    }
  }

  async function handleReport() {
    if (!user) { navigate("/login"); return; }
    const { error } = await supabase.from("reports")
      .insert({ user_id: user.id, video_id: id!, reason: "Inappropriate content" });
    if (error) toast.error("Already reported");
    else toast.success("Video reported");
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: video?.title, url: window.location.href }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    }
  }

  if (loading) {
    return (
      <div className="p-3 sm:p-6 max-w-screen-xl mx-auto">
        <div className="aspect-video rounded-xl shimmer-bg mb-4" />
        <div className="h-5 w-3/4 rounded shimmer-bg mb-2" />
        <div className="h-4 w-1/2 rounded shimmer-bg" />
      </div>
    );
  }

  if (!video) return null;

  const channelAvatar = getAvatarUrl(video.channels?.name || "channel");
  const videoSrc = video.video_url || "";

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-6 lg:p-6">
        {/* Main */}
        <div className="lg:col-span-2">
          {/* Player */}
          <div className="lg:rounded-xl overflow-hidden">
            <VideoPlayer
              src={videoSrc}
              thumbnail={video.thumbnail_url || undefined}
            />
          </div>

          <div className="px-3 sm:px-0 mt-3">
            <h1 className="font-display font-bold text-base sm:text-xl leading-snug">
              {video.title}
            </h1>

            <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3 mt-2">
              <span className="text-sm text-muted-foreground">
                {formatViews(video.views)} views · {formatRelativeTime(video.created_at)}
                {video.categories && (
                  <span className="ml-2 px-2 py-0.5 bg-surface rounded-full text-xs">
                    {video.categories.name}
                  </span>
                )}
              </span>

              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-0.5 w-full sm:w-auto">
                {/* Like/Dislike */}
                <div className="flex items-center bg-surface rounded-full overflow-hidden shrink-0">
                  <button
                    onClick={() => handleLike(true)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 hover:bg-surface-2 transition-colors text-sm font-medium min-w-[44px]",
                      like?.is_like === true && "text-primary"
                    )}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="hidden sm:inline">{video.likes_count}</span>
                  </button>
                  <div className="w-px h-5 bg-border" />
                  <button
                    onClick={() => handleLike(false)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 hover:bg-surface-2 transition-colors text-sm font-medium min-w-[44px]",
                      like?.is_like === false && "text-primary"
                    )}
                  >
                    <ThumbsDown className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-surface hover:bg-surface-2 rounded-full text-sm font-medium transition-colors shrink-0"
                >
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </button>

                <button
                  onClick={handleSave}
                  className={cn(
                    "p-2.5 rounded-full bg-surface hover:bg-surface-2 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center",
                    saved && "text-primary"
                  )}
                >
                  <Bookmark className="w-4 h-4" />
                </button>

                <button
                  onClick={handleReport}
                  className="p-2.5 rounded-full bg-surface hover:bg-surface-2 transition-colors text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Channel info */}
            <div className="flex items-center justify-between mt-3 p-3 sm:p-4 bg-surface rounded-xl">
              <Link to={`/channel/${video.channel_id}`} className="flex items-center gap-3">
                <img src={channelAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                <div>
                  <p className="font-semibold text-sm">{video.channels?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSubscribers(video.channels?.subscriber_count || 0)}
                  </p>
                </div>
              </Link>
              {(!user || user.id !== video.channels?.user_id) && (
                <button
                  onClick={handleSubscribe}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors shrink-0",
                    subscribed
                      ? "bg-surface-2 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                      : "bg-primary text-white hover:bg-primary/90"
                  )}
                >
                  {subscribed
                    ? <><CheckCircle2 className="w-4 h-4" /><span className="hidden sm:inline">Subscribed</span></>
                    : "Subscribe"
                  }
                </button>
              )}
            </div>

            {/* Description */}
            {video.description && (
              <div className="mt-3 p-3 sm:p-4 bg-surface rounded-xl">
                <p className={cn(
                  "text-sm text-foreground/80 whitespace-pre-wrap",
                  !descExpanded && "line-clamp-2"
                )}>
                  {video.description}
                </p>
                {video.description.length > 120 && (
                  <button
                    onClick={() => setDescExpanded((p) => !p)}
                    className="flex items-center gap-1 text-sm font-medium mt-2 hover:text-primary transition-colors"
                  >
                    {descExpanded
                      ? <><ChevronUp className="w-4 h-4" /> Show less</>
                      : <><ChevronDown className="w-4 h-4" /> Show more</>
                    }
                  </button>
                )}
              </div>
            )}

            {/* Related on mobile */}
            <div className="lg:hidden mt-4">
              <button
                onClick={() => setShowRelated((p) => !p)}
                className="flex items-center justify-between w-full p-3 bg-surface rounded-xl text-sm font-semibold"
              >
                <span>Up Next ({related.length})</span>
                {showRelated ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showRelated && (
                <div className="space-y-3 mt-3">
                  {related.map((v) => <VideoCard key={v.id} video={v} horizontal />)}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="mt-4 sm:mt-6">
              <Comments videoId={video.id} count={video.comments_count} />
            </div>
          </div>
        </div>

        {/* Related sidebar (desktop) */}
        <div className="hidden lg:block space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Up Next
          </h3>
          {related.map((v) => <VideoCard key={v.id} video={v} horizontal />)}
        </div>
      </div>
    </div>
  );
}
