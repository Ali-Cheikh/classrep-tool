import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// Test-only dependency substitution. Production handlers and schema run unchanged.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@netlify/identity') {
    return { url: new URL('./fixtures/identity.mjs', import.meta.url).href, shortCircuit: true };
  }
  if (specifier.endsWith('/db/index.js')) {
    return { url: new URL('./fixtures/database.mjs', import.meta.url).href, shortCircuit: true };
  }
  try { return await nextResolve(specifier, context); }
  catch (error) {
    if (specifier.endsWith('.js') && specifier.startsWith('.')) {
      return nextResolve(specifier.slice(0, -3) + '.ts', context);
    }
    throw error;
  }
}

export async function load(url, context, nextLoad) {
  if (/\.(?:ts|mts)$/.test(url)) {
    return { format: 'module', source: stripTypeScriptTypes(await readFile(new URL(url), 'utf8')), shortCircuit: true };
  }
  return nextLoad(url, context);
}
