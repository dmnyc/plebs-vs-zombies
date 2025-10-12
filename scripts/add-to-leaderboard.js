#!/usr/bin/env node

/**
 * Add users to leaderboard from Nostr notes
 *
 * This script extracts user data from zombie purge notes and adds them to the leaderboard.
 * It updates both fetch-leaderboard-profiles.js and leaderboard.html automatically.
 *
 * Usage:
 *   node scripts/add-to-leaderboard.js <note-id-1> [note-id-2] [note-id-3] ...
 *
 * Examples:
 *   node scripts/add-to-leaderboard.js note1abc...
 *   node scripts/add-to-leaderboard.js note1abc... nevent1xyz... note1def...
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import readline from 'readline';
import { extractFromNote } from './extract-from-note.js';

/**
 * Prompt user for confirmation
 */
function prompt(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase().trim());
        });
    });
}

/**
 * Read and parse the fetch-leaderboard-profiles.js file
 */
function readFetchScript() {
    const content = readFileSync('scripts/fetch-leaderboard-profiles.js', 'utf-8');
    return content;
}

/**
 * Extract participants array from the script
 */
function extractParticipantsArray(content) {
    const match = content.match(/const participants = \[([\s\S]*?)\];/);
    if (!match) {
        throw new Error('Could not find participants array in fetch script');
    }
    return match[1];
}

/**
 * Parse participants from array content
 */
function parseParticipants(arrayContent) {
    const participants = [];
    const regex = /\{\s*npub:\s*"([^"]+)",\s*zombiesKilled:\s*(\d+)\s*\}/g;
    let match;
    while ((match = regex.exec(arrayContent)) !== null) {
        participants.push({
            npub: match[1],
            zombiesKilled: parseInt(match[2], 10)
        });
    }
    return participants;
}

/**
 * Check if participant already exists
 */
function participantExists(participants, npub) {
    return participants.some(p => p.npub === npub);
}

/**
 * Generate updated fetch script content
 */
function generateUpdatedFetchScript(content, newParticipants) {
    const currentArrayContent = extractParticipantsArray(content);
    const currentParticipants = parseParticipants(currentArrayContent);

    // Combine and sort by zombiesKilled descending
    const allParticipants = [...currentParticipants, ...newParticipants]
        .sort((a, b) => b.zombiesKilled - a.zombiesKilled);

    // Generate new array content
    const newArrayContent = allParticipants
        .map(p => `    { npub: "${p.npub}", zombiesKilled: ${p.zombiesKilled} }`)
        .join(',\n');

    // Replace the array in the content
    const newContent = content.replace(
        /const participants = \[[\s\S]*?\];/,
        `const participants = [\n${newArrayContent}\n];`
    );

    return newContent;
}

/**
 * Read the leaderboard HTML file
 */
function readLeaderboardHTML() {
    return readFileSync('public/leaderboard.html', 'utf-8');
}

/**
 * Extract participants array from HTML
 */
