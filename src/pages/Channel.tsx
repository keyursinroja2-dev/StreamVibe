import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import VideoCard from "@/components/features/VideoCard";
import { formatSubscribers, getAvatarUrl } from "@/lib/utils";
import type { Channel as ChannelType, Video } from "@/types";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Channel() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [channel, setChannel] = useState<ChannelType | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchChannel();
    if (user) checkSubscribed();
  }, [id, user]);

  // Real-time: subscriber count updates
  useEffect(() => {
    if (!id) return;
    const ch = supabase
      .channel(`channel-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "channels", filter: `id=eq.${id}` },
        (payload) => {
          setChannel((c) =>
            c ? { ...c, subscriber_count: payload.new.subscriber_count ?? c.subscriber_count } : c
          );
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  async function fetchChannel() {
    setLoading(true);
    const { data: ch } = await supabase
      .from("channels")
      .select("*, profiles(username, avatar_url)")
      .eq("id", id!)
      .single();

    if (!ch) { navigate("/"); return; }
    setChannel(ch as ChannelType);

    const { data: v } = await supabase
      .from("videos")
      .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
      .eq("channel_id", id!)
      .eq("status", "published")
      .order("created_at", { ascending: false });

    setVideos((v || []) as Video[]);
    setLoading(false);
  }

  async function checkSubscribed() {
    const { data } = await supabase
      .from("subscriptions").select("id")
      .eq("channel_id", id!).eq("subscriber_id", user!.id).maybeSingle();
    setSubscribed(!!data);
  }

  async function handleSubscribe() {
    if (!user) { navigate("/login"); return; }
    if (subscribed) {
      await supabase.from("subscriptions").delete()
        .eq("channel_id", id!).eq("subscriber_id", user.id);
      setSubscribed(false);
      setChannel((c) => c ? { ...c, subscriber_count: Math.max(0, c.subscriber_count - 1) } : c);
      toast.success("Unsubscribed");
    } else {
      await supabase.from("subscriptions").insert({ channel_id: id!, subscriber_id: user.id });
      setSubscribed(true);
      setChannel((c) => c ? { ...c, subscriber_count: c.subscriber_count + 1 } : c);
      toast.success("Subscribed!");
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-40 bg-surface" />
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex items-end gap-4 -mt-12">
            <div className="w-24 h-24 rounded-full bg-surface-2" />
            <div className="pb-2 space-y-2">
              <div className="h-6 w-40 rounded bg-surface-2" />
              <div className="h-4 w-24 rounded bg-surface-2" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!channel) return null;

  const avatar = channel.profiles?.avatar_url || getAvatarUrl(channel.name);

  return (
    <div>
      {/* Banner */}
      <div className="h-40 sm:h-56 bg-gradient-to-r from-primary/30 to-primary/10 overflow-hidden">
        {channel.banner_url && (
          <img src={channel.banner_url} alt="" className="w-full h-full object-cover" />
        )}
      </div>

      <div className="px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-4 -mt-12 pb-6 border-b border-border">
          <div className="flex items-end gap-4">
            <img
              src={avatar}
              alt={channel.name}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover ring-4 ring-background"
            />
            <div className="pb-1">
              <h1 className="font-display font-bold text-2xl">{channel.name}</h1>
              <p className="text-muted-foreground text-sm">
                {formatSubscribers(channel.subscriber_count)} · {videos.length} videos
              </p>
              {channel.description && (
                <p className="text-sm text-muted-foreground mt-1 max-w-lg line-clamp-2">
                  {channel.description}
                </p>
              )}
            </div>
          </div>

          {(!user || user.id !== channel.user_id) && (
            <button
              onClick={handleSubscribe}
              className={cn(
                "px-6 py-2.5 rounded-full font-semibold text-sm transition-colors min-h-[44px]",
                subscribed
                  ? "bg-surface text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  : "bg-primary text-white hover:bg-primary/90"
              )}
            >
              {subscribed
                ? <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Subscribed</span>
                : "Subscribe"
              }
            </button>
          )}
        </div>

        <div className="py-6">
          {videos.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No videos yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {videos.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
