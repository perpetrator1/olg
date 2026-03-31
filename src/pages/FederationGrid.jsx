import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Download, ExternalLink, ServerCrash, RefreshCw, ThumbsUp } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DJANGO_GRID_URL = `${API_BASE}/api/federation/grid/`;

export const FederationGrid = () => {
  const navigate = useNavigate();
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState({ total_peers: 0, successful_peers: 0, failed_peers: 0, errors: [] });
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchFederatedMaterials();
  }, []);

  const fetchFederatedMaterials = async () => {
    setLoading(true);
    setError(null);
    setMaterials([]);
    try {
      const response = await fetch(DJANGO_GRID_URL);
      if (!response.ok) throw new Error(`Backend error: ${response.statusText}`);
      const data = await response.json();
      setMaterials(data.materials || []);
      setMeta({
        total_peers: data.total_peers || 0,
        successful_peers: data.successful_peers || 0,
        failed_peers: data.failed_peers || 0,
        errors: data.errors || [],
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero */}
      <div className="mb-8 card p-8 bg-gradient-to-br from-indigo-900/50 to-slate-900 border-indigo-500/20">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Globe className="h-8 w-8 text-indigo-400" />
            <div>
              <h1 className="text-3xl font-bold text-white">The Circle</h1>
              <p className="text-slate-400 text-sm mt-0.5">
                Federated notes from all connected instances
              </p>
            </div>
          </div>
          {/* Peer stats */}
          {!loading && !error && (
            <div className="flex gap-4 text-sm">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{meta.total_peers}</div>
                <div className="text-slate-500 text-xs">Nodes</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-green-400">{meta.successful_peers}</div>
                <div className="text-slate-500 text-xs">Online</div>
              </div>
              {meta.failed_peers > 0 && (
                <div className="text-center">
                  <div className="text-xl font-bold text-amber-400">{meta.failed_peers}</div>
                  <div className="text-slate-500 text-xs">Offline</div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={fetchFederatedMaterials}
            className="btn btn-secondary btn-sm flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
        <p className="text-slate-300 max-w-2xl mt-4 text-sm">
          A decentralised educational network. Materials are live-aggregated from every instance
          in your circle — including nodes connected to your peers (up to 3 hops).
        </p>
      </div>

      {/* Failed peer warning */}
      {meta.failed_peers > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <ServerCrash className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-500">Some nodes failed to respond</h4>
            <ul className="text-sm text-slate-400 mt-1 space-y-0.5">
              {meta.errors.map((e, i) => (
                <li key={i}>
                  <span className="font-medium text-slate-300">{e.instance_name}:</span> {e.error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Backend unreachable */}
      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <ServerCrash className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-red-400">Federation backend unreachable</h4>
            <p className="text-sm text-slate-400 mt-1">{error}</p>
            <p className="text-xs text-slate-500 mt-1">
              Make sure the Django backend is running at <code className="text-slate-300">localhost:8000</code>.
            </p>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center py-20">
          <Globe className="h-12 w-12 text-slate-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Traversing the Circle...</p>
        </div>
      ) : materials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {materials.map((m) => {
            const isLocal = m.is_local === true;
            return (
              <div
                key={`${m.instance_id}-${m.id}`}
                className={`card p-5 flex flex-col h-full card-hover cursor-pointer ${
                  isLocal ? 'border-t-2 border-t-amber-500' : 'border-t-2 border-t-indigo-500/70 opacity-95'
                }`}
                onClick={() => navigate(`/materials/${m.id}`, { state: { material: m, isRemote: !isLocal } })}
              >
                <div className="flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <span className="badge badge-primary uppercase text-[10px] tracking-wider shrink-0">
                      {m.type?.replace('_', ' ')}
                    </span>
                    <span
                      className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isLocal
                          ? 'text-amber-300 bg-amber-500/10'
                          : 'text-indigo-300 bg-indigo-500/10'
                      }`}
                    >
                      <Globe className="h-3 w-3" />
                      {m.instance_name}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{m.title}</h3>
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
                      <div className="flex gap-3 text-slate-400 text-xs">
                        <div className="flex items-center gap-1">
                          <Download className="h-3 w-3" /> {m.download_count || 0}
                        </div>
                        <div className="flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" /> {m.upvotes || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : !error ? (
        <div className="card p-12 text-center flex flex-col items-center">
          <Globe className="h-16 w-16 text-slate-600 mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-white mb-2">The Circle is empty</h3>
          <p className="text-slate-400 max-w-md mx-auto">
            No approved materials found in the Circle. Add peer instances in the Admin panel to get
            started.
          </p>
        </div>
      ) : null}
    </div>
  );
};
