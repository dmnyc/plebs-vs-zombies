#!/usr/bin/env node

/**
 * Validate leaderboard data consistency across all files
 *
 * This script ensures that:
 * 1. ALL users in fetch-leaderboard-profiles.js are present in leaderboard.html
 * 2. Zombie kill counts match between both files
 * 3. Protected entries are never removed
 *
 * Usage: node scripts/validate-protected-entries.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Protected entries that must NEVER be removed
const PROTECTED_ENTRIES = [
    {
        npub: "npub1g9uxfl9ucrksgem38ne533qrmkv3g8wezzx4urhutactyxfzz7wsafz3nr",
        name: "₿33Zy ₿",
        reason: "Profile not available on relays, manually added"
    }
];

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  Leaderboard Data Consistency Validator               ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

let hasErrors = false;
let hasWarnings = false;

// Extract participants array from fetch-leaderboard-profiles.js
function extractParticipantsFromJS() {
    const jsContent = readFileSync(
        join(__dirname, 'fetch-leaderboard-profiles.js'),
        'utf8'
    );

    // Extract the participants array using regex
    const participantsMatch = jsContent.match(/const participants = \[([\s\S]*?)\];/);
    if (!participantsMatch) {
        throw new Error('Could not find participants array in fetch-leaderboard-profiles.js');
    }

    // Parse each participant entry
    const participantsText = participantsMatch[1];
    const participants = [];

    // Match each participant object
    const entryRegex = /\{\s*npub:\s*"([^"]+)"[^}]*zombiesKilled:\s*(\d+)/g;
    let match;

    while ((match = entryRegex.exec(participantsText)) !== null) {
        participants.push({
            npub: match[1],
            zombiesKilled: parseInt(match[2], 10)
        });
    }

    return participants;
}

// Extract participants from leaderboard.html
function extractParticipantsFromHTML() {
    const htmlContent = readFileSync(
        join(__dirname, '../public/leaderboard.html'),
        'utf8'
    );

    // Extract the participants array
    const participantsMatch = htmlContent.match(/const participants = \[([\s\S]*?)\];/);
    if (!participantsMatch) {
        throw new Error('Could not find participants array in leaderboard.html');
    }

    const participantsText = participantsMatch[1];
    const participants = [];

    // Match each participant object
    const entryRegex = /\{\s*name:[^}]*npub:\s*"([^"]+)"[^}]*zombiesKilled:\s*(\d+)/g;
    let match;

    while ((match = entryRegex.exec(participantsText)) !== null) {
        participants.push({
            npub: match[1],
            zombiesKilled: parseInt(match[2], 10)
        });
    }

    return participants;
}

console.log('📊 Extracting participant data from both files...\n');

let jsParticipants, htmlParticipants;

try {
    jsParticipants = extractParticipantsFromJS();
    console.log(`   ✅ Loaded ${jsParticipants.length} entries from fetch-leaderboard-profiles.js`);
} catch (error) {
    console.error(`   ❌ Error reading JS file: ${error.message}`);
    hasErrors = true;
}

try {
    htmlParticipants = extractParticipantsFromHTML();
    console.log(`   ✅ Loaded ${htmlParticipants.length} entries from leaderboard.html\n`);
} catch (error) {
    console.error(`   ❌ Error reading HTML file: ${error.message}`);
    hasErrors = true;
}

if (hasErrors) {
    console.error('\n❌ VALIDATION FAILED - Could not read participant data\n');
    process.exit(1);
}

console.log('═══════════════════════════════════════════════════════════════');
console.log('🔍 Validating data consistency...\n');

// Create maps for quick lookup
const jsMap = new Map(jsParticipants.map(p => [p.npub, p]));
const htmlMap = new Map(htmlParticipants.map(p => [p.npub, p]));

// Check 1: Verify all JS entries are in HTML
console.log('📝 Checking: All JS entries present in HTML...\n');
let missingInHTML = [];
for (const jsEntry of jsParticipants) {
    if (!htmlMap.has(jsEntry.npub)) {
        missingInHTML.push(jsEntry);
        console.error(`   ❌ Missing in HTML: ${jsEntry.npub.substring(0, 16)}... (${jsEntry.zombiesKilled} kills)`);
        hasErrors = true;
    }
}
if (missingInHTML.length === 0) {
    console.log('   ✅ All JS entries found in HTML');
}

console.log('');

// Check 2: Verify all HTML entries are in JS
console.log('📝 Checking: All HTML entries present in JS...\n');
let missingInJS = [];
for (const htmlEntry of htmlParticipants) {
    if (!jsMap.has(htmlEntry.npub)) {
        missingInJS.push(htmlEntry);
        console.warn(`   ⚠️  Extra in HTML: ${htmlEntry.npub.substring(0, 16)}... (${htmlEntry.zombiesKilled} kills)`);
        hasWarnings = true;
    }
}
if (missingInJS.length === 0) {
    console.log('   ✅ All HTML entries found in JS');
}

console.log('');

// Check 3: Verify zombie kill counts match
console.log('📝 Checking: Zombie kill counts match...\n');
let mismatchedCounts = [];
for (const jsEntry of jsParticipants) {
    const htmlEntry = htmlMap.get(jsEntry.npub);
    if (htmlEntry && htmlEntry.zombiesKilled !== jsEntry.zombiesKilled) {
        mismatchedCounts.push({
            npub: jsEntry.npub,
            jsKills: jsEntry.zombiesKilled,
            htmlKills: htmlEntry.zombiesKilled
        });
        console.error(`   ❌ Mismatch: ${jsEntry.npub.substring(0, 16)}...`);
        console.error(`      JS: ${jsEntry.zombiesKilled} kills | HTML: ${htmlEntry.zombiesKilled} kills`);
        hasErrors = true;
    }
}
if (mismatchedCounts.length === 0) {
    console.log('   ✅ All zombie kill counts match');
}

console.log('');

// Check 4: Verify protected entries are present in both
console.log('📝 Checking: Protected entries present...\n');
for (const protectedEntry of PROTECTED_ENTRIES) {
    const inJS = jsMap.has(protectedEntry.npub);
    const inHTML = htmlMap.has(protectedEntry.npub);

    if (!inJS || !inHTML) {
        console.error(`   ❌ ${protectedEntry.name} - MISSING!`);
        console.error(`      Present in JS: ${inJS ? 'YES' : 'NO'}`);
        console.error(`      Present in HTML: ${inHTML ? 'YES' : 'NO'}`);
        console.error(`      Reason: ${protectedEntry.reason}\n`);
        hasErrors = true;
    } else {
        console.log(`   ✅ ${protectedEntry.name} - present in both files`);
    }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('📊 SUMMARY\n');

console.log(`   Total entries in JS:   ${jsParticipants.length}`);
console.log(`   Total entries in HTML: ${htmlParticipants.length}`);
console.log(`   Missing in HTML:       ${missingInHTML.length}`);
console.log(`   Extra in HTML:         ${missingInJS.length}`);
console.log(`   Mismatched counts:     ${mismatchedCounts.length}`);

console.log('\n═══════════════════════════════════════════════════════════════\n');

if (hasErrors) {
    console.error('❌ VALIDATION FAILED\n');
    console.error('The leaderboard data is inconsistent between files.');
    console.error('Please fix the errors above before committing.\n');
    process.exit(1);
} else if (hasWarnings) {
    console.warn('⚠️  VALIDATION PASSED WITH WARNINGS\n');
    console.warn('There are some inconsistencies that should be reviewed.\n');
    process.exit(0);
} else {
    console.log('✅ VALIDATION PASSED\n');
    console.log('All leaderboard data is consistent across both files.\n');
    process.exit(0);
}
