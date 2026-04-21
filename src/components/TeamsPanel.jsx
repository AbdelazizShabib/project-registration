import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Filter, Trash2, Plus, ArrowUpDown } from 'lucide-react';
import ManualRegister from './ManualRegister';

export default function TeamsPanel() {
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'team_number', direction: 'asc' });
  
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch projects for filter
      const { data: pData } = await supabase.from('projects').select('id, name').order('display_order');
      setProjects(pData || []);

      // Fetch teams with project info
      const { data: tData, error: tError } = await supabase
        .from('teams')
        .select(`
          id,
          team_number,
          created_at,
          project_id,
          projects(name)
        `);
      
      if (tError) throw tError;

      // Fetch members
      const { data: mData, error: mError } = await supabase
        .from('team_members')
        .select('*');

      if (mError) throw mError;

      // Combine
      const combined = tData.map(team => {
        const members = mData.filter(m => m.team_id === team.id);
        return {
          ...team,
          project_name: team.projects?.name || 'Unknown',
          members,
          member_names: members.map(m => m.member_name).join(', '),
          member_regs: members.map(m => m.registration_number).join(', ')
        };
      });

      setTeams(combined);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (teamId, teamNumber) => {
    if (window.confirm(`Are you sure you want to delete Team ${teamNumber}? This will free their slot and allow these students to register again.`)) {
      try {
        const { error } = await supabase.from('teams').delete().eq('id', teamId);
        if (error) throw error;
        fetchData();
      } catch (err) {
        console.error('Error deleting team:', err);
        alert('Failed to delete team.');
      }
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredTeams = teams.filter(team => {
    const matchesProject = projectFilter ? team.project_id === projectFilter : true;
    const matchesSearch = searchTerm 
      ? team.member_names.toLowerCase().includes(searchTerm.toLowerCase()) || 
        team.member_regs.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.team_number.toString().includes(searchTerm)
      : true;
    return matchesProject && matchesSearch;
  });

  const sortedTeams = [...filteredTeams].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg leading-6 font-medium text-slate-900">Registered Teams</h3>
        <button
          onClick={() => setIsManualModalOpen(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Manual Registration
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border border-slate-200 flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
            placeholder="Search by name, reg number, or team number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-64 relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Filter className="h-5 w-5 text-slate-400" />
          </div>
          <select
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('team_number')}
                >
                  <div className="flex items-center">
                    Team # <ArrowUpDown className="ml-1 w-3 h-3" />
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('project_name')}
                >
                  <div className="flex items-center">
                    Project <ArrowUpDown className="ml-1 w-3 h-3" />
                  </div>
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Members
                </th>
                <th 
                  scope="col" 
                  className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center">
                    Date <ArrowUpDown className="ml-1 w-3 h-3" />
                  </div>
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : sortedTeams.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    No teams found matching your criteria.
                  </td>
                </tr>
              ) : (
                sortedTeams.map((team) => (
                  <tr key={team.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        Team {team.team_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                      {team.project_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      <ul className="list-disc pl-5">
                        {team.members.map((m, i) => (
                          <li key={i}>{m.member_name} <span className="text-slate-400">({m.registration_number})</span></li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {new Date(team.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(team.id, team.team_number)}
                        className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-md hover:bg-red-100 transition-colors"
                        title="Delete Team"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ManualRegister 
        isOpen={isManualModalOpen} 
        onClose={() => setIsManualModalOpen(false)} 
        onSuccess={() => fetchData()} 
      />
    </div>
  );
}
