#!/usr/bin/env node
'use strict';

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
    generatePatchFilename,
    parsePatcherFile,
} from './lib/convert.js';

/**
 * Constants
 */
const UPSTREAM_SRC_URL = 'https://mon.im/bemanipatcher';
const METADATA_SRC_URL = 'metadata';
const CONVERTED_SRC_URL = 'output';

/**
 * Files we should ignore for one reason or another
 */
const HTML_IGNORE_LIST = [
    // currently unsupported games
    // https://github.com/spice2x/spice2x.github.io/wiki/List-of-supported-games
    'bishibashi.html',
    'ddrx.html',
    'gfdmv4.html',
    'gfdmv5.html',
    'gfdmv6.html',
    'gfdmv7.html',
    'gfdmv8.html',
    'gfdmxg2.html',
    'gfdmxg3.html',
    'jubeatripples.html',

    // eacloud
    'bombergirl.html',

    // non-konami games
    'chuniair.html',
    'chuniairplus.html',
    'chuniamazon.html',
    'chuniamazonplus.html',
    'chunicrystal.html',
    'chunicrystalplus.html',
    'chuni.html',
    'chuniparadise.html',
    'chuniplus.html',
    'chunistar.html',
    'chunistarplus.html',
    'chusan.html',
    'chusannewplus.html',
    'chusansun.html',
    'chusansunplus.html',
    'futuretone.html',
    'gc4ex.html',
    'initialdzero.html',
    'kancolle.html',
    'taikonotatsujin.html',
    'waccareverse.html',

    // non-patcher files
    'index.html',
]

/**
 * Paths to files from command-line arguments
 */
if (process.argv.length < 5)
{
    console.error('usage: status.js <metadata> <patchers> <output>');
    process.exit(1);
}

const METADATA_DIR = process.argv[2];
const PATCHERS_DIR = process.argv[3];
const OUTPUT_FILE = process.argv[4];

/**
 * Storage for Markdown text
 */
let output = [
    '# Conversion compatibility table\n',
    'Adapting patches into spice2x format requires some data from the target file. These are stored in the repository as metadata files, which can be viewed from the `Filename` column below.\n',
    'The list below documents how many upstream patches are actively being converted to spice2x format.\n',
    'The contents of this file are generated automatically.\n',
    '## Patcher list\n',
];

for (const patchFile of fs.readdirSync(PATCHERS_DIR))
{
    if (!patchFile.endsWith('.html') || HTML_IGNORE_LIST.includes(patchFile))
        continue;

    let table = [];
    let versions = 0;

    const metaFile = path.join(METADATA_DIR, patchFile.slice(0, -4) + 'json');
    const patcherData = parsePatcherFile(path.join(PATCHERS_DIR, patchFile));

    table.push(`### [${patcherData.title}](${UPSTREAM_SRC_URL}/${patchFile})\n`);
    table.push('| Status | Filename | Version |');
    table.push('| :---:  |----------|---------|');

    let metaData = null;

    if (fs.existsSync(metaFile))
        metaData = JSON.parse(fs.readFileSync(metaFile, { encoding: 'utf8' }));

    for (const patcher of patcherData.patches)
    {
        let patchMeta = null;

        if (metaData && metaData.patches[patcher.fname] && metaData.patches[patcher.fname][patcher.description])
            patchMeta = metaData.patches[patcher.fname][patcher.description];

        if (patchMeta && Array.isArray(patchMeta))
            patchMeta = patchMeta[0]; // The output is identical across all array entries, so just use the first one

        let status = '❌';
        let filename = patcher.fname;
        let version = patcher.description;

        if (metaData && metaData.patches[patcher.fname])
        {
            filename = `[${filename}](${METADATA_SRC_URL}/${path.basename(metaFile)})`;

            if (patchMeta)
            {
                status = '✅';
                version = `[${version}](${CONVERTED_SRC_URL}/${generatePatchFilename(patchMeta)})`;
            }
        }

        table.push(`| ${status} | ${filename} | ${version} |`);
        ++versions;
    }

    if (!versions)
        continue;

    table.push('\n');
    output.push(table.join('\n'));
}

const outputContents = output.join('\n');

if (fs.existsSync(OUTPUT_FILE))
{
    if (fs.readFileSync(OUTPUT_FILE, { encoding: 'utf8' }) === outputContents)
    {
        console.log(`Output file '${OUTPUT_FILE}' is already up-to-date...`);
        process.exit(0);
    }
}

console.log(`Writing output file '${OUTPUT_FILE}'...`);
fs.writeFileSync(OUTPUT_FILE, outputContents);

if (process.env.GIT_NO_COMMIT)
    process.exit(0);

execSync(`git add ${OUTPUT_FILE}`);
execSync(`git commit -m "Update conversion compatibility table"`);