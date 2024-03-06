import * as path from 'node:path';

export function relPath(absPath: string) {
  return path.relative(process.cwd(), absPath);
}
