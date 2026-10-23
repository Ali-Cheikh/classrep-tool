import { state } from './state.mjs';
import { votes, pollSettings } from '../../db/schema.js';

export function getDb() {
  if (state.fail) throw new Error('Simulated database outage');
  return {
    select(fields) {
      return {
        from(table) {
          state.queries.push({ table, fields });
          let rows;
          if (table === pollSettings) {
            rows = state.commentsPublic === undefined ? [] : [{ commentsPublic: state.commentsPublic }];
          } else if (fields?.approve) {
            rows = [{ approve: state.rows.filter(row => row.vote === 'Approve').length,
              disapprove: state.rows.filter(row => row.vote === 'Disapprove').length }];
          } else {
            rows = state.rows.map(row => fields ? Object.fromEntries(Object.keys(fields).map(key => [key, row[key]])) : row);
          }
          const result = Promise.resolve(rows);
          result.where = () => result;
          result.orderBy = () => result;
          return result;
        },
      };
    },
    insert(table) {
      return {
        values(value) {
          return {
            async onConflictDoUpdate() {
              if (table === pollSettings) { state.commentsPublic = value.commentsPublic; return; }
              if (table === votes) {
                const index = state.rows.findIndex(row => row.email === value.email);
                const row = { ...value, updatedAt: new Date('2026-10-23T00:00:00Z') };
                if (index < 0) state.rows.push(row); else state.rows[index] = row;
              }
            },
          };
        },
      };
    },
  };
}
