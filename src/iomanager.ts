import {  Readable, Writable } from 'stream';
import { createInterface } from 'readline';
import { Observable, Subject } from 'rxjs';

import { GdbTimeoutError, GdbResponse, USING_WINDOWS, DEFAULT_GDB_TIMEOUT } from './constants'
import { GdbMiParser } from './gdbmiparser';

export class IoManager {

    private responseLine: Subject<string> = new Subject();
    private gdbMiParser: GdbMiParser;
    $responseLine: Observable<string> = this.responseLine.asObservable();
    private currentRequest: Subject<GdbResponse[]> | null = null;
    private onResponseCallback: (response: GdbResponse[]) => void = () => { };

    constructor(private stdin: Writable, private stdout: Readable) {
        const stdout_rl = createInterface({
            input: stdout
        });
        stdout_rl.on('line', input => {
            this.responseLine.next(input);
        });
        stdout_rl.on('close', () => {
            this.responseLine.complete();
        });
        this.gdbMiParser = new GdbMiParser();
        this.gdbMiParser.subscribeResponseLine(this.$responseLine);
        this.gdbMiParser.$parsedResponse.subscribe(value => {
            this.onResponseCallback(value);
            if (this.currentRequest !== null) {
                this.currentRequest.next(value);
                this.currentRequest.complete();
                this.currentRequest = null;
            }
        })
    }

    private timeout(timeout: number) {
        return new Promise<GdbResponse[]>((_, reject) => {
            setTimeout(() => {
                reject(new GdbTimeoutError());
            }, timeout);
        });
    }

    onResponse(callback: (response: GdbResponse[]) => void) {
        this.onResponseCallback = callback;
    }

    write(content: string, readResponse: false, timeout?: number): null;
    write(content: string, readResponse?: true, timeout?: number): Promise<GdbResponse[]> | null;
    write(content: string, readResponse: any, timeout: any): any {
        if (typeof readResponse === "undefined") readResponse = true;
        if (typeof timeout === "undefined") timeout = DEFAULT_GDB_TIMEOUT;
        if (readResponse) {
            if (this.currentRequest !== null) throw Error("Last request not resolved yet.");
            this.currentRequest = new Subject();
        }
        this.stdin.write(content.trim() + (USING_WINDOWS ? '\r\n' : '\n'));
        if (readResponse) {
            if (this.currentRequest === null) return null;
            return Promise.race([
                this.currentRequest.toPromise(),
                this.timeout(timeout)
            ])
        } else {
            return null;
        }
    }

    getNextResponse(): Promise<GdbResponse[]> {
        if (this.currentRequest !== null) throw Error("Last request not resolved yet.");
        this.currentRequest = new Subject();
        return Promise.race([
            this.currentRequest.toPromise(),
            this.timeout(1000)
        ])
    }
}