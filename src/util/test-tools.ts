import { parseMarkdown } from '../core/parse-markdown.js';
import { runParsedMarkdown } from '../core/run-snippets.js';
import { LogLevel, StatusCounts } from '../entity/snippet.js';
import { Output } from './errors.js';

export function runParsedMarkdownForTests(absFilePath: string, md: string, interceptedShellCommands: null | Array<Array<string>> = []): StatusCounts {
  const statusCounts = new StatusCounts(absFilePath);
  const parsedMarkdown = parseMarkdown(md);
  runParsedMarkdown(Output.ignore(), absFilePath, LogLevel.Normal, parsedMarkdown, statusCounts, interceptedShellCommands);
  return statusCounts;
}
