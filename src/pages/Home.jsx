import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, Download, ThumbsUp, FileText } from 'lucide-react';

export const Home = () => {
  const { session } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);

  const toggleType = (value) => {
    setSelectedTypes(prev => 
      prev.includes(value) 
        ? prev.filter(t => t !== value)
        : [...prev, value]
    );
  };

  useEffect(() => {
    fetchMaterials();
  }, [searchQuery, selectedTypes]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('materials')
        .select(`
          id, title, description, type, file_type, 
          download_count, upvotes, created_at,
          profiles:profiles!uploaded_by(full_name, username)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });


      if (searchQuery) {
        query = query.textSearch('title', searchQuery, { type: 'websearch' }); // Simplified search
      }

      if (selectedTypes.length > 0) {
        query = query.in('type', selectedTypes);
      }

      const { data, error } = await query;
      console.log('Fetched materials raw data:', data);
      if (error) {
        console.error('Supabase query error:', error);
        throw error;
      }
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials catch:', error);
      toast.error('Error loading materials: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
      {/* Sidebar Filters */}
      <aside className="w-full md:w-64 shrink-0 space-y-6">
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-accent" />
            <h3 className="font-semibold">Filters</h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Type</label>
              <div className="space-y-2">
                {[
                  { label: 'Notes', value: 'notes' }, 
                  { label: 'Question Paper', value: 'question_paper' }, 
                  { label: 'Assignment', value: 'assignment' }, 
                  { label: 'Reference', value: 'reference' }
                ].map(type => (
                  <label key={type.value} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <input 
                      type="checkbox" 
                      checked={selectedTypes.includes(type.value)}
                      onChange={() => toggleType(type.value)}
                      className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-accent focus:ring-accent" 
                    />
                    {type.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {!session && (
          <div className="card p-8 mb-8 bg-gradient-to-r from-slate-800 to-slate-900 border-accent/20">
            <h1 className="text-3xl font-bold mb-2">Open Learn Grid</h1>
            <p className="text-slate-300 mb-6 max-w-2xl">A decentralised, federated educational material platform for colleges. Discover notes, past papers, and reference materials shared by your peers.</p>
            <div className="flex gap-4">
              <Link to="/auth/register" className="btn btn-primary">Join the Grid</Link>
              <Link to="/auth/login" className="btn btn-secondary">Sign In</Link>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            className="input pl-10 h-12 text-base"
            placeholder="Search for materials, subjects, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Materials Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Loading materials...</div>
        ) : materials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {materials.map((m) => (
              <Link to={`/materials/${m.id}`} key={m.id} className="card card-hover p-5 flex flex-col h-full block">
                <div className="flex justify-between items-start mb-3">
                  <span className="badge badge-primary uppercase text-[10px] tracking-wider">{m.type?.replace('_', ' ')}</span>
                  <span className="text-xs text-slate-500">{new Date(m.created_at).toLocaleDateString()}</span>
                </div>
                
                <h3 className="text-lg font-bold mb-2 line-clamp-2">{m.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-3 mb-4 flex-1">{m.description || 'No description provided.'}</p>
                
                <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
                      {(m.profiles?.full_name || m.profiles?.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs text-slate-300 truncate max-w-[100px]">
                      {m.profiles?.full_name || m.profiles?.username || 'Unknown'}
                    </span>
                  </div>
                  
                  <div className="flex gap-3 text-slate-400 text-xs">
                    <div className="flex items-center gap-1">
                      <Download className="h-3 w-3" /> {m.download_count || 0}
                    </div>
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> {m.upvotes || 0}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-12 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">No materials found</h3>
            <p className="text-slate-400">Try adjusting your filters or search query.</p>
          </div>
        )}
      </main>
    </div>
  );
};
