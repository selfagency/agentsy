//# hash=c5379c4ace96c851a0c5776514496827
//# sourceMappingURL=tui.js.map

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
/**
 * Ink TUI command — full Agentsy IDE experience.
 *
 * Launched as the default entry-point when `agentsy` is invoked with no
 * subcommand, or explicitly via `agentsy tui`.  Wires the turn loop,
 * CLI stream bridge, and Ink agent renderer into a single interactive
 * terminal session.
 *
 * @example
 * ```bash
 * # Launch the TUI (default)
 * agentsy
 *
 * # Explicit subcommand
 * agentsy tui --model claude-3-5-sonnet
 *
 * # Use a mock provider (no API key)
 * agentsy tui --mock
 * ```
 */ import { createCliStreamBridge } from '@agentsy/renderers/adapters';
import { createInkAgentRenderer, createInkRuntimeController } from '@agentsy/renderers/ink';
import { createSimpleTurnLoop } from '@agentsy/runtime/loop';
import { createMockClient } from '../providers/mock.js';
import { resolveProviderClient } from '../providers/resolve-provider.js';
// ── Helpers (mirrored from chat.ts until a shared utils module is added) ────────
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
function createProviderClient(isMock, argv) {
    var _getFlagValue, _getFlagValue1;
    if (isMock) {
        return createMockClient({});
    }
    var model = (_getFlagValue = getFlagValue(argv, '--model')) !== null && _getFlagValue !== void 0 ? _getFlagValue : 'gpt-4o-mini';
    var providerConfig = {
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
// ── TUI command ──────────────────────────────────────────────────────────────────
/**
 * Run the full Ink TUI agent session.
 */ export function runTuiCommand(argv, _io) {
    return _async_to_generator(function() {
        var _getFlagValue, isMock, model, client, handler, loop, controller, bridgeEvents, handle;
        return _ts_generator(this, function(_state) {
            switch(_state.label){
                case 0:
                    isMock = hasFlag(argv, '--mock');
                    model = (_getFlagValue = getFlagValue(argv, '--model')) !== null && _getFlagValue !== void 0 ? _getFlagValue : 'gpt-4o-mini';
                    client = createProviderClient(isMock, argv);
                    handler = {
                        stream: function stream(req) {
                            return client.stream(req);
                        }
                    };
                    loop = createSimpleTurnLoop({
                        handler: handler,
                        model: model
                    });
                    controller = createInkRuntimeController({
                        onWarning: function onWarning() {
                        /* noop */ }
                    });
                    bridgeEvents = createCliStreamBridge(controller.listeners);
                    return [
                        4,
                        createInkAgentRenderer({
                            controller: controller,
                            onInput: function onInput(text) {
                                return _async_to_generator(function() {
                                    return _ts_generator(this, function(_state) {
                                        switch(_state.label){
                                            case 0:
                                                return [
                                                    4,
                                                    loop.run(text, bridgeEvents)
                                                ];
                                            case 1:
                                                _state.sent();
                                                return [
                                                    2
                                                ];
                                        }
                                    });
                                })();
                            }
                        })
                    ];
                case 1:
                    handle = _state.sent();
                    return [
                        4,
                        handle.waitUntilExit()
                    ];
                case 2:
                    _state.sent();
                    return [
                        2,
                        0
                    ];
            }
        });
    })();
}
