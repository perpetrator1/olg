import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Settings, Activity, Server, FileText, Database, CheckCircle, XCircle, Info, Plus, Pencil, Trash2, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

// User Management Tab
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [confirmAction, setConfirmAction] = useState(null); // { userId, action, roleName, roleId }
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*, roles(name)'),
        supabase.from('roles').select('*')
      ]);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, roleId) => {
    const targetRole = roles.find(r => r.id === roleId);
    // Confirm before promoting to admin
    if (targetRole?.name === 'admin') {
      setConfirmAction({ userId, roleId, roleName: 'admin', action: 'promote' });
      return;
    }
    await applyRoleChange(userId, roleId);
  };

  const applyRoleChange = async (userId, roleId) => {
    try {
      const { error } = await supabase.from('profiles').update({ role_id: roleId }).eq('id', userId);
      if (error) throw error;
      const roleName = roles.find(r => r.id === roleId)?.name || 'unknown';
      toast.success(`Role updated to ${roleName}`);
      setConfirmAction(null);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update role");
    }
  };

  const handleBanToggle = async (userId, currentlyBanned) => {
    if (userId === currentUser.id) return toast.error("You can't ban yourself");
    const action = currentlyBanned ? 'unban' : 'ban';
    try {
      const { error } = await supabase.from('profiles').update({ is_banned: !currentlyBanned }).eq('id', userId);
      if (error) throw error;
      toast.success(`User ${action}ned successfully`);
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error(`Failed to ${action} user`);
    }
  };

  const getRoleBadgeClass = (roleName) => {
    switch (roleName) {
      case 'admin': return 'bg-red-500/20 text-red-400';
      case 'teacher': return 'bg-purple-500/20 text-purple-400';
      case 'verifier': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || 
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.roles?.name === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <div className="card p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-xl font-bold">User Management</h3>
          <p className="text-slate-400 text-sm mt-1">{users.length} total users · Assign roles and manage access</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <input
            className="input"
            placeholder="Search by name, username, or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
          <option value="all">All Roles</option>
          {roles.map(r => <option key={r.id} value={r.name}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>)}
        </select>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="mb-6 p-4 rounded-lg border border-red-500/30 bg-red-500/10">
          <p className="text-sm text-red-300 mb-3">
            <strong>⚠ Confirm:</strong> Are you sure you want to promote this user to <strong>Admin</strong>? Admins have full control over the platform.
          </p>
          <div className="flex gap-2">
            <button className="btn btn-danger btn-sm" onClick={() => applyRoleChange(confirmAction.userId, confirmAction.roleId)}>
              <Check className="h-3 w-3 mr-1" /> Yes, Promote to Admin
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setConfirmAction(null)}>Cancel</button>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-500 mb-2">{filtered.length} user{filtered.length !== 1 ? 's' : ''} shown</p>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-500">Loading users...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-8 text-slate-500">No users match your search.</td>
              </tr>
            ) : filtered.map(user => (
              <tr key={user.id} className={user.is_banned ? 'opacity-60' : ''}>
                <td>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{user.full_name || 'N/A'}</span>
                    {user.id === currentUser.id && <span className="badge badge-primary text-[10px]">You</span>}
                  </div>
                </td>
                <td>{user.username}</td>
                <td className="text-slate-400 text-xs">{user.email || 'N/A'}</td>
                <td>
                  <select 
                    className="input py-1 px-2 text-sm bg-slate-800 border-slate-700"
                    value={user.role_id || ''}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    disabled={user.id === currentUser.id}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>
                    ))}
                  </select>
                </td>
                <td>
                  {user.is_banned 
                    ? <span className="badge badge-danger">Banned</span>
                    : <span className="badge badge-success">Active</span>}
                </td>
                <td>
                  {user.id !== currentUser.id && (
                    <button
                      className={`btn btn-sm ${user.is_banned ? 'btn-primary' : 'btn-danger'}`}
                      onClick={() => handleBanToggle(user.id, user.is_banned)}
                    >
                      {user.is_banned ? 'Unban' : 'Ban'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RequestsTab = () => {
  const [requests, setRequests] = useState([]);
  const [materials, setMaterials] = useState({});
  const [loading, setLoading] = useState(true);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`*, requested_user:profiles!requests_requested_by_fkey(username, email)`)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      
      setRequests(data || []);
      
      // Fetch material titles for note_approval and removal_request requests
      const materialIds = data
        .filter(r => (r.type === 'note_approval' || r.type === 'removal_request' || r.type === 'material_report') && (r.payload?.material_id || r.details?.material_id))
        .map(r => r.payload?.material_id || r.details?.material_id);
        
      if (materialIds.length > 0) {
        const { data: matData } = await supabase
          .from('materials')
          .select('id, title')
          .in('id', materialIds);
          
        const matMap = {};
        matData?.forEach(m => { matMap[m.id] = m.title; });
        setMaterials(matMap);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch requests");
    } finally {
      setLoading(false);
    }
  };

  const updateRequest = async (id, status, type, payload, requested_by) => {
    const toastId = toast.loading(`Processing ${status}...`);
    try {
      console.log('Action details:', { id, status, type, payload, requested_by });
      
      // 1. Update the request status
      const { data: reqUpdated, error: reqError } = await supabase
        .from('requests')
        .update({ 
          status, 
          reviewed_by: currentUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*');
        
      if (reqError) throw new Error(`Request update failed: ${reqError.message}`);
      const reqCount = reqUpdated?.length || 0;
      
      let actionTaken = false;
      let matCount = 0;

      // 2. Perform actions if approved
      if (status === 'approved') {
        if (type === 'role_upgrade') {
          const roleName = payload?.requested_role || payload?.role || payload?.new_role;
          if (!roleName) throw new Error("No role specified in request payload (checked requested_role, role, new_role)");
          
          const { data: roleData, error: roleFetchError } = await supabase
            .from('roles')
            .select('id')
            .eq('name', roleName.toLowerCase())
            .single();
            
          if (roleFetchError || !roleData) {
            throw new Error(`Role '${roleName}' not found in database.`);
          }
          
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ role_id: roleData.id })
            .eq('id', requested_by);
            
          if (profileError) throw new Error(`Failed to update profile: ${profileError.message}`);
          actionTaken = true;
          console.log(`Action: Upgraded ${requested_by} to ${roleName}`);
          
        } else if (type === 'note_approval' || type === 'material_approval') {
          let parsedPayload = payload;
          if (typeof payload === 'string') {
            try { parsedPayload = JSON.parse(payload); } catch (e) {}
          }
          const materialId = parsedPayload?.material_id || parsedPayload?.id;
          if (!materialId) throw new Error("No material ID found in payload");
          
          const { data: updatedObj, error: matError } = await supabase
            .from('materials')
            .update({ status: 'approved' })
            .eq('id', materialId)
            .select('*');
            
          if (matError) throw new Error(`Failed to approve material: ${matError.message}`);
          matCount = updatedObj?.length || 0;
          if (matCount === 0) console.warn(`Material ${materialId} not found or RLS prevented update.`);
          
          actionTaken = true;
          console.log(`Action: Approved material ${materialId}, rows affected: ${matCount}`);
        } else if (type === 'material_report' || type === 'removal_request') {
          const materialId = payload?.material_id;
          if (!materialId) throw new Error(`No material ID found in ${type} payload`);

          if (status === 'approved') {
            // "Approving" means we agree it should be removed
            const { error: deleteError } = await supabase
              .from('materials')
              .delete()
              .eq('id', materialId);
            
            if (deleteError) throw deleteError;
            
            // Clean up other requests for this material
            await supabase.from('requests').update({ 
              status: 'rejected', 
              reviewed_by: currentUser.id,
              review_note: 'Material removed due to report/request',
              updated_at: new Date().toISOString()
            })
            .containedBy('payload', { material_id: materialId })
            .eq('status', 'pending');

            actionTaken = true;
            console.log(`Action: Deleted material ${materialId} per ${type}`);
          } else {
            // Rejecting the request/report means we dismiss it
            actionTaken = true;
            console.log(`Action: Dismissed ${type} for ${materialId}`);
          }
        }
      }

      toast.success(
        status === 'approved' && !actionTaken && type !== 'general'
          ? `Request marked as approved, but no automated action was defined for type "${type}".`
          : `Success! Request rows: ${reqCount}, Material rows: ${matCount}`,
        { id: toastId, duration: 8000 }
      );
      
      fetchRequests();
    } catch (e) {
      console.error('Admin Action Error:', e);
      toast.error(e.message, { id: toastId });
      fetchRequests();
    }

  };

  const getRequestDetails = (r) => {
    let payload = r.payload || r.details || {};
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch (e) {}
    }
    const matId = payload.material_id || payload.id || r.target_id;

    if (r.type === 'note_approval' || r.type === 'material_approval') {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-slate-300">Material: {materials[matId] || 'Title loading...'}</span>
          <Link 
            to={`/materials/${matId}`} 
            className="text-[10px] text-accent hover:underline flex items-center gap-1"
          >
            <Info className="h-2 w-2" /> View & Preview Material
          </Link>
        </div>
      );
    }
    if (r.type === 'material_report' || r.type === 'removal_request') {
      const isRemoval = r.type === 'removal_request' || payload.request_type === 'removal';
      return (
        <div className="flex flex-col gap-1">
          <span className={`font-bold ${isRemoval ? 'text-red-500' : 'text-orange-400'}`}>
            {isRemoval ? 'REMOVAL REQUEST' : 'REPORT'}: {payload.reason}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Material: {payload.material_title || materials[matId] || matId}</span>
            <Link to={`/materials/${matId}`} className="text-[10px] text-accent hover:underline">Preview</Link>
          </div>
        </div>
      );
    }
    if (r.type === 'role_upgrade') {
      return `Upgrade to: ${payload.requested_role || payload.role || 'Unknown'}`;
    }
    return JSON.stringify(payload);
  };


  return (
    <div className="card p-6">
      <h3 className="text-xl font-bold mb-4">Requests Management</h3>
      <div className="table-container mt-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Details</th>
              <th>Requested By</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center py-8 text-slate-500">Loading requests...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-8 text-slate-500">No requests found.</td></tr>
            ) : requests.map(r => (
              <tr key={r.id}>
                <td>
                  <span className="capitalize">{r.type.replace('_', ' ')}</span>
                </td>
                <td className="max-w-xs truncate font-medium text-slate-300">
                  {getRequestDetails(r)}
                </td>
                <td>{r.requested_user ? r.requested_user.username : r.requested_by}</td>
                <td>
                  <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                    {r.status}
                  </span>
                </td>
                <td>
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <button 
                        className="btn btn-sm btn-primary flex items-center gap-1" 
                        onClick={() => updateRequest(r.id, 'approved', r.type, r.payload || r.details, r.requested_by)}
                      >
                        <CheckCircle className="h-3 w-3" /> Approve
                      </button>
                      <button 
                        className="btn btn-sm btn-secondary flex items-center gap-1" 
                        onClick={() => updateRequest(r.id, 'rejected', r.type, r.payload || r.details, r.requested_by)}
                      >
                        <XCircle className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                  {r.status !== 'pending' && (
                    <span className="text-xs text-slate-500 italic">Processed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SystemTab = () => {
  const [subTab, setSubTab] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [courses, setCourses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit / Add state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [deptRes, courseRes, subRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('courses').select('*, department:departments(name)').order('name'),
        supabase.from('subjects').select('*').order('name'),
      ]);
      setDepartments(deptRes.data || []);
      setCourses(courseRes.data || []);
      setSubjects(subRes.data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load taxonomy data');
    } finally {
      setLoading(false);
    }
  };

  const resetForms = () => {
    setEditingId(null);
    setEditForm({});
    setAddingNew(false);
    setNewForm({});
    setDeleteConfirmId(null);
  };

  // ── Generic CRUD helpers ──────────────────────────────────
  const handleAdd = async (table, data) => {
    try {
      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;
      toast.success(`Added successfully`);
      resetForms();
      fetchAll();
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to add');
    }
  };

  const handleUpdate = async (table, id, data) => {
    try {
      const { error } = await supabase.from(table).update(data).eq('id', id);
      if (error) throw error;
      toast.success(`Updated successfully`);
      resetForms();
      fetchAll();
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to update');
    }
  };

  const handleDelete = async (table, id) => {
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      toast.success(`Deleted successfully`);
      resetForms();
      fetchAll();
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Failed to delete');
    }
  };

  // ── Sub-tab buttons ───────────────────────────────────────
  const subTabs = [
    { id: 'departments', label: 'Departments' },
    { id: 'courses', label: 'Courses' },
    { id: 'subjects', label: 'Subjects' },
  ];

  // ── Departments panel ─────────────────────────────────────
  const renderDepartments = () => (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{departments.length} department{departments.length !== 1 ? 's' : ''}</p>
        <button className="btn btn-primary btn-sm" onClick={() => { resetForms(); setAddingNew(true); setNewForm({ name: '', code: '' }); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Department
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th className="w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {addingNew && (
              <tr className="bg-accent/5">
                <td>
                  <input className="input py-1 px-2 text-sm" placeholder="Department name" value={newForm.name || ''} onChange={e => setNewForm({ ...newForm, name: e.target.value })} autoFocus />
                </td>
                <td>
                  <input className="input py-1 px-2 text-sm" placeholder="e.g. CS" value={newForm.code || ''} onChange={e => setNewForm({ ...newForm, code: e.target.value })} />
                </td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={() => { if (!newForm.name?.trim()) return toast.error('Name is required'); handleAdd('departments', { name: newForm.name.trim(), code: newForm.code?.trim() || null }); }}>
                      <Check className="h-3 w-3 mr-1" /> Save
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={resetForms}>Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {loading ? (
              <tr><td colSpan="3" className="text-center py-8 text-slate-500">Loading...</td></tr>
            ) : departments.length === 0 && !addingNew ? (
              <tr><td colSpan="3" className="text-center py-8 text-slate-500">No departments yet. Add one to get started.</td></tr>
            ) : departments.map(d => (
              <tr key={d.id}>
                <td>
                  {editingId === d.id
                    ? <input className="input py-1 px-2 text-sm" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
                    : <span className="font-medium">{d.name}</span>}
                </td>
                <td>
                  {editingId === d.id
                    ? <input className="input py-1 px-2 text-sm" value={editForm.code || ''} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
                    : <span className="badge badge-secondary">{d.code || '—'}</span>}
                </td>
                <td>
                  {deleteConfirmId === d.id ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-red-400">Delete?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete('departments', d.id)}>Yes</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmId(null)}>No</button>
                    </div>
                  ) : editingId === d.id ? (
                    <div className="flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={() => { if (!editForm.name?.trim()) return toast.error('Name is required'); handleUpdate('departments', d.id, { name: editForm.name.trim(), code: editForm.code?.trim() || null }); }}>
                        <Check className="h-3 w-3 mr-1" /> Save
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={resetForms}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => { resetForms(); setEditingId(d.id); setEditForm({ name: d.name, code: d.code || '' }); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => { resetForms(); setDeleteConfirmId(d.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  // ── Courses panel ─────────────────────────────────────────
  const renderCourses = () => (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{courses.length} course{courses.length !== 1 ? 's' : ''}</p>
        <button className="btn btn-primary btn-sm" onClick={() => { resetForms(); setAddingNew(true); setNewForm({ name: '', department_id: departments[0]?.id || '', duration_semesters: 8 }); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Course
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Department</th>
              <th>Semesters</th>
              <th className="w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {addingNew && (
              <tr className="bg-accent/5">
                <td>
                  <input className="input py-1 px-2 text-sm" placeholder="Course name" value={newForm.name || ''} onChange={e => setNewForm({ ...newForm, name: e.target.value })} autoFocus />
                </td>
                <td>
                  <select className="input py-1 px-2 text-sm" value={newForm.department_id || ''} onChange={e => setNewForm({ ...newForm, department_id: e.target.value })}>
                    <option value="">— None —</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </td>
                <td>
                  <input type="number" className="input py-1 px-2 text-sm w-20" min="1" max="16" value={newForm.duration_semesters ?? 8} onChange={e => setNewForm({ ...newForm, duration_semesters: parseInt(e.target.value) || 8 })} />
                </td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={() => { if (!newForm.name?.trim()) return toast.error('Name is required'); handleAdd('courses', { name: newForm.name.trim(), department_id: newForm.department_id || null, duration_semesters: newForm.duration_semesters || 8 }); }}>
                      <Check className="h-3 w-3 mr-1" /> Save
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={resetForms}>Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {loading ? (
              <tr><td colSpan="4" className="text-center py-8 text-slate-500">Loading...</td></tr>
            ) : courses.length === 0 && !addingNew ? (
              <tr><td colSpan="4" className="text-center py-8 text-slate-500">No courses yet. Add one to get started.</td></tr>
            ) : courses.map(c => (
              <tr key={c.id}>
                <td>
                  {editingId === c.id
                    ? <input className="input py-1 px-2 text-sm" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
                    : <span className="font-medium">{c.name}</span>}
                </td>
                <td>
                  {editingId === c.id
                    ? <select className="input py-1 px-2 text-sm" value={editForm.department_id || ''} onChange={e => setEditForm({ ...editForm, department_id: e.target.value })}>
                        <option value="">— None —</option>
                        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    : <span className="text-slate-300">{c.department?.name || '—'}</span>}
                </td>
                <td>
                  {editingId === c.id
                    ? <input type="number" className="input py-1 px-2 text-sm w-20" min="1" max="16" value={editForm.duration_semesters ?? 8} onChange={e => setEditForm({ ...editForm, duration_semesters: parseInt(e.target.value) || 8 })} />
                    : <span>{c.duration_semesters}</span>}
                </td>
                <td>
                  {deleteConfirmId === c.id ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-red-400">Delete?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete('courses', c.id)}>Yes</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmId(null)}>No</button>
                    </div>
                  ) : editingId === c.id ? (
                    <div className="flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={() => { if (!editForm.name?.trim()) return toast.error('Name is required'); handleUpdate('courses', c.id, { name: editForm.name.trim(), department_id: editForm.department_id || null, duration_semesters: editForm.duration_semesters || 8 }); }}>
                        <Check className="h-3 w-3 mr-1" /> Save
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={resetForms}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => { resetForms(); setEditingId(c.id); setEditForm({ name: c.name, department_id: c.department_id || '', duration_semesters: c.duration_semesters }); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => { resetForms(); setDeleteConfirmId(c.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  // ── Subjects panel ────────────────────────────────────────
  const renderSubjects = () => (
    <>
      <div className="flex justify-between items-center mb-4">
        <p className="text-slate-400 text-sm">{subjects.length} subject{subjects.length !== 1 ? 's' : ''}</p>
        <button className="btn btn-primary btn-sm" onClick={() => { resetForms(); setAddingNew(true); setNewForm({ name: '', code: '', is_common: false }); }}>
          <Plus className="h-4 w-4 mr-1" /> Add Subject
        </button>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Common</th>
              <th className="w-40">Actions</th>
            </tr>
          </thead>
          <tbody>
            {addingNew && (
              <tr className="bg-accent/5">
                <td>
                  <input className="input py-1 px-2 text-sm" placeholder="Subject name" value={newForm.name || ''} onChange={e => setNewForm({ ...newForm, name: e.target.value })} autoFocus />
                </td>
                <td>
                  <input className="input py-1 px-2 text-sm" placeholder="e.g. CS101" value={newForm.code || ''} onChange={e => setNewForm({ ...newForm, code: e.target.value })} />
                </td>
                <td>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-700 bg-slate-900 text-accent focus:ring-accent w-4 h-4" checked={newForm.is_common || false} onChange={e => setNewForm({ ...newForm, is_common: e.target.checked })} />
                    <span className="text-xs text-slate-400">Common</span>
                  </label>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={() => { if (!newForm.name?.trim()) return toast.error('Name is required'); handleAdd('subjects', { name: newForm.name.trim(), code: newForm.code?.trim() || null, is_common: newForm.is_common || false }); }}>
                      <Check className="h-3 w-3 mr-1" /> Save
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={resetForms}>Cancel</button>
                  </div>
                </td>
              </tr>
            )}
            {loading ? (
              <tr><td colSpan="4" className="text-center py-8 text-slate-500">Loading...</td></tr>
            ) : subjects.length === 0 && !addingNew ? (
              <tr><td colSpan="4" className="text-center py-8 text-slate-500">No subjects yet. Add one to get started.</td></tr>
            ) : subjects.map(s => (
              <tr key={s.id}>
                <td>
                  {editingId === s.id
                    ? <input className="input py-1 px-2 text-sm" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} autoFocus />
                    : <span className="font-medium">{s.name}</span>}
                </td>
                <td>
                  {editingId === s.id
                    ? <input className="input py-1 px-2 text-sm" value={editForm.code || ''} onChange={e => setEditForm({ ...editForm, code: e.target.value })} />
                    : <span className="badge badge-secondary">{s.code || '—'}</span>}
                </td>
                <td>
                  {editingId === s.id
                    ? <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="rounded border-slate-700 bg-slate-900 text-accent focus:ring-accent w-4 h-4" checked={editForm.is_common || false} onChange={e => setEditForm({ ...editForm, is_common: e.target.checked })} />
                        <span className="text-xs text-slate-400">Common</span>
                      </label>
                    : s.is_common ? <span className="badge badge-success">Yes</span> : <span className="badge badge-secondary">No</span>}
                </td>
                <td>
                  {deleteConfirmId === s.id ? (
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-red-400">Delete?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete('subjects', s.id)}>Yes</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setDeleteConfirmId(null)}>No</button>
                    </div>
                  ) : editingId === s.id ? (
                    <div className="flex gap-2">
                      <button className="btn btn-primary btn-sm" onClick={() => { if (!editForm.name?.trim()) return toast.error('Name is required'); handleUpdate('subjects', s.id, { name: editForm.name.trim(), code: editForm.code?.trim() || null, is_common: editForm.is_common || false }); }}>
                        <Check className="h-3 w-3 mr-1" /> Save
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={resetForms}>Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn btn-secondary btn-sm" onClick={() => { resetForms(); setEditingId(s.id); setEditForm({ name: s.name, code: s.code || '', is_common: s.is_common }); }}>
                        <Pencil className="h-3 w-3 mr-1" /> Edit
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => { resetForms(); setDeleteConfirmId(s.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );

  return (
    <div className="card p-6">
      <h3 className="text-xl font-bold mb-1">Academic Taxonomy</h3>
      <p className="text-slate-400 text-sm mb-5">Manage departments, courses, and subjects.</p>

      {/* Sub-tab navigation */}
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg mb-6 border border-slate-700/50">
        {subTabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setSubTab(t.id); resetForms(); }}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              subTab === t.id
                ? 'bg-accent text-white shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {subTab === 'departments' && renderDepartments()}
      {subTab === 'courses' && renderCourses()}
      {subTab === 'subjects' && renderSubjects()}
    </div>
  );
};

const AuditLogTab = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`*, reviewer:profiles!requests_reviewed_by_fkey(username), requester:profiles!requests_requested_by_fkey(username)`)
        .in('status', ['approved', 'rejected'])
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  const timeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'role_upgrade': return 'bg-purple-500';
      case 'note_approval': case 'material_approval': return 'bg-accent';
      case 'material_report': return 'bg-orange-500';
      case 'removal_request': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const getBadgeClass = (status) => status === 'approved' ? 'badge-success' : 'badge-danger';

  const getDescription = (log) => {
    const payload = log.payload || {};
    const requester = log.requester?.username || 'Unknown';
    switch (log.type) {
      case 'role_upgrade':
        return <>{log.status === 'approved' ? 'Promoted' : 'Denied promotion of'} <span className="text-slate-300">{requester}</span> to <span className="text-slate-300">{payload.requested_role || payload.role || '?'}</span></>;
      case 'note_approval': case 'material_approval':
        return <>{log.status === 'approved' ? 'Approved' : 'Rejected'} material by <span className="text-slate-300">{requester}</span></>;
      case 'material_report':
        return <>{log.status === 'approved' ? 'Removed reported material' : 'Dismissed report'} — reason: <span className="text-slate-300">{payload.reason || '—'}</span></>;
      case 'removal_request':
        return <>{log.status === 'approved' ? 'Approved removal' : 'Denied removal'} requested by <span className="text-slate-300">{requester}</span></>;
      default:
        return <>{log.status} request from <span className="text-slate-300">{requester}</span></>;
    }
  };

  return (
    <div className="card p-6">
      <h3 className="text-xl font-bold mb-4">Audit Log</h3>
      <p className="text-slate-400 mb-6">Timeline of reviewed admin actions.</p>

      {loading ? (
        <div className="text-center py-12 text-slate-500">Loading audit log...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">No audit entries yet. Process some requests to see them here.</div>
      ) : (
        <div className="relative pl-6 border-l-2 border-slate-700 space-y-8">
          {logs.map(log => (
            <div key={log.id} className="relative">
              <div className={`absolute -left-[1.95rem] top-1 h-4 w-4 rounded-full ${getTypeColor(log.type)} border-4 border-slate-900`}></div>
              <div className="text-xs text-slate-500 mb-1">{timeAgo(log.updated_at)}</div>
              <div className="flex gap-2 items-center mb-2">
                <span className="font-medium text-slate-900 dark:text-white">{log.reviewer?.username || 'System'}</span>
                <span className={`badge ${getBadgeClass(log.status)}`}>{log.type.replace(/_/g, ' ')}</span>
                <span className={`badge ${log.status === 'approved' ? 'badge-success' : 'badge-danger'}`}>{log.status}</span>
              </div>
              <div className="text-sm text-slate-400">{getDescription(log)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const InstanceSettingsTab = () => (
  <div className="space-y-6">
    <div className="card p-6">
      <h3 className="text-xl font-bold mb-4">Local Instance Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-300">Instance Name</label>
          <input type="text" className="input" defaultValue="Open Learning Grid (Local)" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input type="checkbox" className="rounded border-slate-700 bg-slate-900 text-accent focus:ring-accent w-5 h-5" defaultChecked />
            <span className="text-slate-300 font-medium">Allow Open Registration</span>
          </label>
        </div>
      </div>
      <button className="btn btn-primary mt-6">Save Settings</button>
    </div>

    <div className="card p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Federated Peers (The Grid)</h3>
        <button className="btn btn-primary btn-sm">Add Peer Node</button>
      </div>
      <p className="text-slate-400 mb-6">Connect to other college instances by adding their Supabase URL and Anon Key.</p>
      
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Node Name</th>
              <th>Status</th>
              <th>Added</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="4" className="text-center py-8 text-slate-500">No peer nodes configured.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

export const AdminPanel = () => {
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'system', label: 'System', icon: Database },
    { id: 'requests', label: 'Requests', icon: FileText },
    { id: 'audit', label: 'Audit Log', icon: Activity },
    { id: 'instance', label: 'Instance Settings', icon: Server },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Administration</h1>
        <p className="text-slate-400 mt-2">Manage the platform, users, and federation settings.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Nav */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="card p-2 flex flex-col gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-accent/10 text-accent' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'system' && <SystemTab />}
          {activeTab === 'requests' && <RequestsTab />}
          {activeTab === 'audit' && <AuditLogTab />}
          {activeTab === 'instance' && <InstanceSettingsTab />}
        </div>
      </div>
    </div>
  );
};
