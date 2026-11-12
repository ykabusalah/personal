// Put the site live and bring GitHub up to date in one go: npm run ship.
// Stops if a change isn't committed yet, so the live site and GitHub always match.
import { execSync } from 'node:child_process';

const run = (command, ifItFails) => {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch {
    console.error(`\nStopping: ${ifItFails}`);
    process.exit(1);
  }
};

if (execSync('git status --porcelain --untracked-files=no').toString().trim()) {
  console.error('Stopping: commit your changes first, so the live site and GitHub match.');
  process.exit(1);
}

run(
  'npm run deploy',
  'the site didn\'t go live, so nothing was pushed to GitHub either. The reason is just above. If it says the token isn\'t valid or no credentials were found, run "npx.cmd vercel login", then ship again.',
);
run('git push origin main', 'the site is live, but pushing to GitHub didn\'t work. The reason is just above.');
