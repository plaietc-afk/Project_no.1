process.chdir(__dirname + '/client');
require('child_process').execSync('node node_modules/vite/bin/vite.js --port 5174', { stdio: 'inherit' });
