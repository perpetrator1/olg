import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/StatCard';
import { CheckCircle, Clock, Check, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

export const VerifierDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ queue: 0, verified: 0 });
  const [pendingMaterials, setPendingMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { count: queueCount },
        { count: verifiedCount },
        { data: materials }
      ] = await Promise.all([
        supabase.from('materials').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('materials').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('materials').select('*, profiles:profiles!uploaded_by(full_name, username)').eq('status', 'pending').order('created_at', { ascending: true })
      ]);
      
      setStats({
        queue: queueCount || 0,
        verified: verifiedCount || 0
      });
      setPendingMaterials(materials || []);
    } catch (error) {
      console.error("Error fetching verifier data:", error.message);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, action) => {
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      
      // 1. Update the material
      const { error: matError } = await supabase
        .from('materials')
        .update({ 
          status: status,
          verified_by: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (matError) throw matError;

      // 2. Automatically update any associated requests
      const { error: reqError } = await supabase
        .from('requests')
        .update({ 
          status: status,
          reviewed_by: user.id,
          updated_at: new Date().toISOString()
        })
        .containedBy('payload', { material_id: id })
        .eq('status', 'pending');

      if (reqError) console.error("Could not sync requests table:", reqError.message);
      
      toast.success(`Material ${status} successfully`);
      fetchData(); // Refresh list and stats
    } catch (error) {
      toast.error(`Failed to ${action} material: ` + error.message);
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-400">Loading verifier dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard title="Notes In Queue" value={stats.queue} icon={Clock} color="amber" index={0} />
        <StatCard title="Total Verified" value={stats.verified} icon={CheckCircle} color="green" index={1} />
      </div>

      <div className="card p-6 mt-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold">Verification Queue</h3>
            <p className="text-sm text-slate-400">List of student-uploaded notes requiring verification.</p>
          </div>
        </div>

        {pendingMaterials.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400 text-xs uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Material</th>
                  <th className="pb-3 font-semibold">Uploaded By</th>
                  <th className="pb-3 font-semibold">Date</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {pendingMaterials.map((item) => (
                  <tr key={item.id} className="group hover:bg-slate-800/30">
                    <td className="py-4">
                      <div className="font-medium text-white">{item.title}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{item.description}</div>
                    </td>
                    <td className="py-4">
                      <div className="text-sm text-slate-300">{item.profiles?.full_name || item.profiles?.username}</div>
                    </td>
                    <td className="py-4 text-sm text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <a 
                          href={item.file_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="View File"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button 
                          onClick={() => handleAction(item.id, 'approve')}
                          className="p-2 hover:bg-green-500/10 rounded-lg text-green-500 transition-colors"
                          title="Approve"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleAction(item.id, 'reject')}
                          className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-colors"
                          title="Reject"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 border-2 border-dashed border-slate-700 rounded-xl mt-4">
            <Clock className="h-12 w-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-slate-300 font-medium">Queue is empty</h4>
            <p className="text-slate-500 text-sm">No materials are currently pending verification.</p>
          </div>
        )}
      </div>
    </div>
  );
};

