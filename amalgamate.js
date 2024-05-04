#!/usr/bin/env node
'use strict';

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execSync } from 'child_process';

/**
 * Paths to files from command-line arguments
 */
if (process.argv.length < 4)
{
    console.error('usage: amalgamate.js <input> <output>');
    process.exit(1);
}

const INPUT_DIR = process.argv[2];
const OUTPUT_DIR = process.argv[3];

/**
 * Ensure the output directory exists
 */
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Start iterating over input files
 */
let output = [];
let seenFileHashes = [];

for (const patchFile of fs.readdirSync(INPUT_DIR))
{
    if (!patchFile.endsWith('.json'))
        continue;

    const contents = fs.readFileSync(path.join(INPUT_DIR, patchFile), { encoding: 'utf8' });
    const hash = createHash('sha256').update(contents).digest('hex');

    if (seenFileHashes.includes(hash))
    {
        console.warn(`Duplicate patch found: ${patchFile} [${hash}]`);
        continue;
    }

    seenFileHashes.push(hash);

    for (const item of JSON.parse(contents))
    {
        output.push({
            dateCode: 0,
            description: item.description,
            gameCode: item.gameCode,
            name: item.name,
            patches: item.patches,
            preset: false,
            type: item.type,
            peIdentifier: path.basename(patchFile, '.json'),
        });
    }
}

/**
 * Write output file(s) - for now, only a combined file with all patches
 */
const outputFilename = path.join(OUTPUT_DIR, 'patches.json');
fs.writeFileSync(outputFilename, JSON.stringify(output, null, 4));

if (!process.env.GIT_NO_COMMIT)
{
    execSync(`git add ${outputFilename}`);
    execSync(`git commit -m "Update combined patches.json"`);
}