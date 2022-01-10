import { Readable, Writable } from 'stream';
import * as iconv from 'iconv-lite';
import { Observable, Subject, firstValueFrom, throwError } from 'rxjs';
import { map, tap, timeout as timeoutOp } from 'rxjs/operators';
import { GdbTimeoutError, GdbResponse, USING_WINDOWS, DEFAULT_GDB_TIMEOUT } from './constants';
import { parseResponse } from './gdbmiparser';

export class IoManager {

    private responseLine: Subject<string> = new Subject();
    parsedResponse$: Observable<GdbResponse> = this.responseLine.pipe(
        map(value => {
            const parsed = parseResponse(value, this.encoding);
            if (parsed.type === "result" && this.currentRequest !== null) {
                this.currentRequest.next(parsed);
                this.currentRequest.complete();
                this.currentRequest = null;
            }
            return parsed;
        })
    );
    private currentRequest: Subject<GdbResponse> | null = null;

    constructor(private stdin: Writable, private stdout: Readable, private encoding: string) {
        let output = "";
        this.stdout.on('data', (chunk) => {
            output += iconv.decode(chunk, this.encoding);
            const lines = output.split(USING_WINDOWS ? '\r\n' : '\n');
            output = lines.pop() ?? "";
            for (const line of lines) {
                if (line.trim() !== "") this.responseLine.next(line);
            }
        });
        this.stdout.on('close', () => {
            this.responseLine.complete();
        });
    }

    write(content: string, timeout: number | undefined): void {
        if (typeof timeout === "undefined") timeout = DEFAULT_GDB_TIMEOUT;
        const buffer = iconv.encode(content.trim() + (USING_WINDOWS ? '\r\n' : '\n'), this.encoding);
        this.stdin.write(buffer);
    }
}