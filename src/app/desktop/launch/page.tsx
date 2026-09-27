"use client";
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { Monitor } from 'lucide-react';

export default function LaunchPage() {
  const router = useRouter();

  useEffect(() => {
    // Optionally resize window to be compact on launch
    invoke('resize_window', { width: 600, height: 480 }).catch(console.error);
  }, []);

  const handleOffline = async () => {
    await invoke('resize_window', { width: 1440, height: 900 }).catch(console.error);
    router.push('/desktop/dashboard');
  };

  return (
    <div className="h-screen w-screen bg-[#020205] text-white flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Logo mock */}
        <div className="mb-6 relative w-24 h-24 flex items-center justify-center bg-gradient-to-br from-white/10 to-transparent rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
          <span className="text-5xl font-light text-white tracking-tighter">Z</span>
        </div>
        
        <h1 className="text-2xl tracking-widest font-light mb-2">ZTERMINAL</h1>
        <p className="text-sm text-gray-400 mb-10">Research infrastructure for traders</p>

        <p className="mb-4 text-center text-xs text-gray-400">Cloud sign-in is not yet available in the Windows app. Your local research remains on this device.</p>

        <button 
          onClick={handleOffline}
          className="w-full flex items-center justify-center gap-2 bg-transparent border border-white/10 hover:bg-white/5 text-gray-300 py-3 px-4 rounded-lg transition-colors font-medium text-sm"
        >
          <Monitor className="w-4 h-4" />
          Continue offline
        </button>
      </div>
    </div>
  );
}
