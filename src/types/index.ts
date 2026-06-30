export interface Profile {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  bio: string;
  is_admin: boolean;
  created_at: string;
}

export interface Channel {
  id: string;
  user_id: string;
  name: string;
  banner_url: string | null;
  description: string;
  subscriber_count: number;
  created_at: string;
  profiles?: Profile;
}

export interface Category {
  id: string;
  name: string;
}

export interface Video {
  id: string;
  user_id: string;
  channel_id: string | null;
  title: string;
  description: string;
  category_id: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration: number;
  views: number;
  likes_count: number;
  dislikes_count: number;
  comments_count: number;
  status: "published" | "private" | "removed";
  is_reported: boolean;
  created_at: string;
  processing_status: "ready" | "processing" | "failed" | null;
  original_resolution: string | null;
  // Joined fields
  channels?: Channel;
  categories?: Category;
  profiles?: Profile;
}

export interface Like {
  id: string;
  user_id: string;
  video_id: string;
  is_like: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  video_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  created_at: string;
  profiles?: Profile;
  replies?: Comment[];
}

export interface Subscription {
  id: string;
  subscriber_id: string;
  channel_id: string;
  created_at: string;
  channels?: Channel;
}

export interface Notification {
  id: string;
  user_id: string;
  type: "new_upload" | "comment" | "reply" | "like" | "subscribe";
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar_url?: string | null;
  is_admin?: boolean;
}
