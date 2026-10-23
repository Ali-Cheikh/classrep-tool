export const state = { user: null, commentsPublic: undefined, rows: [], queries: [], fail: false };
export function reset() {
  Object.assign(state, { user: null, commentsPublic: undefined, rows: [], queries: [], fail: false });
}
