import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { StatCard } from '../../components/StatCard';
import { CheckCircle, Clock } from 'lucide-react';

export const VerifierDashboard = () => {
  const [stats, setStats] = useState({ queue: 0, verified: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          { count: queueCount },
          { count: verifiedCount }
        ] = await Promise.all([
          supabase.from('materials').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('type', 'notes'),
          supabase.from('materials').select('*', { count: 'exact', head: true }).not('verified_by', 'is', null) // rough estimate
        ]);
        
        setStats({
          queue: queueCount || 0,
          verified: verifiedCount || 0
        });
      } catch (error) {
        console.error("Error fetching verifier stats:", error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="text-center py-10 text-slate-400">Loading verifier dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard title="Notes In Queue" value={stats.queue} icon={Clock} color="amber" index={0} />
        <StatCard title="Total Verified" value={stats.verified} icon={CheckCircle} color="green" index={1} />
      </div>

      <div className="card p-6 mt-8">
        <h3 className="text-lg font-bold mb-4">Verification Queue</h3>
        <p className="text-sm text-slate-400">List of student-uploaded notes requiring verification.</p>
      </div>
    </div>
  );
};
