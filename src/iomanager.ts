import { Readable, Writable } from 'stream';
import { createInterface } from 'readline';
import * as iconv from 'iconv-lite';
import { Mutex } from 'async-mutex';
import { Observable, Subject, firstValueFrom, throwError } from 'rxjs';
import { map, tap, timeout as timeoutOp } from 'rxjs/operators';
import { GdbTimeoutError, GdbResponse, USING_WINDOWS, DEFAULT_GDB_TIMEOUT } from './constants';
import { parseResponse } from './gdbmiparser';

export class IoManager {

    private writeMutex: Mutex = new Mutex();
    private responseLine: Subject<string> = new Subject();
    parsedResponse$: Observable<GdbResponse> = this.responseLine.pipe(
        // tap(v => console.log('debug' + v)),
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
        const stdout_rl = createInterface({
            input: stdout.pipe(iconv.decodeStream(this.encoding)).pipe(iconv.encodeStream('utf8')),
        });
        stdout_rl.on('line', input => {
            this.responseLine.next(input);
        });
        stdout_rl.on('close', () => {
            this.responseLine.complete();
        });
    }

    write(content: string, readResponse?: false, timeout?: number): Promise<null>;
    write(content: string, readResponse: true, timeout?: number): Promise<GdbResponse | null>;
    async write(content: string, readResponse: boolean | undefined, timeout: number | undefined): Promise<GdbResponse | null> {
        if (typeof readResponse === "undefined") readResponse = false;
        if (typeof timeout === "undefined") timeout = DEFAULT_GDB_TIMEOUT;
        if (readResponse) {
            if (this.currentRequest !== null) throw Error("Last request not resolved yet.");
            this.currentRequest = new Subject();
        }
        const buffer = iconv.encode(content.trim() + (USING_WINDOWS ? '\r\n' : '\n'), this.encoding);
        this.stdin.write(buffer);
        console.log("hel");
        if (readResponse) {
            if (this.currentRequest === null) return null;
            return firstValueFrom(this.currentRequest.pipe(
                timeoutOp({
                    each: timeout,
                    with: () => throwError(() => new GdbTimeoutError())
                }),
            ));
        } else {
            return null;
        }
    }
}