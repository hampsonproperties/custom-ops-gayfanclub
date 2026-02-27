const { execSync } = require('child_process');

// Get all commits with timestamps
const gitLog = execSync('git log --all --pretty=format:"%ai | %s"', { encoding: 'utf-8' });
const commits = gitLog.split('\n').reverse(); // Chronological order

const sessions = [];
let currentSession = null;
const MAX_GAP_HOURS = 4; // If more than 4 hours between commits, it's a new session

commits.forEach((commit, index) => {
  if (!commit.trim()) return;

  const timestampStr = commit.split(' | ')[0];
  const timestamp = new Date(timestampStr);
  const message = commit.split(' | ')[1];

  if (index === 0) {
    // First commit starts first session
    currentSession = {
      start: timestamp,
      end: timestamp,
      commits: [{ timestamp, message }],
    };
    return;
  }

  const prevCommit = currentSession.commits[currentSession.commits.length - 1];
  const timeDiffMs = timestamp - prevCommit.timestamp;
  const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

  if (timeDiffHours <= MAX_GAP_HOURS) {
    // Same session
    currentSession.end = timestamp;
    currentSession.commits.push({ timestamp, message });
  } else {
    // New session
    sessions.push(currentSession);
    currentSession = {
      start: timestamp,
      end: timestamp,
      commits: [{ timestamp, message }],
    };
  }
});

// Don't forget the last session
if (currentSession) {
  sessions.push(currentSession);
}

// Calculate statistics
let totalWorkHours = 0;
const sessionsByDate = {};

console.log('\n=== WORK SESSIONS ANALYSIS ===\n');
console.log(`Total commits: ${commits.filter(c => c.trim()).length}`);
console.log(`Work sessions: ${sessions.length}`);
console.log(`Analysis period: ${sessions[0].start.toLocaleDateString()} - ${sessions[sessions.length - 1].end.toLocaleDateString()}\n`);

sessions.forEach((session, index) => {
  const durationMs = session.end - session.start;
  const durationHours = durationMs / (1000 * 60 * 60);
  const durationMinutes = (durationMs / (1000 * 60)) % 60;

  // Add base time for single commits (estimate 15 minutes minimum per commit)
  const estimatedHours = durationHours + (session.commits.length * 0.25);
  totalWorkHours += estimatedHours;

  const dateKey = session.start.toLocaleDateString();
  if (!sessionsByDate[dateKey]) {
    sessionsByDate[dateKey] = { hours: 0, commits: 0, sessions: 0 };
  }
  sessionsByDate[dateKey].hours += estimatedHours;
  sessionsByDate[dateKey].commits += session.commits.length;
  sessionsByDate[dateKey].sessions += 1;

  console.log(`Session ${index + 1}: ${session.start.toLocaleString()}`);
  console.log(`  Duration: ${Math.floor(durationHours)}h ${Math.floor(durationMinutes)}m`);
  console.log(`  Commits: ${session.commits.length}`);
  console.log(`  Estimated work time: ${estimatedHours.toFixed(1)} hours`);
  console.log(`  First: ${session.commits[0].message.substring(0, 60)}...`);
  console.log(`  Last: ${session.commits[session.commits.length - 1].message.substring(0, 60)}...`);
  console.log('');
});

console.log('\n=== SUMMARY BY DATE ===\n');
Object.entries(sessionsByDate)
  .sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB))
  .forEach(([date, stats]) => {
    console.log(`${date}: ${stats.hours.toFixed(1)} hours (${stats.commits} commits, ${stats.sessions} sessions)`);
  });

console.log('\n=== TOTAL ESTIMATED WORK TIME ===\n');
console.log(`Total active work hours: ${totalWorkHours.toFixed(1)} hours`);
console.log(`Average per day: ${(totalWorkHours / Object.keys(sessionsByDate).length).toFixed(1)} hours`);
console.log(`Total work days: ${Object.keys(sessionsByDate).length} days\n`);
