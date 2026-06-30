import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { getAvatarUrl, formatRelativeTime } from "@/lib/utils";
import { Trash2, Reply, Send } from "lucide-react";
import { toast } from "sonner";
import type { Comment } from "@/types";
import { Link } from "react-router-dom";

interface CommentsProps {
  videoId: string;
  count: number;
}

export default function Comments({ videoId, count }: CommentsProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  useEffect(() => {
    fetchComments();
  }, [videoId]);

  async function fetchComments() {
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url)")
      .eq("video_id", videoId)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) {
      // Fetch replies
      const withReplies = await Promise.all(
        data.map(async (c) => {
          const { data: replies } = await supabase
            .from("comments")
            .select("*, profiles(username, avatar_url)")
            .eq("parent_id", c.id)
            .order("created_at", { ascending: true });
          return { ...c, replies: replies || [] };
        })
      );
      setComments(withReplies as Comment[]);
    }
    setLoading(false);
  }

  async function submitComment() {
    if (!user || !text.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      video_id: videoId,
      user_id: user.id,
      content: text.trim(),
    });
    if (error) { toast.error("Failed to post comment"); }
    else { setText(""); fetchComments(); }
    setSubmitting(false);
  }

  async function submitReply(parentId: string) {
    if (!user || !replyText.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      video_id: videoId,
      user_id: user.id,
      parent_id: parentId,
      content: replyText.trim(),
    });
    if (error) { toast.error("Failed to post reply"); }
    else { setReplyText(""); setReplyTo(null); fetchComments(); }
    setSubmitting(false);
  }

  async function deleteComment(id: string) {
    await supabase.from("comments").delete().eq("id", id).eq("user_id", user!.id);
    fetchComments();
  }

  const CommentItem = ({ c, isReply = false }: { c: Comment; isReply?: boolean }) => {
    const avatar = c.profiles?.avatar_url || getAvatarUrl(c.profiles?.username || "user");
    return (
      <div className={`flex gap-3 ${isReply ? "ml-10" : ""}`}>
        <img src={avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{c.profiles?.username || "User"}</span>
            <span className="text-xs text-muted-foreground">{formatRelativeTime(c.created_at)}</span>
          </div>
          <p className="text-sm mt-0.5 text-foreground/90">{c.content}</p>
          <div className="flex items-center gap-3 mt-1">
            {user && !isReply && (
              <button onClick={() => setReplyTo(replyTo === c.id ? null : c.id)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                <Reply className="w-3 h-3" /> Reply
              </button>
            )}
            {user?.id === c.user_id && (
              <button onClick={() => deleteComment(c.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          {replyTo === c.id && (
            <div className="flex gap-2 mt-2">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Add a reply..."
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                onKeyDown={(e) => e.key === "Enter" && submitReply(c.id)}
              />
              <button onClick={() => submitReply(c.id)} disabled={submitting} className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h3 className="font-display font-semibold text-lg mb-4">{count} Comments</h3>

      {user ? (
        <div className="flex gap-3 mb-6">
          <img src={user.avatar_url || getAvatarUrl(user.username)} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          <div className="flex-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment..."
              className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
            />
            {text && (
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setText("")} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                <button onClick={submitComment} disabled={submitting} className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">
                  Comment
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-6 p-3 bg-surface rounded-xl text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">Sign in</Link> to comment
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full shimmer-bg" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded shimmer-bg" />
                <div className="h-3 w-full rounded shimmer-bg" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {comments.map((c) => (
            <div key={c.id} className="space-y-4">
              <CommentItem c={c} />
              {c.replies?.map((r) => (
                <CommentItem key={r.id} c={r} isReply />
              ))}
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">No comments yet. Be the first!</p>
          )}
        </div>
      )}
    </div>
  );
}
