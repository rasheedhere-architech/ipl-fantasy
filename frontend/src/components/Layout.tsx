import { Outlet, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { Trophy, LayoutDashboard, Settings, LogOut, Menu, X, BarChart2 } from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const { isAuthenticated, user, logout } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const clMenu = () => setIsMenuOpen(false);

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
                <Link to="/matchcenter" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <LayoutDashboard className="w-4 h-4" />
                  MATCH CENTER
                </Link>
                <Link to="/leaderboard" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <Trophy className="w-4 h-4" />
                  LEADERBOARD
                </Link>
                <Link to="/analysis" className="text-gray-300 hover:text-white flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors">
                  <BarChart2 className="w-4 h-4" />
                  ANALYSIS
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
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium hidden sm:block leading-none">{user.name}</span>
                    {user.is_guest && (
                      <span className="text-[8px] bg-ipl-gold/20 text-ipl-gold border border-ipl-gold/30 px-1.5 py-0.5 mt-1 rounded font-bold uppercase tracking-tighter hidden sm:block">
                        Guest Access
                      </span>
                    )}
                  </div>
                  <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=0B0E1A&color=F4C430`} alt="avatar" className="w-8 h-8 rounded-full border border-ipl-gold/50" />
                  <button onClick={logout} className="hidden md:block text-gray-400 hover:text-white transition-colors ml-2" title="Logout">
                    <LogOut className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden text-gray-400 hover:text-white p-1 ml-2">
                    {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden bg-ipl-surface border-t border-white/10 p-4 space-y-2 shadow-lg absolute w-full left-0 animate-in slide-in-from-top-2 duration-300">
            <Link to="/matchcenter" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <LayoutDashboard className="w-5 h-5 text-ipl-gold" />
              MATCH CENTER
            </Link>
            <Link to="/leaderboard" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <Trophy className="w-5 h-5 text-ipl-gold" />
              LEADERBOARD
            </Link>
            <Link to="/analysis" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
              <BarChart2 className="w-5 h-5 text-ipl-gold" />
              ANALYSIS
            </Link>
            {user?.is_admin && (
              <Link to="/admin" onClick={clMenu} className="block text-gray-300 hover:text-white font-medium flex items-center gap-3 px-4 py-3 bg-white/5 rounded-lg active:bg-white/10 transition-colors">
                <Settings className="w-5 h-5 text-ipl-gold" />
                ADMIN
              </Link>
            )}
            <button onClick={() => { logout(); clMenu(); }} className="w-full text-left text-red-500 hover:text-red-400 font-medium flex items-center gap-3 px-4 py-3 bg-red-500/10 rounded-lg active:bg-red-500/20 transition-colors mt-4">
              <LogOut className="w-5 h-5" />
              LOGOUT
            </button>
          </div>
        )}
      </nav>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
