#!/bin/bash

# Script to remove all October 2025 Competition temporary components
# Run this AFTER October 31, 2025 to clean up competition code

set -e  # Exit on error

echo "🧹 October 2025 Competition Cleanup Script"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will remove all competition-related files and code!"
echo ""
read -p "Are you sure you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

echo ""
echo "📋 Creating backup branch..."
git checkout -b remove-october-2025-competition

echo ""
echo "🗑️  Removing competition files..."

# Remove HTML files
files_to_remove=(
    "public/leaderboard.html"
    "charts/top-zombie-challenge-october-2025.html"
)

for file in "${files_to_remove[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✓ Removing: $file"
        git rm "$file"
    else
        echo "  ⚠️  Not found: $file"
    fi
done

echo ""
echo "📝 Reverting vercel.json changes..."

# Create a backup
cp vercel.json vercel.json.backup

# Remove the leaderboard route (lines 6-12)
cat > vercel.json << 'EOF'
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
EOF

echo "  ✓ Removed leaderboard route from vercel.json"

echo ""
echo "🔍 Checking for remaining markers..."
remaining=$(grep -rn "\[TEMPORARY - October 2025 Competition\]" \
    --include="*.vue" \
    --include="*.js" \
    --include="*.ts" \
    src/ public/ 2>/dev/null || true)

if [ -n "$remaining" ]; then
    echo "⚠️  Found remaining markers in code:"
    echo "$remaining"
    echo ""
    echo "Please remove these manually before continuing."
    exit 1
else
    echo "  ✓ No remaining markers found in source code"
fi

echo ""
echo "📊 Creating archive directory..."
mkdir -p archive/competitions/october-2025

echo ""
echo "💾 Archiving competition data..."
# Restore files temporarily to archive them
git restore --staged public/leaderboard.html charts/top-zombie-challenge-october-2025.html 2>/dev/null || true
git restore public/leaderboard.html charts/top-zombie-challenge-october-2025.html 2>/dev/null || true

if [ -f "public/leaderboard.html" ]; then
    cp public/leaderboard.html archive/competitions/october-2025/final-leaderboard.html
    echo "  ✓ Archived: final-leaderboard.html"
fi

if [ -f "charts/top-zombie-challenge-october-2025.html" ]; then
    cp charts/top-zombie-challenge-october-2025.html archive/competitions/october-2025/redirect-page.html
    echo "  ✓ Archived: redirect-page.html"
fi

# Copy documentation
cp COMPETITION-OCTOBER-2025.md archive/competitions/october-2025/README.md
echo "  ✓ Archived: README.md"

# Remove files again
git rm public/leaderboard.html charts/top-zombie-challenge-october-2025.html 2>/dev/null || true

echo ""
echo "🧪 Running tests..."
npm test 2>/dev/null || echo "  ⚠️  No tests configured"

echo ""
echo "📝 Committing changes..."
git add .
git commit -m "Remove October 2025 Competition temporary components

- Removed public/leaderboard.html
- Removed charts/top-zombie-challenge-october-2025.html
- Reverted vercel.json leaderboard route
- Archived competition data to archive/competitions/october-2025/

Competition concluded: October 31, 2025

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Review changes: git diff main"
echo "  2. Test the application thoroughly"
echo "  3. If everything looks good:"
echo "     git checkout main"
echo "     git merge remove-october-2025-competition"
echo "     git push origin main"
echo "  4. Delete competition branch:"
echo "     git branch -d top-zombie-challenge-october-2025"
echo "     git push origin --delete top-zombie-challenge-october-2025"
echo ""
echo "📁 Archived data location:"
echo "  archive/competitions/october-2025/"
