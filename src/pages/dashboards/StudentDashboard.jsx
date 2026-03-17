import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/StatCard';
import { Upload, Clock, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const StudentDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ requests: 0, uploads: 0, downloaded: 0 });
  const [loading, setLoading] = useState(true);

  const handleApplyVerifier = async () => {
    try {
      const { error } = await supabase.from('requests').insert([{
        requested_by: user.id,
        type: 'role_upgrade',
        payload: { requested_role: 'verifier' },
        status: 'pending'
      }]);
      if (error) throw error;
      toast.success('Applied for Verifier successfully!');
    } catch (err) {
      toast.error(err.message || 'Failed to apply for Verifier');
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: requestsCount },
          { count: uploadsCount }
        ] = await Promise.all([
          supabase.from('requests').select('*', { count: 'exact', head: true }).eq('requested_by', user.id).eq('status', 'pending'),
          supabase.from('materials').select('*', { count: 'exact', head: true }).eq('uploaded_by', user.id)
        ]);

        setStats({
          requests: requestsCount || 0,
          uploads: uploadsCount || 0,
          downloaded: 0 // Mock stat since downloads aren't tracked per user yet
        });
      } catch (error) {
        console.error("Error fetching student stats:", error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user.id]);

  if (loading) return <div className="text-center py-10 text-slate-400">Loading student dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="My Uploads" value={stats.uploads} icon={Upload} color="blue" index={0} />
        <StatCard title="Pending Requests" value={stats.requests} icon={Clock} color="amber" index={1} />
        <StatCard title="Items Downloaded" value={stats.downloaded} icon={BookOpen} color="green" index={2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="card p-6 min-h-[300px]">
          <h3 className="text-lg font-bold text-white mb-4">Recently Added Materials</h3>
          <p className="text-sm text-slate-400">Discover new content shared by your peers.</p>
        </div>
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-white mb-4">My Request Statuses</h3>
            <p className="text-sm text-slate-400">Track approvals for materials and role requests.</p>
          </div>
          <div className="card p-6">
            <h3 className="text-lg font-bold text-white mb-4">Quick Links</h3>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-secondary btn-sm" onClick={() => navigate('/upload')}>Upload Material</button>
              <button className="btn btn-secondary btn-sm" onClick={() => toast('Course requests coming soon!', { icon: '🚧' })}>Request Course</button>
              <button className="btn btn-secondary btn-sm" onClick={handleApplyVerifier}>Apply for Verifier</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
