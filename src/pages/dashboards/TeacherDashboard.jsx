import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/StatCard';
import { FileCheck, UploadCloud, Users } from 'lucide-react';

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pendingVerification: 0, myUploads: 0, studentsPromoted: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: pending },
          { count: uploads },
          { count: promoted }
        ] = await Promise.all([
          supabase.from('materials').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('materials').select('*', { count: 'exact', head: true }).eq('uploaded_by', user.id),
          supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'role_upgrade').eq('reviewed_by', user.id)
        ]);
        
        setStats({
          pendingVerification: pending || 0,
          myUploads: uploads || 0,
          studentsPromoted: promoted || 0
        });
      } catch (e) {
        console.error("Error fetching generic stats:", e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [user.id]);

  if (loading) return <div className="text-center py-10 text-slate-400">Loading teacher dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Materials Awaiting Verification" value={stats.pendingVerification} icon={FileCheck} color="amber" index={0} />
        <StatCard title="My Uploaded Materials" value={stats.myUploads} icon={UploadCloud} color="blue" index={1} />
        <StatCard title="Promoted Students" value={stats.studentsPromoted} icon={Users} color="green" index={2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <div className="card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Pending Verifications</h3>
          <p className="text-sm text-slate-400">Queue of notes waiting for verification.</p>
        </div>
        <div className="card p-6">
          <h3 className="text-lg font-bold text-white mb-4">Promote Students</h3>
          <p className="text-sm text-slate-400">Invite a trusted student to become a Verifier.</p>
          <button className="btn btn-primary mt-4">Promote a Student</button>
        </div>
      </div>
    </div>
  );
};
