import * as child_process from 'child_process';
import EventEmitter from 'events';

import { GdbResponse } from './constants';
import { IoManager } from './iomanager';

export class GdbController {
    private gdbProcess: child_process.ChildProcessWithoutNullStreams | null = null;
    private ioManager: IoManager | null = null;
    private eventEmitter: EventEmitter = new EventEmitter();
    constructor() { }
    private genArgs(args: string[]) {
        const result: string[] = ['--interpreter=mi3']
        for (const arg of args) {
            if (!arg.startsWith("--interpreter=")) {
                result.push(arg);
            }
        }
        return result;
    }

    sendRequest(content: string, readResponse: false, timeout?: number): null;
    sendRequest(content: string, readResponse?: true, timeout?: number): Promise<GdbResponse[]> | null;
    sendRequest(content: string, readResponse: any, timeout?: number): any {
        if (this.ioManager === null) return null;
        return this.ioManager?.write(content, readResponse, timeout);
    }
    onResponse(callback: (response: GdbResponse) => void) {
        this.eventEmitter.on('response', callback);
    }
    launch(path: string, args: string[], options?: child_process.SpawnOptionsWithoutStdio) {
        if (this.gdbProcess !== null) {
            throw Error("GDB already launched.");
        }
        this.gdbProcess = child_process.spawn(path, this.genArgs(args), options);
        this.gdbProcess.on('close', () => {
            this.gdbProcess = null;
            this.ioManager = null;
        });
        this.ioManager = new IoManager(this.gdbProcess.stdin, this.gdbProcess.stdout);
        this.ioManager.$parsedResponse.subscribe(response => this.eventEmitter.emit('response', response));
    }
    exit() {
        if (this.gdbProcess === null) return;
        this.gdbProcess.kill();
        this.gdbProcess = null;
        this.ioManager = null;
    }

}