//# hash=47d679b9796809e0adacf51ef46d0f5e
//# sourceMappingURL=index.test.js.map

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
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { name, runCli } from './index.js';
describe('cli package scaffold', function() {
    it('exports the package name', function() {
        expect(name).toBe('cli');
    });
    it('runs compress command with inline --text input', function() {
        return _async_to_generator(function() {
            var stdout, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stdout = [];
                        return [
                            4,
                            runCli([
                                'compress',
                                '--level',
                                'full',
                                '--text',
                                'very very verbose verbose text'
                            ], {
                                stderr: function stderr() {
                                // no-op
                                },
                                stdout: function stdout1(value) {
                                    stdout.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(stdout.join('\n')).toContain('Savings:');
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('runs compress command for file input', function() {
        return _async_to_generator(function() {
            var dir, filePath, stdout, stderr, code;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            mkdtemp(join(tmpdir(), 'agentsy-cli-compress-'))
                        ];
                    case 1:
                        dir = _state.sent();
                        filePath = join(dir, 'response.md');
                        return [
                            4,
                            writeFile(filePath, 'This is basically a simple response with fluff.', 'utf-8')
                        ];
                    case 2:
                        _state.sent();
                        stdout = [];
                        stderr = [];
                        return [
                            4,
                            runCli([
                                'compress',
                                '--file',
                                filePath,
                                '--level',
                                'full'
                            ], {
                                stderr: function stderr1(message) {
                                    stderr.push(message);
                                },
                                stdout: function stdout1(message) {
                                    stdout.push(message);
                                }
                            })
                        ];
                    case 3:
                        code = _state.sent();
                        expect(code).toBe(0);
                        expect(stderr).toStrictEqual([]);
                        expect(stdout.join('\n')).toContain('Savings:');
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('runs memory file compression command and preserves original as backup', function() {
        return _async_to_generator(function() {
            var dir, filePath, exitCode, backup;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            mkdtemp(join(tmpdir(), 'agentsy-cli-compress-'))
                        ];
                    case 1:
                        dir = _state.sent();
                        _state.label = 2;
                    case 2:
                        _state.trys.push([
                            2,
                            ,
                            6,
                            8
                        ]);
                        filePath = join(dir, 'CLAUDE.md');
                        return [
                            4,
                            writeFile(filePath, 'line\n\nline\n', 'utf-8')
                        ];
                    case 3:
                        _state.sent();
                        return [
                            4,
                            runCli([
                                'compress-memory',
                                '--file',
                                filePath
                            ], {
                                stderr: function stderr() {
                                // no-op
                                },
                                stdout: function stdout() {
                                // no-op
                                }
                            })
                        ];
                    case 4:
                        exitCode = _state.sent();
                        return [
                            4,
                            readFile("".concat(filePath, ".original.md"), 'utf-8')
                        ];
                    case 5:
                        backup = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(backup).toBe('line\n\nline\n');
                        return [
                            3,
                            8
                        ];
                    case 6:
                        return [
                            4,
                            rm(dir, {
                                force: true,
                                recursive: true
                            })
                        ];
                    case 7:
                        _state.sent();
                        return [
                            7
                        ];
                    case 8:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('runs compress-memory command and writes compressed file with backup', function() {
        return _async_to_generator(function() {
            var dir, filePath, stdout, code, updated, backup;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            mkdtemp(join(tmpdir(), 'agentsy-cli-memory-'))
                        ];
                    case 1:
                        dir = _state.sent();
                        filePath = join(dir, 'CLAUDE.md');
                        return [
                            4,
                            writeFile(filePath, 'This is basically a memory file that is actually verbose.', 'utf-8')
                        ];
                    case 2:
                        _state.sent();
                        stdout = [];
                        return [
                            4,
                            runCli([
                                'compress-memory',
                                '--file',
                                filePath
                            ], {
                                stderr: function stderr() {
                                // no-op for test
                                },
                                stdout: function stdout1(message) {
                                    stdout.push(message);
                                }
                            })
                        ];
                    case 3:
                        code = _state.sent();
                        expect(code).toBe(0);
                        return [
                            4,
                            readFile(filePath, 'utf-8')
                        ];
                    case 4:
                        updated = _state.sent();
                        return [
                            4,
                            readFile("".concat(filePath, ".original.md"), 'utf-8')
                        ];
                    case 5:
                        backup = _state.sent();
                        expect(updated.length).toBeLessThanOrEqual(backup.length);
                        expect(stdout.join('\n')).toContain('Savings:');
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('prints local memory sync dev wiring', function() {
        return _async_to_generator(function() {
            var stdout, code;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stdout = [];
                        return [
                            4,
                            runCli([
                                'memory-sync-dev'
                            ], {
                                stderr: function stderr() {
                                // no-op
                                },
                                stdout: function stdout1(message) {
                                    stdout.push(message);
                                }
                            })
                        ];
                    case 1:
                        code = _state.sent();
                        expect(code).toBe(0);
                        expect(stdout.join('\n')).toContain('tursodb ./.agentsy/local-sync-server.db --sync-server 0.0.0.0:8080');
                        expect(stdout.join('\n')).toContain('TURSO_DATABASE_URL=http://localhost:8080');
                        expect(stdout.join('\n')).toContain("import { createTursoManager } from '@agentsy/memory';");
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('prints local memory sync dev wiring as JSON', function() {
        return _async_to_generator(function() {
            var _stdout_, stdout, code;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stdout = [];
                        return [
                            4,
                            runCli([
                                'memory-sync-dev',
                                '--json',
                                '--server-db',
                                './tmp/server.db',
                                '--replica-db',
                                './tmp/replica.db',
                                '--server-url',
                                'http://localhost:9090',
                                '--bind',
                                '127.0.0.1:9090',
                                '--sync-interval-ms',
                                '1500'
                            ], {
                                stderr: function stderr() {
                                // no-op
                                },
                                stdout: function stdout1(message) {
                                    stdout.push(message);
                                }
                            })
                        ];
                    case 1:
                        code = _state.sent();
                        expect(code).toBe(0);
                        expect(JSON.parse((_stdout_ = stdout[0]) !== null && _stdout_ !== void 0 ? _stdout_ : '{}')).toMatchObject({
                            bindAddress: '127.0.0.1:9090',
                            replicaDbPath: './tmp/replica.db',
                            serverDbPath: './tmp/server.db',
                            serverUrl: 'http://localhost:9090',
                            startCommand: 'tursodb ./tmp/server.db --sync-server 127.0.0.1:9090',
                            syncIntervalMs: 1500
                        });
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('returns non-zero for invalid memory sync interval values', function() {
        return _async_to_generator(function() {
            var stderr, code;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stderr = [];
                        return [
                            4,
                            runCli([
                                'memory-sync-dev',
                                '--sync-interval-ms',
                                'nope'
                            ], {
                                stderr: function stderr1(message) {
                                    stderr.push(message);
                                },
                                stdout: function stdout() {
                                // no-op
                                }
                            })
                        ];
                    case 1:
                        code = _state.sent();
                        expect(code).toBe(1);
                        expect(stderr.join(' ')).toContain('Invalid --sync-interval-ms value');
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('returns non-zero for unknown command', function() {
        return _async_to_generator(function() {
            var stderr, code;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        stderr = [];
                        return [
                            4,
                            runCli([
                                'unknown-command'
                            ], {
                                stderr: function stderr1(message) {
                                    stderr.push(message);
                                },
                                stdout: function stdout() {
                                // no-op
                                }
                            })
                        ];
                    case 1:
                        code = _state.sent();
                        expect(code).toBe(1);
                        expect(stderr.join(' ')).toContain('Unknown command');
                        return [
                            2
                        ];
                }
            });
        })();
    });
});
