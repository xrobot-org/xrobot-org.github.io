const fs = require('fs');
const path = require('path');
const axios = require('axios');

// The homepage version card shows the released versions of the two pip
// packages and the LibXR commit on master.
const pypiPackages = {
  xrobotVersion: 'xrobot',
  codegenVersion: 'libxr',
};

const commits = {
  libxrCommit: {repo: 'xrobot-org/libxr', ref: 'master'},
};

(async () => {
  const result = {};
  for (const [key, name] of Object.entries(pypiPackages)) {
    try {
      const res = await axios.get(`https://pypi.org/pypi/${name}/json`);
      result[key] = res.data.info.version;
    } catch {
      result[key] = 'Error';
    }
  }
  for (const [key, info] of Object.entries(commits)) {
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${info.repo}/commits/${info.ref}`
      );
      result[key] = res.data.sha.substring(0, 7);
    } catch {
      result[key] = 'Error';
    }
  }

  const outputDir = path.resolve(__dirname, '../src/data');
  fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(
    path.join(outputDir, 'commitInfo.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  );
})();
