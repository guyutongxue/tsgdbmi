import * as os from 'os'

export const DEFAULT_GDB_TIMEOUT = 1000;
export const USING_WINDOWS = os.platform() === 'win32';


export type GdbDict = {
    [key: string]: GdbVal
};
export type GdbArray = GdbVal[];
export type GdbVal = GdbArray | GdbDict | string;

export interface GdbResponse {
    type: "notify" | "result" | "console" | "log" | "target" | "done" | "output";
    message: string | null;
    payload: GdbVal | null;
    token?: number | null;
}

export class GdbTimeoutError extends Error { }
