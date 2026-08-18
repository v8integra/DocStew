const fs = require("fs");
const path = require("path");

const assets = [
  ["src/renderer/index.html", "dist/src/renderer/index.html"],
  ["src/renderer/styles.css", "dist/src/renderer/styles.css"],
];

for (const [from, to] of assets) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}
