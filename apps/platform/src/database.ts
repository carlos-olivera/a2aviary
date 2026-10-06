import {Pool, types} from 'pg';
// Better Auth rate timestamps use int8. pg otherwise returns strings, which can
// corrupt arithmetic (notably Retry-After). Audit IDs are read as text explicitly.
export function createPool(connectionString: string, options?: string) {
  const getTypeParser: typeof types.getTypeParser = (oid: number, format?: 'text' | 'binary') => {
    if (oid === 20 && format !== 'binary') return (value: string) => {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) throw new Error('Unsafe database integer');
      return number;
    };
    return types.getTypeParser(oid, format);
  };
  return new Pool({connectionString, options, max: 10, connectionTimeoutMillis: 5000,
    query_timeout: 5000, statement_timeout: 5000, types: {getTypeParser}});
}
