import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Upload, X, File, AlertCircle } from 'lucide-react';

export const UploadMaterial = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'notes',
    subject_id: '' // Simplified for demo
  });
  
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const onDrop = useCallback(acceptedFiles => {
    if (acceptedFiles.length > 0) {
      const selected = acceptedFiles[0];
      if (selected.size > 20 * 1024 * 1024) {
        toast.error('File size must be less than 20MB');
        return;
      }
      setFile(selected);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 1
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error('Please select a file to upload');
    if (!formData.title) return toast.error('Title is required');

    setUploading(true);
    setProgress(10); // Start progress

    try {
      // 1. Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;
      setProgress(50);

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('materials')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;
      setProgress(75);

      // 2. Insert into materials table
      // Auto-approve if teacher/verifier/admin, else pending
      const status = ['teacher', 'verifier', 'admin'].includes(role) ? 'approved' : 'pending';

      const { data: materialData, error: dbError } = await supabase
        .from('materials')
        .insert({
          title: formData.title,
          description: formData.description,
          type: formData.type,
          file_url: fileUrl,
          file_type: file.type,
          uploaded_by: user.id,
          status: status
        })
        .select()
        .single();

      if (dbError) throw dbError;
      setProgress(90);

      // 3. If student, create a request automatically
      if (role === 'student') {
        const { error: reqError } = await supabase
          .from('requests')
          .insert({
            type: 'note_approval',
            requested_by: user.id,
            payload: { material_id: materialData.id }
          });
          
        if (reqError) console.error("Could not create request:", reqError);
      }

      setProgress(100);
      toast.success(status === 'approved' ? 'Material published successfully!' : 'Material submitted for approval.');
      navigate('/dashboard');

    } catch (error) {
      console.error(error);
      toast.error('Upload failed: ' + error.message);
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <div className="mb-8 items-center flex justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Upload Material</h1>
          <p className="text-slate-400 mt-2">Share your notes, papers, or references with the community.</p>
        </div>
      </div>

      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* File Dropzone */}
          <div>
            <label className="block text-sm font-medium mb-3 text-slate-300">File Attachment (PDF, JPG, PNG)</label>
            {!file ? (
              <div 
                {...getRootProps()} 
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${isDragActive ? 'border-accent bg-accent/5' : 'border-slate-600 hover:border-slate-500 bg-slate-800/50'}`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <p className="text-sm text-slate-300 mb-1">Drag and drop your file here, or click to browse</p>
                <p className="text-xs text-slate-500">Maximum file size: 20MB</p>
              </div>
            ) : (
              <div className="relative border rounded-xl p-6 bg-slate-800/50 border-accent/30 flex items-center justify-between">
                <div className="flex items-center gap-4 truncate">
                  <div className="h-10 w-10 shrink-0 bg-accent/20 rounded-lg flex items-center justify-center text-accent">
                    <File className="h-5 w-5" />
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-white truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setFile(null)}
                  className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"
                  disabled={uploading}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Title</label>
              <input
                type="text"
                className="input"
                required
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Data Structures Midterm Notes"
                disabled={uploading}
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 text-slate-300">Description (Optional)</label>
              <textarea
                className="input min-h-[100px] py-3"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Briefly describe the contents..."
                disabled={uploading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-slate-300">Material Type</label>
              <select 
                className="input" 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
                disabled={uploading}
              >
                <option value="notes">Notes</option>
                <option value="question_paper">Question Paper</option>
                <option value="assignment">Assignment</option>
                <option value="reference">Reference</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {role === 'student' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex gap-3 text-amber-200 mt-4">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-400" />
              <p className="text-sm">As a student, your uploaded materials will be reviewed by a verifier or teacher before they become publicly available.</p>
            </div>
          )}

          {uploading && (
            <div className="mt-6">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-accent h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-700">
            <button 
              type="button" 
              onClick={() => navigate(-1)} 
              className="btn btn-secondary"
              disabled={uploading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary min-w-[120px]"
              disabled={uploading || !file}
            >
              {uploading ? 'Processing...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
