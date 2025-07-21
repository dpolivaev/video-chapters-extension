const fs = require('fs-extra');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');

fs.removeSync(distDir);
console.log('dist directory cleaned.'); 