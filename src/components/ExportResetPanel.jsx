import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Download, AlertTriangle, Key } from 'lucide-react';

export default function ExportResetPanel() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  
  const [passLoading, setPassLoading] = useState(false);
  const [passMessage, setPassMessage] = useState({ type: '', text: '' });
  
  const [exportLoading, setExportLoading] = useState(false);
  const [gradesExportLoading, setGradesExportLoading] = useState(false);
  
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState({ type: '', text: '' });
  
  const [config, setConfig] = useState(null);

  useEffect(() => {
    supabase.from('config').select('*').eq('id', 1).single().then(({ data }) => setConfig(data));
  }, []);

  const handleExportCSV = async () => {
    if (!config) return;
    setExportLoading(true);
    try {
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select(`
          id,
          team_number,
          projects(name)
        `)
        .order('team_number');

      if (teamsError) throw teamsError;

      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select('*');

      if (membersError) throw membersError;

      const headers = ['Team Number', 'Project Name'];
      for (let i = 1; i <= config.members_per_team; i++) {
        headers.push(`Member ${i} Name`);
        headers.push(`Member ${i} Reg Number`);
      }

      let csvContent = headers.join(',') + '\n';

      teamsData.forEach(team => {
        const teamMembers = membersData.filter(m => m.team_id === team.id);
        const row = [
          team.team_number,
          `"${(team.projects?.name || 'Unknown').replace(/"/g, '""')}"`
        ];

        for (let i = 0; i < config.members_per_team; i++) {
          if (teamMembers[i]) {
            row.push(`"${teamMembers[i].member_name.replace(/"/g, '""')}"`);
            row.push(`"${teamMembers[i].registration_number.replace(/"/g, '""')}"`);
          } else {
            row.push('');
            row.push('');
          }
        }

        csvContent += row.join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `registration_data_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleExportGradesCSV = async () => {
    setGradesExportLoading(true);
    try {
      const { data: members, error: membersError } = await supabase
        .from('team_members')
        .select('id, member_name, registration_number')
        .order('registration_number');

      if (membersError) throw membersError;

      const { data: gradesData, error: gradesError } = await supabase
        .from('grades')
        .select('team_member_id, grade');

      if (gradesError) throw gradesError;

      console.log('DEBUG grades rows:', gradesData);
      console.log('DEBUG first member id:', members?.[0]?.id);

      const gradesMap = {};
      (gradesData || []).forEach(g => {
        gradesMap[g.team_member_id] = g.grade ?? '';
      });

      console.log('DEBUG gradesMap:', gradesMap);

      let csvContent = 'Student Name,Registration Number,Grade\n';
      members.forEach(member => {
        const grade = gradesMap[member.id] ?? '';
        csvContent +=
          `"${member.member_name.replace(/"/g, '""')}",` +
          `"${member.registration_number.replace(/"/g, '""')}",` +
          `"${String(grade).replace(/"/g, '""')}"\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `grades_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Grades export error:', err);
      alert('Failed to export grades.');
    } finally {
      setGradesExportLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassMessage({ type: '', text: '' });

    if (password !== confirmPassword) {
      setPassMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    if (password.length < 6) {
      setPassMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
      return;
    }

    setPassLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setPassMessage({ type: 'success', text: 'Password updated successfully.' });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPassMessage({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setPassLoading(false);
    }
  };

  const handleReset = async () => {
    if (resetConfirm !== 'RESET') {
      setResetMessage({ type: 'error', text: 'Please type RESET exactly to confirm.' });
      return;
    }

    if (!window.confirm('Are you ABSOLUTELY sure? This action CANNOT be undone!')) {
      return;
    }

    setResetLoading(true);
    setResetMessage({ type: '', text: '' });

    try {
      // Delete data. RLS might need to be bypassed if it restricts deletes. Assuming admin is authenticated,
      // and RLS allows deletes for authenticated admins. If not, this needs an RPC.
      // The prompt says "delete all rows from... cascade handles it". So we can delete all teams and projects.
      const { error: err1 } = await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (err1) throw err1;

      const { error: err2 } = await supabase.from('projects').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (err2) throw err2;

      // Reset config
      const { error: err3 } = await supabase
        .from('config')
        .update({
          course_name: 'Untitled Course',
          registration_open: false,
          allow_incomplete_teams: false,
          min_members_per_team: null
        })
        .eq('id', 1);
      
      if (err3) throw err3;

      setResetConfirm('');
      setResetMessage({ 
        type: 'success', 
        text: 'System successfully reset! Note: Team numbers will continue from the last used number.' 
      });
      
    } catch (err) {
      console.error('Reset error:', err);
      setResetMessage({ type: 'error', text: err.message || 'Failed to reset system.' });
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      
      {/* Export Section */}
      <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6 border-l-4 border-indigo-500">
        <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center">
          <Download className="mr-2 h-5 w-5 text-indigo-500" />
          Export Data
        </h3>
        <div className="mt-2 max-w-xl text-sm text-slate-500">
          <p>Download a complete list of all registered teams and members in CSV format. You can open this file in Excel or Google Sheets.</p>
        </div>
        <div className="mt-5">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={exportLoading || !config}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
          >
            {exportLoading ? 'Exporting...' : 'Download CSV'}
          </button>
        </div>
      </div>

      {/* Grades Export Section */}
      <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6 border-l-4 border-emerald-500">
        <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center">
          <Download className="mr-2 h-5 w-5 text-emerald-500" />
          Export Grades
        </h3>
        <div className="mt-2 max-w-xl text-sm text-slate-500">
          <p>Download grades for all students as CSV. Columns: Student Name, Registration Number, Grade.</p>
        </div>
        <div className="mt-5">
          <button
            type="button"
            onClick={handleExportGradesCSV}
            disabled={gradesExportLoading}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent font-medium rounded-md text-emerald-700 bg-emerald-100 hover:bg-emerald-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 sm:text-sm disabled:opacity-50"
          >
            {gradesExportLoading ? 'Exporting...' : 'Download Grades CSV'}
          </button>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6">
        <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center">
          <Key className="mr-2 h-5 w-5 text-slate-400" />
          Change Admin Password
        </h3>
        
        {passMessage.text && (
          <div className={`mt-4 p-4 rounded-md ${passMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {passMessage.text}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="mt-5 space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">New Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border"
            />
          </div>
          <button
            type="submit"
            disabled={passLoading}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
          >
            {passLoading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="bg-white shadow rounded-lg px-4 py-5 sm:p-6 border border-red-200">
        <h3 className="text-lg leading-6 font-medium text-red-600 flex items-center">
          <AlertTriangle className="mr-2 h-5 w-5" />
          Danger Zone: Factory Reset
        </h3>
        <div className="mt-2 max-w-xl text-sm text-slate-500 space-y-2">
          <p>This will permanently delete ALL data:</p>
          <ul className="list-disc pl-5">
            <li>All registered teams and members</li>
            <li>All projects</li>
            <li>Resets configuration to defaults</li>
          </ul>
          <p className="font-medium text-red-600 mt-2">This action cannot be undone.</p>
        </div>

        {resetMessage.text && (
          <div className={`mt-4 p-4 rounded-md ${resetMessage.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {resetMessage.text}
          </div>
        )}

        <div className="mt-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="Type RESET to confirm"
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              className="shadow-sm focus:ring-red-500 focus:border-red-500 block w-full sm:text-sm border-slate-300 rounded-md py-2 px-3 border"
            />
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetLoading || resetConfirm !== 'RESET'}
            className="w-full sm:w-auto inline-flex justify-center items-center px-4 py-2 border border-transparent font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:text-sm disabled:opacity-50 disabled:bg-red-400"
          >
            {resetLoading ? 'Resetting...' : 'Factory Reset'}
          </button>
        </div>
      </div>

    </div>
  );
}
