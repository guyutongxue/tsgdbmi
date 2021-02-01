import { Observable, Subject } from "rxjs";
import { GdbResponse, GdbVal, GdbDict, GdbArray } from "./constants";
import { StringStream } from './stringstream';

const GDB_MI_RESULT_RE = /^(\d*)\^(\S+?)(,(.*))?$/;
const GDB_MI_NOTIFY_RE = /^(\d*)[*=](\S+?),(.*)$/;
const GDB_MI_CONSOLE_RE = /~"(.*)"/;
const GDB_MI_LOG_RE = /&"(.*)"/;
const GDB_MI_TARGET_OUTPUT_RE = /@"(.*)"/;
const GDB_MI_RESPONSE_FINISHED_RE = /^\(gdb\)\s*$/;

const WHITESPACES = [' ', ' \t', '\r', '\n'];
const GDB_MI_CHAR_DICT_START = '{';
const GDB_MI_CHAR_ARRAY_START = '[';
const GDB_MI_CHAR_STRING_START = '"';
const GDB_MI_VALUE_START_CHARS = [
    GDB_MI_CHAR_DICT_START,
    GDB_MI_CHAR_ARRAY_START,
    GDB_MI_CHAR_STRING_START
]

function parseResponse(gdbMiText: string): GdbResponse {
    const stream = new StringStream(gdbMiText);
    if (GDB_MI_NOTIFY_RE.test(gdbMiText)) {
        const { token, message, payload } = getNotifyMsgAndPayload(gdbMiText, stream);
        return {
            type: 'notify',
            message,
            payload,
            token
        };
    } else if (GDB_MI_RESULT_RE.test(gdbMiText)) {
        const { token, message, payload } = getResultMsgAndPayload(gdbMiText, stream);
        return {
            type: 'result',
            message,
            payload,
            token
        };
    } else if (GDB_MI_CONSOLE_RE.test(gdbMiText)) {
        const matches = GDB_MI_CONSOLE_RE.exec(gdbMiText)!;
        const payload = matches[1];
        return {
            type: 'console',
            message: null,
            payload
        }
    } else if (GDB_MI_LOG_RE.test(gdbMiText)) {
        const matches = GDB_MI_LOG_RE.exec(gdbMiText)!;
        const payload = matches[1];
        return {
            type: 'log',
            message: null,
            payload
        }
    } else if (responseIsFinished(gdbMiText)) {
        return {
            type: 'done',
            message: null,
            payload: null
        }
    } else {
        return {
            type: 'output',
            message: null,
            payload: gdbMiText
        }
    }
}

function responseIsFinished(gdbMiText: string): boolean {
    return GDB_MI_RESPONSE_FINISHED_RE.test(gdbMiText);
}

function assertMatch(acturalStr: string, expectedStr: string) {
    if (acturalStr !== expectedStr) {
        console.log("Expected");
        console.log(expectedStr);
        console.log();
        console.log("Got");
        console.log(acturalStr);
        throw Error();
    }
}

function getNotifyMsgAndPayload(result: string, stream: StringStream) {
    const tokenStr = stream.advancePastChars(['=','*']);
    const token = (tokenStr !== "" ? Number.parseInt(tokenStr) : null);
    console.debug("parsing message");
    console.debug(result);
    const message = stream.advancePastChars([',']);
    console.debug("parsed message");
    console.debug(message);
    const payload = parseDict(stream);
    return { token, message: message.trim(), payload: payload };
}

function getResultMsgAndPayload(result: string, stream: StringStream) {
    const matches = GDB_MI_RESULT_RE.exec(result)!;
    matches.shift();
    const token = matches[0] !== "" ? Number.parseInt(matches[0]) : null;
    const message = matches[1];
    let payload: any;
    if (typeof message[3] === "undefined") {
        payload = null;
    } else {
        stream.advancePastChars([',']);
        payload = parseDict(stream);
    }
    return { token, message, payload };
}


function parseDict(stream: StringStream) {
    const obj: GdbDict = {};
    while (true) {
        let c = stream.read(1);
        if (WHITESPACES.includes(c)) { }
        else if (["{", ","].includes(c)) { }
        else if (["}", ""].includes(c)) {
            break;
        } else {
            stream.seek(-1);
            const { key, value } = parseKeyVal(stream);
            if (key in obj) {
                if (Array.isArray(obj[key])) {
                    (obj[key] as GdbArray).push(value);
                } else {
                    obj[key] = [obj[key], value];
                }
            } else {
                obj[key] = value;
            }
            let lookAheadForGarbage = true;
            c = stream.read(1);
            while (lookAheadForGarbage) {
                if (["}", ",", ""].includes(c)) {
                    lookAheadForGarbage = false;
                } else {
                    console.debug("skipping unexpected character: " + c);
                    c = stream.read(1);
                }
            }
            stream.seek(-1);
        }
    }
    console.debug("parsed dict");
    console.debug(obj);
    return obj;
}

function parseKeyVal(stream: StringStream) {
    console.debug("parsing key/val");
    const key = parseKey(stream);
    const value = parseVal(stream);
    console.debug("parsed key/val");
    console.debug(key);
    console.debug(value);
    return { key, value };
}

function parseKey(stream: StringStream) {
    console.debug("parsing key");
    const key = stream.advancePastChars(['=']);
    console.debug("parsed key:");
    console.debug(key);
    return key;
}

function parseVal(stream: StringStream) {
    console.debug("parsing value");
    let val: GdbVal;
    while (true) {
        let c = stream.read(1);
        if (c === "{") {
            val = parseDict(stream);
            break;
        } else if (c === "[") {
            val = parseArray(stream);
            break;
        } else if (c === '"') {
            val = stream.advancePastStringWithGdbExcapes();
            break;
        } else {
            console.warn(`unexpected character "${c}". Continuing.`);
            val = "";
        }
    }
    console.debug("parsed value:");
    console.debug(val);
    return val;
}

function parseArray(stream: StringStream) {
    console.debug("parsing array");
    const arr: GdbArray = [];
    while (true) {
        let c = stream.read(1);
        if (GDB_MI_VALUE_START_CHARS.includes(c)) {
            stream.seek(-1);
            const val = parseVal(stream);
            arr.push(val);
        } else if (WHITESPACES.includes(c)) { }
        else if (c === ',') { }
        else if (c === ']') {
            break;
        }
    }
    console.debug("parsed array:");
    console.debug(arr);
    return arr;
}

export class GdbMiParser {
    private parsedResponse: Subject<GdbResponse[]> = new Subject();
    $parsedResponse = this.parsedResponse.asObservable();
    private currentResponseList: GdbResponse[] = [];

    subscribeResponseLine(observable: Observable<string>) {
        observable.subscribe(value => {
            const parsed = parseResponse(value);
            this.currentResponseList.push(parsed);
            if (parsed.type === "done") {
                this.parsedResponse.next(this.currentResponseList);
                this.currentResponseList = [];
            }
        })
    }
}