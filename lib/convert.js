'use strict';

import fs from 'fs';
import vm from 'vm';
import * as cheerio from 'cheerio';

/**
 * Convert a byte array to a hex string usable by spice2x
 */
const formatPatchBytes = (bytes) =>
    bytes.map(byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase();

/**
 * Generate a unique filename using components from the PE file header
 */
export const generatePatchFilename = (meta) =>
    `${meta.TimeDateStamp}${meta.AddressOfEntryPoint}.json`;

/**
 * Extract a list of patches from an HTML patcher file
 */
export const parsePatcherFile = (file) =>
{
    const html = fs.readFileSync(file, { encoding: 'utf8' });
    const document = cheerio.load(html);

    let script = '';
    let result = { title: document('title').text(), patches: [] };

    for (const element of document('script').get())
    {
        const code = document(element).html();

        if (!code.includes('new PatchContainer'))
            continue;

        if (!code.includes('new Patcher'))
            continue;

        script += code + '\n';
    }

    if (!script)
    {
        console.warn(`Failed to find any BemaniPatcher script blocks in '${file}'!`);
        return result;
    }

    const context = { store: (fname, description, args) => result.patches.push({ fname, description, args }) };
    const bootstrap =
        `const window = { addEventListener: (type, callback) => callback() };
         const Patcher = function(fname, description, args) { store(fname, description, args); };
         const PatchContainer = function(patchers) {};`;

    vm.createContext(context);

    vm.runInContext(bootstrap, context);
    vm.runInContext(script, context);

    return result;
}

/**
 * Translate a single patch into a format usable by spice2x
 */
export const convertToSpicePatch = (patch, prefix, dll) =>
{
    if ('type' in patch && patch.type === 'number')
        return console.warn(`Number patch '${patch.name}' can not be converted, skipping...`);

    let result = { name: patch.name, description: patch.tooltip || '', gameCode: prefix };

    if ('type' in patch && patch.type === 'union')
    {
        result.type = 'union';
        result.patches = [];

        for (const item of patch.patches)
        {
            result.patches.push({
                name: item.name,
                type: 'union',
                patch: {
                    dllName: dll,
                    data: formatPatchBytes(item.patch),
                    offset: patch.offset,
                }
            });
        }
    }
    else
    {
        result.type = 'memory';
        result.patches = [];

        for (const item of patch.patches)
        {
            result.patches.push({
                offset: item.offset,
                dllName: dll,
                dataDisabled: formatPatchBytes(item.off),
                dataEnabled: formatPatchBytes(item.on),
            });
        }
    }

    return result;
}