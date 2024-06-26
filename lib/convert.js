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
{
    return [
             meta.GameCodePrefix,
        '-', meta.TimeDateStamp.toString(16),
        '_', meta.AddressOfEntryPoint.toString(16),
    ].join('') + '.json';
}

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
    let result = {};

    result.name = patch.name;
    result.description = patch.tooltip || '';

    if (patch.danger)
        result.caution = patch.danger || '';

    result.gameCode = prefix;

    if ('type' in patch)
    {
        if (patch.type === 'union')
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
        else if (patch.type === 'number')
        {
            result.type = 'number';
            result.patch = {
                dllName: dll,
                offset: patch.offset,
                min: patch.min,
                max: patch.max,
                size: patch.size,
            };
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