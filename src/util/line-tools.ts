export function linesContain(lines: Array<string>, part: Array<string>): boolean {
  const lastIndex = lines.length - part.length;
  containerLoop: for (let containerIndex = 0; containerIndex <= lastIndex; containerIndex++) {
    for (let lineIndex = 0; lineIndex < part.length; lineIndex++) {
      const containerLine = lines[containerIndex + lineIndex];
      const line = part[lineIndex];
      if (containerLine.trim() !== line.trim()) {
        continue containerLoop;
      }
    }
    // All lines matched
    return true;
  }
  return false;
}

export function linesAreSame(here: Array<string>, there: Array<string>): boolean {
  if (here.length !== there.length) {
    return false;
  }
  for (let i = 0; i < here.length; i++) {
    if (here[i].trim() !== there[i].trim()) {
      return false;
    }
  }
  return true;
}
