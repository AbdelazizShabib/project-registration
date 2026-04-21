/**
 * Generate CSV content string from team / member data.
 *
 * @param {Array} teamsData  - Array of team objects. Each must have:
 *   { id, team_number, projects: { name } | null }
 * @param {Array} membersData - Array of member objects. Each must have:
 *   { team_id, member_name, registration_number }
 * @param {number} membersPerTeam - The configured members_per_team value.
 *
 * @returns {string} CSV content (including header row and trailing newline).
 */
export function generateCSV(teamsData, membersData, membersPerTeam) {
  const headers = ['Team Number', 'Project Name'];
  for (let i = 1; i <= membersPerTeam; i++) {
    headers.push(`Member ${i} Name`);
    headers.push(`Member ${i} Reg Number`);
  }

  let csvContent = headers.join(',') + '\n';

  teamsData.forEach((team) => {
    const teamMembers = membersData.filter((m) => m.team_id === team.id);
    const row = [
      team.team_number,
      `"${(team.projects?.name || 'Unknown').replace(/"/g, '""')}"`,
    ];

    for (let i = 0; i < membersPerTeam; i++) {
      if (teamMembers[i]) {
        row.push(
          `"${teamMembers[i].member_name.replace(/"/g, '""')}"`
        );
        row.push(
          `"${teamMembers[i].registration_number.replace(/"/g, '""')}"`
        );
      } else {
        row.push('');
        row.push('');
      }
    }

    csvContent += row.join(',') + '\n';
  });

  return csvContent;
}
