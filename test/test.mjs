import { GdbController } from '../dist/index.js';

const gdb = new GdbController('GBK');
// Set callback when get response from GDB
gdb.onResponse(value => {
    if (value.type === "console")
        console.log(value.payload);
})
// launch gdb
gdb.launch('gdb.exe', [], {});
// send request (MI command or CLI command)
gdb.sendRequest("help")?.then(value => {
    console.log("response: ", value);
    return gdb.sendRequest("file C:\\\\Users\\\\Guyutongxue\\\\Downloads\\\\%E6%9C%AA%E5%91%BD%E5%90%8D1.exe");
}).then(value => {
    console.log("response: ", value);
    return gdb.sendRequest("-break-insert \"C:\\\\Users\\\\Guyutongxue\\\\Downloads\\\\未命名1.cpp:98\"")
}).then(value => {
    console.log("response: ", value);
    gdb.exit();
});