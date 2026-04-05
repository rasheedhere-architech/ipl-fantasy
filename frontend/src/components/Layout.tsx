import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Trophy, LayoutDashboard, Settings, LogOut } from 'lucide-react';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="border-b border-white/5 bg-ipl-surface/90 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <Link to="/" className="text-2xl font-display font-bold text-ipl-gold tracking-widest flex items-center gap-2">
                <Trophy className="w-6 h-6" />
                IPL FANTASY
              </Link>
              
              <div className="hidden md:flex space-x-4">
                <Link to="/dashboard" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  DASHBOARD
                </Link>
                <Link to="/leaderboard" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <Trophy className="w-4 h-4" />
                  LEADERBOARD
                </Link>
                {user?.is_admin && (
                  <Link to="/admin" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                    <Settings className="w-4 h-4" />
                    ADMIN
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium hidden sm:block">{user.name}</span>
                  <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=0B0E1A&color=F4C430`} alt="avatar" className="w-8 h-8 rounded-full border border-ipl-gold/50" />
                  <button onClick={logout} className="text-gray-400 hover:text-white transition-colors ml-2" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
