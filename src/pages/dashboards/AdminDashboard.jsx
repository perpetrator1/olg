import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/StatCard';
import { Users, FileText, Activity, AlertCircle, Settings, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    users: 0,
    materials: 0,
    requests: 0,
    activeInstances: 0
  });
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: usersCount },
          { count: materialsCount },
          { count: requestsCount },
          { count: instancesCount },
          { data: requestsData },
          { data: usersData }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('materials').select('*', { count: 'exact', head: true }),
          supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('federated_instances').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('requests').select('*, profiles:profiles!requested_by(username)').eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
          supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(5)
        ]);

        setStats({
          users: usersCount || 0,
          materials: materialsCount || 0,
          requests: requestsCount || 0,
          activeInstances: instancesCount || 0
        });
        setPendingRequests(requestsData || []);
        setRecentUsers(usersData || []);
      } catch (error) {
        console.error('Error fetching admin stats:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-400">Loading admin dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold">Quick Overview</h3>
        <div className="flex gap-2">
          <Link to="/upload" className="btn btn-secondary btn-sm flex items-center gap-2">
            Upload Material
          </Link>
          <Link to="/admin" className="btn btn-primary btn-sm flex items-center gap-2">
            <Settings className="h-4 w-4" /> Full Admin Panel
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Users" value={stats.users} icon={Users} color="blue" index={0} />
        <StatCard title="Total Materials" value={stats.materials} icon={FileText} color="amber" index={1} />
        <StatCard title="Pending Requests" value={stats.requests} icon={AlertCircle} color="red" index={2} />
        <StatCard title="Active Peer Nodes" value={stats.activeInstances} icon={Activity} color="green" index={3} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Pending Requests Widget */}
        <div className="card p-6 min-h-[300px]">
          <h3 className="text-lg font-bold mb-4">Pending Requests</h3>
          {pendingRequests.length > 0 ? (
            <div className="space-y-4">
              {pendingRequests.map(req => (
                <div key={req.id} className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-white capitalize">{req.type.replace('_', ' ')}</div>
                    <div className="text-xs text-slate-500">By {req.profiles?.username}</div>
                  </div>
                  <Link to="/admin" className="text-xs text-accent hover:underline">Review</Link>
                </div>
              ))}
              <Link to="/admin" className="block text-center text-xs text-slate-500 mt-4 hover:text-white">View all requests</Link>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500">
              <CheckCircle className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">No pending requests</p>
            </div>
          )}
        </div>

        {/* Recent Users Widget */}
        <div className="card p-6 min-h-[300px]">
          <h3 className="text-lg font-bold mb-4">Recent Users</h3>
          {recentUsers.length > 0 ? (
            <div className="space-y-4">
              {recentUsers.map(u => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold">
                    {(u.full_name || u.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{u.full_name || u.username}</div>
                    <div className="text-[10px] text-slate-500">{new Date(u.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-10">No users found.</p>
          )}
        </div>
      </div>
      
      <div className="card p-6">
        <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
        <div className="text-sm text-slate-400">All system systems are functional. Peer synchronization active.</div>
      </div>
    </div>
  );
};

