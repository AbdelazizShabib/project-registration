import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings, FolderKanban, Users, Download, LogOut } from 'lucide-react';
import ConfigPanel from './ConfigPanel';
import ProjectsPanel from './ProjectsPanel';
import TeamsPanel from './TeamsPanel';
import ExportResetPanel from './ExportResetPanel';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('config');

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const tabs = [
    { id: 'config', name: 'Course Config', icon: Settings },
    { id: 'projects', name: 'Manage Projects', icon: FolderKanban },
    { id: 'teams', name: 'Registered Teams', icon: Users },
    { id: 'export', name: 'Export & Reset', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="px-3 space-y-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="flex-shrink-0 -ml-1 mr-3 h-5 w-5" />
                  <span className="truncate">{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
        
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-3 py-2 text-sm font-medium text-slate-300 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5" />
            Logout
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto bg-slate-50">
        <div className="p-8">
          <div className="max-w-6xl mx-auto">
            {activeTab === 'config' && <ConfigPanel />}
            {activeTab === 'projects' && <ProjectsPanel />}
            {activeTab === 'teams' && <TeamsPanel />}
            {activeTab === 'export' && <ExportResetPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}
