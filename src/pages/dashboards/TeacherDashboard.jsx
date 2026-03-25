import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { StatCard } from '../../components/StatCard';
import { FileCheck, UploadCloud, Users, Check, X, ExternalLink, AlertTriangle, Trash2, Search, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pendingVerification: 0, myUploads: 0, studentsPromoted: 0 });
  const [pendingMaterials, setPendingMaterials] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Promote modal state
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [promoting, setPromoting] = useState(null); // id of student being promoted

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { count: pendingCount },
        { count: uploadsCount },
        { count: promotedCount },
        { data: materials },
        { data: reportsData }
      ] = await Promise.all([
        supabase.from('materials').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('materials').select('*', { count: 'exact', head: true }).eq('uploaded_by', user.id),
        supabase.from('requests').select('*', { count: 'exact', head: true }).eq('type', 'role_upgrade').eq('reviewed_by', user.id),
        supabase.from('materials').select('*, profiles:profiles!uploaded_by(full_name, username)').eq('status', 'pending').order('created_at', { ascending: true }),
        supabase.from('requests').select('*, profiles:profiles!requested_by(full_name, username)').eq('type', 'material_report').eq('status', 'pending')
      ]);
      
      setStats({
        pendingVerification: pendingCount || 0,
        myUploads: uploadsCount || 0,
        studentsPromoted: promotedCount || 0
      });
      setPendingMaterials(materials || []);
      setReports(reportsData || []);
    } catch (e) {
      console.error("Error fetching teacher data:", e.message);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleMaterialAction = async (id, action) => {
    try {
      const status = action === 'approve' ? 'approved' : 'rejected';
      
      // 1. Update the material
      await supabase
        .from('materials')
        .update({ status, verified_by: user.id, updated_at: new Date().toISOString() })
        .eq('id', id);

      // 2. Sync requests table
      await supabase
        .from('requests')
        .update({ status, reviewed_by: user.id, updated_at: new Date().toISOString() })
        .containedBy('payload', { material_id: id })
        .eq('status', 'pending');
      
      toast.success(`Material ${status} successfully`);
      fetchData();
    } catch (error) {
      toast.error(`Failed to update material: ` + error.message);
    }
  };

  const handleReportAction = async (requestId, action, materialId) => {
    const actionToast = toast.loading(action === 'remove' ? "Removing material..." : "Dismissing report...");
    try {
      const timestamp = new Date().toISOString();
      if (action === 'remove') {
        // 1. Delete the material
        const { error: deleteError } = await supabase
          .from('materials')
          .delete()
          .eq('id', materialId);
        
        if (deleteError) throw deleteError;

        // 2. Approve the report request (concluding it was valid)
        await supabase.from('requests').update({ 
          status: 'approved', 
          reviewed_by: user.id, 
          updated_at: timestamp 
        }).eq('id', requestId);

        // 3. Reject ANY other pending requests for this material (approvals, other reports, etc)
        // We use a more generic approach: any pending request with this material_id in payload
        await supabase.from('requests').update({ 
          status: 'rejected', 
          reviewed_by: user.id, 
          review_note: 'Material removed by moderator',
          updated_at: timestamp 
        })
        .containedBy('payload', { material_id: materialId })
        .eq('status', 'pending');
          
        toast.success("Material permanently removed", { id: actionToast });
      } else {
        // Just dismiss the report
        await supabase.from('requests').update({ 
          status: 'rejected', 
          reviewed_by: user.id,
          updated_at: timestamp
        }).eq('id', requestId);
        toast.success("Report dismissed", { id: actionToast });
      }
      fetchData();
    } catch (error) {
      console.error("Report Action Error:", error);
      toast.error("Failed to process action: " + error.message, { id: actionToast });
    }
  };

  const searchStudents = useCallback(async (q) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, username, email, roles!role_id(name)')
        .or(`username.ilike.%${q}%,email.ilike.%${q}%,full_name.ilike.%${q}%`)
        .limit(10);
      if (error) throw error;
      // Only show students
      setSearchResults((data || []).filter(p => p.roles?.name === 'student'));
    } catch (e) {
      toast.error('Search failed: ' + e.message);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    // debounce: search 400ms after typing stops
    clearTimeout(window._promoteSearchTimer);
    window._promoteSearchTimer = setTimeout(() => searchStudents(val), 400);
  };

  const handlePromote = async (student) => {
    setPromoting(student.id);
    try {
      // 1. Get verifier role id
      const { data: roleData, error: roleErr } = await supabase
        .from('roles')
        .select('id')
        .eq('name', 'verifier')
        .single();
      if (roleErr) throw roleErr;

      // 2. Update the student's role
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ role_id: roleData.id })
        .eq('id', student.id);
      if (updateErr) throw updateErr;

      // 3. Log the promotion as a request for audit trail
      await supabase.from('requests').insert({
        type: 'role_upgrade',
        requested_by: student.id,
        reviewed_by: user.id,
        status: 'approved',
        payload: { student_id: student.id, promoted_to: 'verifier', promoted_by: user.id },
      });

      toast.success(`${student.full_name || student.username} promoted to Verifier!`);
      setShowPromoteModal(false);
      setSearchQuery('');
      setSearchResults([]);
      fetchData();
    } catch (e) {
      toast.error('Promotion failed: ' + e.message);
    } finally {
      setPromoting(null);
    }
  };

  if (loading) return <div className="text-center py-10 text-slate-400">Loading teacher dashboard...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Materials Awaiting Verification" value={stats.pendingVerification} icon={FileCheck} color="amber" index={0} />
        <StatCard title="My Uploaded Materials" value={stats.myUploads} icon={UploadCloud} color="blue" index={1} />
        <StatCard title="Promoted Students" value={stats.studentsPromoted} icon={Users} color="green" index={2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Pending Materials Queue */}
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4">Pending Verifications</h3>
          {pendingMaterials.length > 0 ? (
            <div className="space-y-4">
              {pendingMaterials.slice(0, 5).map(m => (
                <div key={m.id} className="flex justify-between items-center p-3 bg-slate-800/30 rounded-lg">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-white truncate">{m.title}</div>
                    <div className="text-xs text-slate-500">By {m.profiles?.full_name || m.profiles?.username}</div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <a href={m.file_url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-700 rounded text-slate-400"><ExternalLink className="h-4 w-4" /></a>
                    <button onClick={() => handleMaterialAction(m.id, 'approve')} className="p-1.5 hover:bg-green-500/10 rounded text-green-500"><Check className="h-4 w-4" /></button>
                    <button onClick={() => handleMaterialAction(m.id, 'reject')} className="p-1.5 hover:bg-red-500/10 rounded text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
              {pendingMaterials.length > 5 && <p className="text-xs text-center text-slate-500">And {pendingMaterials.length - 5} more...</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No pending verifications.</p>
          )}
        </div>

        {/* Reported Notes Queue */}
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Reported Notes
          </h3>
          {reports.length > 0 ? (
            <div className="space-y-4">
              {reports.map(r => (
                <div key={r.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-bold text-white">Reason: {r.payload?.reason || 'No reason'}</div>
                    <div className="text-[10px] text-slate-500 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="text-xs text-slate-400 mb-3">Reported by {r.profiles?.full_name || r.profiles?.username}</div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleReportAction(r.id, 'remove', r.payload?.material_id)}
                      className="btn btn-danger btn-xs flex-1 py-1"
                    >
                      <Trash2 className="h-3 w-3 mr-1" /> Remove Note
                    </button>
                    <button 
                      onClick={() => handleReportAction(r.id, 'dismiss')}
                      className="btn btn-secondary btn-xs flex-1 py-1"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-8">No reported notes.</p>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-bold mb-4">Promote Students</h3>
        <p className="text-sm text-slate-400">Invite a trusted student to become a Verifier.</p>
        <button className="btn btn-primary mt-4" onClick={() => setShowPromoteModal(true)}>
          <UserCheck className="h-4 w-4 mr-2 inline" />
          Promote a Student
        </button>
      </div>

      {/* Promote Modal */}
      {showPromoteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) { setShowPromoteModal(false); setSearchQuery(''); setSearchResults([]); } }}
        >
          <div className="card w-full max-w-md mx-4 p-6 space-y-4" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Promote a Student</h2>
              <button
                onClick={() => { setShowPromoteModal(false); setSearchQuery(''); setSearchResults([]); }}
                className="p-1.5 hover:bg-slate-700 rounded text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400">Search by name, username, or email to find a student and promote them to Verifier.</p>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                className="input w-full pl-9"
                placeholder="Search students..."
                value={searchQuery}
                onChange={handleSearchChange}
                autoFocus
              />
            </div>

            {searching && <p className="text-sm text-slate-400 text-center py-2">Searching...</p>}

            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No students found.</p>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 bg-slate-800/40 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-white">{s.full_name || s.username}</div>
                      <div className="text-xs text-slate-400">@{s.username} · {s.email}</div>
                    </div>
                    <button
                      onClick={() => handlePromote(s)}
                      disabled={promoting === s.id}
                      className="btn btn-primary btn-xs py-1 px-3"
                    >
                      {promoting === s.id ? 'Promoting...' : 'Promote'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

