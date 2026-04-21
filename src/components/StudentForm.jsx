import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import SuccessScreen from './SuccessScreen';

export default function StudentForm({ config }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for form
  const [members, setMembers] = useState(
    Array.from({ length: config.members_per_team }).map(() => ({ name: '', registration_number: '' }))
  );
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  // State for submission
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateField, setDuplicateField] = useState(null);
  const [successData, setSuccessData] = useState(null);

  useEffect(() => {
    async function fetchProjects() {
      try {
        // Fetch projects
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .order('display_order');

        if (projectsError) throw projectsError;

        // Fetch team counts
        // Since we might not have the teams(count) syntax reliably, let's fetch all teams and group
        const { data: teamsData, error: teamsError } = await supabase
          .from('teams')
          .select('project_id');

        if (teamsError) throw teamsError;

        const teamCounts = {};
        teamsData.forEach(t => {
          teamCounts[t.project_id] = (teamCounts[t.project_id] || 0) + 1;
        });

        const projectsWithAvailability = projectsData.map(p => ({
          ...p,
          registered_teams: teamCounts[p.id] || 0,
          is_full: (teamCounts[p.id] || 0) >= p.max_teams
        }));

        setProjects(projectsWithAvailability);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError('Could not load projects. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    }

    fetchProjects();
  }, []);

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
    
    // Clear duplicate field error if they start typing
    if (duplicateField === newMembers[index].registration_number) {
      setDuplicateField(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setDuplicateField(null);
    
    // Client-side validation
    let validMembers = [];
    let localDuplicateCheck = new Set();
    
    for (let i = 0; i < config.members_per_team; i++) {
      const isRequired = !config.allow_incomplete_teams || i < config.min_members_per_team;
      const mem = members[i];
      const nameTrimmed = mem.name.trim();
      const regTrimmed = mem.registration_number.trim();
      
      if (isRequired) {
        if (!nameTrimmed || !regTrimmed) {
          setError(`Please fill in all required fields for Member ${i + 1}.`);
          return;
        }
      }
      
      if (nameTrimmed || regTrimmed) {
        if (!nameTrimmed || !regTrimmed) {
           setError(`Please fill in both Name and Registration Number for Member ${i + 1}, or leave both empty if optional.`);
           return;
        }
        
        if (localDuplicateCheck.has(regTrimmed)) {
          setError(`Duplicate registration number: ${regTrimmed}`);
          setDuplicateField(regTrimmed);
          return;
        }
        localDuplicateCheck.add(regTrimmed);
        
        validMembers.push({ name: nameTrimmed, registration_number: regTrimmed });
      }
    }
    
    if (!selectedProjectId) {
      setError('Please select a project.');
      return;
    }
    
    const project = projects.find(p => p.id === selectedProjectId);
    if (project && project.is_full) {
      setError('The selected project is full. Please select another one.');
      return;
    }

    setSubmitting(true);
    
    try {
      const { data, error: rpcError } = await supabase.rpc('register_team', {
        p_project_id: selectedProjectId,
        p_members: validMembers
      });
      
      if (rpcError) throw rpcError;
      
      if (!data.success) {
        setError(data.error || 'Registration failed.');
        if (data.duplicate_field) {
          setDuplicateField(data.duplicate_field);
        }
      } else {
        setSuccessData({
          teamNumber: data.team_number,
          projectName: project.name
        });
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.message || 'An unexpected error occurred during registration.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (successData) {
    return <SuccessScreen teamNumber={successData.teamNumber} projectName={successData.projectName} />;
  }

  return (
    <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          <h3 className="text-lg leading-6 font-medium text-slate-900 border-b pb-2">
            Team Members
          </h3>
          
          {members.map((member, index) => {
            const isRequired = !config.allow_incomplete_teams || index < config.min_members_per_team;
            
            return (
              <div key={index} className="bg-slate-50 p-4 rounded-md border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-semibold text-slate-700">
                    Member {index + 1}
                  </h4>
                  {!isRequired && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      Optional
                    </span>
                  )}
                </div>
                
                <div className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
                  <div>
                    <label htmlFor={`name-${index}`} className="block text-sm font-medium text-slate-700">
                      Full Name {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id={`name-${index}`}
                        value={member.name}
                        onChange={(e) => handleMemberChange(index, 'name', e.target.value)}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border"
                        required={isRequired}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor={`reg-${index}`} className="block text-sm font-medium text-slate-700">
                      Registration Number {isRequired && <span className="text-red-500">*</span>}
                    </label>
                    <div className="mt-1">
                      <input
                        type="text"
                        id={`reg-${index}`}
                        value={member.registration_number}
                        onChange={(e) => handleMemberChange(index, 'registration_number', e.target.value)}
                        className={`shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm rounded-md py-2 px-3 border ${
                          duplicateField === member.registration_number && member.registration_number !== '' 
                            ? 'border-red-300 ring-red-500 focus:border-red-500 bg-red-50' 
                            : 'border-slate-300'
                        }`}
                        required={isRequired}
                      />
                    </div>
                    {duplicateField === member.registration_number && member.registration_number !== '' && (
                      <p className="mt-1 text-sm text-red-600">This registration number is already registered.</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h3 className="text-lg leading-6 font-medium text-slate-900">
            Project Selection
          </h3>
          
          <div>
            <label htmlFor="project" className="block text-sm font-medium text-slate-700">
              Select a Project <span className="text-red-500">*</span>
            </label>
            <select
              id="project"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border"
              required
            >
              <option value="" disabled>-- Choose a project --</option>
              {projects.map((project) => (
                <option 
                  key={project.id} 
                  value={project.id} 
                  disabled={project.is_full}
                  className={project.is_full ? 'text-slate-400' : 'text-slate-900'}
                >
                  {project.name} {project.is_full ? '(Full)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-5">
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Registering...
              </span>
            ) : (
              'Submit Registration'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
