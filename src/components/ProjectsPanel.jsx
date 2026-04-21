import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Check, X, ArrowUp, ArrowDown } from 'lucide-react';

export default function ProjectsPanel() {
  const [projects, setProjects] = useState([]);
  const [teamCounts, setTeamCounts] = useState({});
  const [loading, setLoading] = useState(true);
  
  // Add project state
  const [newProject, setNewProject] = useState({ name: '', description: '', max_teams: 1 });
  const [adding, setAdding] = useState(false);
  
  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchProjectsAndCounts();
  }, []);

  const fetchProjectsAndCounts = async () => {
    try {
      const { data: pData, error: pError } = await supabase
        .from('projects')
        .select('*')
        .order('display_order');
      
      if (pError) throw pError;

      const { data: tData, error: tError } = await supabase
        .from('teams')
        .select('project_id');
        
      if (tError) throw tError;

      const counts = {};
      tData.forEach(t => {
        counts[t.project_id] = (counts[t.project_id] || 0) + 1;
      });

      setProjects(pData);
      setTeamCounts(counts);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (e) => {
    e.preventDefault();
    setAdding(true);
    setError(null);
    
    try {
      const displayOrder = projects.length > 0 ? Math.max(...projects.map(p => p.display_order || 0)) + 1 : 1;
      
      const { error } = await supabase
        .from('projects')
        .insert([{
          name: newProject.name,
          description: newProject.description,
          max_teams: newProject.max_teams,
          display_order: displayOrder
        }]);

      if (error) throw error;
      
      setNewProject({ name: '', description: '', max_teams: 1 });
      fetchProjectsAndCounts();
    } catch (err) {
      console.error('Error adding project:', err);
      setError(err.message || 'Failed to add project.');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (project) => {
    setEditingId(project.id);
    setEditForm({ ...project });
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setError(null);
  };

  const saveEdit = async () => {
    setError(null);
    const original = projects.find(p => p.id === editingId);
    const registeredCount = teamCounts[editingId] || 0;

    if (editForm.max_teams < original.max_teams) {
      setError(`Cannot decrease max teams below current value (${original.max_teams}).`);
      return;
    }

    if (editForm.max_teams < registeredCount) {
      setError(`Cannot decrease max teams below registered teams count (${registeredCount}).`);
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: editForm.name,
          description: editForm.description,
          max_teams: editForm.max_teams
        })
        .eq('id', editingId);

      if (error) throw error;
      
      setEditingId(null);
      fetchProjectsAndCounts();
    } catch (err) {
      console.error('Error updating project:', err);
      setError(err.message || 'Failed to update project.');
    }
  };

  const moveProject = async (index, direction) => {
    if (
      (direction === -1 && index === 0) || 
      (direction === 1 && index === projects.length - 1)
    ) return;

    const newProjects = [...projects];
    const p1 = newProjects[index];
    const p2 = newProjects[index + direction];

    // Swap display_orders
    const tempOrder = p1.display_order;
    p1.display_order = p2.display_order;
    p2.display_order = tempOrder;

    // Optimistic UI update
    setProjects(newProjects.sort((a, b) => a.display_order - b.display_order));

    try {
      // Update DB
      await supabase.from('projects').update({ display_order: p1.display_order }).eq('id', p1.id);
      await supabase.from('projects').update({ display_order: p2.display_order }).eq('id', p2.id);
    } catch (err) {
      console.error('Error reordering:', err);
      fetchProjectsAndCounts(); // Revert on error
    }
  };

  if (loading) {
    return <div className="p-8 text-center"><div className="animate-spin inline-block w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Add Project Form */}
      <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4">Add New Project</h3>
        <form onSubmit={handleAddProject} className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">Project Name</label>
            <input
              type="text"
              id="name"
              required
              value={newProject.name}
              onChange={(e) => setNewProject({...newProject, name: e.target.value})}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
            />
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">Description</label>
            <input
              type="text"
              id="description"
              value={newProject.description}
              onChange={(e) => setNewProject({...newProject, description: e.target.value})}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
            />
          </div>

          <div className="sm:col-span-1">
            <label htmlFor="max_teams" className="block text-sm font-medium text-slate-700">Max Teams</label>
            <input
              type="number"
              id="max_teams"
              min="1"
              required
              value={newProject.max_teams}
              onChange={(e) => setNewProject({...newProject, max_teams: parseInt(e.target.value)})}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
            />
          </div>

          <div className="sm:col-span-6">
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            >
              <Plus className="w-4 h-4 mr-2" />
              {adding ? 'Adding...' : 'Add Project'}
            </button>
          </div>
        </form>
      </div>

      {/* Projects List */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 border-b border-slate-200 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-slate-900">Existing Projects</h3>
        </div>
        <ul className="divide-y divide-slate-200">
          {projects.length === 0 ? (
            <li className="px-4 py-8 text-center text-slate-500">No projects added yet.</li>
          ) : (
            projects.map((project, index) => (
              <li key={project.id} className="p-4 sm:px-6 hover:bg-slate-50 transition-colors">
                {editingId === project.id ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-500 uppercase">Name</label>
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-xs font-medium text-slate-500 uppercase">Description</label>
                        <input
                          type="text"
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-medium text-slate-500 uppercase">Max Teams</label>
                        <input
                          type="number"
                          min={Math.max(project.max_teams, teamCounts[project.id] || 0)}
                          value={editForm.max_teams}
                          onChange={(e) => setEditForm({...editForm, max_teams: parseInt(e.target.value)})}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-1">Min: {Math.max(project.max_teams, teamCounts[project.id] || 0)}</p>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                      <button onClick={cancelEdit} className="inline-flex items-center px-3 py-1.5 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50">
                        <X className="w-4 h-4 mr-1" /> Cancel
                      </button>
                      <button onClick={saveEdit} className="inline-flex items-center px-3 py-1.5 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                        <Check className="w-4 h-4 mr-1" /> Save
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-lg font-bold text-slate-900 truncate">{project.name}</h4>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {teamCounts[project.id] || 0} / {project.max_teams} Teams
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2">{project.description || 'No description provided.'}</p>
                    </div>
                    
                    <div className="flex flex-col items-center space-y-2 ml-4 border-l border-slate-200 pl-4">
                      <div className="flex space-x-1">
                        <button 
                          onClick={() => moveProject(index, -1)}
                          disabled={index === 0}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400"
                          title="Move Up"
                        >
                          <ArrowUp className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => moveProject(index, 1)}
                          disabled={index === projects.length - 1}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 disabled:hover:text-slate-400"
                          title="Move Down"
                        >
                          <ArrowDown className="w-5 h-5" />
                        </button>
                      </div>
                      <button 
                        onClick={() => startEdit(project)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-slate-300 shadow-sm text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 w-full justify-center"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Edit
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
