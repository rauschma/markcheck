// The actual API is documented at the end of this file

/**
 * @see https://en.wikipedia.org/wiki/ANSI_escape_code#SGR_(Select_Graphic_Rendition)_parameters
 */
class Ink extends Function {

  //----- Attributes -----

  get Normal(): InkResult { return this._newFunc(0) }
  get Bold(): InkResult { return this._newFunc(1) }
  get Faint(): InkResult { return this._newFunc(2) }
  get Italic(): InkResult { return this._newFunc(2) }
  get Underline(): InkResult { return this._newFunc(4) }
  get Blink(): InkResult { return this._newFunc(5) }
  get Reverse(): InkResult { return this._newFunc(7) }
  get Conceal(): InkResult { return this._newFunc(8) }
  get CrossedOut(): InkResult { return this._newFunc(9) }
  get DoublyUnderlined(): InkResult { return this._newFunc(21) }

  //----- Foreground colors -----

  get FgBlack(): InkResult { return this._newFunc(30) }
  get FgRed(): InkResult { return this._newFunc(31) }
  get FgGreen(): InkResult { return this._newFunc(32) }
  get FgYellow(): InkResult { return this._newFunc(33) }
  get FgBlue(): InkResult { return this._newFunc(34) }
  get FgMagenta(): InkResult { return this._newFunc(35) }
  get FgCyan(): InkResult { return this._newFunc(36) }
  get FgWhite(): InkResult { return this._newFunc(37) }

  FgColorCode(code: number): InkResult { return this._newFunc(38, 5, code) }

  /** Gray */
  get FgBrightBlack(): InkResult { return this._newFunc(90) }
  get FgBrightRed(): InkResult { return this._newFunc(91) }
  get FgBrightGreen(): InkResult { return this._newFunc(92) }
  get FgBrightYellow(): InkResult { return this._newFunc(93) }
  get FgBrightBlue(): InkResult { return this._newFunc(94) }
  get FgBrightMagenta(): InkResult { return this._newFunc(95) }
  get FgBrightCyan(): InkResult { return this._newFunc(96) }
  get FgBrightWhite(): InkResult { return this._newFunc(97) }

  //----- Background colors -----

  get BgBlack(): InkResult { return this._newFunc(40) }
  get BgRed(): InkResult { return this._newFunc(41) }
  get BgGreen(): InkResult { return this._newFunc(42) }
  get BgYellow(): InkResult { return this._newFunc(43) }
  get BgBlue(): InkResult { return this._newFunc(44) }
  get BgMagenta(): InkResult { return this._newFunc(45) }
  get BgCyan(): InkResult { return this._newFunc(46) }
  get BgWhite(): InkResult { return this._newFunc(47) }

  BgColorCode(code: number): InkResult { return this._newFunc(48, 5, code) }

  /** Gray */
  get BgBrightBlack(): InkResult { return this._newFunc(100) }
  get BgBrightRed(): InkResult { return this._newFunc(101) }
  get BgBrightGreen(): InkResult { return this._newFunc(102) }
  get BgBrightYellow(): InkResult { return this._newFunc(103) }
  get BgBrightBlue(): InkResult { return this._newFunc(104) }
  get BgBrightMagenta(): InkResult { return this._newFunc(105) }
  get BgBrightCyan(): InkResult { return this._newFunc(106) }
  get BgBrightWhite(): InkResult { return this._newFunc(107) }

  //----- API management -----

  private _params = new Array<number>();

  /**
   * Returns a function that is both:
   * 1. An instance of `Ink` (which is a factory for more `InkResult`
   *    values)
   * 2. A hybrid of a template tag function and a normal function
   */
  private _newFunc(...nums: Array<number>): InkResult {
    const func = ((templateStrings: string | TemplateStringsArray, ...substitutions: unknown[]): string => {
      let text;
      if (typeof templateStrings === 'string') {
        text = templateStrings;
      } else {
        text = templateStrings[0];
        for (const [index, subst] of substitutions.entries()) {
          text += String(subst);
          text += templateStrings[index + 1];
        }
      }
      return setAttrs(...func._params) + text + setAttrs(0);
    }) as InkResult; // (2)
    func._params = [...this._params, ...nums];
    Object.setPrototypeOf(func, Ink.prototype); // (1)
    return func;
  }
}

function setAttrs(...attrs: Array<number>) {
  return `\x1B[` + attrs.join(';') + `m`;
}

export type InkResult = Ink & TmplFunc;

type TmplFunc = (templateStrings: string | TemplateStringsArray, ...substitutions: unknown[]) => string;

/**
 * ```js
 * console.log(ink.Underline.FgGreen`underlined green`);
 * console.log(ink.FgColorCode(51)`turquoise`);
 * console.log(ink.Bold('bold'));
 * ```
 * You can set up the template tag dynamically:
 * ```js
 * let style;
 * if (success) {
 *   style = ink.FgGreen.Bold;
 * } else {
 *   style = ink.FgRed.Bold;
 * }
 * console.log(style`We are finished`);
 * ```
 */
export const ink = new Ink();
