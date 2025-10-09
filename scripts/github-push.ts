import { execSync } from 'child_process';

interface ConnectionSettings {
  settings: {
    access_token?: string;
    expires_at?: string;
    oauth?: {
      credentials?: {
        access_token?: string;
      };
    };
  };
}

async function getAccessToken(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );

  const data = await response.json();
  const connectionSettings: ConnectionSettings = data.items?.[0];

  const accessToken = connectionSettings?.settings?.access_token || 
                     connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }

  return accessToken;
}

async function pushToGitHub() {
  try {
    console.log('🔑 Getting fresh GitHub token...');
    const token = await getAccessToken();
    
    console.log('📦 Updating git remote with fresh token...');
    const remoteUrl = `https://rcz87:${token}@github.com/rcz87/crypto-api.git`;
    
    execSync(`git remote set-url origin "${remoteUrl}"`, { stdio: 'inherit' });
    
    console.log('✅ Remote updated successfully');
    
    console.log('📤 Pushing all commits to GitHub...');
    execSync('git push origin main', { stdio: 'inherit' });
    
    console.log('🎉 Successfully pushed all changes to GitHub!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

pushToGitHub();
