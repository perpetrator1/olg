import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, Grid, User, LogIn, Bell } from 'lucide-react';
import { DarkModeToggle } from '../components/DarkModeToggle';

export const MainLayout = () => {
  const { session, user, signOut } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white">
            <BookOpen className="h-6 w-6 text-accent" />
            <span>Open Learn Grid</span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link to="/" className="text-sm font-medium hover:text-accent transition-colors">Browse</Link>
            {session && (
              <Link to="/federation" className="text-sm font-medium hover:text-accent transition-colors flex items-center gap-1">
                <Grid className="h-4 w-4" /> The Grid
              </Link>
            )}
            
            <div className="flex items-center gap-2">
              <DarkModeToggle />
              
              {session ? (
                <div className="flex items-center gap-4 ml-2">
                  <button className="relative rounded-full p-2 hover:bg-slate-800 transition-colors">
                    <Bell className="h-5 w-5 text-slate-400 hover:text-white" />
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-accent"></span>
                  </button>
                  <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                    <Link to="/dashboard" className="flex items-center gap-2 hover:text-accent transition-colors">
                      <div className="h-8 w-8 rounded-full bg-slate-700 overflow-hidden">
                        {user?.avatar_url ? (
                          <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 m-1.5 opacity-50" />
                        )}
                      </div>
                    </Link>
                    <button onClick={() => signOut()} className="btn btn-ghost btn-sm text-slate-400 hover:text-white">
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 ml-2">
                  <Link to="/auth/login" className="btn btn-ghost btn-sm">Sign In</Link>
                  <Link to="/auth/register" className="btn btn-primary btn-sm flex gap-2">
                    <LogIn className="w-4 h-4"/> Register
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>
      
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
};
