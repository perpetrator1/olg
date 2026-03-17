import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/StatCard';
import { Users, FileText, Activity, AlertCircle, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard = () => {
  const [stats, setStats] = useState({
    users: 0,
    materials: 0,
    requests: 0,
    activeInstances: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: usersCount },
          { count: materialsCount },
          { count: requestsCount },
          { count: instancesCount }
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('materials').select('*', { count: 'exact', head: true }),
          supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('federated_instances').select('*', { count: 'exact', head: true }).eq('status', 'active')
        ]);

        setStats({
          users: usersCount || 0,
          materials: materialsCount || 0,
          requests: requestsCount || 0,
          activeInstances: instancesCount || 0
        });
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
        <div className="card p-6 min-h-[300px]">
          <h3 className="text-lg font-bold mb-4">Pending Requests</h3>
          <div className="text-sm text-slate-400">Widget Placeholder: List of pending requests will appear here.</div>
        </div>
        <div className="card p-6 min-h-[300px]">
          <h3 className="text-lg font-bold mb-4">Recent Users</h3>
          <div className="text-sm text-slate-400">Widget Placeholder: List of recently joined users.</div>
        </div>
      </div>
      
      <div className="card p-6">
        <h3 className="text-lg font-bold mb-4">Recent Activity</h3>
        <div className="text-sm text-slate-400">Widget Placeholder: Global audit log will appear here.</div>
      </div>
    </div>
  );
};
