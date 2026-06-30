import { Link } from "react-router-dom";
import { formatViews, formatRelativeTime, formatDuration, getAvatarUrl } from "@/lib/utils";
import { VideoOff } from "lucide-react";
import type { Video } from "@/types";
import { useState } from "react";

interface VideoCardProps {
  video: Video;
  horizontal?: boolean;
}

function SafeImage({ src, alt, className, fallback }: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [errored, setErrored] = useState(false);
  if (errored) return <>{fallback}</> || <div className={className} />;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      loading="lazy"
      decoding="async"
    />
  );
}

export default function VideoCard({ video, horizontal = false }: VideoCardProps) {
  const channelName = video.channels?.name || "Unknown Channel";
  const avatarSrc = getAvatarUrl(channelName);

  // Thumbnail fallback: user-uploaded > unsplash placeholder
  const thumbnail =
    video.thumbnail_url ||
    `https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=640&h=360&fit=crop&sig=${video.id?.slice(-6)}`;

  const durationLabel = video.duration > 0 ? formatDuration(video.duration) : null;

  if (horizontal) {
    return (
      <Link to={`/watch/${video.id}`} className="flex gap-3 group">
        <div className="relative shrink-0 w-36 sm:w-44 aspect-video rounded-xl overflow-hidden bg-surface">
          <SafeImage
            src={thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-surface-2">
                <VideoOff className="w-5 h-5 text-muted-foreground" />
              </div>
            }
          />
          {durationLabel && (
            <span className="absolute bottom-1 right-1 bg-black/85 text-white text-[11px] px-1.5 py-0.5 rounded font-medium leading-none">
              {durationLabel}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0 py-0.5">
          <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors leading-snug">
            {video.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1 truncate">{channelName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatViews(video.views)} · {formatRelativeTime(video.created_at)}
          </p>
        </div>
      </Link>
    );
  }

  return (
    <div className="group cursor-pointer">
      <Link to={`/watch/${video.id}`}>
        <div className="relative aspect-video rounded-xl overflow-hidden bg-surface mb-3">
          <SafeImage
            src={thumbnail}
            alt={video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            fallback={
              <div className="w-full h-full flex items-center justify-center bg-surface-2">
                <VideoOff className="w-8 h-8 text-muted-foreground" />
              </div>
            }
          />
          {durationLabel && (
            <span className="absolute bottom-2 right-2 bg-black/85 text-white text-xs px-1.5 py-0.5 rounded font-medium leading-none">
              {durationLabel}
            </span>
          )}
        </div>
      </Link>
      <div className="flex gap-3">
        <Link to={`/channel/${video.channel_id}`} className="shrink-0">
          <img
            src={avatarSrc}
            alt={channelName}
            className="w-9 h-9 rounded-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <Link to={`/watch/${video.id}`}>
            <h3 className="font-medium text-sm line-clamp-2 leading-snug group-hover:text-primary transition-colors">
              {video.title}
            </h3>
          </Link>
          <Link
            to={`/channel/${video.channel_id}`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors block mt-0.5 truncate"
          >
            {channelName}
          </Link>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatViews(video.views)} · {formatRelativeTime(video.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