function extractHTMLParticipantsArray(content) {
    const match = content.match(/const participants = \[([\s\S]*?)\s*\];/);
    if (!match) {
        throw new Error('Could not find participants array in HTML file');
    }
    return match[0];
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('❌ Error: No note IDs provided\n');
        console.log('Usage: node scripts/add-to-leaderboard.js <note-id-1> [note-id-2] ...\n');
        console.log('Example:');
        console.log('  node scripts/add-to-leaderboard.js note1abc... nevent1xyz...');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🧟 PLEBS VS. ZOMBIES - LEADERBOARD UPDATER');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`📝 Processing ${args.length} note(s)...\n`);

    // Extract data from all notes
    const extractedData = [];
    const errors = [];

    for (let i = 0; i < args.length; i++) {
        const noteId = args[i];
        console.log(`[${i + 1}/${args.length}] Extracting from ${noteId.substring(0, 20)}...`);

        try {
            const data = await extractFromNote(noteId);
            extractedData.push(data);
            console.log(`   ✅ ${data.authorName}: ${data.zombiesKilled} kills\n`);
        } catch (error) {
            console.error(`   ❌ Failed: ${error.message}\n`);
            errors.push({ noteId, error: error.message });
        }
    }

    if (extractedData.length === 0) {
        console.error('❌ No data extracted successfully. Exiting.');
        process.exit(1);
    }

    // Check for duplicates
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 CHECKING FOR DUPLICATES');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const fetchScriptContent = readFetchScript();
    const currentArrayContent = extractParticipantsArray(fetchScriptContent);
    const currentParticipants = parseParticipants(currentArrayContent);

    const duplicates = [];
    const newParticipants = [];

    for (const data of extractedData) {
        if (participantExists(currentParticipants, data.npub)) {
            duplicates.push(data);
        } else {
            newParticipants.push({
                npub: data.npub,
                zombiesKilled: data.zombiesKilled
            });
        }
    }

    if (duplicates.length > 0) {
        console.log('⚠️  Found duplicates (already on leaderboard):');
        duplicates.forEach(d => {
            console.log(`   - ${d.authorName} (${d.zombiesKilled} kills)`);
        });
        console.log('');
    }

    if (newParticipants.length === 0) {
        console.log('ℹ️  No new participants to add (all are duplicates).');
        process.exit(0);
    }

    // Show preview
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`✨ PREVIEW: ${newParticipants.length} NEW PARTICIPANT(S) TO ADD`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    const previewTable = extractedData
        .filter(d => !participantExists(currentParticipants, d.npub))
        .map((d, i) => {
            const rank = i + 1;
            const name = d.authorName.padEnd(25);
            const kills = String(d.zombiesKilled).padStart(4);
            const npubShort = d.npub.substring(0, 12) + '...';
            return `   ${rank}. ${name} ${kills} kills  (${npubShort})`;
        })
        .join('\n');

    console.log(previewTable);
    console.log('');

    if (errors.length > 0) {
        console.log('⚠️  Errors encountered:');
        errors.forEach(e => {
            console.log(`   - ${e.noteId.substring(0, 20)}...: ${e.error}`);
        });
        console.log('');
    }

    // Confirm
    const answer = await prompt(`\n❓ Add these ${newParticipants.length} participant(s) to the leaderboard? (y/n): `);

    if (answer !== 'y' && answer !== 'yes') {
        console.log('\n❌ Cancelled. No changes made.');
        process.exit(0);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔄 UPDATING LEADERBOARD');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Update fetch-leaderboard-profiles.js
    console.log('1️⃣  Updating fetch-leaderboard-profiles.js...');
    const updatedFetchScript = generateUpdatedFetchScript(fetchScriptContent, newParticipants);
    writeFileSync('scripts/fetch-leaderboard-profiles.js', updatedFetchScript, 'utf-8');
    console.log('   ✅ Updated\n');

    // Run the fetch script to get profiles
    console.log('2️⃣  Fetching profiles from Nostr...');
    try {
        const output = execSync('node scripts/fetch-leaderboard-profiles.js', {
            encoding: 'utf-8',
            timeout: 60000
        });

        // Extract the JavaScript array from the output
        const arrayMatch = output.match(/const participants = \[([\s\S]*?)\];/);
        if (!arrayMatch) {
            throw new Error('Could not extract participants array from fetch script output');
        }

        const fullArrayContent = arrayMatch[0];

        // Update leaderboard.html
        console.log('\n3️⃣  Updating leaderboard.html...');
        const htmlContent = readLeaderboardHTML();
        const currentHTMLArray = extractHTMLParticipantsArray(htmlContent);
        const updatedHTMLContent = htmlContent.replace(currentHTMLArray, fullArrayContent);
        writeFileSync('public/leaderboard.html', updatedHTMLContent, 'utf-8');
        console.log('   ✅ Updated\n');

    } catch (error) {
        console.error('❌ Error running fetch script:', error.message);
        console.log('\n⚠️  fetch-leaderboard-profiles.js has been updated, but leaderboard.html update failed.');
        console.log('   You may need to run the fetch script manually and update the HTML.');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ LEADERBOARD UPDATED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log(`Added ${newParticipants.length} new participant(s) to the leaderboard.\n`);

    // Show git diff
    console.log('📊 Git changes:');
    console.log('═══════════════════════════════════════════════════════════════\n');

    try {
        const diff = execSync('git diff --stat', { encoding: 'utf-8' });
        console.log(diff);
        console.log('\nRun `git diff` to see detailed changes.');
        console.log('Run `git status` to see modified files.');
    } catch (error) {
        console.log('Could not get git diff. Run `git diff` manually to see changes.');
    }

    console.log('');
}

// Run
main().catch(error => {
    console.error('\n❌ Fatal error:', error.message);
    process.exit(1);
});
