import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Settings, Activity, Server, FileText, Database, CheckCircle, XCircle, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';

// Placeholder Components for Tabs
const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);

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
    try {
      const { error } = await supabase.from('profiles').update({ role_id: roleId }).eq('id', userId);
      if (error) throw error;
      toast.success("User role updated");
      fetchData();
    } catch (e) {
      console.error(e);
      toast.error("Failed to update role");
    }
  };

  return (
    <div className="card p-6">
      <h3 className="text-xl font-bold text-white mb-4">User Management</h3>
      <p className="text-slate-400">Manage user roles.</p>
      <div className="table-container mt-6">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center py-8 text-slate-500">Loading users...</td>
              </tr>
            ) : users.map(user => (
              <tr key={user.id}>
                <td>{user.full_name || 'N/A'}</td>
                <td>{user.username}</td>
                <td>{user.email || 'N/A'}</td>
                <td>
                  <select 
                    className="input py-1 px-2 text-sm bg-slate-800 border-slate-700"
                    value={user.role_id || ''}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
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
      
      // Fetch material titles for note_approval requests
      const materialIds = data
        .filter(r => r.type === 'note_approval' && (r.payload?.material_id || r.details?.material_id))
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
      const { error: reqError } = await supabase
        .from('requests')
        .update({ 
          status, 
          reviewed_by: currentUser.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (reqError) throw new Error(`Request update failed: ${reqError.message}`);
      
      let actionTaken = false;

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
          const materialId = payload?.material_id || payload?.id;
          if (!materialId) throw new Error("No material ID found in payload");
          
          const { error: matError } = await supabase
            .from('materials')
            .update({ status: 'approved' })
            .eq('id', materialId);
            
          if (matError) throw new Error(`Failed to approve material: ${matError.message}`);
          actionTaken = true;
          console.log(`Action: Approved material ${materialId}`);
        }
      }

      toast.success(
        status === 'approved' && !actionTaken && type !== 'general'
          ? `Request marked as approved, but no automated action was defined for type "${type}".`
          : `Request ${status} successfully!`,
        { id: toastId, duration: 5000 }
      );
      
      fetchRequests();
    } catch (e) {
      console.error('Admin Action Error:', e);
      toast.error(e.message, { id: toastId });
      fetchRequests();
    }
  };

  const getRequestDetails = (r) => {
    const payload = r.payload || r.details || {};
    if (r.type === 'note_approval' || r.type === 'material_approval') {
      const matId = payload.material_id || payload.id || r.target_id;
      return (
        <div className="flex flex-col gap-1">
          <span className="text-slate-300">Material ID: {matId || 'Missing'}</span>
          <span className="text-xs text-slate-500">{materials[matId] || 'Title loading...'}</span>
          {r.status === 'approved' && matId && (
            <button 
              onClick={() => updateRequest(r.id, 'approved', 'note_approval', payload, r.requested_by)}
              className="text-[10px] text-accent hover:underline text-left w-fit"
            >
              (Retry Material Activation)
            </button>
          )}
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
      <h3 className="text-xl font-bold text-white mb-4">Requests Management</h3>
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

const SystemTab = () => (
  <div className="card p-6">
    <h3 className="text-xl font-bold text-white mb-4">Departments, Courses, Subjects</h3>
    <p className="text-slate-400">CRUD operations for academic taxonomy.</p>
  </div>
);

const AuditLogTab = () => (
  <div className="card p-6">
    <h3 className="text-xl font-bold text-white mb-4">Audit Log</h3>
    <p className="text-slate-400 mb-6">Timeline of system actions.</p>
    
    <div className="relative pl-6 border-l-2 border-slate-700 space-y-8">
      {/* Timeline item */}
      <div className="relative">
        <div className="absolute -left-[1.95rem] top-1 h-4 w-4 rounded-full bg-accent border-4 border-slate-900"></div>
        <div className="text-xs text-slate-500 mb-1">10 minutes ago</div>
        <div className="flex gap-2 items-center mb-2">
          <span className="font-medium text-white">Admin User</span>
          <span className="badge badge-success">updated_role</span>
        </div>
        <div className="text-sm text-slate-400">Changed role of <span className="text-slate-300">janesmith</span> to Verifier.</div>
      </div>
      
      {/* Timeline item */}
      <div className="relative">
        <div className="absolute -left-[1.95rem] top-1 h-4 w-4 rounded-full bg-blue-500 border-4 border-slate-900"></div>
        <div className="text-xs text-slate-500 mb-1">2 hours ago</div>
        <div className="flex gap-2 items-center mb-2">
          <span className="font-medium text-white">System</span>
          <span className="badge badge-primary">new_instance</span>
        </div>
        <div className="text-sm text-slate-400">Added peer node <span className="text-slate-300">MIT OpenCourseWare</span>.</div>
      </div>
    </div>
  </div>
);

const InstanceSettingsTab = () => (
  <div className="space-y-6">
    <div className="card p-6">
      <h3 className="text-xl font-bold text-white mb-4">Local Instance Settings</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-300">Instance Name</label>
          <input type="text" className="input" defaultValue="Open Learn Grid (Local)" />
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
        <h3 className="text-xl font-bold text-white">Federated Peers (The Grid)</h3>
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
        <h1 className="text-3xl font-bold text-white">Administration</h1>
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
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
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
