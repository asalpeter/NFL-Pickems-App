const { execSync } = require('node:child_process');
try { execSync('tsc -v', { stdio: 'ignore' }); } catch {}
