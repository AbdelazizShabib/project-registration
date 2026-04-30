import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, ArrowLeft, Save, CheckCircle } from 'lucide-react';

export default function GradingPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [grades, setGrades] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          team_number,
          projects(name),
          team_members(id, member_name, registration_number)
        `)
        .order('team_number');

      if (error) throw error;
      setTeams(data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTeams = searchTerm
    ? teams.filter(team => {
        const term = searchTerm.toLowerCase();
        return (
          team.team_number.toString().includes(term) ||
          team.team_members?.some(m =>
            m.registration_number.toLowerCase().includes(term)
          )
        );
      })
    : teams;

  const handleSelectTeam = async (team) => {
    setSelectedTeam(team);
    setSaveSuccess(false);

    const memberIds = team.team_members.map(m => m.id);
    const { data: existingGrades } = await supabase
      .from('grades')
      .select('team_member_id, grade')
      .in('team_member_id', memberIds);

    const gradeMap = {};
    (existingGrades || []).forEach(g => {
      gradeMap[g.team_member_id] = g.grade ?? '';
    });
    setGrades(gradeMap);
  };

  const handleSaveGrades = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const upsertData = selectedTeam.team_members.map(member => ({
        team_member_id: member.id,
        grade: grades[member.id] ?? null,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from('grades')
        .upsert(upsertData, { onConflict: 'team_member_id' });

      if (error) throw error;
      setSaveSuccess(true);
    } catch (err) {
      console.error('Error saving grades:', err);
      alert('Failed to save grades: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (selectedTeam) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            onClick={() => setSelectedTeam(null)}
            className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Search
          </button>
          <h3 className="text-lg font-medium text-slate-900">
            Team {selectedTeam.team_number}
            {selectedTeam.projects?.name ? ` — ${selectedTeam.projects.name}` : ''}
          </h3>
        </div>

        {saveSuccess && (
          <div className="flex items-center gap-2 p-4 bg-green-50 text-green-700 rounded-lg border border-green-200">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            Grades saved successfully.
          </div>
        )}

        <div className="bg-white shadow rounded-lg border border-slate-200 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Student Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Registration Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Grade
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {selectedTeam.team_members.map(member => (
                <tr key={member.id}>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    {member.member_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {member.registration_number}
                  </td>
                  <td className="px-6 py-4">
                    <input
                      type="text"
                      value={grades[member.id] ?? ''}
                      onChange={(e) =>
                        setGrades(prev => ({ ...prev, [member.id]: e.target.value }))
                      }
                      placeholder="Enter grade"
                      className="w-36 border border-slate-300 rounded-md px-3 py-1.5 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveGrades}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Grades'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-slate-900">Grade Projects</h3>
        <p className="mt-1 text-sm text-slate-500">
          Search by team number or a student's registration number, then select the team to enter grades.
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
        <div className="relative rounded-md shadow-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-300 rounded-md py-2 border"
            placeholder="Search by team number or registration number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Team #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Members
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : filteredTeams.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                    {searchTerm ? 'No teams match your search.' : 'No teams registered yet.'}
                  </td>
                </tr>
              ) : (
                filteredTeams.map(team => (
                  <tr key={team.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        Team {team.team_number}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                      {team.projects?.name || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {team.team_members?.map(m => m.member_name).join(', ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleSelectTeam(team)}
                        className="text-indigo-600 hover:text-indigo-900 text-sm font-medium hover:underline"
                      >
                        Grade Team
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
