/**
 * n8n Telegram Message Parser for IPL Fantasy
 * 
 * This script parses a Telegram message into a format compatible with the 
 * /external/match-results endpoint.
 * 
 * Expected Format:
 * /match
 * Match 37
 * GT
 * CSK:28
 * GT:55
 * POTM: KAGISO RABADA
 * six:GT
 * four:GT
 */

let text = $json.message.text;

if (!text) {
  throw new Error("Empty message");
}

// Optional command check
if (text.startsWith('/match')) {
  text = text.replace('/match', '').trim();
}

const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

if (lines.length < 5) {
  throw new Error("Invalid format. Expected at least 5 lines.");
}

if (!lines[0].toLowerCase().startsWith('match')) {
  throw new Error("First line must start with 'Match'");
}

const matchNo = parseInt(lines[0].replace(/[^0-9]/g, ''));
const winner = lines[1];

const scores = {};
let potm = "";
let more_sixes_team = "";
let more_fours_team = "";

// Iterate through remaining lines (skipping match no and winner)
for (let i = 2; i < lines.length; i++) {
  const line = lines[i];
  if (!line.includes(':')) continue;

  const [key, value] = line.split(':').map(s => s.trim());
  const upperKey = key.toUpperCase();

  if (upperKey === 'POTM') {
    potm = value;
  } else if (upperKey === 'SIX') {
    more_sixes_team = value;
  } else if (upperKey === 'FOUR') {
    more_fours_team = value;
  } else {
    // Treat as Powerplay scores (e.g., CSK:28)
    const parsedScore = parseInt(value);
    if (!isNaN(parsedScore)) {
      scores[key] = parsedScore;
    }
  }
}

// Validation
if (!potm) {
  throw new Error("Missing POTM line");
}

return {
  match: matchNo,
  winner,
  scores,
  potm,
  more_sixes_team,
  more_fours_team,
  chat: $json.message.chat,
  messageId: $json.message.message_id,
  from: $json.message.from
};
