#!/usr/bin/env node
'use strict';

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
    generatePatchFilename,
    convertToSpicePatch,
    parsePatcherFile,
} from './lib/convert.js';

/**
 * Paths to files from command-line arguments
 */
if (process.argv.length < 5)
{
    console.error('usage: convert.js <metadata> <patchers> <output>');
    process.exit(1);
}

const METADATA_DIR = process.argv[2];
const PATCHERS_DIR = process.argv[3];
const OUTPUT_DIR = process.argv[4];

/**
 * Ensure the output directory exists
 */
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

/**
 * Start iterating over metadata files
 */
for (const metaFile of fs.readdirSync(METADATA_DIR))
{
    if (!metaFile.endsWith('.json'))
        continue;

    const patchFile = path.join(PATCHERS_DIR, metaFile.slice(0, -4) + 'html');
    console.log(`\nProcessing HTML patcher file '${patchFile}'...`);

    if (!fs.existsSync(patchFile))
    {
        console.warn(`No matching patcher exists for metadata file '${metaFile}', skipping...`);
        continue;
    }

    const meta = JSON.parse(fs.readFileSync(path.join(METADATA_DIR, metaFile), { encoding: 'utf8' }));
    console.log(`Converting patches for '${meta.name}'...`);

    for (const patcher of parsePatcherFile(patchFile).patches)
    {
        if (!meta.patches[patcher.fname])
        {
            console.warn(`No metadata for file '${patcher.fname}' in '${metaFile}', skipping...`);
            continue;
        }

        if (!meta.patches[patcher.fname][patcher.description])
        {
            console.warn(`No metadata for file '${patcher.fname}' version '${patcher.description}' in '${metaFile}', skipping...`);
            continue;
        }

        const metaItem = meta.patches[patcher.fname][patcher.description];
        console.log(`Converting patches for '${patcher.fname}' version '${patcher.description}'...`);

        let convertedPatches = [];

        for (const patch of patcher.args)
        {
            const converted = convertToSpicePatch(patch, metaItem.GameCodePrefix, patcher.fname);

            if (!converted)
                continue;

            convertedPatches.push(converted);
        }

        const outputFilename = path.join(OUTPUT_DIR, generatePatchFilename(metaItem));
        const outputContents = JSON.stringify(convertedPatches, null, 4);

        let operation = 'Add';

        if (fs.existsSync(outputFilename))
        {
            if (fs.readFileSync(outputFilename, { encoding: 'utf8' }) === outputContents)
            {
                console.log(`Output file '${outputFilename}' is already up-to-date...`);
                continue;
            }

            operation = 'Update';
        }

        console.log(`Writing output file '${outputFilename}'...`);
        fs.writeFileSync(outputFilename, outputContents);

        if (process.env.GIT_NO_COMMIT)
            continue;

        execSync(`git add ${outputFilename}`);
        execSync(`git commit -m "${operation} ${meta.id} '${patcher.fname}' ${patcher.description} patches"`);
    }
}