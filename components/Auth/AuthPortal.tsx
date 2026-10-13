
import React, { useState } from 'react';
import { Store, Compass, ChevronRight, Mail, User, Phone, Landmark, UserPlus, LogIn, ArrowLeft, Lock, ShieldCheck, AlertCircle } from 'lucide-react';
import { UserRole, UserProfile } from '../../types';
import { storage } from '../../services/storage';

import { LocationPicker } from '../UI/LocationPicker';

interface AuthPortalProps {
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthSuccess }) => {
  const [step, setStep] = useState<'choice' | 'form' | 'location'>('choice');
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    category: 'Paintings'
  });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectMode = (selectedRole: UserRole, signUpMode: boolean) => {
    setRole(selectedRole);
    setIsSignUp(signUpMode);
    setStep('form');
    setError('');
  };

  const validatePhone = (num: string) => {
    return /^\d{10}$/.test(num);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        if (!validatePhone(formData.phone)) {
          throw new Error("Mewar-Sync requires a valid 10-digit phone number.");
        }
        if (password !== confirmPassword) {
          throw new Error("Mewar-Sync security check: Passwords do not match.");
        }
        if (password.length < 6) {
          throw new Error("Mewar-Sync security policy: Password must be at least 6 characters.");
        }
        if (isSignUp && role === 'SHOPKEEPER' && !location) {
          setStep('location');
          setLoading(false);
          return;
        }

        const signUpData: any = {
          ...formData,
          email,
          password,
          role: role as UserRole,
        };

        if (location) {
          signUpData.location = location;
        }

        const user = await storage.signUp(signUpData);
        onAuthSuccess(user);
      } else {
        const user = await storage.signIn(email, password);
        onAuthSuccess(user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center p-6 font-outfit">
        <div className="text-center mb-12 animate-in fade-in slide-in-from-top duration-700">
           <Landmark className="mx-auto text-saffron mb-4 w-16 h-16" />
           <h1 className="text-6xl font-heritage font-bold tracking-tighter text-gray-900 mb-2 uppercase">MEWAR<span className="text-gold">-SYNC</span></h1>
           <p className="text-gray-400 uppercase tracking-[0.4em] text-[10px] font-bold">The Royal Gateway</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full animate-in zoom-in duration-500">
          <div className="glass-mewar p-10 rounded-[40px] border-2 border-gold/10 flex flex-col items-center text-center group hover:border-gold/30 transition-all bg-white/40 shadow-xl">
            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center text-gold mb-6 group-hover:scale-110 transition-transform">
              <Compass size={32} />
            </div>
            <h2 className="text-2xl font-heritage font-bold mb-2 uppercase tracking-wide">Guest Gateway</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed italic">Explore the legacy of Mewar</p>
            <div className="w-full space-y-3 font-heritage">
              <button 
                onClick={() => selectMode('VISITOR', true)}
                className="w-full py-4 bg-royal-gradient text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:translate-y-[-2px] transition-all"
              >
                <UserPlus size={16} /> Join as Guest
              </button>
              <button 
                onClick={() => selectMode('VISITOR', false)}
                className="w-full py-4 bg-white border border-gold/20 rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-gold/5 transition-all"
              >
                <LogIn size={16} /> Return to Mewar
              </button>
            </div>
          </div>

          <div className="glass-mewar p-10 rounded-[40px] border-2 border-saffron/10 flex flex-col items-center text-center group hover:border-saffron/30 transition-all bg-white/40 shadow-xl">
            <div className="w-16 h-16 bg-saffron/10 rounded-full flex items-center justify-center text-saffron mb-6 group-hover:scale-110 transition-transform">
              <Store size={32} />
            </div>
            <h2 className="text-2xl font-heritage font-bold mb-2 uppercase tracking-wide">Artisan Registry</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed italic">Manage your heritage business</p>
            <div className="w-full space-y-3 font-heritage">
              <button 
                onClick={() => selectMode('SHOPKEEPER', true)}
                className="w-full py-4 bg-gray-900 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:translate-y-[-2px] transition-all"
              >
                <UserPlus size={16} /> Register Craft
              </button>
              <button 
                onClick={() => selectMode('SHOPKEEPER', false)}
                className="w-full py-4 bg-white border border-saffron/20 rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-saffron/5 transition-all"
              >
                <LogIn size={16} /> Access Ledger
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'location') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-6 font-outfit">
        <div className="max-w-md w-full glass-mewar p-10 rounded-[40px] shadow-2xl border-2 border-gold/10 bg-white animate-in slide-in-from-bottom duration-500">
          <button 
            onClick={() => setStep('form')}
            className="flex items-center gap-2 text-xs font-heritage font-bold text-gold uppercase tracking-widest mb-8 hover:text-saffron transition-colors"
          >
            <ArrowLeft size={14} /> Back to Details
          </button>

          <div className="text-center mb-8 font-heritage">
            <h2 className="text-2xl font-bold">Set Workshop Location</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Mandatory for Artisan Registry</p>
          </div>

          <LocationPicker 
            onLocationSelect={(lat, lng) => setLocation({ lat, lng })}
          />

          <button 
            onClick={handleSubmit}
            disabled={loading || !location}
            className="w-full mt-8 py-5 bg-gray-900 text-white rounded-2xl font-heritage font-bold flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
          >
            {loading ? "REGISTERING..." : "FINISH REGISTRATION"}
            {!loading && <ChevronRight size={18} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] p-6 font-outfit">
      <div className="max-w-md w-full glass-mewar p-10 rounded-[40px] shadow-2xl border-2 border-gold/10 relative overflow-hidden animate-in slide-in-from-bottom duration-500 bg-white">
        <button 
          onClick={() => setStep('choice')}
          className="flex items-center gap-2 text-xs font-heritage font-bold text-gold uppercase tracking-widest mb-8 hover:text-saffron transition-colors"
        >
          <ArrowLeft size={14} /> Back to Gateway
        </button>
        
        <div className="text-center mb-8 font-heritage">
          <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${role === 'SHOPKEEPER' ? 'bg-saffron/10 text-saffron' : 'bg-gold/10 text-gold'}`}>
             {role === 'SHOPKEEPER' ? <Store size={20} /> : <Compass size={20} />}
          </div>
          <h2 className="text-2xl font-bold">{isSignUp ? 'New Profile' : 'Welcome Back'}</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{role} Portal</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex flex-col gap-2 text-red-600 text-xs font-bold animate-in shake">
            <div className="flex items-center gap-3">
              <AlertCircle size={16} /> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 font-outfit">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
            <input 
              required
              type="email"
              placeholder="Email Address"
              className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-saffron shadow-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
            <input 
              required
              type="password"
              placeholder="Password"
              className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-saffron shadow-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {isSignUp && (
            <>
              <div className="relative">
                <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                <input 
                  required
                  type="password"
                  placeholder="Confirm Password"
                  className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-saffron shadow-sm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                <input 
                  required
                  type="text"
                  placeholder="Full Name"
                  className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-saffron shadow-sm"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gold w-4 h-4" />
                <input 
                  required 
                  type="tel" 
                  placeholder="Phone (10 digits)" 
                  className="w-full bg-gray-50 border border-gold/10 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-saffron shadow-sm" 
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                />
              </div>
            </>
          )}

          <button 
            type="submit"
            disabled={loading}
            className={`w-full py-5 rounded-2xl font-heritage font-bold flex items-center justify-center gap-3 shadow-xl transition-all active:scale-95 disabled:opacity-50 text-white uppercase tracking-widest text-xs ${role === 'SHOPKEEPER' ? 'bg-gray-900' : 'bg-royal-gradient shadow-saffron/20'}`}
          >
            {loading ? "AUTHENTICATING..." : isSignUp ? "REGISTER PROFILE" : "ENTER MEWAR"}
            {!loading && <ChevronRight size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};
