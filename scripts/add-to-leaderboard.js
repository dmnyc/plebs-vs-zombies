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
    // Updated regex to optionally capture processedEventIds array
    const regex = /\{\s*npub:\s*"([^"]+)",\s*zombiesKilled:\s*(\d+)(?:\s*,\s*processedEventIds:\s*(\[[^\]]*\]))?\s*\}/g;
    let match;
    while ((match = regex.exec(arrayContent)) !== null) {
        const processedEventIds = match[3] ? JSON.parse(match[3]) : [];
        participants.push({
            npub: match[1],
            zombiesKilled: parseInt(match[2], 10),
            processedEventIds
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
function generateUpdatedFetchScript(content, newParticipants, updatedParticipants) {
    const currentArrayContent = extractParticipantsArray(content);
    const currentParticipants = parseParticipants(currentArrayContent);

    // Apply updates to existing participants
    for (const participant of currentParticipants) {
        const update = updatedParticipants.find(u => u.npub === participant.npub);
        if (update) {
            participant.zombiesKilled = update.totalKills;
            participant.processedEventIds = [...participant.processedEventIds, ...update.newEventIds];
        }
    }

    // Combine and sort by zombiesKilled descending
    const allParticipants = [...currentParticipants, ...newParticipants]
        .sort((a, b) => b.zombiesKilled - a.zombiesKilled);

    // Generate new array content with processedEventIds
    const newArrayContent = allParticipants
        .map(p => {
            const eventIdsStr = JSON.stringify(p.processedEventIds || []);
            return `    { npub: "${p.npub}", zombiesKilled: ${p.zombiesKilled}, processedEventIds: ${eventIdsStr} }`;
        })
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

    // Consolidate multiple notes from the same user (sum kills, track event IDs)
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 CONSOLIDATING BATCH');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const npubMap = new Map();
    const consolidatedNotes = [];

    for (const data of extractedData) {
        if (npubMap.has(data.npub)) {
            const existing = npubMap.get(data.npub);
            // Sum the kills from multiple notes
            const totalKills = existing.zombiesKilled + data.zombiesKilled;
            consolidatedNotes.push({
                npub: data.npub,
                authorName: data.authorName,
                note1Kills: existing.zombiesKilled,
                note2Kills: data.zombiesKilled,
                totalKills: totalKills
            });
            npubMap.set(data.npub, {
                ...existing,
                zombiesKilled: totalKills,
                eventIds: [...existing.eventIds, data.eventId]
            });
        } else {
            npubMap.set(data.npub, {
                ...data,
                eventIds: [data.eventId]
            });
        }
    }

    if (consolidatedNotes.length > 0) {
        console.log('⚠️  Multiple notes from same user(s) detected:');
        consolidatedNotes.forEach(c => {
            console.log(`   - ${c.authorName}: Summing kills (${c.note1Kills} + ${c.note2Kills} = ${c.totalKills} total)`);
        });
        console.log('');
    } else {
        console.log('✅ No multiple notes within batch\n');
    }

    // Use consolidated data
    const consolidatedData = Array.from(npubMap.values());

    // Check for existing entries and update them, or add new ones
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 CHECKING AGAINST EXISTING LEADERBOARD');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const fetchScriptContent = readFetchScript();
    const currentArrayContent = extractParticipantsArray(fetchScriptContent);
    const currentParticipants = parseParticipants(currentArrayContent);

    const updates = [];
    const newParticipants = [];
    const skippedEvents = [];

    for (const data of consolidatedData) {
        const existingParticipant = currentParticipants.find(p => p.npub === data.npub);
        if (existingParticipant) {
            // Filter out already-processed events
            const newEventIds = data.eventIds.filter(id =>
                !existingParticipant.processedEventIds.includes(id)
            );

            if (newEventIds.length === 0) {
                skippedEvents.push({
                    npub: data.npub,
                    authorName: data.authorName,
                    reason: 'All events already processed'
                });
                continue;
            }

            // Calculate kills only from new events
            const newKills = extractedData
                .filter(e => e.npub === data.npub && newEventIds.includes(e.eventId))
                .reduce((sum, e) => sum + e.zombiesKilled, 0);

            const newTotal = existingParticipant.zombiesKilled + newKills;

            updates.push({
                npub: data.npub,
                authorName: data.authorName,
                oldKills: existingParticipant.zombiesKilled,
                newKills: newKills,
                totalKills: newTotal,
                newEventIds: newEventIds
            });

            // Update the participant in the array
            existingParticipant.zombiesKilled = newTotal;
            existingParticipant.processedEventIds = [...existingParticipant.processedEventIds, ...newEventIds];
        } else {
            newParticipants.push({
                npub: data.npub,
                zombiesKilled: data.zombiesKilled,
                processedEventIds: data.eventIds
            });
        }
    }

    if (skippedEvents.length > 0) {
        console.log('⏭️  Skipping already-processed events:');
        skippedEvents.forEach(s => {
            console.log(`   - ${s.authorName}: ${s.reason}`);
        });
        console.log('');
    }

    if (updates.length > 0) {
        console.log('🔄 Found existing participants - updating totals:');
        updates.forEach(u => {
            console.log(`   - ${u.authorName}: ${u.oldKills} + ${u.newKills} = ${u.totalKills} kills (${u.newEventIds.length} new event(s))`);
        });
        console.log('');
    }

    if (newParticipants.length === 0 && updates.length === 0) {
        console.log('ℹ️  No changes needed.');
        process.exit(0);
    }

    // Show preview
    console.log('═══════════════════════════════════════════════════════════════');
    const changeCount = newParticipants.length + updates.length;
    const changeType = newParticipants.length > 0 && updates.length > 0 ? 'NEW + UPDATED' :
                       newParticipants.length > 0 ? 'NEW' : 'UPDATED';
    console.log(`✨ PREVIEW: ${changeCount} ${changeType} PARTICIPANT(S)`);
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (newParticipants.length > 0) {
        console.log('🆕 New participants:');
        const newData = consolidatedData.filter(d => !currentParticipants.some(p => p.npub === d.npub));
        newData.forEach((d, i) => {
            const rank = i + 1;
            const name = d.authorName.padEnd(25);
            const kills = String(d.zombiesKilled).padStart(4);
            const npubShort = d.npub.substring(0, 12) + '...';
            console.log(`   ${rank}. ${name} ${kills} kills  (${npubShort})`);
        });
        console.log('');
    }

    if (updates.length > 0) {
        console.log('🔄 Updated participants:');
        updates.forEach((u, i) => {
            const rank = i + 1;
            const name = u.authorName.padEnd(25);
            console.log(`   ${rank}. ${name} ${u.oldKills} → ${u.totalKills} kills (+${u.newKills})`);
        });
        console.log('');
    }

    if (errors.length > 0) {
        console.log('⚠️  Errors encountered:');
        errors.forEach(e => {
            console.log(`   - ${e.noteId.substring(0, 20)}...: ${e.error}`);
        });
        console.log('');
    }

    // Confirm
    const answer = await prompt(`\n❓ Apply these ${changeCount} change(s) to the leaderboard? (y/n): `);

    if (answer !== 'y' && answer !== 'yes') {
        console.log('\n❌ Cancelled. No changes made.');
        process.exit(0);
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('🔄 UPDATING LEADERBOARD');
    console.log('═══════════════════════════════════════════════════════════════\n');

    // Update fetch-leaderboard-profiles.js
    console.log('1️⃣  Updating fetch-leaderboard-profiles.js...');
    const updatedFetchScript = generateUpdatedFetchScript(fetchScriptContent, newParticipants, updates);
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

    if (newParticipants.length > 0) {
        console.log(`✨ Added ${newParticipants.length} new participant(s)`);
    }
    if (updates.length > 0) {
        console.log(`🔄 Updated ${updates.length} existing participant(s)`);
    }
    console.log('');

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
