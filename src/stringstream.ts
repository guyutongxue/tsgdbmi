import * as iconv from 'iconv-lite';

// Basically same as pygdbmi.StringStream.

export class StringStream {
    index: number = 0;
    len: number;
    constructor(private rawText: string, public encoding: string) {
        this.len = rawText.length;
    }

    read(count: number) {
        const newIndex = this.index + count;
        let buf: string;
        if (newIndex > this.len) {
            buf = this.rawText.substring(this.index);
        } else {
            buf = this.rawText.substring(this.index, newIndex);
        }
        this.index = newIndex;
        return buf;
    }

    seek(offset: number) {
        this.index += offset;
    }

    advancePastChars(chars: string[]) {
        const startIndex = this.index;
        while (true) {
            const currentChar = this.rawText[this.index];
            this.index++;
            if (chars.includes(currentChar)) break;
            if (this.index == this.len) break;
        }
        return this.rawText.substring(startIndex, this.index - 1);
    }
    
    /** characters that gdb escapes that should not be escaped by this parser */
    advancePastStringWithGdbExcapes(charsToRemoveGdbEscape?: string[]) {
        if (typeof charsToRemoveGdbEscape === "undefined") {
            charsToRemoveGdbEscape = ['"'];
        }
        let buf = "";
        while (true) {
            const c = this.rawText[this.index];
            this.index++;
            if (c == '\\') {
                const c2 = this.rawText[this.index];
                this.index++;
                buf += (c + c2);
            } else if (c == '"') {
                break;
            } else {
                buf += c;
            }
        }
        return buf;
    }

    
    descape(src: string) {
    let result: number[] = [];
    let escapeValue = 0;
    let escapeType: "none" | "oct" | "hex" = "none";
    let escapeLength: number = 0;
    for (let i = 0; i < src.length; i++) {
      if (escapeType === "none") {
        if (src[i] === '\\') {
          i++;
          switch (src[i]) {
            case "'": result.push(0x27); break;
            case '"': result.push(0x22); break;
            case '?': result.push(0x3f); break;
            case '\\': result.push(0x5c); break;
            case 'n': result.push(0x0a); break;
            case 'r': break;
            case 't': result.push(0x09); break;
            case '0': case '1': case '2':
            case '3': case '4': case '5':
            case '6': case '7':
              escapeType = "oct";
              escapeLength = 2;
              escapeValue = Number.parseInt(src[i]);
              break;
            case 'x':
              escapeType = "hex";
              escapeLength = 2;
              escapeValue = 0;
              break;
          }
        } else {
          result.push(src.charCodeAt(i));
        }
      } else if (escapeType === "oct") {
        const isAvailable = src[i] >= '0' && src[i] <= '7';
        if (!isAvailable || escapeLength === 0) {
          escapeType = "none";
          result.push(escapeValue);
          i--;
          continue;
        }
        if (isAvailable) {
          escapeLength--;
          escapeValue *= 8;
          escapeValue += Number.parseInt(src[i]);
          continue;
        }
      } else {
        const isAvailable = (src[i] >= '0' && src[i] <= '9') ||
          (src[i] >= 'a' && src[i] <= 'f') ||
          (src[i] >= 'A' && src[i] <= 'f');
        if (!isAvailable || escapeLength === 0) {
          escapeType = "none";
          result.push(escapeValue);
          i--;
          continue;
        }
        if (isAvailable) {
          escapeLength--;
          escapeValue *= 16;
          escapeValue += Number.parseInt(src[i]);
          continue;
        }
      }
    }
    return iconv.decode(Buffer.from(result), this.encoding);
  }
}