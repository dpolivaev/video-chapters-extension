#!/bin/bash

# Find all .js files excluding node_modules and vendor, and run Terser to strip comments except Copyright (C)
find . \( -path "./node_modules" -o -path "./vendor" \) -prune -false -o -type f -name "*.js" | while read -r file; do
  npx terser "$file" \
    --output "$file" \
    --format 'comments=/Copyright \(C\)/,beautify=true,indent_level=2'
  echo "Processed $file"
done 