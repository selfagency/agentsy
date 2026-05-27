//# hash=f1d0f63762ddeed419df5aa882bb55c5
//# sourceMappingURL=index.js.map

function _array_like_to_array(arr, len) {
    if (len == null || len > arr.length) len = arr.length;
    for(var i = 0, arr2 = new Array(len); i < len; i++)arr2[i] = arr[i];
    return arr2;
}
function _array_with_holes(arr) {
    if (Array.isArray(arr)) return arr;
}
function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
    try {
        var info = gen[key](arg);
        var value = info.value;
    } catch (error) {
        reject(error);
        return;
    }
    if (info.done) {
        resolve(value);
    } else {
        Promise.resolve(value).then(_next, _throw);
    }
}
function _async_to_generator(fn) {
    return function() {
        var self = this, args = arguments;
        return new Promise(function(resolve, reject) {
            var gen = fn.apply(self, args);
            function _next(value) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
            }
            function _throw(err) {
                asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
            }
            _next(undefined);
        });
    };
}
function _iterable_to_array(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
}
function _non_iterable_rest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
}
function _to_array(arr) {
    return _array_with_holes(arr) || _iterable_to_array(arr) || _unsupported_iterable_to_array(arr) || _non_iterable_rest();
}
function _unsupported_iterable_to_array(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _array_like_to_array(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(n);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _array_like_to_array(o, minLen);
}
function _ts_generator(thisArg, body) {
    var f, y, t, _ = {
        label: 0,
        sent: function() {
            if (t[0] & 1) throw t[1];
            return t[1];
        },
        trys: [],
        ops: []
    }, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype), d = Object.defineProperty;
    return d(g, "next", {
        value: verb(0)
    }), d(g, "throw", {
        value: verb(1)
    }), d(g, "return", {
        value: verb(2)
    }), typeof Symbol === "function" && d(g, Symbol.iterator, {
        value: function() {
            return this;
        }
    }), g;
    function verb(n) {
        return function(v) {
            return step([
                n,
                v
            ]);
        };
    }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while(g && (g = 0, op[0] && (_ = 0)), _)try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [
                op[0] & 2,
                t.value
            ];
            switch(op[0]){
                case 0:
                case 1:
                    t = op;
                    break;
                case 4:
                    _.label++;
                    return {
                        value: op[1],
                        done: false
                    };
                case 5:
                    _.label++;
                    y = op[1];
                    op = [
                        0
                    ];
                    continue;
                case 7:
                    op = _.ops.pop();
                    _.trys.pop();
                    continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                        _ = 0;
                        continue;
                    }
                    if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
                        _.label = op[1];
                        break;
                    }
                    if (op[0] === 6 && _.label < t[1]) {
                        _.label = t[1];
                        t = op;
                        break;
                    }
                    if (t && _.label < t[2]) {
                        _.label = t[2];
                        _.ops.push(op);
                        break;
                    }
                    if (t[2]) _.ops.pop();
                    _.trys.pop();
                    continue;
            }
            op = body.call(thisArg, _);
        } catch (e) {
            op = [
                6,
                e
            ];
            y = 0;
        } finally{
            f = t = 0;
        }
        if (op[0] & 5) throw op[1];
        return {
            value: op[0] ? op[1] : void 0,
            done: true
        };
    }
}
import { readFile } from 'node:fs/promises';
import { compressMemoryFile } from '@agentsy/core/context';
import { compressOutput } from '@agentsy/tokens';
export var name = 'cli';
var DEFAULT_IO = {
    stderr: function stderr(message) {
        console.error(message);
    },
    stdout: function stdout(message) {
        console.log(message);
    }
};
function getFlagValue(args, flag) {
    var _args_;
    var index = args.indexOf(flag);
    if (index === -1) {
        return null;
    }
    return (_args_ = args[index + 1]) !== null && _args_ !== void 0 ? _args_ : null;
}
function hasFlag(args, flag) {
    return args.includes(flag);
}
var DEFAULT_MEMORY_SYNC_SERVER_DB = './.agentsy/local-sync-server.db';
var DEFAULT_MEMORY_SYNC_REPLICA_DB = './.agentsy/local-replica.db';
var DEFAULT_MEMORY_SYNC_BIND = '0.0.0.0:8080';
var DEFAULT_MEMORY_SYNC_URL = 'http://localhost:8080';
var DEFAULT_MEMORY_SYNC_INTERVAL_MS = 5000;
function getNumberFlagValue(args, flag, fallback) {
    var raw = getFlagValue(args, flag);
    if (raw === null) {
        return fallback;
    }
    var parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function createMemorySyncDevExample(args) {
    var _getFlagValue, _getFlagValue1, _getFlagValue2, _getFlagValue3;
    var syncIntervalMs = getNumberFlagValue(args, '--sync-interval-ms', DEFAULT_MEMORY_SYNC_INTERVAL_MS);
    if (syncIntervalMs === null) {
        return null;
    }
    var serverDbPath = (_getFlagValue = getFlagValue(args, '--server-db')) !== null && _getFlagValue !== void 0 ? _getFlagValue : DEFAULT_MEMORY_SYNC_SERVER_DB;
    var replicaDbPath = (_getFlagValue1 = getFlagValue(args, '--replica-db')) !== null && _getFlagValue1 !== void 0 ? _getFlagValue1 : DEFAULT_MEMORY_SYNC_REPLICA_DB;
    var bindAddress = (_getFlagValue2 = getFlagValue(args, '--bind')) !== null && _getFlagValue2 !== void 0 ? _getFlagValue2 : DEFAULT_MEMORY_SYNC_BIND;
    var serverUrl = (_getFlagValue3 = getFlagValue(args, '--server-url')) !== null && _getFlagValue3 !== void 0 ? _getFlagValue3 : DEFAULT_MEMORY_SYNC_URL;
    var startCommand = "tursodb ".concat(serverDbPath, " --sync-server ").concat(bindAddress);
    return {
        bindAddress: bindAddress,
        env: {
            AGENTSY_MEMORY_SYNC_INTERVAL_MS: String(syncIntervalMs),
            TURSO_AUTH_TOKEN: '',
            TURSO_DATABASE_URL: serverUrl
        },
        managerExample: [
            "import { createTursoManager } from '@agentsy/memory';",
            '',
            'const manager = createTursoManager({',
            "  path: '".concat(replicaDbPath, "',"),
            "  databaseUrl: '".concat(serverUrl, "',"),
            "  authToken: '',",
            "  syncIntervalMs: ".concat(syncIntervalMs, ","),
            '  maxRetries: 3,',
            "  mode: 'remote-shadow'",
            '});'
        ].join('\n'),
        replicaDbPath: replicaDbPath,
        serverDbPath: serverDbPath,
        serverUrl: serverUrl,
        startCommand: startCommand,
        syncIntervalMs: syncIntervalMs
    };
}
function formatMemorySyncDevExample(example) {
    return [
        'Local Turso sync server development wiring',
        '',
        'Start the local sync server:',
        example.startCommand,
        '',
        'Environment:',
        "TURSO_DATABASE_URL=".concat(example.env.TURSO_DATABASE_URL),
        'TURSO_AUTH_TOKEN=',
        "AGENTSY_MEMORY_SYNC_INTERVAL_MS=".concat(example.env.AGENTSY_MEMORY_SYNC_INTERVAL_MS),
        '',
        'No auth token is needed for the local sync server.',
        '',
        'Example @agentsy/memory setup:',
        example.managerExample
    ];
}
function toCompressionLevel(value) {
    if (value === 'lite' || value === 'full' || value === 'ultra') {
        return value;
    }
    if (value === null) {
        return 'full';
    }
    return null;
}
function validateCompressFlags(filePath, text, level, io) {
    if (level === null) {
        var _io_stderr;
        ((_io_stderr = io.stderr) !== null && _io_stderr !== void 0 ? _io_stderr : DEFAULT_IO.stderr)('Invalid --level value. Use one of: lite, full, ultra.');
        return false;
    }
    if (filePath === null && text === null) {
        var _io_stderr1;
        ((_io_stderr1 = io.stderr) !== null && _io_stderr1 !== void 0 ? _io_stderr1 : DEFAULT_IO.stderr)('Missing input. Provide --text or --file.');
        return false;
    }
    return true;
}
function handleCompressCommand(rest, io) {
    return _async_to_generator(function() {
        var _io_stdout, _io_stdout1, filePath, text, level, source, _tmp, _tmp1, result;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    filePath = getFlagValue(rest, '--file');
                    text = getFlagValue(rest, '--text');
                    level = toCompressionLevel(getFlagValue(rest, '--level'));
                    if (!validateCompressFlags(filePath, text, level, io)) {
                        return [
                            2,
                            1
                        ];
                    }
                    if (!(text !== null && text !== void 0)) return [
                        3,
                        1
                    ];
                    _tmp = text;
                    return [
                        3,
                        5
                    ];
                case 1:
                    if (!(filePath === null)) return [
                        3,
                        2
                    ];
                    _tmp1 = '';
                    return [
                        3,
                        4
                    ];
                case 2:
                    return [
                        4,
                        readFile(filePath, 'utf-8')
                    ];
                case 3:
                    _tmp1 = _state.sent();
                    _state.label = 4;
                case 4:
                    _tmp = _tmp1;
                    _state.label = 5;
                case 5:
                    source = _tmp;
                    result = compressOutput(source, {
                        level: level
                    });
                    ((_io_stdout = io.stdout) !== null && _io_stdout !== void 0 ? _io_stdout : DEFAULT_IO.stdout)("Savings: ".concat((result.savingsRatio * 100).toFixed(2), "%"));
                    ((_io_stdout1 = io.stdout) !== null && _io_stdout1 !== void 0 ? _io_stdout1 : DEFAULT_IO.stdout)(result.compressed);
                    return [
                        2,
                        0
                    ];
            }
        });
    })();
}
function handleCompressMemoryCommand(rest, io) {
    return _async_to_generator(function() {
        var _io_stdout, _io_stdout1, filePath, _io_stderr, backup, result;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    filePath = getFlagValue(rest, '--file');
                    if (filePath === null) {
                        ;
                        ((_io_stderr = io.stderr) !== null && _io_stderr !== void 0 ? _io_stderr : DEFAULT_IO.stderr)('Missing --file for compress-memory command.');
                        return [
                            2,
                            1
                        ];
                    }
                    backup = !hasFlag(rest, '--no-backup');
                    return [
                        4,
                        compressMemoryFile(filePath, {
                            backup: backup
                        })
                    ];
                case 1:
                    result = _state.sent();
                    ((_io_stdout = io.stdout) !== null && _io_stdout !== void 0 ? _io_stdout : DEFAULT_IO.stdout)("Compressed ".concat(filePath));
                    ((_io_stdout1 = io.stdout) !== null && _io_stdout1 !== void 0 ? _io_stdout1 : DEFAULT_IO.stdout)("Savings: ".concat((result.savingsRatio * 100).toFixed(2), "%"));
                    return [
                        2,
                        0
                    ];
            }
        });
    })();
}
function _handleMemorySyncDevCommand(rest, io) {
    var _io_stdout;
    var example = createMemorySyncDevExample(rest);
    if (example === null) {
        var _io_stderr;
        ((_io_stderr = io.stderr) !== null && _io_stderr !== void 0 ? _io_stderr : DEFAULT_IO.stderr)('Invalid --sync-interval-ms value. Use a positive number.');
        return 1;
    }
    var stdout = (_io_stdout = io.stdout) !== null && _io_stdout !== void 0 ? _io_stdout : DEFAULT_IO.stdout;
    if (hasFlag(rest, '--json')) {
        stdout(JSON.stringify(example, null, 2));
        return 0;
    }
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = formatMemorySyncDevExample(example)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var line = _step.value;
            stdout(line);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally{
        try {
            if (!_iteratorNormalCompletion && _iterator.return != null) {
                _iterator.return();
            }
        } finally{
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
    return 0;
}
function handleMemorySyncDevCommand(rest, io) {
    return _handleMemorySyncDevCommand(rest, io);
}
function handleSandboxDiagnosticsCommand(rest, io) {
    return _async_to_generator(function() {
        var runSandboxDiagnosticsCommand;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        import('./commands/sandbox-diagnostics.js')
                    ];
                case 1:
                    runSandboxDiagnosticsCommand = _state.sent().runSandboxDiagnosticsCommand;
                    return [
                        2,
                        runSandboxDiagnosticsCommand(rest, io)
                    ];
            }
        });
    })();
}
function handleChatCommand(rest, io) {
    return _async_to_generator(function() {
        var runChatCommand;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        import('./commands/chat.js')
                    ];
                case 1:
                    runChatCommand = _state.sent().runChatCommand;
                    return [
                        2,
                        runChatCommand(rest, io)
                    ];
            }
        });
    })();
}
function handleTuiCommand(argv, io) {
    return _async_to_generator(function() {
        var runTuiCommand;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        import('./commands/tui.js')
                    ];
                case 1:
                    runTuiCommand = _state.sent().runTuiCommand;
                    return [
                        2,
                        runTuiCommand(argv, io)
                    ];
            }
        });
    })();
}
function handleContentAddressStatsCommand(rest, io) {
    return _async_to_generator(function() {
        var runContentAddressStatsCommand;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    return [
                        4,
                        import('./commands/content-address-stats.js')
                    ];
                case 1:
                    runContentAddressStatsCommand = _state.sent().runContentAddressStatsCommand;
                    return [
                        2,
                        runContentAddressStatsCommand(rest, io)
                    ];
            }
        });
    })();
}
function handleUnknownCommand(command, io) {
    var _io_stderr, _io_stderr1;
    ((_io_stderr = io.stderr) !== null && _io_stderr !== void 0 ? _io_stderr : DEFAULT_IO.stderr)("Unknown command: ".concat(command !== null && command !== void 0 ? command : '(none)'));
    ((_io_stderr1 = io.stderr) !== null && _io_stderr1 !== void 0 ? _io_stderr1 : DEFAULT_IO.stderr)('Supported commands: tui (default), chat, compress, compress-memory, memory-sync-dev, sandbox-diagnostics, content-address-stats');
    return 1;
}
export function runCli(_0) {
    return _async_to_generator(function(argv) {
        var io, _argv, command, rest;
        var _arguments = arguments;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    io = _arguments.length > 1 && _arguments[1] !== void 0 ? _arguments[1] : DEFAULT_IO;
                    _argv = _to_array(argv), command = _argv[0], rest = _argv.slice(1);
                    // Default entry-point: no subcommand → Ink TUI agent IDE
                    if (command === undefined) {
                        return [
                            2,
                            handleTuiCommand(argv, io)
                        ];
                    }
                    if (command === 'tui') {
                        return [
                            2,
                            handleTuiCommand(rest, io)
                        ];
                    }
                    if (!(command === 'compress')) return [
                        3,
                        2
                    ];
                    return [
                        4,
                        handleCompressCommand(rest, io)
                    ];
                case 1:
                    return [
                        2,
                        _state.sent()
                    ];
                case 2:
                    if (!(command === 'compress-memory')) return [
                        3,
                        4
                    ];
                    return [
                        4,
                        handleCompressMemoryCommand(rest, io)
                    ];
                case 3:
                    return [
                        2,
                        _state.sent()
                    ];
                case 4:
                    if (command === 'memory-sync-dev') {
                        return [
                            2,
                            handleMemorySyncDevCommand(rest, io)
                        ];
                    }
                    if (!(command === 'sandbox-diagnostics')) return [
                        3,
                        6
                    ];
                    return [
                        4,
                        handleSandboxDiagnosticsCommand(rest, io)
                    ];
                case 5:
                    return [
                        2,
                        _state.sent()
                    ];
                case 6:
                    if (!(command === 'chat')) return [
                        3,
                        8
                    ];
                    return [
                        4,
                        handleChatCommand(rest, io)
                    ];
                case 7:
                    return [
                        2,
                        _state.sent()
                    ];
                case 8:
                    if (!(command === 'content-address-stats')) return [
                        3,
                        10
                    ];
                    return [
                        4,
                        handleContentAddressStatsCommand(rest, io)
                    ];
                case 9:
                    return [
                        2,
                        _state.sent()
                    ];
                case 10:
                    return [
                        2,
                        handleUnknownCommand(command, io)
                    ];
            }
        });
    }).apply(this, arguments);
}
