# `tsgdbmi` - Get structured output from GDB/MI

**This is a subproject of [Dev-C++ 7](https://github.com/Guyutongxue/devcpp7), and I do not intend to make it a public library.** So use at your own risk.

No documentation now. But here's a small example tested under Windows:
```ts
// Create GDB Controller
const gdb = new GdbController('gdb.exe', [], {});
// Set callback when get response from GDB
gdb.onResponse(value => {
    console.log(value);
})
// launch gdb and send request (MI command or CMD command)
gdb.launch()?.then(value => {
    return gdb.sendRequest("help");
}).then(value => {
    return gdb.sendRequest("file a.exe");
}).then(value => {
    gdb.exit();
});
```

This repo is mainly "translated" from [pygdbmi](https://github.com/cs01/pygdbmi). I just adjust (or simplify) its IO manage.