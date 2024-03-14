import { parseMarkdown } from '../src/core/parse-markdown.js';
import { runParsedMarkdown } from '../src/core/run-entities.js';
import { LogLevel, MarkcheckMockData, StatusCounts } from '../src/entity/snippet.js';
import { Output } from '../src/util/errors.js';

export type RunOptions = {
  markcheckMockData?: MarkcheckMockData,
  out?: Output,
};

export function runMarkdownForTests(absFilePath: string, md: string, opts: RunOptions = {}): StatusCounts {
  const markcheckMockData = opts.markcheckMockData ?? new MarkcheckMockData();
  const out = opts.out ?? Output.ignore();
  const statusCounts = new StatusCounts(absFilePath);
  const parsedMarkdown = parseMarkdown(md);
  runParsedMarkdown(out, absFilePath, LogLevel.Normal, parsedMarkdown, statusCounts, markcheckMockData);
  return statusCounts;
}
