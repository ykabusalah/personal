// Put the site live and bring GitHub up to date in one go: npm run ship.
// Stops if a change isn't committed yet, so the live site and GitHub always match.
import { execSync } from 'node:child_process';

const run = (command) => execSync(command, { stdio: 'inherit' });

if (execSync('git status --porcelain --untracked-files=no').toString().trim()) {
  console.error('Stopping: commit your changes first, so the live site and GitHub match.');
  process.exit(1);
}

run('npm run deploy');
run('git push origin main');
