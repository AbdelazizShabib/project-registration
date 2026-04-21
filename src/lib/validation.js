/**
 * Validates registration form data client-side.
 *
 * @param {Array} members - Array of { name, registration_number } objects for every slot.
 * @param {Object} config - The course config object.
 * @param {string|null} selectedProjectId - The chosen project UUID (or '' / null).
 * @param {Array} projects - Array of project objects with `is_full` boolean.
 *
 * @returns {{ valid: boolean, error?: string, duplicateField?: string, validMembers?: Array }}
 */
export function validateRegistrationForm(members, config, selectedProjectId, projects) {
  const validMembers = [];
  const localDuplicateCheck = new Set();

  for (let i = 0; i < config.members_per_team; i++) {
    const isRequired =
      !config.allow_incomplete_teams || i < config.min_members_per_team;
    const mem = members[i] || { name: '', registration_number: '' };
    const nameTrimmed = mem.name.trim();
    const regTrimmed = mem.registration_number.trim();

    if (isRequired) {
      if (!nameTrimmed || !regTrimmed) {
        return {
          valid: false,
          error: `Please fill in all required fields for Member ${i + 1}.`,
        };
      }
    }

    if (nameTrimmed || regTrimmed) {
      if (!nameTrimmed || !regTrimmed) {
        return {
          valid: false,
          error: `Please fill in both Name and Registration Number for Member ${i + 1}, or leave both empty if optional.`,
        };
      }

      if (localDuplicateCheck.has(regTrimmed)) {
        return {
          valid: false,
          error: `Duplicate registration number: ${regTrimmed}`,
          duplicateField: regTrimmed,
        };
      }
      localDuplicateCheck.add(regTrimmed);

      validMembers.push({ name: nameTrimmed, registration_number: regTrimmed });
    }
  }

  if (!selectedProjectId) {
    return { valid: false, error: 'Please select a project.' };
  }

  const project = projects.find((p) => p.id === selectedProjectId);
  if (project && project.is_full) {
    return {
      valid: false,
      error: 'The selected project is full. Please select another one.',
    };
  }

  return { valid: true, validMembers };
}
