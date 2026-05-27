//# hash=2adb051b27ee7884c0839234a7529f8f
//# sourceMappingURL=chat-streaming.spec.js.map

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
var _process_env_OLLAMA_API_KEY;
/**
 * E2E chat streaming tests against a real provider API (Ollama).
 *
 * These tests spawn the CLI as a subprocess via tui-test and verify that
 * interactive streaming works end-to-end — from message input through
 * the provider request pipeline to visible token-by-token output.
 *
 * **Env requirement:** `OLLAMA_API_KEY` must be set in the shell running
 * `pnpm test:e2e`. Tests will gracefully skip if the key is missing.
 *
 * @example
 * ```bash
 * # Build the CLI binary first
 * pnpm --filter @agentsy/cli build
 * # Run E2E tests (requires OLLAMA_API_KEY in env)
 * pnpm --filter @agentsy/cli test:e2e
 * ```
 */ import { expect, test } from '@microsoft/tui-test';
var BASE_URL = 'https://ollama.com/v1/chat/completions';
var MODEL = 'deepseek-v4-flash';
var apiKey = (_process_env_OLLAMA_API_KEY = process.env.OLLAMA_API_KEY) !== null && _process_env_OLLAMA_API_KEY !== void 0 ? _process_env_OLLAMA_API_KEY : null;
/**
 * Build the CLI command string for chat.
 * When apiKey is available and the test requires a valid key,
 * the flag is included. Otherwise an explicit key can be injected
 * for error-path tests.
 */ function chatCommand(overrideKey) {
    var _ref;
    var key = (_ref = overrideKey !== null && overrideKey !== void 0 ? overrideKey : apiKey) !== null && _ref !== void 0 ? _ref : '';
    var keyFlag = key ? "--api-key ".concat(key) : '';
    return "node dist/cli.js chat --base-url ".concat(BASE_URL, " ").concat(keyFlag, " --model ").concat(MODEL).trim();
}
test.describe('chat streaming E2E — Ollama', function() {
    // ── 1. Streaming renders text deltas ──────────────────────────────────────
    test('streaming renders text deltas', function(param) {
        var terminal = param.terminal;
        return _async_to_generator(function() {
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (apiKey === null) {
                            return [
                                2
                            ]; // OLLAMA_API_KEY not set — skip
                        }
                        return [
                            4,
                            terminal.submit(chatCommand())
                        ];
                    case 1:
                        _state.sent();
                        // Wait for the prompt to appear before sending input
                        return [
                            4,
                            terminal.write('Count from 1 to 5, separated by commas.')
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 3:
                        _state.sent();
                        // Wait for the assistant header — signals the stream has started
                        return [
                            4,
                            expect(terminal.getByText(/assistant/gi)).toBeVisible()
                        ];
                    case 4:
                        _state.sent();
                        // Count from 1 to 5 reliably produces "1, 2, 3, 4, 5".
                        // The pattern /,\s[2-4]/g matches ",\s2|,\s3|,\s4" which only appears in
                        // the model response, not in the user's prompt "Count from 1 to 5"
                        // (no commas, digits 2-4 only as part of "to 5").
                        return [
                            4,
                            expect(terminal.getByText(/,\s[2-4]/g, {
                                full: true,
                                strict: false
                            })).toBeVisible({
                                timeout: 60000
                            })
                        ];
                    case 5:
                        _state.sent();
                        // Exit cleanly
                        return [
                            4,
                            terminal.write('/exit')
                        ];
                    case 6:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 7:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    });
    // ── 2. Error with invalid API key ────────────────────────────────────────
    test('shows error for invalid API key', function(param) {
        var terminal = param.terminal;
        return _async_to_generator(function() {
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        // This test does NOT require a valid API key — it intentionally uses 'invalid'
                        return [
                            4,
                            terminal.submit(chatCommand('invalid'))
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            terminal.write('Hello')
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 3:
                        _state.sent();
                        // The provider should reject with 401 and the CLI should display the error
                        return [
                            4,
                            expect(terminal.getByText(/error|401|Unauthorized|invalid|failed/gi)).toBeVisible({
                                timeout: 30000
                            })
                        ];
                    case 4:
                        _state.sent();
                        return [
                            4,
                            terminal.write('/exit')
                        ];
                    case 5:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 6:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    });
    // ── 3. /status shows model info ──────────────────────────────────────────
    test('/status shows the current model', function(param) {
        var terminal = param.terminal;
        return _async_to_generator(function() {
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (apiKey === null) {
                            return [
                                2
                            ]; // OLLAMA_API_KEY not set — skip
                        }
                        return [
                            4,
                            terminal.submit(chatCommand())
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            terminal.write('/status')
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 3:
                        _state.sent();
                        // The status line includes the model name
                        return [
                            4,
                            expect(terminal.getByText(new RegExp(MODEL, 'gi'))).toBeVisible()
                        ];
                    case 4:
                        _state.sent();
                        return [
                            4,
                            terminal.write('/exit')
                        ];
                    case 5:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 6:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    });
    // ── 4. /help lists available commands ────────────────────────────────────
    test('/help lists available commands', function(param) {
        var terminal = param.terminal;
        return _async_to_generator(function() {
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (apiKey === null) {
                            return [
                                2
                            ]; // OLLAMA_API_KEY not set — skip
                        }
                        return [
                            4,
                            terminal.submit(chatCommand())
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            terminal.write('/help')
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 3:
                        _state.sent();
                        return [
                            4,
                            expect(terminal.getByText(/Commands:/g)).toBeVisible()
                        ];
                    case 4:
                        _state.sent();
                        return [
                            4,
                            expect(terminal.getByText(/\/exit/gi)).toBeVisible()
                        ];
                    case 5:
                        _state.sent();
                        return [
                            4,
                            expect(terminal.getByText(/\/clear/gi)).toBeVisible()
                        ];
                    case 6:
                        _state.sent();
                        return [
                            4,
                            terminal.write('/exit')
                        ];
                    case 7:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 8:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    });
    // ── 5. Ctrl+C during streaming ──────────────────────────────────────────
    test('handles Ctrl+C during streaming gracefully', function(param) {
        var terminal = param.terminal;
        return _async_to_generator(function() {
            return _ts_generator(this, function(_state) {
                switch(_state.label){
                    case 0:
                        if (apiKey === null) {
                            return [
                                2
                            ]; // OLLAMA_API_KEY not set — skip
                        }
                        return [
                            4,
                            terminal.submit(chatCommand())
                        ];
                    case 1:
                        _state.sent();
                        return [
                            4,
                            terminal.write('Write a short sentence about AI.')
                        ];
                    case 2:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 3:
                        _state.sent();
                        // Give the stream a moment to start producing output
                        return [
                            4,
                            expect(terminal.getByText(/assistant/gi)).toBeVisible({
                                timeout: 30000
                            })
                        ];
                    case 4:
                        _state.sent();
                        // Interrupt the stream mid-flight. The CLI continues processing the
                        // current streaming response (no early-termination), then exits.
                        // After the process exits, bash takes over and processes buffered input.
                        return [
                            4,
                            terminal.keyCtrlC()
                        ];
                    case 5:
                        _state.sent();
                        // Send a unique marker — this only appears after bash regains control.
                        return [
                            4,
                            terminal.write('echo tui-test-ok')
                        ];
                    case 6:
                        _state.sent();
                        return [
                            4,
                            terminal.keyPress('Enter')
                        ];
                    case 7:
                        _state.sent();
                        // Generous timeout: streaming must complete before the CLI exits
                        // and bash processes the echo command.
                        return [
                            4,
                            expect(terminal.getByText(/tui-test-ok/g, {
                                full: true,
                                strict: false
                            })).toBeVisible({
                                timeout: 120000
                            })
                        ];
                    case 8:
                        _state.sent();
                        return [
                            2
                        ];
                }
            });
        })();
    });
});
