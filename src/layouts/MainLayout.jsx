import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, Grid, User, LogIn, Bell, CheckCircle2, Clock, X } from 'lucide-react';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { useState } from 'react';

export const MainLayout = () => {
  const { session, user, signOut } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = [
    { id: 1, title: 'Welcome to Open Learn Grid', message: 'Explore shared educational materials.', icon: CheckCircle2, time: 'Now', color: 'text-green-500' },
    { id: 2, title: 'Pending Approval', message: 'Your uploaded material is being reviewed.', icon: Clock, time: '2h ago', color: 'text-amber-500' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
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
                  <div className="relative">
                    <button 
                      onClick={() => setShowNotifications(!showNotifications)}
                      className={`relative rounded-full p-2 transition-colors ${showNotifications ? 'bg-slate-100 dark:bg-slate-800 text-accent' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                      <Bell className="h-5 w-5" />
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent border-2 border-white dark:border-slate-900"></span>
                    </button>

                    {showNotifications && (
                      <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm">Notifications</h4>
                          <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {notifications.map((n) => (
                            <div key={n.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex gap-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
                              <n.icon className={`h-5 w-5 shrink-0 mt-0.5 ${n.color}`} />
                              <div>
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{n.time}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="p-2 bg-slate-50/50 dark:bg-slate-900/50 text-center">
                          <button className="text-xs font-medium text-accent hover:underline">Mark all as read</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                    <Link to="/dashboard" className="flex items-center gap-2 transition-colors">
                      <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden flex items-center justify-center transition-all hover:scale-105 hover:shadow-md ring-1 ring-slate-200 dark:ring-slate-600">
                        {user?.avatar_url ? (
                          <img src={user.avatar_url} alt="avatar" className="h-full w-full object-cover" />
                        ) : (
                          <User className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        )}
                      </div>
                    </Link>
                    <button onClick={() => signOut()} className="btn btn-ghost btn-sm text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Sign Out">
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
