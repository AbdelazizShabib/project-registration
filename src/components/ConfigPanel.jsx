import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export default function ConfigPanel() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [hasTeams, setHasTeams] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('config')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) throw error;
      setConfig(data);

      const { count, error: countError } = await supabase
        .from('teams')
        .select('*', { count: 'exact', head: true });
        
      if (!countError && count > 0) {
        setHasTeams(true);
      } else {
        setHasTeams(false);
      }
    } catch (error) {
      console.error('Error fetching config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // Validate
      if (config.allow_incomplete_teams) {
        if (!config.min_members_per_team || config.min_members_per_team < 1 || config.min_members_per_team >= config.members_per_team) {
          throw new Error(`Minimum members must be between 1 and ${config.members_per_team - 1}.`);
        }
      }

      const updates = {
        course_name: config.course_name,
        members_per_team: config.members_per_team,
        allow_incomplete_teams: config.allow_incomplete_teams,
        min_members_per_team: config.allow_incomplete_teams ? config.min_members_per_team : null,
        registration_open: config.registration_open,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('config')
        .update(updates)
        .eq('id', 1);

      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Configuration saved successfully.' });
      fetchConfig(); // Reload to get fresh data
    } catch (error) {
      console.error('Error saving config:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save configuration.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse flex space-x-4"><div className="flex-1 space-y-4 py-1"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="space-y-2"><div className="h-4 bg-slate-200 rounded"></div><div className="h-4 bg-slate-200 rounded w-5/6"></div></div></div></div>;
  }

  if (!config) return null;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6 border-b border-slate-200">
        <h3 className="text-lg leading-6 font-medium text-slate-900">Course Configuration</h3>
        <p className="mt-1 text-sm text-slate-500">Manage global settings for the registration system.</p>
      </div>
      
      <div className="px-4 py-5 sm:p-6">
        {message.text && (
          <div className={`mb-6 p-4 rounded-md ${message.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
          
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <label className="text-base font-medium text-slate-900">Registration Open</label>
              <p className="text-sm text-slate-500">Enable or disable the registration form for students.</p>
            </div>
            <button
              type="button"
              onClick={() => setConfig({ ...config, registration_open: !config.registration_open })}
              className={`${
                config.registration_open ? 'bg-indigo-600' : 'bg-slate-200'
              } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
            >
              <span className="sr-only">Toggle registration</span>
              <span
                className={`${
                  config.registration_open ? 'translate-x-5' : 'translate-x-0'
                } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
              />
            </button>
          </div>

          <div>
            <label htmlFor="course_name" className="block text-sm font-medium text-slate-700">Course Name</label>
            <input
              type="text"
              id="course_name"
              value={config.course_name || ''}
              onChange={(e) => setConfig({ ...config, course_name: e.target.value })}
              className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-slate-300 rounded-md p-2 border"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Members Per Team</label>
            <div className="mt-1 flex items-center">
              <input
                type="number"
                min="1"
                value={config.members_per_team || ''}
                disabled={config.registration_open || hasTeams}
                onChange={(e) => setConfig({ ...config, members_per_team: parseInt(e.target.value) })}
                className={`shadow-sm block w-full sm:text-sm border-slate-300 rounded-md p-2 border ${
                  config.registration_open || hasTeams ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'focus:ring-indigo-500 focus:border-indigo-500'
                }`}
                required
              />
              <span className="ml-3 text-sm text-slate-500 italic">
                {config.registration_open 
                  ? '(Cannot be changed while registration is open)' 
                  : hasTeams 
                    ? '(Cannot be changed while teams are registered. Reset data first.)'
                    : '(Editable)'}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="text-base font-medium text-slate-900">Allow Incomplete Teams</label>
                <p className="text-sm text-slate-500">Allow teams to register without filling all member slots.</p>
              </div>
              <button
                type="button"
                onClick={() => setConfig({ ...config, allow_incomplete_teams: !config.allow_incomplete_teams })}
                className={`${
                  config.allow_incomplete_teams ? 'bg-indigo-600' : 'bg-slate-200'
                } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <span className="sr-only">Toggle incomplete teams</span>
                <span
                  className={`${
                    config.allow_incomplete_teams ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                />
              </button>
            </div>

            {config.allow_incomplete_teams && (
              <div className="ml-4 pl-4 border-l-2 border-indigo-100">
                <label htmlFor="min_members" className="block text-sm font-medium text-slate-700">Minimum Members Per Team</label>
                <input
                  type="number"
                  id="min_members"
                  min="1"
                  max={config.members_per_team - 1}
                  value={config.min_members_per_team || ''}
                  onChange={(e) => setConfig({ ...config, min_members_per_team: parseInt(e.target.value) })}
                  className="mt-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:max-w-xs sm:text-sm border-slate-300 rounded-md p-2 border"
                  required={config.allow_incomplete_teams}
                />
                <p className="mt-1 text-xs text-slate-500">Must be at least 1 and less than {config.members_per_team}.</p>
              </div>
            )}
          </div>

          <div className="pt-5 border-t border-slate-200">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
