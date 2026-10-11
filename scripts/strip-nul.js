/**
 * Removes spurious NUL (\u0000) characters from built HTML.
 *
 * React 18.3 streaming SSR inserts \u0000 segment markers into long text and
 * heading ids/anchors; the HTML parser then turns them into U+FFFD, which
 * garbles body text and breaks anchor links (href/id mismatch). The docs
 * sources contain no NUL characters, so every NUL in the output is an
 * injected marker and stripping it restores the intended text and ids.
 * Wired as the `postbuild` npm script.
 */
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
let files = 0;
let removed = 0;

(function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (fs.statSync(full).isDirectory()) {
      walk(full);
    } else if (full.endsWith('.html')) {
      const html = fs.readFileSync(full, 'utf8');
      if (!html.includes('\u0000')) continue;
      const count = html.split('\u0000').length - 1;
      fs.writeFileSync(full, html.replace(/\u0000/g, ''), 'utf8');
      files += 1;
      removed += count;
    }
  }
})(buildDir);

console.log(`[strip-nul] removed ${removed} NUL characters from ${files} HTML files.`);
