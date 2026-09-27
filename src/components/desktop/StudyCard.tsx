import React from 'react';
import { StudyEntity } from '@/stores/desktop-sync';
import { Cloud, Monitor, CloudUpload, MoreHorizontal } from 'lucide-react';
import { useDesktopSyncStore } from '@/stores/desktop-sync';

export function StudyCard({ study }: { study: StudyEntity }) {
  const triggerSync = useDesktopSyncStore(state => state.triggerSync);

  const getSyncBadge = (status: StudyEntity['syncStatus']) => {
    switch (status) {
      case 'Local':
        return (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-md">
            <Monitor className="w-3.5 h-3.5" />
            <span>Local</span>
            <button 
              onClick={(e) => { e.stopPropagation(); triggerSync(study.id); }}
              className="ml-1 text-blue-400 hover:text-blue-300 transition-colors"
              title="Sync to Cloud"
            >
              <CloudUpload className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      case 'Cloud':
        return (
          <div className="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-900/30 px-2 py-1 rounded-md">
            <Cloud className="w-3.5 h-3.5" />
            <span>Cloud</span>
          </div>
        );
      case 'Synced':
      default:
        return (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-md">
            <Monitor className="w-3.5 h-3.5" />
            <span>Local + Cloud</span>
          </div>
        );
    }
  };

  return (
    <div className="group relative flex flex-col justify-between p-4 bg-[#0a0a0f] border border-white/5 rounded-xl hover:border-white/10 transition-all cursor-pointer">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h3 className="text-sm font-medium text-white mb-1">{study.name}</h3>
          <p className="text-xs text-gray-500">{study.description}</p>
        </div>
        <button className="text-gray-500 hover:text-white transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      
      {/* Chart mockup area */}
      <div className="h-20 w-full bg-gradient-to-t from-blue-900/10 to-transparent rounded-lg mb-4"></div>

      <div className="flex items-center justify-between">
        {getSyncBadge(study.syncStatus)}
        <span className="text-xs text-gray-500">{study.updatedAt}</span>
      </div>
    </div>
  );
}
