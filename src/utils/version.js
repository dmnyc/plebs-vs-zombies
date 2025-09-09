import packageJson from '../../package.json';

// Get the base version from package.json
const baseVersion = packageJson.version;

// Function to get git commit hash
async function getCommitHash() {
  try {
    // Try to get commit hash from git command if available
    // This won't work in browser, so we'll use a build-time approach
    return import.meta.env.VITE_GIT_COMMIT || 'dev';
  } catch (error) {
    return 'dev';
  }
}

// Function to get full version string
export async function getVersion() {
  const commitHash = await getCommitHash();
  return `${baseVersion} build ${commitHash}`;
}

// Synchronous version for immediate use
export function getVersionSync() {
  const commitHash = import.meta.env.VITE_GIT_COMMIT || 'dev';
  return `${baseVersion} build ${commitHash}`;
}

export { baseVersion };