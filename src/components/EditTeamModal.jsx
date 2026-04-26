import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

export default function EditTeamModal({ isOpen, onClose, onSuccess, team, config }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [duplicateField, setDuplicateField] = useState(null);

  useEffect(() => {
    if (isOpen && team && config) {
      const initialMembers = Array.from({ length: config.members_per_team }).map((_, index) => {
        const existing = team.members[index];
        if (existing) {
          return { id: existing.id, name: existing.member_name, registration_number: existing.registration_number };
        }
        return { name: '', registration_number: '' };
      });
      setMembers(initialMembers);
      setError(null);
      setDuplicateField(null);
    }
  }, [isOpen, team, config]);

  const handleMemberChange = (index, field, value) => {
    const newMembers = [...members];
    newMembers[index][field] = value;
    setMembers(newMembers);
    
    if (duplicateField === newMembers[index].registration_number) {
      setDuplicateField(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setDuplicateField(null);
    
    let validMembers = [];
    let localDuplicateCheck = new Set();
    
    for (let i = 0; i < config.members_per_team; i++) {
      const isRequired = !config.allow_incomplete_teams || i < config.min_members_per_team;
      const mem = members[i];
      const nameTrimmed = mem.name.trim();
      const regTrimmed = mem.registration_number.trim();
      
      if (isRequired && (!nameTrimmed || !regTrimmed)) {
        setError(`Please fill in all required fields for Member ${i + 1}.`);
        return;
      }
      
      if (nameTrimmed || regTrimmed) {
        if (!nameTrimmed || !regTrimmed) {
           setError(`Please fill in both Name and Registration Number for Member ${i + 1}, or leave both empty if optional.`);
           return;
        }
        
        if (localDuplicateCheck.has(regTrimmed)) {
          setError(`Duplicate registration number in form: ${regTrimmed}`);
          setDuplicateField(regTrimmed);
          return;
        }
        localDuplicateCheck.add(regTrimmed);
        
        validMembers.push({ id: mem.id, name: nameTrimmed, registration_number: regTrimmed });
      }
    }

    setLoading(true);
    
    try {
      const regs = validMembers.map(m => m.registration_number);
      if (regs.length > 0) {
        const { data: existingRegs, error: checkError } = await supabase
          .from('team_members')
          .select('registration_number')
          .in('registration_number', regs)
          .neq('team_id', team.id);

        if (checkError) throw checkError;

        if (existingRegs.length > 0) {
          const duplicateReg = existingRegs[0].registration_number;
          setError(`Registration number ${duplicateReg} is already registered in another team.`);
          setDuplicateField(duplicateReg);
          setLoading(false);
          return;
        }
      }

      const existingMemberIds = team.members.map(m => m.id);
      const validIds = validMembers.filter(m => m.id).map(m => m.id);
      const idsToDelete = existingMemberIds.filter(id => !validIds.includes(id));

      if (idsToDelete.length > 0) {
        const { data, error: deleteError } = await supabase
          .from('team_members')
          .delete()
          .in('id', idsToDelete)
          .select();
        if (deleteError) throw deleteError;
        if (!data || data.length === 0) {
           throw new Error(`Failed to delete removed members. The database blocked the delete (likely due to missing RLS DELETE policy on team_members table).`);
        }
      }

      for (const m of validMembers) {
        if (m.id) {
          const { data, error: updateError } = await supabase
            .from('team_members')
            .update({ member_name: m.name, registration_number: m.registration_number })
            .eq('id', m.id)
            .select();
            
          if (updateError) throw updateError;
          if (!data || data.length === 0) {
            throw new Error(`Failed to update ${m.name}. The database blocked the update (likely due to missing RLS UPDATE policy on team_members table).`);
          }
        } else {
          const { data, error: insertError } = await supabase
            .from('team_members')
            .insert({ team_id: team.id, member_name: m.name, registration_number: m.registration_number })
            .select();
          if (insertError) throw insertError;
          if (!data || data.length === 0) {
             throw new Error(`Failed to insert new member ${m.name}. The database blocked the insert.`);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating team:', err);
      setError(err.message || 'An unexpected error occurred during update.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !team || !config) return null;

  return (
    <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={onClose}></div>

      <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <div className="relative transform overflow-hidden rounded-lg bg-slate-50 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                Edit Team {team.team_number} - {team.project_name}
              </h3>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-500">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="bg-slate-50 px-4 py-5 sm:p-6 max-h-[75vh] overflow-y-auto">
              <form onSubmit={handleSubmit} className="space-y-8 bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
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

                <div className="pt-5 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="bg-white py-2 px-4 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
