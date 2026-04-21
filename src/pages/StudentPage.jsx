import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import StudentForm from '../components/StudentForm';

export default function StudentPage() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchConfig() {
      try {
        const { data, error } = await supabase
          .from('config')
          .select('*')
          .eq('id', 1)
          .single();

        if (error) throw error;
        setConfig(data);
      } catch (err) {
        console.error('Error fetching config:', err);
        setError('Could not load course configuration.');
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-600">
        <p>{error}</p>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-3xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
            {config.course_name || 'Course Registration'}
          </h1>
        </div>

        {!config.registration_open ? (
          <div className="bg-white py-12 px-4 shadow sm:rounded-lg sm:px-10 text-center">
            <h2 className="text-2xl font-medium text-slate-700">
              Registration is currently closed.
            </h2>
          </div>
        ) : (
          <StudentForm config={config} />
        )}
      </div>
    </div>
  );
}
