import * as child_process from 'child_process';

import { GdbResponse } from './constants';
import { IoManager } from './iomanager';

export class GdbController {
    private gdbProcess: child_process.ChildProcessWithoutNullStreams | null = null;
    private ioManager: IoManager | null = null;
    private readonly args: string[] = ['--interpreter=mi3'];
    private onResponseCallback: (response: GdbResponse[]) => void = () => { };
    constructor(private readonly path: string, args: string[], private readonly options?: child_process.SpawnOptionsWithoutStdio) {
        for (const arg of args) {
            if (!arg.startsWith("--interpreter=")) {
                this.args.push(arg);
            }
        }
    }
    sendRequest(content: string, readResponse: false, timeout?: number): null;
    sendRequest(content: string, readResponse?: true, timeout?: number): Promise<GdbResponse[]> | null;
    sendRequest(content: string, readResponse: any, timeout?: number): any {
        if (this.ioManager === null) return null;
        return this.ioManager?.write(content, readResponse, timeout);
    }
    getNextResponse() {
        if (this.ioManager === null) return null;
        return this.ioManager.getNextResponse();
    }
    onResponse(callback: (response: GdbResponse[]) => void) {
        this.onResponseCallback = callback;
    }
    launch() {
        if (this.gdbProcess !== null) {
            throw Error("GDB already launched.");
        }
        this.gdbProcess = child_process.spawn(this.path, this.args, this.options);
        this.gdbProcess.on('close', () => {
            this.gdbProcess = null;
            this.ioManager = null;
        });
        this.ioManager = new IoManager(this.gdbProcess.stdin, this.gdbProcess.stdout);
        this.ioManager.onResponse(this.onResponseCallback);
        return this.getNextResponse(); // header info
    }
    exit() {
        if (this.gdbProcess === null) return;
        this.gdbProcess.kill();
        this.gdbProcess = null;
        this.ioManager = null;
    }

}