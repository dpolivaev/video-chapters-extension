const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const input = path.join(__dirname, '../resources/icon_highres.png');
const outputDir = path.join(__dirname, '../icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

sizes.forEach(size => {
  const output = path.join(outputDir, `icon${size}.png`);
  sharp(input)
    .resize(size, size)
    .toFile(output, (err) => {
      if (err) console.error(`Error creating icon${size}.png:`, err);
      else console.log(`Created ${output}`);
    });
}); 