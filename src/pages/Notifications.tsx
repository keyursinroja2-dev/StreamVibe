import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { formatRelativeTime } from "@/lib/utils";
import { Bell, CheckCheck } from "lucide-react";
import type { Notification } from "@/types";
import { cn } from "@/lib/utils";

const typeColors: Record<string, string> = {
  new_upload: "bg-primary/20 text-primary",
  comment: "bg-blue-500/20 text-blue-400",
  reply: "bg-purple-500/20 text-purple-400",
  like: "bg-green-500/20 text-green-400",
  subscribe: "bg-yellow-500/20 text-yellow-400",
};

const typeLabels: Record<string, string> = {
  new_upload: "Upload",
  comment: "Comment",
  reply: "Reply",
  like: "Like",
  subscribe: "Subscribe",
};

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    fetchNotifications();
    markAllRead();
  }, [user]);

  async function fetchNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false);
  }

  async function markRead(id: string) {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((n) => n.map((x) => x.id === id ? { ...x, is_read: true } : x));
  }

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-3">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex gap-3 p-4 bg-surface rounded-xl">
            <div className="w-10 h-10 rounded-full shimmer-bg shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 rounded shimmer-bg w-full" />
              <div className="h-3 rounded shimmer-bg w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Notifications</h1>
        {notifications.some((n) => !n.is_read) && (
          <button onClick={markAllRead} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl transition-colors cursor-pointer",
                !n.is_read ? "bg-primary/10 hover:bg-primary/15" : "bg-surface hover:bg-surface-2"
              )}
              onClick={() => { markRead(n.id); if (n.link) navigate(n.link); }}
            >
              <div className={cn("px-2 py-1 rounded-full text-xs font-medium shrink-0 mt-0.5", typeColors[n.type] || "bg-surface text-muted-foreground")}>
                {typeLabels[n.type] || n.type}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{formatRelativeTime(n.created_at)}</p>
              </div>
              {!n.is_read && <div className="w-2 h-2 bg-primary rounded-full shrink-0 mt-1.5" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
