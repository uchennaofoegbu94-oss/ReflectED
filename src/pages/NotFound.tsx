import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, LayoutDashboard } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const homeRoute = isAuthenticated ? (user?.isSuperAdmin ? '/super-admin' : '/dashboard') : '/';

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Oops! Page not found</p>
        <Link to={homeRoute}>
          <Button variant="outline" className="gap-2">
            {isAuthenticated ? <LayoutDashboard size={16} /> : <Home size={16} />}
            {isAuthenticated ? 'Return to Dashboard' : 'Return to Home'}
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
