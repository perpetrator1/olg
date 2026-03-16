import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { UserPlus } from 'lucide-react';

export const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      return toast.error('Passwords do not match');
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await signUp(
        formData.email,
        formData.password,
        formData.username,
        formData.fullName
      );
      
      if (error) throw error;
      
      toast.success('Registration successful! Check your email if verification is required.');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(error.message || 'Failed to register');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 my-8">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-full bg-accent/20 flex items-center justify-center mb-4">
            <UserPlus className="h-6 w-6 text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-white">Create Account</h2>
          <p className="text-slate-400 mt-2 text-center">Join Open Learn Grid</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Full Name</label>
            <input
              type="text"
              name="fullName"
              className="input"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Jane Doe"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Username</label>
            <input
              type="text"
              name="username"
              className="input"
              value={formData.username}
              onChange={handleChange}
              placeholder="janedoe"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Email Address</label>
            <input
              type="email"
              name="email"
              className="input"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@college.edu"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Password</label>
            <input
              type="password"
              name="password"
              className="input"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-slate-300">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              className="input"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>
          
          <button
            type="submit"
            className="btn btn-primary w-full mt-6"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-accent hover:underline">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};
