//# hash=e4522c467c4db9129d551fb8a6f2df8f
//# sourceMappingURL=chat.test.js.map

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
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runChatCommand } from './chat.js';
/**
 * Create a mock stdin stream that yields the given lines then ends.
 */ function makeMockStdin(lines) {
    return Readable.from(function() {
        var _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, line, err;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                    _state.label = 1;
                case 1:
                    _state.trys.push([
                        1,
                        6,
                        7,
                        8
                    ]);
                    _iterator = lines[Symbol.iterator]();
                    _state.label = 2;
                case 2:
                    if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                        3,
                        5
                    ];
                    line = _step.value;
                    return [
                        4,
                        "".concat(line, "\n")
                    ];
                case 3:
                    _state.sent();
                    _state.label = 4;
                case 4:
                    _iteratorNormalCompletion = true;
                    return [
                        3,
                        2
                    ];
                case 5:
                    return [
                        3,
                        8
                    ];
                case 6:
                    err = _state.sent();
                    _didIteratorError = true;
                    _iteratorError = err;
                    return [
                        3,
                        8
                    ];
                case 7:
                    try {
                        if (!_iteratorNormalCompletion && _iterator.return != null) {
                            _iterator.return();
                        }
                    } finally{
                        if (_didIteratorError) {
                            throw _iteratorError;
                        }
                    }
                    return [
                        7
                    ];
                case 8:
                    return [
                        2
                    ];
            }
        });
    }());
}
describe('chat command', function() {
    afterEach(function() {
        vi.restoreAllMocks();
    });
    it('exits cleanly with /exit command', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, stderrChunks, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        stderrChunks = [];
                        vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock',
                                '--model',
                                'test-model'
                            ], {
                                stderr: function stderr(msg) {
                                    stderrChunks.push(msg);
                                }
                            }, {
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(stderrChunks.some(function(c) {
                            return c.includes('[mock]');
                        })).toBeTruthy();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('sends user message to mock provider and receives response', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, stdoutChunks, exitCode, allOutput;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            'Hello!',
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        stdoutChunks = [];
                        vi.spyOn(process.stdout, 'write').mockImplementation(function(chunk) {
                            stdoutChunks.push(String(chunk));
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock',
                                '--model',
                                'test-model'
                            ], {
                                stderr: function stderr() {
                                // no-op
                                }
                            }, {
                                mockResponseText: 'Test mock response!',
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        allOutput = stdoutChunks.join('');
                        expect(allOutput).toContain('assistant');
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles /help command', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, stderrChunks, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            '/help',
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        stderrChunks = [];
                        vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock'
                            ], {
                                stderr: function stderr(msg) {
                                    stderrChunks.push(msg);
                                }
                            }, {
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(stderrChunks.some(function(c) {
                            return c.includes('Commands:');
                        })).toBeTruthy();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles empty line gracefully', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            '',
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock'
                            ], {
                                stderr: function stderr() {
                                // no-op
                                }
                            }, {
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles /clear command', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, stdoutSpy, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            '/clear',
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock'
                            ], {
                                stderr: function stderr() {
                                    return undefined;
                                }
                            }, {
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(stdoutSpy).toHaveBeenCalled();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles /status command', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, stderrChunks, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            '/status',
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        stderrChunks = [];
                        vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock'
                            ], {
                                stderr: function stderr(msg) {
                                    stderrChunks.push(msg);
                                }
                            }, {
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(stderrChunks.some(function(c) {
                            return c.includes('[status]');
                        })).toBeTruthy();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles unknown slash command', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            '/unknown',
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock'
                            ], {
                                stderr: function stderr() {
                                    return undefined;
                                }
                            }, {
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles /model command with model name', function() {
        return _async_to_generator(function() {
            var mockStdin, origStdin, stderrChunks, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        mockStdin = makeMockStdin([
                            '/model gpt-5',
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        stderrChunks = [];
                        vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 1;
                    case 1:
                        _state.trys.push([
                            1,
                            ,
                            3,
                            4
                        ]);
                        return [
                            4,
                            runChatCommand([
                                '--mock'
                            ], {
                                stderr: function stderr(msg) {
                                    stderrChunks.push(msg);
                                }
                            }, {
                                mockChunkDelayMs: 1
                            })
                        ];
                    case 2:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(stderrChunks.some(function(c) {
                            return c.includes('[model]');
                        })).toBeTruthy();
                        return [
                            3,
                            4
                        ];
                    case 3:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('can be dispatched through runCli', function() {
        return _async_to_generator(function() {
            var runCli, mockStdin, origStdin, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            import('../index.js')
                        ];
                    case 1:
                        runCli = _state.sent().runCli;
                        mockStdin = makeMockStdin([
                            '/exit'
                        ]);
                        origStdin = process.stdin;
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return mockStdin;
                            }
                        });
                        vi.spyOn(process.stdout, 'write').mockImplementation(function() {
                            return true;
                        });
                        _state.label = 2;
                    case 2:
                        _state.trys.push([
                            2,
                            ,
                            4,
                            5
                        ]);
                        return [
                            4,
                            runCli([
                                'chat',
                                '--mock',
                                '--model',
                                'test-model'
                            ], {
                                stderr: function stderr() {
                                // no-op
                                }
                            })
                        ];
                    case 3:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        return [
                            3,
                            5
                        ];
                    case 4:
                        Object.defineProperty(process, 'stdin', {
                            configurable: true,
                            enumerable: true,
                            get: function get() {
                                return origStdin;
                            }
                        });
                        return [
                            7
                        ];
                    case 5:
                        return [
                            2
                        ];
                }
            });
        })();
    });
});
