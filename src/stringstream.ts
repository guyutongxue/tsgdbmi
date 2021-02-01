// Basically same as pygdbmi.StringStream.

export class StringStream {
    index: number = 0;
    len: number;
    constructor(private rawText: string) {
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
                buf += c2;
            } else if (c == '"') {
                break;
            } else {
                buf += c;
            }
        }
        return buf;
    }
}