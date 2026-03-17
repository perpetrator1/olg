import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Document, Page, pdfjs } from 'react-pdf';
import { Download, ThumbsUp, AlertTriangle, ArrowLeft, Trash2, Edit, CheckCircle, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

// Setup pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export const MaterialDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, user, role } = useAuth();
  
  const [material, setMaterial] = useState(null);
  const [loading, setLoading] = useState(true);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ title: '', description: '', type: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchMaterial();
  }, [id]);

  const fetchMaterial = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select(`
          *,
          profiles:profiles!uploaded_by(full_name, username)
        `)
        .eq('id', id)
        .single();
        
      if (error) throw error;
      setMaterial(data);
    } catch (error) {
      console.error('Error fetching material:', error.message);
      toast.error('Material not found');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleDownload = async () => {
    if (!session) return toast.error('Please login to download');
    
    try {
      // Increment download count
      await supabase.rpc('increment_download', { row_id: id });
      setMaterial(prev => ({ ...prev, download_count: prev.download_count + 1 }));
      
      // Trigger download
      window.open(material.file_url, '_blank');
    } catch (error) {
      toast.error('Failed to initiate download');
    }
  };

  const handleUpvote = async () => {
    if (!session) return toast.error('Please login to upvote');
    try {
      await supabase.rpc('increment_upvote', { row_id: id });
      setMaterial(prev => ({ ...prev, upvotes: prev.upvotes + 1 }));
      toast.success('Upvoted!');
    } catch (error) {
      toast.error('Failed to upvote');
    }
  };

  const handleReport = async () => {
    try {
      console.log('--- START REPORT ---');
      if (!session || !session.user) {
        console.error('No session found');
        return toast.error('You must be logged in to report');
      }

      // 1. Get Reason
      const reason = window.prompt("Why are you reporting this material?");
      console.log('Prompt result:', reason);
      
      if (reason === null) {
        console.log('Report cancelled by user');
        return;
      }
      
      if (!reason.trim()) {
        toast.error('A reason is required to submit a report');
        return;
      }

      // 2. Submit
      toast.loading('Submitting report...', { id: 'report-submitting' });
      console.log('Attempting DB insert...');

      const { error } = await supabase
        .from('requests')
        .insert({
          type: 'material_report',
          requested_by: session.user.id,
          payload: {
            material_id: id,
            reason: reason,
            material_title: material.title
          }
        });

      if (error) {
        console.error('Supabase insert error:', error);
        throw error;
      }

      console.log('Insert successful');
      toast.success('Report submitted. A moderator will review it.', { id: 'report-submitting' });
    } catch (error) {
      console.error('Fatal error in handleReport:', error);
      toast.error('Failed to submit report: ' + error.message, { id: 'report-submitting' });
    }
  };



  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState("report"); // "report" or "removal"
  const [reportReason, setReportReason] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);



  const handleUpdate = () => {
    setEditData({
      title: material.title,
      description: material.description || '',
      type: material.type
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!editData.title.trim()) return toast.error('Title is required');
    
    setIsSaving(true);
    const savingToast = toast.loading("Saving changes...");
    try {
      const { data, error } = await supabase
        .from('materials')
        .update({
          title: editData.title,
          description: editData.description,
          type: editData.type,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      setMaterial(data);
      setIsEditing(false);
      toast.success("Changes saved successfully!", { id: savingToast });
    } catch (error) {
      console.error('Error updating material:', error);
      toast.error("Failed to save: " + error.message, { id: savingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this material? This action cannot be undone.")) return;
    
    const deletingToast = toast.loading("Deleting material...", { id: 'delete-material' });
    try {
      console.log('--- DELETE ATTEMPT ---');
      console.log('Material ID:', id);
      console.log('Current User ID:', user?.id);
      console.log('Current Role:', role);
      console.log('Material Owner:', material.uploaded_by);

      console.log('--- ATTEMPTING DELETE ---');
      console.log('Target ID:', id);
      console.log('Logged User:', user?.id);
      console.log('Logged Role:', role);

      const { error, status, count } = await supabase
        .from('materials')
        .delete({ count: 'exact' })
        .eq('id', id);

      console.log('Delete Response:', { error, status, count });

      if (error) {
        console.error('Supabase Delete Error:', error);
        throw error;
      }

      // If count is null or 0, it means no rows were affected (likely RLS)
      if (count === 0) {
        // Double check if it still exists
        const { data: stillThere } = await supabase.from('materials').select('id').eq('id', id).single();
        if (stillThere) {
          const msg = `Permission Denied (Status ${status}): The database did not allow the deletion. Check if your role (${role}) has delete permissions for this material.`;
          alert(msg);
          throw new Error(msg);
        } else {
          toast.success("Material already removed", { id: 'delete-material' });
          setTimeout(() => navigate('/'), 1000);
          return;
        }
      }

      toast.success("Material deleted successfully", { id: 'delete-material' });
      setTimeout(() => navigate('/'), 1000);
    } catch (error) {
      console.error('Fatal delete error:', error);
      toast.error(error.message || "Failed to delete material", { id: 'delete-material' });
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return toast.error('Please specify a reason');
    
    setIsSubmittingReport(true);
    const reportToast = toast.loading('Submitting report...');

    try {
      const { error } = await supabase
        .from('requests')
        .insert({
          type: reportType === 'removal' ? 'removal_request' : 'material_report',
          requested_by: session.user.id,
          payload: {
            material_id: id,
            reason: reportReason,
            material_title: material.title,
            request_type: reportType
          }
        });

      if (error) throw error;
      
      toast.success(reportType === 'removal' ? 'Removal request submitted.' : 'Report submitted. A moderator will review it.', { id: reportToast });
      setIsReportModalOpen(false);
      setReportReason("");
      setReportType("report");
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Failed to submit report: ' + error.message, { id: reportToast });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-400 font-medium">Loading material details...</div>;
  if (!material) return null;

  const isPDF = material.file_url?.toLowerCase().endsWith('.pdf') || material.file_type === 'application/pdf';
  const isImage = material.file_url?.match(/\.(jpeg|jpg|png|gif)$/i) || material.file_type?.startsWith('image/');
  
  const isOwner = user?.id === material.uploaded_by;
  const lowerRole = role?.toLowerCase();
  const canManage = lowerRole === 'admin' || lowerRole === 'teacher';
  const canReport = !isOwner && (lowerRole === 'student' || lowerRole === 'verifier');

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm mb-6 text-slate-400 hover:text-white flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to browse
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Viewer */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card bg-slate-900 border-slate-800 overflow-hidden flex flex-col items-center justify-center min-h-[500px] relative">
            {isPDF ? (
              <div className="w-full flex flex-col items-center overflow-auto p-4 max-h-[800px]">
                <Document 
                   file={material.file_url} 
                   onLoadSuccess={onDocumentLoadSuccess}
                   loading={<div className="animate-pulse text-slate-500">Loading PDF...</div>}
                >
                  <Page pageNumber={pageNumber} width={Math.min(window.innerWidth - 64, 800)} />
                </Document>
                {numPages && (
                  <div className="flex items-center gap-4 mt-4 bg-slate-800 p-2 rounded-full absolute bottom-4 border border-slate-700 shadow-xl">
                    <button 
                      className="btn btn-secondary btn-sm rounded-full w-8 p-0"
                      disabled={pageNumber <= 1} 
                      onClick={() => setPageNumber(prev => prev - 1)}
                    >
                      &lt;
                    </button>
                    <span className="text-xs text-white font-medium px-2">Page {pageNumber} of {numPages}</span>
                    <button 
                      className="btn btn-secondary btn-sm rounded-full w-8 p-0"
                      disabled={pageNumber >= numPages} 
                      onClick={() => setPageNumber(prev => prev + 1)}
                    >
                      &gt;
                    </button>
                  </div>
                )}
              </div>
            ) : isImage ? (
              <img src={material.file_url} alt={material.title} className="max-w-full max-h-[800px] object-contain cursor-zoom-in rounded" />
            ) : (
              <div className="text-center p-12">
                <FileText className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">Preview not available</h3>
                <p className="text-slate-400 mb-6">This file type cannot be previewed in the browser.</p>
                <button onClick={handleDownload} className="btn btn-primary">Download File</button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Metadata */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex justify-between items-start mb-4">
              <span className="badge badge-primary uppercase tracking-wider">{material.type}</span>
              <div className="flex gap-2">
                {material.status === 'approved' && <span className="badge badge-success flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Verified</span>}
                {material.status === 'pending' && <span className="badge badge-warning flex items-center gap-1">Pending Review</span>}
                {material.status === 'rejected' && <span className="badge badge-danger flex items-center gap-1">Rejected</span>}
              </div>
            </div>

            {isEditing ? (
              <div className="space-y-4 mb-6 animate-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Title</label>
                  <input
                    type="text"
                    className="input text-lg font-bold"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Type</label>
                  <select
                    className="input py-1 h-auto"
                    value={editData.type}
                    onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                  >
                    <option value="notes">Notes</option>
                    <option value="question_paper">Question Paper</option>
                    <option value="assignment">Assignment</option>
                    <option value="reference">Reference</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    className="input min-h-[100px] text-sm py-3"
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSave} disabled={isSaving} className="btn btn-primary btn-sm flex-1">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setIsEditing(false)} disabled={isSaving} className="btn btn-ghost btn-sm flex-1">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-white mb-2 leading-tight">{material.title}</h1>
                <p className="text-slate-400 text-sm mb-6 whitespace-pre-wrap leading-relaxed">{material.description || 'No description provided.'}</p>
              </>
            )}

            <div className="space-y-4 border-t border-slate-700/50 pt-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Uploaded by</span>
                <span className="font-semibold text-slate-300">{material.profiles?.full_name || material.profiles?.username || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="font-semibold text-slate-300">{new Date(material.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Downloads</span>
                <span className="font-semibold text-slate-300">{material.download_count}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={handleDownload} 
                className="btn btn-primary w-full flex justify-center items-center gap-2 group"
              >
                <Download className="h-4 w-4 transition-transform group-hover:scale-110" /> Download Now
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={handleUpvote} 
                  className="btn btn-secondary flex-1 flex justify-center items-center gap-2"
                >
                  <ThumbsUp className="h-4 w-4" /> {material.upvotes}
                </button>
                {session && canReport && (
                  <button 
                    onClick={() => setIsReportModalOpen(true)}
                    className="btn btn-ghost text-red-400 hover:text-red-300 hover:bg-red-400/10 flex-1 flex justify-center items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" /> Report / Request Removal
                  </button>
                )}
              </div>
              {isOwner && (
                <p className="text-[10px] text-center text-slate-500 italic mt-2">You uploaded this material</p>
              )}
            </div>
          </div>

          {canManage && (
            <div className="card p-4 border-red-500/20 bg-red-500/5 shadow-inner">
              <h3 className="text-xs font-bold text-red-500 mb-3 uppercase tracking-widest opacity-80">Management Tools</h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleUpdate}
                  className="btn btn-secondary btn-sm flex-1 flex items-center justify-center gap-2"
                >
                  <Edit className="h-4 w-4" /> Edit
                </button>
                <button 
                  onClick={handleDelete}
                  className="btn btn-danger btn-sm flex-1 flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
              
              <div className="mt-4 p-2 bg-black/40 rounded border border-slate-700/50 text-[10px] font-mono text-slate-500">
                <p>Diagnostic Info:</p>
                <p>User ID: {user?.id?.slice(0, 8)}...</p>
                <p>Role: <span className="text-accent">{role}</span></p>
                <p>Owner ID: {material.uploaded_by?.slice(0, 8)}...</p>
              </div>
              {(role === 'admin' || role === 'teacher') && !isOwner && <p className="text-[10px] text-slate-500 mt-2 text-center opacity-70">Staff Access</p>}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal Integration */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6 bg-slate-900 border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-xl font-bold text-white">Report Material</h3>
            </div>
            
            <p className="text-sm text-slate-400 mb-6">
              Please help us maintain content quality by specifying your concern regarding <span className="text-slate-200 font-medium">"{material.title}"</span>.
            </p>

            <form onSubmit={handleReportSubmit} className="space-y-4">
              <div className="flex bg-slate-800 p-1 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => setReportType('report')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${reportType === 'report' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Report Content
                </button>
                <button
                  type="button"
                  onClick={() => setReportType('removal')}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${reportType === 'removal' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Request Removal
                </button>
              </div>

              <textarea
                className="input min-h-[120px] resize-none py-3 text-sm"
                placeholder={reportType === 'removal' ? "Why should this material be removed? (e.g. copyright, duplicate, incorrect info)" : "What is wrong with this content? (e.g. inappropriate, poor quality)"}
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                autoFocus
                required
              />
              
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  className="btn btn-ghost flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSubmittingReport}
                  className={`btn flex-1 ${reportType === 'removal' ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isSubmittingReport ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};


