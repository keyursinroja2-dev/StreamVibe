import { Link } from "react-router-dom";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <div className="text-8xl font-display font-bold text-primary/20 mb-4">404</div>
        <h1 className="font-display font-bold text-2xl mb-2">Page not found</h1>
        <p className="text-muted-foreground mb-8">The page you're looking for doesn't exist.</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors">
            <Home className="w-4 h-4" /> Go home
          </Link>
          <Link to="/search" className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-border rounded-xl font-medium hover:bg-surface-2 transition-colors">
            <Search className="w-4 h-4" /> Search
          </Link>
        </div>
      </div>
    </div>
  );
}
