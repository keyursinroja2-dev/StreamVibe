import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import VideoCard from "@/components/features/VideoCard";
import { formatSubscribers, getAvatarUrl } from "@/lib/utils";
import type { Video, Subscription } from "@/types";

export default function Subscriptions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchData();
  }, [user]);

  // Real-time: new videos from subscribed channels
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("subscriptions-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "videos" },
        async (payload) => {
          if (payload.new.status !== "published") return;
          // Check if this video is from a subscribed channel
          const isSubscribed = subs.some((s) => s.channel_id === payload.new.channel_id);
          if (!isSubscribed) return;
          // Refresh videos
          const channelIds = subs.map((s) => s.channel_id);
          if (channelIds.length === 0) return;
          const { data: v } = await supabase
            .from("videos")
            .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
            .in("channel_id", channelIds)
            .eq("status", "published")
            .order("created_at", { ascending: false })
            .limit(40);
          if (v) setVideos(v as Video[]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, subs]);

  async function fetchData() {
    setLoading(true);
    const { data: subData } = await supabase
      .from("subscriptions")
      .select("*, channels(*, profiles(username, avatar_url))")
      .eq("subscriber_id", user!.id)
      .order("created_at", { ascending: false });

    const fetchedSubs = (subData || []) as Subscription[];
    setSubs(fetchedSubs);

    if (fetchedSubs.length > 0) {
      const channelIds = fetchedSubs.map((s) => s.channel_id);
      const { data: v } = await supabase
        .from("videos")
        .select("*, channels(id, name, subscriber_count, user_id, banner_url), categories(id, name)")
        .in("channel_id", channelIds)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(40);
      setVideos((v || []) as Video[]);
    }
    setLoading(false);
  }

  async function unsubscribe(channelId: string) {
    await supabase.from("subscriptions").delete()
      .eq("channel_id", channelId).eq("subscriber_id", user!.id);
    setSubs((s) => s.filter((x) => x.channel_id !== channelId));
    setVideos((v) => v.filter((x) => x.channel_id !== channelId));
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="h-7 w-48 rounded shimmer-bg mb-6" />
        <div className="flex gap-4 mb-8 overflow-x-auto">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-16 h-16 rounded-full shimmer-bg shrink-0" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="aspect-video rounded-xl shimmer-bg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <h1 className="font-display font-bold text-2xl mb-6">Subscriptions</h1>

      {subs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No subscriptions yet</p>
          <p className="text-sm mt-1">Subscribe to channels to see their videos here</p>
        </div>
      ) : (
        <>
          <div className="flex gap-4 mb-8 overflow-x-auto scrollbar-hide pb-2">
            {subs.map((s) => {
              const ch = s.channels!;
              return (
                <div key={s.id} className="flex flex-col items-center gap-2 shrink-0 group">
                  <Link to={`/channel/${s.channel_id}`} className="relative">
                    <img
                      src={ch.profiles?.avatar_url || getAvatarUrl(ch.name)}
                      alt={ch.name}
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-transparent group-hover:ring-primary transition-all"
                    />
                  </Link>
                  <p className="text-xs text-center w-16 truncate">{ch.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSubscribers(ch.subscriber_count).replace(" subscribers", "")}
                  </p>
                  <button
                    onClick={() => unsubscribe(s.channel_id)}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Unsubscribe
                  </button>
                </div>
              );
            })}
          </div>

          <h2 className="font-semibold text-lg mb-4">Latest from subscriptions</h2>
          {videos.length === 0 ? (
            <p className="text-muted-foreground text-sm">No videos from subscriptions yet</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {videos.map((v) => <VideoCard key={v.id} video={v} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
