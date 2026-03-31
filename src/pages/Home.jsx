import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Search, Filter, Download, ThumbsUp, FileText, Globe } from 'lucide-react';

const DJANGO_GRID_URL = 'http://localhost:8000/api/federation/grid/';

const MATERIAL_TYPES = [
  { label: 'Notes', value: 'notes' },
  { label: 'Question Paper', value: 'question_paper' },
  { label: 'Assignment', value: 'assignment' },
  { label: 'Reference', value: 'reference' },
];

export const Home = () => {
  const { session } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [usingFederation, setUsingFederation] = useState(false);

  const toggleType = (value) => {
    setSelectedTypes(prev =>
      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
    );
  };

  useEffect(() => {
    fetchMaterials();
  }, [searchQuery, selectedTypes]);

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      // 1. Try Django federation API (circle-aware, includes local + all peers)
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedTypes.length > 0) params.append('types', selectedTypes.join(','));

      const response = await fetch(
        `${DJANGO_GRID_URL}${params.toString() ? '?' + params.toString() : ''}`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (response.ok) {
        const data = await response.json();
        setMaterials(data.materials || []);
        setUsingFederation(true);
        setLoading(false); // ← fix: must set here before returning
        return;
      }
    } catch {
      // Django not available — fall through to local Supabase query
    }

    // 2. Fallback: local Supabase only
    setUsingFederation(false);
    try {
      let query = supabase
        .from('materials')
        .select(`
          id, title, description, type, file_type,
          download_count, upvotes, created_at, file_url,
          profiles:profiles!uploaded_by(full_name, username)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (searchQuery) query = query.ilike('title', `%${searchQuery}%`);
      if (selectedTypes.length > 0) query = query.in('type', selectedTypes);

      const { data, error } = await query;
      if (error) throw error;
      setMaterials(data || []);
    } catch (error) {
      console.error('Error fetching materials:', error);
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
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Type
            </label>
            <div className="space-y-2">
              {MATERIAL_TYPES.map(type => (
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

        {/* Circle / federation status pill */}
        <div
          className={`card p-3 flex items-center gap-2 text-xs ${
            usingFederation
              ? 'border-indigo-500/30 bg-indigo-500/5 text-indigo-300'
              : 'border-slate-700/30 text-slate-500'
          }`}
        >
          <Globe className={`h-4 w-4 shrink-0 ${usingFederation ? 'text-indigo-400' : 'text-slate-600'}`} />
          {usingFederation ? 'Showing Circle — all connected nodes' : 'Showing local notes only'}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1">
        {!session && (
          <div className="card p-8 mb-8 bg-gradient-to-r from-slate-800 to-slate-900 border-accent/20">
            <h1 className="text-3xl font-bold mb-2">Open Learning Grid</h1>
            <p className="text-slate-300 mb-6 max-w-2xl">
              A decentralised, federated educational material platform for colleges.
            </p>
            <div className="flex gap-4">
              <Link to="/auth/register" className="btn btn-primary">Join the Grid</Link>
              <Link to="/auth/login" className="btn btn-secondary">Sign In</Link>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="text"
            className="input pl-10 h-12 text-base"
            placeholder={usingFederation
              ? 'Search across all circle nodes...'
              : 'Search for materials, subjects, or keywords...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">
            {usingFederation ? 'Traversing the Circle...' : 'Loading materials...'}
          </div>
        ) : materials.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {materials.map((m) => {
              // is_local=true  → came from Django, this node's own material
              // is_local=false → came from Django, remote peer material
              // is_local=undefined → came from Supabase fallback (always local)
              const isRemote = m.is_local === false;

              return (
                <div
                  key={`${m.instance_id || 'local'}-${m.id}`}
                  className={`card p-5 flex flex-col h-full ${
                    isRemote
                      ? 'border-t-2 border-t-indigo-500/70 opacity-95'
                      : 'card-hover cursor-pointer'
                  }`}
                  onClick={!isRemote ? () => window.location.href = `/materials/${m.id}` : undefined}
                >
                  {/* Header row: type badge + instance badge */}
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <span className="badge badge-primary uppercase text-[10px] tracking-wider shrink-0">
                      {m.type?.replace('_', ' ')}
                    </span>

                    {isRemote ? (
                      // Remote: show indigo instance badge
                      <span className="flex items-center gap-1 text-[10px] font-medium text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                        <Globe className="h-2.5 w-2.5" />
                        {m.instance_name}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-500">
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <h3 className="text-lg font-bold mb-2 line-clamp-2">{m.title}</h3>
                  <p className="text-sm text-slate-400 line-clamp-3 mb-4 flex-1">
                    {m.description || 'No description provided.'}
                  </p>

                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-medium text-white">
                        {(m.profiles?.full_name || m.profiles?.username || '?').charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-300 truncate max-w-[100px]">
                        {m.profiles?.full_name || m.profiles?.username || 'Unknown'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Remote notes: show download button; local: show stats */}
                      {isRemote ? (
                        <a
                          href={m.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs h-7 px-3"
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                      ) : (
                        <div className="flex gap-3 text-slate-400 text-xs">
                          <div className="flex items-center gap-1">
                            <Download className="h-3 w-3" /> {m.download_count || 0}
                          </div>
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" /> {m.upvotes || 0}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Read-only label for remote notes */}
                  {isRemote && (
                    <p className="text-[10px] text-slate-600 mt-2 text-right">
                      Read-only · from {m.instance_name}
                    </p>
                  )}
                </div>
              );
            })}
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
