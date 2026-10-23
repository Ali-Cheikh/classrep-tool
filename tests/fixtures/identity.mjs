import { state } from './state.mjs';
export { verifyRequestOrigin } from '../../node_modules/@netlify/identity/dist/main.js';
export async function getUser() { return state.user; }
