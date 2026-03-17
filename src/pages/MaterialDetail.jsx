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
    if (!session) return toast.error('Please login to report');
    
    const reason = window.prompt("Why are you reporting this material? (e.g., inappropriate content, copyright, wrong subject)");
    
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('requests')
        .insert({
          type: 'material_report',
          requested_by: user.id,
          payload: {
            material_id: id,
            reason: reason,
            material_title: material.title
          }
        });

      if (error) throw error;
      toast.success('Report submitted. A moderator will review it.');
    } catch (error) {
      console.error('Error reporting material:', error.message);
      toast.error('Failed to submit report');
    }
  };

  if (loading) return <div className="text-center py-20 text-slate-400">Loading material details...</div>;
  if (!material) return null;

  const isPDF = material.file_url?.toLowerCase().endsWith('.pdf') || material.file_type === 'application/pdf';
  const isImage = material.file_url?.match(/\.(jpeg|jpg|png|gif)$/i) || material.file_type?.startsWith('image/');
  const canEdit = role === 'admin' || user?.id === material.uploaded_by;

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
                  <div className="flex items-center gap-4 mt-4 bg-slate-800 p-2 rounded-full absolute bottom-4">
                    <button 
                      className="btn btn-secondary btn-sm rounded-full w-8 p-0"
                      disabled={pageNumber <= 1} 
                      onClick={() => setPageNumber(prev => prev - 1)}
                    >
                      &lt;
                    </button>
                    <span className="text-xs text-white font-medium">Page {pageNumber} of {numPages}</span>
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
              <img src={material.file_url} alt={material.title} className="max-w-full max-h-[800px] object-contain cursor-zoom-in" />
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
              {material.status === 'approved' && <span className="badge badge-success flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Verified</span>}
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">{material.title}</h1>
            <p className="text-slate-400 text-sm mb-6 whitespace-pre-wrap">{material.description || 'No description provided.'}</p>

            <div className="space-y-4 border-t border-slate-700/50 pt-4 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Uploaded by</span>
                <span className="font-medium text-slate-300">{material.profiles?.full_name || material.profiles?.username || 'Unknown'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Date</span>
                <span className="font-medium text-slate-300">{new Date(material.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Downloads</span>
                <span className="font-medium text-slate-300">{material.download_count}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button onClick={handleDownload} className="btn btn-primary w-full flex justify-center gap-2">
                <Download className="h-4 w-4" /> Download
              </button>
              <div className="flex gap-3">
                <button onClick={handleUpvote} className="btn btn-secondary flex-1 flex justify-center gap-2">
                  <ThumbsUp className="h-4 w-4" /> {material.upvotes}
                </button>
                {session && user?.id !== material.uploaded_by && (
                  <button 
                    onClick={handleReport}
                    className="btn btn-ghost text-red-400 hover:text-red-300 hover:bg-red-400/10 flex-1 flex justify-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4" /> Report
                  </button>
                )}

              </div>
            </div>
          </div>

          {canEdit && (
            <div className="card p-4 border-red-500/20 bg-red-500/5">
              <h3 className="text-sm font-bold text-red-400 mb-3 uppercase tracking-wider">Management</h3>
              <div className="flex gap-2">
                <button className="btn btn-secondary btn-sm flex-1 flex items-center justify-center gap-2">
                  <Edit className="h-4 w-4" /> Edit
                </button>
                <button 
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this material?")) {
                      supabase.from('materials').delete().eq('id', id).then(() => {
                        toast.success("Material deleted");
                        navigate('/');
                      });
                    }
                  }}
                  className="btn btn-danger btn-sm flex-1 flex items-center justify-center gap-2"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
