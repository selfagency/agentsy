//# hash=f77549ec39cc3122fe44f1458769e4d6
//# sourceMappingURL=commands.perf.test.js.map

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
function _ts_values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function() {
            if (o && i >= o.length) o = void 0;
            return {
                value: o && o[i++],
                done: !o
            };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runCli } from './index.js';
/**
 * Phase 0 CLI Command Validation
 * Ensures compress and compress-memory commands work correctly
 */ var SAMPLE_TEXT = "\nThis is a very comprehensive response that provides really extensive information.\nThe response is basically quite verbose and could definitely benefit from compression.\nThere is really quite a lot of redundant content here that should be compressed.\n";
describe('Phase 0: CLI Commands Validation', function() {
    var testFile;
    var capturedOutput;
    beforeEach(function() {
        testFile = join('/tmp', "test-cli-".concat(Date.now(), ".txt"));
        capturedOutput = [];
    });
    afterEach(function() {
        if (existsSync(testFile)) {
            unlinkSync(testFile);
        }
        var memoryTestFile = testFile.replace('.txt', '.md');
        if (existsSync(memoryTestFile)) {
            unlinkSync(memoryTestFile);
        }
        var backupFile = "".concat(memoryTestFile, ".original.md");
        if (existsSync(backupFile)) {
            unlinkSync(backupFile);
        }
    });
    it('compress command works with --text flag', function() {
        return _async_to_generator(function() {
            var exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            runCli([
                                'compress',
                                '--level',
                                'full',
                                '--text',
                                SAMPLE_TEXT
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stdout: function stdout(value) {
                                    capturedOutput.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        expect(capturedOutput.length).toBeGreaterThan(0);
                        expect(capturedOutput[0]).toBeDefined(); // Compressed output
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('compress command supports different levels', function() {
        return _async_to_generator(function() {
            var _loop, _i, _iter;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        _loop = function(_i, _iter) {
                            var level, currentLevelOutput, stdout, exitCode;
                            return _ts_generator(this, function(_state) {
                                switch(_state.label){
                                    case 0:
                                        level = _iter[_i];
                                        currentLevelOutput = [];
                                        // oxlint-disable-next-line typescript/no-loop-func
                                        stdout = function stdout(value) {
                                            currentLevelOutput.push(value);
                                        };
                                        capturedOutput = [];
                                        return [
                                            4,
                                            runCli([
                                                'compress',
                                                '--level',
                                                level,
                                                '--text',
                                                SAMPLE_TEXT
                                            ], {
                                                stdout: stdout
                                            })
                                        ];
                                    case 1:
                                        exitCode = _state.sent();
                                        expect(exitCode).toBe(0);
                                        if (currentLevelOutput.length === 0) {
                                            console.log("No output for level: ".concat(level, ", currentLevelOutput:"), currentLevelOutput);
                                            throw new Error("Expected output for level ".concat(level));
                                        }
                                        return [
                                            2
                                        ];
                                }
                            });
                        };
                        _i = 0, _iter = [
                            'lite',
                            'full',
                            'ultra'
                        ];
                        _state.label = 1;
                    case 1:
                        if (!(_i < _iter.length)) return [
                            3,
                            4
                        ];
                        return [
                            5,
                            _ts_values(_loop(_i, _iter))
                        ];
                    case 2:
                        _state.sent();
                        _state.label = 3;
                    case 3:
                        _i++;
                        return [
                            3,
                            1
                        ];
                    case 4:
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('compress-memory command creates backup', function() {
        return _async_to_generator(function() {
            var memoryFile, exitCode, backupFile, backupContent;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        memoryFile = testFile.replace('.txt', '.md');
                        writeFileSync(memoryFile, SAMPLE_TEXT, 'utf-8');
                        return [
                            4,
                            runCli([
                                'compress-memory',
                                '--file',
                                memoryFile
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stdout: function stdout(value) {
                                    capturedOutput.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        backupFile = "".concat(memoryFile, ".original.md");
                        expect(existsSync(backupFile)).toBeTruthy();
                        // Verify backup contains original content
                        backupContent = readFileSync(backupFile, 'utf-8');
                        expect(backupContent).toContain('comprehensive');
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('compress-memory command preserves code blocks', function() {
        return _async_to_generator(function() {
            var memoryFile, contentWithCode, exitCode, compressedContent;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        memoryFile = testFile.replace('.txt', '.md');
                        contentWithCode = "\n".concat(SAMPLE_TEXT, "\n\n```typescript\nexport function important(): void {}\n```\n\nMore text after code.\n    ");
                        writeFileSync(memoryFile, contentWithCode, 'utf-8');
                        return [
                            4,
                            runCli([
                                'compress-memory',
                                '--file',
                                memoryFile
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stdout: function stdout(value) {
                                    capturedOutput.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        // Verify compressed file preserves code
                        compressedContent = readFileSync(memoryFile, 'utf-8');
                        expect(compressedContent).toContain('export function important');
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('compress command reports savings ratio', function() {
        return _async_to_generator(function() {
            var exitCode, savingsLine;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        return [
                            4,
                            runCli([
                                'compress',
                                '--level',
                                'ultra',
                                '--text',
                                SAMPLE_TEXT
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stdout: function stdout(value) {
                                    capturedOutput.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        // Should have compressed content and savings ratio
                        savingsLine = capturedOutput.find(function(line) {
                            return line.includes('Savings:');
                        });
                        expect(savingsLine).toBeDefined();
                        // oxlint-disable-next-line require-unicode-regexp
                        expect(savingsLine).toMatch(/Savings: \d+\.\d+%/);
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('compress command completes quickly', function() {
        return _async_to_generator(function() {
            var startTime, elapsed;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        startTime = performance.now();
                        return [
                            4,
                            runCli([
                                'compress',
                                '--level',
                                'full',
                                '--text',
                                SAMPLE_TEXT
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stdout: function stdout(value) {
                                    capturedOutput.push(value);
                                }
                            })
                        ];
                    case 1:
                        _state.sent();
                        elapsed = performance.now() - startTime;
                        console.log("CLI command time: ".concat(elapsed.toFixed(2), "ms"));
                        expect(elapsed).toBeLessThan(100);
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles missing --file argument gracefully', function() {
        return _async_to_generator(function() {
            var errors, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        errors = [];
                        return [
                            4,
                            runCli([
                                'compress-memory'
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stderr: function stderr(value) {
                                    errors.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(1);
                        expect(errors.some(function(e) {
                            return e.includes('Missing --file');
                        })).toBeTruthy();
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('handles missing input for compress command', function() {
        return _async_to_generator(function() {
            var errors, exitCode;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        errors = [];
                        return [
                            4,
                            runCli([
                                'compress'
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stderr: function stderr(value) {
                                    errors.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(1);
                        expect(errors.some(function(e) {
                            return e.includes('Missing input');
                        })).toBeTruthy();
                        return [
                            2
                        ];
                }
            });
        })();
    });
    it('compress-memory command reports savings', function() {
        return _async_to_generator(function() {
            var memoryFile, exitCode, savingsLine;
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        memoryFile = testFile.replace('.txt', '.md');
                        writeFileSync(memoryFile, SAMPLE_TEXT, 'utf-8');
                        return [
                            4,
                            runCli([
                                'compress-memory',
                                '--file',
                                memoryFile
                            ], {
                                // oxlint-disable-next-line typescript/no-confusing-void-expression
                                stdout: function stdout(value) {
                                    capturedOutput.push(value);
                                }
                            })
                        ];
                    case 1:
                        exitCode = _state.sent();
                        expect(exitCode).toBe(0);
                        savingsLine = capturedOutput.find(function(line) {
                            return line.includes('Savings:');
                        });
                        expect(savingsLine).toBeDefined();
                        return [
                            2
                        ];
                }
            });
        })();
    });
});
