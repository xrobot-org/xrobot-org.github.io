/**
 * Copy the LXGW WenKai Screen webfont (npm: lxgw-wenkai-screen-webfont) into
 * static/fonts/lxgw/ so it ships as a static asset:
 *   - every top-level *.css of the package  -> static/fonts/lxgw/*.css
 *   - the whole files/ directory            -> static/fonts/lxgw/files/
 * The CSS references ./files/... relatively, so the layout must be preserved.
 * static/fonts/lxgw/ is gitignored; the copy runs via `prestart` / `prebuild`.
 *
 * If the target directory exists it is emptied first, so the output always
 * matches the installed package version exactly.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'node_modules', 'lxgw-wenkai-screen-webfont');
const targetDir = path.join(projectRoot, 'static', 'fonts', 'lxgw');

if (!fs.existsSync(sourceDir)) {
  console.error(
    '[copy-fonts] node_modules/lxgw-wenkai-screen-webfont not found. Run `npm install` first.'
  );
  process.exit(1);
}

// Empty the target dir but keep it (avoids churn if something watches static/).
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

// Copy all package CSS files (keep original names, e.g. lxgwwenkaiscreen.css).
const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
let copied = 0;
for (const entry of entries) {
  if (entry.isFile() && entry.name.endsWith('.css')) {
    fs.copyFileSync(path.join(sourceDir, entry.name), path.join(targetDir, entry.name));
    copied += 1;
  }
}

// Copy the whole font files/ directory (relative ./files/ URLs must resolve).
const sourceFiles = path.join(sourceDir, 'files');
const targetFiles = path.join(targetDir, 'files');
fs.cpSync(sourceFiles, targetFiles, { recursive: true });
const fileCount = fs.readdirSync(targetFiles).length;

console.log(
  `[copy-fonts] LXGW WenKai Screen -> static/fonts/lxgw (${copied} css, ${fileCount} font files)`
);
