/**
 * Icon Generation Script for Chaptotek Extension
 * Generates PNG icons of various sizes from a high-res source
 *
 * Copyright (C) 2025 Dimitry Polivaev
 *
 * This file is part of Chaptotek.
 *
 * Chaptotek is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Chaptotek is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Chaptotek. If not, see <https://www.gnu.org/licenses/>.
 */
const sharp = require('sharp');

const fs = require('fs');

const path = require('path');

const sizes = [ 16, 48, 128 ];

const input = path.join(__dirname, '../resources/icon_highres.png');

const outputDir = path.join(__dirname, '../icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, {
    recursive: true
  });
}

sizes.forEach(size => {
  const output = path.join(outputDir, `icon${size}.png`);
  sharp(input).resize(size, size).toFile(output, err => {
    if (err) {
      console.error(`Error creating icon${size}.png:`, err);
    } else {
      console.log(`Created ${output}`);
    }
  });
});
