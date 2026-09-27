import React from 'react';
import { WorkspaceEntity } from '@/stores/desktop-sync';
import { FileText, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function WorkspaceCard({ workspace }: { workspace: WorkspaceEntity }) {
  const router = useRouter();

  const handleLaunch = () => {
    // Navigate to terminal with the workspace ID
    router.push(`/terminal?workspaceId=${workspace.id}`);
  };

  return (
    <div 
      onClick={handleLaunch}
      className="group flex flex-col justify-between p-4 bg-[#0a0a0f] border border-white/5 rounded-xl hover:border-white/10 transition-all cursor-pointer h-[180px]"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-white">{workspace.name}</h3>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); }}
          className="text-gray-500 hover:text-white transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>
      
      {/* Visual mockup of workspace layout */}
      <div className="flex-1 w-full bg-[#13131a] rounded-lg mt-2 mb-3 border border-white/5 flex gap-1 p-1">
        <div className="flex-1 bg-white/5 rounded-sm"></div>
        <div className="w-1/3 flex flex-col gap-1">
          <div className="flex-1 bg-white/5 rounded-sm"></div>
          <div className="flex-1 bg-white/5 rounded-sm"></div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{workspace.updatedAt}</span>
      </div>
    </div>
  );
}
