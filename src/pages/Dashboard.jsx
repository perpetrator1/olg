import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { TeacherDashboard } from './dashboards/TeacherDashboard';
import { VerifierDashboard } from './dashboards/VerifierDashboard';
import { StudentDashboard } from './dashboards/StudentDashboard';

export const Dashboard = () => {
  const { role, user, loading } = useAuth();
  
  console.log('Dashboard: Rendering with state:', { role, user: !!user, loading });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="animate-spin h-8 w-8 border-4 border-amber-500 border-t-transparent rounded-full"></div>
        <div className="text-slate-400">Loading Dashboard...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {user?.full_name || user?.username}
        </h1>
        <p className="text-slate-400 mt-2">
          Your current role is <span className="badge badge-primary uppercase">{role}</span>
        </p>
      </div>

      {role?.toLowerCase() === 'admin' && <AdminDashboard />}
      {role?.toLowerCase() === 'teacher' && <TeacherDashboard />}
      {role?.toLowerCase() === 'verifier' && <VerifierDashboard />}
      {role?.toLowerCase() === 'student' && <StudentDashboard />}

      {!['admin', 'teacher', 'verifier', 'student'].includes(role?.toLowerCase()) && (
        <div className="card p-8 text-center">
          <p className="text-slate-400">We couldn't determine your specific dashboard view. Please contact an administrator.</p>
          <p className="text-xs text-slate-500 mt-4">Detected role: {role || 'none'}</p>
        </div>
      )}
    </div>
  );
};
