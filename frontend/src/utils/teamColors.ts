export const teamColors: Record<string, string> = {
  MI: '#004BA0',
  CSK: '#F4C430',
  RCB: '#CC0000',
  KKR: '#552583',
  DC: '#0078BC',
  RR: '#E91E8C',
  PBKS: '#AA0000',
  SRH: '#FF6600',
  GT: '#1B6CA8',
  LSG: '#00ADEF',
};

export const getTeamColor = (teamName: any) => {
  if (teamName === undefined || teamName === null) return '#ffffff';
  const teamStr = String(teamName);
  
  const normalized = teamStr.trim().toUpperCase();
  
  // 1. Direct lookup (MI, CSK, etc)
  if (teamColors[normalized]) return teamColors[normalized];
  
  // 2. Initials lookup (Mumbai Indians -> MI)
  const words = teamStr.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (teamColors[initials]) return teamColors[initials];
  }

  // 3. Partial match (Chennai -> CSK, etc)
  const teamMapping: Record<string, string> = {
    'MUMBAI': 'MI',
    'CHENNAI': 'CSK',
    'BANGALORE': 'RCB',
    'BENGALURU': 'RCB',
    'KOLKATA': 'KKR',
    'DELHI': 'DC',
    'RAJASTHAN': 'RR',
    'PUNJAB': 'PBKS',
    'HYDERABAD': 'SRH',
    'GUJARAT': 'GT',
    'LUCKNOW': 'LSG'
  };

  for (const [key, value] of Object.entries(teamMapping)) {
    if (normalized.includes(key)) return teamColors[value];
  }

  return '#ffffff';
};

export const getTeamShortName = (teamName: any) => {
  if (teamName === undefined || teamName === null) return '';
  const teamStr = String(teamName);
  const normalized = teamStr.trim().toUpperCase();
  if (teamColors[normalized]) return normalized;
  
  const words = teamStr.trim().split(/\s+/);
  if (words.length > 1) {
    const initials = words.map(w => w[0]).join('').toUpperCase();
    if (teamColors[initials]) return initials;
  }
  
  const teamMapping: Record<string, string> = {
    'MUMBAI': 'MI',
    'CHENNAI': 'CSK',
    'BANGALORE': 'RCB',
    'BENGALURU': 'RCB',
    'KOLKATA': 'KKR',
    'DELHI': 'DC',
    'RAJASTHAN': 'RR',
    'PUNJAB': 'PBKS',
    'HYDERABAD': 'SRH',
    'GUJARAT': 'GT',
    'LUCKNOW': 'LSG'
  };

  for (const [key, value] of Object.entries(teamMapping)) {
    if (normalized.includes(key)) return value;
  }
  return teamName;
};
