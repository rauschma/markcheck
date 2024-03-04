import { parseMarkdown } from '../core/parse-markdown.js';
import { runParsedMarkdown } from '../core/run-entities.js';
import { LogLevel, StatusCounts, emptyMockShellData, type MockShellData } from '../entity/snippet.js';
import { Output } from './errors.js';

export function runParsedMarkdownForTests(absFilePath: string, md: string, mockShellData: null | MockShellData = emptyMockShellData()): StatusCounts {
  const statusCounts = new StatusCounts(absFilePath);
  const parsedMarkdown = parseMarkdown(md);
  runParsedMarkdown(Output.ignore(), absFilePath, LogLevel.Normal, parsedMarkdown, statusCounts, mockShellData);
  return statusCounts;
}
