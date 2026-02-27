const { execSync } = require('child_process');

// Get all commits with timestamps
const gitLog = execSync('git log --all --pretty=format:"%ai | %s"', { encoding: 'utf-8' });
const commits = gitLog.split('\n').reverse(); // Chronological order

// Organize by week
const weeks = {};
const dailyStats = {};

commits.forEach((commit) => {
  if (!commit.trim()) return;

  const parts = commit.split(' | ');
  const timestampStr = parts[0];
  const message = parts[1];
  const timestamp = new Date(timestampStr);

  // Get week starting Sunday
  const weekStart = new Date(timestamp);
  const day = weekStart.getDay();
  weekStart.setDate(weekStart.getDate() - day);
  weekStart.setHours(0, 0, 0, 0);
  const weekKey = weekStart.toISOString().split('T')[0];

  if (!weeks[weekKey]) {
    weeks[weekKey] = [];
  }
  weeks[weekKey].push({ timestamp, message });

  // Daily stats
  const dateKey = timestamp.toISOString().split('T')[0];
  if (!dailyStats[dateKey]) {
    dailyStats[dateKey] = { count: 0, commits: [] };
  }
  dailyStats[dateKey].count++;
  dailyStats[dateKey].commits.push({ time: timestamp.toLocaleTimeString(), message });
});

console.log('\n=== COMPLETE PROJECT TIMELINE ===\n');
console.log(`Total Commits: ${commits.filter(c => c.trim()).length}`);
console.log(`First Commit: ${commits[0].split(' | ')[0]}`);
console.log(`Latest Commit: ${commits[commits.length - 1].split(' | ')[0]}`);

console.log('\n=== BREAKDOWN BY WEEK ===\n');

Object.entries(weeks)
  .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
  .forEach(([weekStart, weekCommits]) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    console.log(`\n📅 Week of ${new Date(weekStart).toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
    console.log(`   ${weekCommits.length} commits`);

    // Show daily breakdown for this week
    const dailyBreakdown = {};
    weekCommits.forEach(commit => {
      const dateKey = commit.timestamp.toISOString().split('T')[0];
      if (!dailyBreakdown[dateKey]) {
        dailyBreakdown[dateKey] = [];
      }
      dailyBreakdown[dateKey].push(commit);
    });

    Object.entries(dailyBreakdown)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .forEach(([date, commits]) => {
        const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short' });
        const first = commits[0].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const last = commits[commits.length - 1].timestamp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        console.log(`   ${dayName} ${new Date(date).toLocaleDateString()}: ${commits.length} commits (${first} - ${last})`);
      });
  });

console.log('\n\n=== DETAILED DAILY LOG ===\n');

Object.entries(dailyStats)
  .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Reverse chronological
  .slice(0, 30) // Show last 30 days
  .forEach(([date, stats]) => {
    const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    console.log(`\n${dayName} - ${stats.count} commits:`);
    stats.commits.forEach((commit, idx) => {
      const timeStr = commit.time.substring(0, 8);
      const msg = commit.message.substring(0, 80);
      console.log(`  ${timeStr} - ${msg}`);
    });
  });

console.log('\n');
