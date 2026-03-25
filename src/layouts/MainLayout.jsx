import React, { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, Grid, User, LogIn, Bell, CheckCircle2, Clock, X, AlertTriangle } from 'lucide-react';
import { DarkModeToggle } from '../components/DarkModeToggle';
import { supabase } from '../lib/supabase';

export const MainLayout = () => {
  const { session, user, signOut } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [lastRead, setLastRead] = useState(0);

  useEffect(() => {
    if (user) setLastRead(Number(localStorage.getItem('lastRead_' + user.id)) || 0);
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('requested_by', user.id)
        .order('updated_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        setNotifications(data.map(formatNotification));
      }
    };

    fetchNotifications();

    const subscription = supabase
      .channel('public:requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'requests', filter: `requested_by=eq.${user.id}` }, payload => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const formatNotification = (req) => {
    let title = 'Notification';
    let message = '';
    let icon = Bell;
    let color = 'text-slate-500';

    if (req.type === 'role_upgrade') {
      title = 'Role Upgraded';
      message = `You have been promoted to ${req.payload?.promoted_to || 'a new role'}.`;
      icon = CheckCircle2;
      color = 'text-green-500';
    } else if (req.type === 'note_approval') {
      if (req.status === 'pending') {
        title = 'Pending Approval';
        message = 'Your uploaded material is being reviewed.';
        icon = Clock;
        color = 'text-amber-500';
      } else if (req.status === 'approved') {
        title = 'Material Approved';
        message = 'Your uploaded material has been approved and published.';
        icon = CheckCircle2;
        color = 'text-green-500';
      } else if (req.status === 'rejected') {
        title = 'Material Rejected';
        message = req.review_note ? `Material rejected: ${req.review_note}` : 'Your uploaded material was rejected.';
        icon = AlertTriangle;
        color = 'text-red-500';
      }
    } else if (req.type === 'material_report') {
       if (req.status === 'approved') {
          title = 'Report Resolved';
          message = 'A material you reported has been removed.';
          icon = CheckCircle2;
          color = 'text-green-500';
       } else if (req.status === 'rejected') {
          title = 'Report Dismissed';
          message = 'A report you submitted was reviewed and dismissed.';
          icon = AlertTriangle;
          color = 'text-slate-500';
       } else {
          title = 'Report Received';
          message = 'Your report is being reviewed by moderators.';
          icon = Clock;
          color = 'text-amber-500';
       }
    }

    const date = new Date(req.updated_at || req.created_at);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    let timeStr = 'Just now';
    if (diffDays > 0) timeStr = `${diffDays}d ago`;
    else if (diffHours > 0) timeStr = `${diffHours}h ago`;
    else if (diffMins > 0) timeStr = `${diffMins}m ago`;

    return {
      id: req.id,
      title,
      message,
      icon,
      time: timeStr,
      color,
      rawDate: date.toISOString()
    };
  };

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
                      {notifications.filter(n => new Date(n.rawDate).getTime() > lastRead).length > 0 && (
                        <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent border-2 border-white dark:border-slate-900"></span>
                      )}
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
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                              <Bell className="h-8 w-8 mx-auto mb-3 opacity-20" />
                              <p className="text-sm">No new notifications</p>
                            </div>
                          ) : (
                            notifications.map((n) => {
                              const isUnread = new Date(n.rawDate).getTime() > lastRead;
                              return (
                                <div key={n.id} className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex gap-3 border-b border-slate-50 dark:border-slate-700 last:border-0 ${isUnread ? 'bg-slate-50 dark:bg-slate-800/80' : ''}`}>
                                  <n.icon className={`h-5 w-5 shrink-0 mt-0.5 ${n.color}`} />
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{n.title}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{n.message}</p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">{n.time}</p>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                        <div className="p-2 bg-slate-50/50 dark:bg-slate-900/50 text-center">
                          <button 
                            onClick={() => {
                              const now = Date.now();
                              setLastRead(now);
                              if (user) localStorage.setItem('lastRead_' + user.id, now);
                            }} 
                            className="text-xs font-medium text-accent hover:underline"
                          >
                            Mark all as read
                          </button>
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
