//# hash=d5d8b2bc8c78b06590de4d05a1d39540
//# sourceMappingURL=chat.js.map

function _async_iterator(iterable) {
    var method, async, sync, retry = 2;
    for("undefined" != typeof Symbol && (async = Symbol.asyncIterator, sync = Symbol.iterator); retry--;){
        if (async && null != (method = iterable[async])) return method.call(iterable);
        if (sync && null != (method = iterable[sync])) return new AsyncFromSyncIterator(method.call(iterable));
        async = "@@asyncIterator", sync = "@@iterator";
    }
    throw new TypeError("Object is not async iterable");
}
function AsyncFromSyncIterator(s) {
    function AsyncFromSyncIteratorContinuation(r) {
        if (Object(r) !== r) return Promise.reject(new TypeError(r + " is not an object."));
        var done = r.done;
        return Promise.resolve(r.value).then(function(value) {
            return {
                value: value,
                done: done
            };
        });
    }
    return AsyncFromSyncIterator = function(s) {
        this.s = s, this.n = s.next;
    }, AsyncFromSyncIterator.prototype = {
        s: null,
        n: null,
        next: function() {
            return AsyncFromSyncIteratorContinuation(this.n.apply(this.s, arguments));
        },
        return: function(value) {
            var ret = this.s.return;
            return void 0 === ret ? Promise.resolve({
                value: value,
                done: !0
            }) : AsyncFromSyncIteratorContinuation(ret.apply(this.s, arguments));
        },
        throw: function(value) {
            var thr = this.s.return;
            return void 0 === thr ? Promise.reject(value) : AsyncFromSyncIteratorContinuation(thr.apply(this.s, arguments));
        }
    }, new AsyncFromSyncIterator(s);
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
function _instanceof(left, right) {
    "@swc/helpers - instanceof";
    if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
        return !!right[Symbol.hasInstance](left);
    } else {
        return left instanceof right;
    }
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
/**
 * Interactive chat command for the @agentsy CLI.
 *
 * Provides a readline-based interactive REPL that sends messages to an LLM
 * provider and streams responses token by token to stdout. Supports both
 * real provider connections (via load-balanced client) and a mock provider
 * for testing and dogfooding without live API keys.
 *
 * @example
 * ```bash
 * # Chat with a mock provider (no API key needed)
 * npx agentsy chat --mock
 *
 * # Chat with OpenAI
 * npx agentsy chat --model gpt-4
 * ```
 */ import { createInterface } from 'node:readline/promises';
import { discoverLocalProviders } from '@agentsy/models';
import { createSimpleTurnLoop } from '@agentsy/runtime/loop';
import { createMockClient } from '../providers/mock.js';
import { resolveProviderClient } from '../providers/resolve-provider.js';
// ── ANSI helpers ────────────────────────────────────────────────────────────────
var DIM = '\x1b[2m';
var GREEN = '\x1b[32m';
var CYAN = '\x1b[36m';
var YELLOW = '\x1b[33m';
var RESET = '\x1b[0m';
function dim(text) {
    return "".concat(DIM).concat(text).concat(RESET);
}
function green(text) {
    return "".concat(GREEN).concat(text).concat(RESET);
}
function cyan(text) {
    return "".concat(CYAN).concat(text).concat(RESET);
}
function yellow(text) {
    return "".concat(YELLOW).concat(text).concat(RESET);
}
// ── Helpers ─────────────────────────────────────────────────────────────────────
function hasFlag(args, flag) {
    return args.includes(flag);
}
function getFlagValue(args, flag) {
    var _args_at;
    var index = args.indexOf(flag);
    if (index === -1) {
        return null;
    }
    return (_args_at = args.at(index + 1)) !== null && _args_at !== void 0 ? _args_at : null;
}
function formatUsage(inputTokens, outputTokens) {
    var parts = [];
    if (inputTokens !== undefined) {
        parts.push("↑".concat(inputTokens));
    }
    if (outputTokens !== undefined) {
        parts.push("↓".concat(outputTokens));
    }
    return parts.length > 0 ? parts.join(' ') : '';
}
var DEFAULT_HEADERS = {
    prefix: "".concat(dim('\u2500'), " ").concat(green('assistant'), " ").concat(dim('\u2500'))
};
function createProviderClient(isMock, argv, options) {
    var _getFlagValue, _ref, _getFlagValue1;
    if (isMock) {
        return createMockClient({
            responseText: options === null || options === void 0 ? void 0 : options.mockResponseText,
            chunkDelayMs: options === null || options === void 0 ? void 0 : options.mockChunkDelayMs
        });
    }
    var model = (_getFlagValue = getFlagValue(argv, '--model')) !== null && _getFlagValue !== void 0 ? _getFlagValue : 'gpt-4o-mini';
    var providerConfig = (_ref = options === null || options === void 0 ? void 0 : options.providerConfig) !== null && _ref !== void 0 ? _ref : {
        model: model,
        providers: [
            {
                id: 'default',
                name: 'Default provider',
                provider: (_getFlagValue1 = getFlagValue(argv, '--provider')) !== null && _getFlagValue1 !== void 0 ? _getFlagValue1 : 'openai'
            }
        ]
    };
    return resolveProviderClient(providerConfig);
}
/**
 * Execute the chat command.
 */ // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: chat loop with multi-provider IO is inherently complex; refactoring deferred
export function runChatCommand(argv, io, options) {
    return _async_to_generator(function() {
        var _io_stderr, _getFlagValue, _ref, stderr, isMock, model, headers, client, handler, loop, rl, _iteratorAbruptCompletion, _didIteratorError, _iteratorError, _iterator, _step, _value, line, trimmed, newModel, discovery, _iteratorNormalCompletion, _didIteratorError1, _iteratorError1, _iterator1, _step1, _step_value, provider, models, _iteratorNormalCompletion1, _didIteratorError2, _iteratorError2, _iterator2, _step2, m, error, message, error1, message1, err, error2, message2;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    stderr = (_io_stderr = io.stderr) !== null && _io_stderr !== void 0 ? _io_stderr : function(msg) {
                        return console.error(msg);
                    };
                    isMock = hasFlag(argv, '--mock');
                    model = (_getFlagValue = getFlagValue(argv, '--model')) !== null && _getFlagValue !== void 0 ? _getFlagValue : 'gpt-4o-mini';
                    headers = (_ref = options === null || options === void 0 ? void 0 : options.headers) !== null && _ref !== void 0 ? _ref : DEFAULT_HEADERS;
                    client = createProviderClient(isMock, argv, options);
                    if (isMock) {
                        stderr(dim("[mock] model=".concat(model, "\n")));
                    } else {
                        stderr(dim("model=".concat(model, "\n")));
                    }
                    handler = {
                        stream: function stream(req) {
                            return client.stream(req);
                        }
                    };
                    loop = createSimpleTurnLoop({
                        handler: handler,
                        model: model,
                        systemPrompt: 'You are a helpful assistant.'
                    });
                    rl = createInterface({
                        input: process.stdin,
                        output: process.stdout,
                        prompt: "".concat(cyan('> '))
                    });
                    rl.prompt();
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        23,
                        24,
                        25
                    ]);
                    _iteratorAbruptCompletion = false, _didIteratorError = false;
                    _state.label = 2;
                case 2:
                    _state.trys.push([
                        2,
                        16,
                        17,
                        22
                    ]);
                    _iterator = _async_iterator(rl);
                    _state.label = 3;
                case 3:
                    return [
                        4,
                        _iterator.next()
                    ];
                case 4:
                    if (!(_iteratorAbruptCompletion = !(_step = _state.sent()).done)) return [
                        3,
                        15
                    ];
                    _value = _step.value;
                    line = _value;
                    trimmed = line.trim();
                    if (trimmed === '/exit' || trimmed === '/quit') {
                        return [
                            3,
                            15
                        ];
                    }
                    if (trimmed === '/clear') {
                        console.clear();
                        loop.reset();
                        rl.prompt();
                        return [
                            3,
                            14
                        ];
                    }
                    if (trimmed === '/help') {
                        stderr('Commands:\n' + '  /exit, /quit     Exit the chat\n' + '  /clear           Clear conversation history\n' + '  /model <name>    Switch to a different model\n' + '  /provider        List available providers\n' + '  /status          Show current model and provider\n' + '  /help            Show this help message\n');
                        rl.prompt();
                        return [
                            3,
                            14
                        ];
                    }
                    if (trimmed.startsWith('/model ')) {
                        newModel = trimmed.slice(7).trim();
                        if (newModel) {
                            stderr(dim("[model] model switching requires restart (current: ".concat(model, ", requested: ").concat(newModel, ")\n")));
                        } else {
                            stderr(dim("[model] current model: ".concat(model, "\n")));
                        }
                        rl.prompt();
                        return [
                            3,
                            14
                        ];
                    }
                    if (!(trimmed === '/provider')) return [
                        3,
                        9
                    ];
                    stderr(dim('[provider] discovering local providers...\n'));
                    _state.label = 5;
                case 5:
                    _state.trys.push([
                        5,
                        7,
                        ,
                        8
                    ]);
                    return [
                        4,
                        discoverLocalProviders()
                    ];
                case 6:
                    discovery = _state.sent();
                    if (discovery.discovered.length > 0) {
                        stderr(dim("[provider] found ".concat(discovery.discovered.length, " local provider(s):\n")));
                        _iteratorNormalCompletion = true, _didIteratorError1 = false, _iteratorError1 = undefined;
                        try {
                            for(_iterator1 = discovery.discovered[Symbol.iterator](); !(_iteratorNormalCompletion = (_step1 = _iterator1.next()).done); _iteratorNormalCompletion = true){
                                _step_value = _step1.value, provider = _step_value.provider, models = _step_value.models;
                                stderr(dim("  ".concat(provider, ": ").concat(models.length, " model(s)\n")));
                                _iteratorNormalCompletion1 = true, _didIteratorError2 = false, _iteratorError2 = undefined;
                                try {
                                    for(_iterator2 = models.slice(0, 3)[Symbol.iterator](); !(_iteratorNormalCompletion1 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion1 = true){
                                        m = _step2.value;
                                        stderr(dim("    - ".concat(m.id, "\n")));
                                    }
                                } catch (err) {
                                    _didIteratorError2 = true;
                                    _iteratorError2 = err;
                                } finally{
                                    try {
                                        if (!_iteratorNormalCompletion1 && _iterator2.return != null) {
                                            _iterator2.return();
                                        }
                                    } finally{
                                        if (_didIteratorError2) {
                                            throw _iteratorError2;
                                        }
                                    }
                                }
                                if (models.length > 3) {
                                    stderr(dim("    ... and ".concat(models.length - 3, " more\n")));
                                }
                            }
                        } catch (err) {
                            _didIteratorError1 = true;
                            _iteratorError1 = err;
                        } finally{
                            try {
                                if (!_iteratorNormalCompletion && _iterator1.return != null) {
                                    _iterator1.return();
                                }
                            } finally{
                                if (_didIteratorError1) {
                                    throw _iteratorError1;
                                }
                            }
                        }
                    } else {
                        stderr(dim('[provider] no local providers found\n'));
                    }
                    return [
                        3,
                        8
                    ];
                case 7:
                    error = _state.sent();
                    message = _instanceof(error, Error) ? error.message : String(error);
                    stderr(dim("[provider] error: ".concat(message, "\n")));
                    return [
                        3,
                        8
                    ];
                case 8:
                    rl.prompt();
                    return [
                        3,
                        14
                    ];
                case 9:
                    if (trimmed === '/status') {
                        stderr(dim("[status] model: ".concat(model, "\n")));
                        rl.prompt();
                        return [
                            3,
                            14
                        ];
                    }
                    if (trimmed === '' || trimmed.startsWith('/')) {
                        rl.prompt();
                        return [
                            3,
                            14
                        ];
                    }
                    process.stdout.write("".concat(headers.prefix, "\n"));
                    _state.label = 10;
                case 10:
                    _state.trys.push([
                        10,
                        12,
                        ,
                        13
                    ]);
                    return [
                        4,
                        loop.run(trimmed, {
                            onText: function onText(delta) {
                                process.stdout.write(delta);
                            },
                            onThinking: function onThinking(delta) {
                                process.stdout.write(dim(delta));
                            },
                            onDone: function onDone(_finishReason, usage) {
                                var usageStr = formatUsage(usage === null || usage === void 0 ? void 0 : usage.inputTokens, usage === null || usage === void 0 ? void 0 : usage.outputTokens);
                                if (usageStr) {
                                    process.stdout.write("\n".concat(dim('\u2500\u2500\u2500'), " ").concat(yellow(usageStr), " ").concat(dim('\u2500\u2500\u2500'), "\n"));
                                }
                            },
                            onError: function onError(error) {
                                stderr("\n".concat(dim('[error]'), " ").concat(error.message, "\n"));
                            }
                        })
                    ];
                case 11:
                    _state.sent();
                    process.stdout.write('\n');
                    return [
                        3,
                        13
                    ];
                case 12:
                    error1 = _state.sent();
                    message1 = _instanceof(error1, Error) ? error1.message : String(error1);
                    stderr("\n".concat(dim('[error]'), " ").concat(message1, "\n"));
                    return [
                        3,
                        13
                    ];
                case 13:
                    rl.prompt();
                    _state.label = 14;
                case 14:
                    _iteratorAbruptCompletion = false;
                    return [
                        3,
                        3
                    ];
                case 15:
                    return [
                        3,
                        22
                    ];
                case 16:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        22
                    ];
                case 17:
                    _state.trys.push([
                        17,
                        ,
                        20,
                        21
                    ]);
                    if (!(_iteratorAbruptCompletion && _iterator.return != null)) return [
                        3,
                        19
                    ];
                    return [
                        4,
                        _iterator.return()
                    ];
                case 18:
                    _state.sent();
                    _state.label = 19;
                case 19:
                    return [
                        3,
                        21
                    ];
                case 20:
                    if (_didIteratorError) {
                        throw _iteratorError;
                    }
                    return [
                        7
                    ];
                case 21:
                    return [
                        7
                    ];
                case 22:
                    return [
                        3,
                        25
                    ];
                case 23:
                    error2 = _state.sent();
                    message2 = _instanceof(error2, Error) ? error2.message : String(error2);
                    stderr("".concat(dim('[error]'), " ").concat(message2, "\n"));
                    return [
                        2,
                        1
                    ];
                case 24:
                    rl.close();
                    return [
                        7
                    ];
                case 25:
                    return [
                        2,
                        0
                    ];
            }
        });
    })();
}
