import { Readable, Writable } from 'stream';
import { createInterface } from 'readline';
import * as iconv from 'iconv-lite';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';
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

    private timeout(timeout: number) {
        return new Promise<GdbResponse>((_, reject) => {
            setTimeout(() => {
                reject(new GdbTimeoutError());
            }, timeout);
        });
    }

    write(content: string, readResponse: false, timeout?: number): null;
    write(content: string, readResponse?: true, timeout?: number): Promise<GdbResponse> | null;
    write(content: string, readResponse: any, timeout: any): any {
        if (typeof readResponse === "undefined") readResponse = true;
        if (typeof timeout === "undefined") timeout = DEFAULT_GDB_TIMEOUT;
        if (readResponse) {
            if (this.currentRequest !== null) throw Error("Last request not resolved yet.");
            this.currentRequest = new Subject();
        }
        this.stdin.write(iconv.encode(content.trim() + (USING_WINDOWS ? '\r\n' : '\n'), this.encoding));
        if (readResponse) {
            if (this.currentRequest === null) return null;
            return Promise.race([
                firstValueFrom(this.currentRequest),
                this.timeout(timeout)
            ])
        } else {
            return null;
        }
    }
}