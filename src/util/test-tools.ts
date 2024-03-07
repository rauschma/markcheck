import { parseMarkdown } from '../core/parse-markdown.js';
import { runParsedMarkdown } from '../core/run-entities.js';
import { LogLevel, StatusCounts, emptyMockShellData, type MockShellData } from '../entity/snippet.js';
import { Output } from './errors.js';

export type RunOptions = {
  mockShellData?: MockShellData,
  out?: Output,
};

export function runMarkdownForTests(absFilePath: string, md: string, opts: RunOptions = {}): StatusCounts {
  const mockShellData = opts.mockShellData ?? emptyMockShellData();
  const out = opts.out ?? Output.ignore();
  const statusCounts = new StatusCounts(absFilePath);
  const parsedMarkdown = parseMarkdown(md);
  runParsedMarkdown(out, absFilePath, LogLevel.Normal, parsedMarkdown, statusCounts, mockShellData);
  return statusCounts;
}
