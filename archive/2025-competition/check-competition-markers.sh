#!/bin/bash

# Script to find all competition-related temporary code markers
# Run this before removing competition components to ensure nothing is missed

echo "🔍 Searching for October 2025 Competition markers..."
echo "=================================================="
echo ""

# Search for temporary markers in source code
echo "📝 Temporary Code Markers:"
echo "--------------------------"
grep -rn "\[TEMPORARY - October 2025 Competition\]" \
  --include="*.vue" \
  --include="*.js" \
  --include="*.ts" \
  --include="*.jsx" \
  --include="*.tsx" \
  --include="*.html" \
  --include="*.css" \
  --include="*.scss" \
  src/ public/ 2>/dev/null || echo "No markers found in source files"

echo ""
echo "📊 Competition-related Files:"
echo "-----------------------------"

# Check for competition files
files_to_check=(
  "public/leaderboard.html"
  "charts/top-zombie-challenge-october-2025.html"
  "COMPETITION-OCTOBER-2025.md"
  "scripts/check-competition-markers.sh"
)

for file in "${files_to_check[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ Found: $file"
  else
    echo "✗ Missing: $file"
  fi
done

echo ""
echo "🔗 Checking vercel.json for competition routes..."
echo "-------------------------------------------------"
if grep -q "leaderboard" vercel.json 2>/dev/null; then
  echo "⚠️  Found 'leaderboard' references in vercel.json:"
  grep -n "leaderboard" vercel.json
else
  echo "✓ No leaderboard routes found in vercel.json"
fi

echo ""
echo "🔍 Searching for 'competition' references in code..."
echo "----------------------------------------------------"
grep -rn -i "competition\|leaderboard\|top.zombie.challenge" \
  --include="*.vue" \
  --include="*.js" \
  src/ 2>/dev/null | head -20 || echo "No competition references found"

echo ""
echo "✅ Search complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review all found markers and files"
echo "  2. Update COMPETITION-OCTOBER-2025.md with any new findings"
echo "  3. After October 31, use this script before cleanup"
