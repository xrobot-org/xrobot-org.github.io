const fs = require('fs');
const path = require('path');
const axios = require('axios');

const repos = {
  XRobot: {repo: 'xrobot-org/XRobot', ref: 'master'},
  LibXR: {repo: 'xrobot-org/libxr', ref: 'master'},
  CodeGen: {repo: 'xrobot-org/LibXR_CppCodeGenerator', ref: 'master'},
};

(async () => {
  const result = {};
  for (const [name, info] of Object.entries(repos)) {
    try {
      const res = await axios.get(
        `https://api.github.com/repos/${info.repo}/commits/${info.ref}`
      );
      result[name] = res.data.sha.substring(0, 7);
    } catch {
      result[name] = 'Error';
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
