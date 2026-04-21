import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';
import StudentForm from './StudentForm';

export default function ManualRegister({ isOpen, onClose, onSuccess }) {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    const { data } = await supabase.from('config').select('*').eq('id', 1).single();
    setConfig(data);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-slate-50 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
              Manual Team Registration
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="bg-slate-50 px-4 py-5 sm:p-6 max-h-[70vh] overflow-y-auto">
            {!config ? (
              <div className="flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>
            ) : (
              <StudentForm config={config} />
            )}
          </div>
          <div className="bg-white px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-slate-200">
            <button
              type="button"
              className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm"
              onClick={() => {
                onClose();
                onSuccess(); // Triggers reload
              }}
            >
              Close / Refresh List
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
