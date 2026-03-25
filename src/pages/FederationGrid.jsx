import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Globe, Download, ExternalLink, ServerCrash } from 'lucide-react';

export const FederationGrid = () => {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCount, setErrorCount] = useState(0);

  useEffect(() => {
    fetchFederatedMaterials();
  }, []);

  const fetchFederatedMaterials = async () => {
    setLoading(true);
    setMaterials([]);
    setErrorCount(0);
    
    try {
      // 1. Fetch from Django Backend Aggregator
      const response = await fetch('http://localhost:8000/api/federation/grid/');
      if (!response.ok) {
        throw new Error(`Backend API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // The Django API returns { total_peers, successful_peers, failed_peers, errors, materials }
      setMaterials(data.materials || []);
      setErrorCount(data.failed_peers || 0);
      
      if (data.failed_peers > 0) {
        console.warn('Some peer nodes failed:', data.errors);
      }
      
    } catch (error) {
      console.error('Federation API Error:', error.message);
      setErrorCount(1); // Ensure error UI shows up
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 card p-8 bg-gradient-to-br from-indigo-900/50 to-slate-900 border-indigo-500/20">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="h-8 w-8 text-indigo-400" />
          <h1 className="text-3xl font-bold text-white">The Global Learn Grid</h1>
        </div>
        <p className="text-slate-300 max-w-2xl">
          A truly decentralized educational network. The materials below are dynamically aggregated in real-time from active peer college databases. 
        </p>
      </div>

      {errorCount > 0 && (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <ServerCrash className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-500 relative top-0.5">Some nodes failed to respond</h4>
            <p className="text-sm text-slate-400 mt-1">{errorCount} peer node(s) could not be reached. Their materials are not currently shown.</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-20">
          <Globe className="h-12 w-12 text-slate-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Querying peer databases...</p>
        </div>
      ) : materials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {materials.map((m) => (
            <div key={`${m.instance_id}-${m.id}`} className="card flex flex-col h-full border-t-4 border-t-indigo-500">
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex justify-between items-start mb-3">
                  <span className="badge badge-primary uppercase text-[10px] tracking-wider">{m.type}</span>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                    <Globe className="h-3 w-3" />
                    {m.instance_name}
                  </div>
                </div>
                
                <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">{m.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-3 mb-4 flex-1">{m.description || 'No description provided.'}</p>
                
                <div className="pt-4 border-t border-slate-700/50 flex justify-between items-center mt-auto">
                  <span className="text-xs text-slate-400">
                    By {m.profiles?.full_name || m.profiles?.username || 'Unknown'}
                  </span>
                  <a 
                    href={m.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm flex items-center gap-2 text-xs h-8 px-3"
                  >
                    <Download className="h-3 w-3" /> Get File
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center flex flex-col items-center">
          <Globe className="h-16 w-16 text-slate-600 mb-4 opacity-50" />
          <h3 className="text-xl font-bold text-white mb-2">The Grid is empty</h3>
          <p className="text-slate-400 max-w-md mx-auto mb-6">There are no materials available from federated peers. Either no peer nodes are configured, or they have no approved materials to share.</p>
        </div>
      )}
    </div>
  );
};
