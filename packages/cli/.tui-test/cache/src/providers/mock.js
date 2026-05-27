//# hash=1e45f5427841a37435290091b6bad8e5
//# sourceMappingURL=mock.js.map

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
 * Mock provider client for testing the CLI chat command without live API keys.
 *
 * Returns deterministic streaming responses so chat command behavior
 * can be verified in unit tests and manual dogfooding sessions.
 */ import { ReadableStream } from 'node:stream/web';
/** Minimum delay between mock chunks in milliseconds. */ var DEFAULT_CHUNK_DELAY_MS = 15;
/** Default mock response content returned by the mock client. */ var DEFAULT_MOCK_RESPONSE = 'Hello! I am a mock LLM response. This simulates a streaming reply.';
/**
 * Creates a mock UniversalClient-compatible object for testing.
 *
 * The mock client returns configurable deterministic responses and
 * does not connect to any external provider.
 */ export function createMockClient() {
    var options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    var _options_responseText, _options_chunkDelayMs;
    var responseText = (_options_responseText = options.responseText) !== null && _options_responseText !== void 0 ? _options_responseText : DEFAULT_MOCK_RESPONSE;
    var chunkDelayMs = (_options_chunkDelayMs = options.chunkDelayMs) !== null && _options_chunkDelayMs !== void 0 ? _options_chunkDelayMs : DEFAULT_CHUNK_DELAY_MS;
    return {
        complete: // biome-ignore lint/suspicious/useAwait: must match interface return type Promise<CompletionResponse>
        function complete(_request) {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        {
                            content: responseText,
                            model: 'mock-model',
                            usage: {
                                inputTokens: 10,
                                outputTokens: responseText.split(' ').length,
                                totalTokens: 10 + responseText.split(' ').length
                            }
                        }
                    ];
                });
            })();
        },
        stream: // biome-ignore lint/suspicious/useAwait: must match interface return type Promise<ReadableStream<NormalizedChunk>>
        function stream(_request) {
            return _async_to_generator(function() {
                return _ts_generator(this, function(_state) {
                    return [
                        2,
                        new ReadableStream({
                            start: function start(controller) {
                                return _async_to_generator(function() {
                                    var words, _iteratorNormalCompletion, _didIteratorError, _iteratorError, _iterator, _step, word, content, err, allWords;
                                    return _ts_generator(this, function(_state) {
                                        switch(_state.label){
                                            case 0:
                                                // Emit thinking block first
                                                controller.enqueue({
                                                    thinking: 'Mock thinking...',
                                                    done: false
                                                });
                                                return [
                                                    4,
                                                    sleep(chunkDelayMs)
                                                ];
                                            case 1:
                                                _state.sent();
                                                // Emit content word by word for realistic streaming feel
                                                words = responseText.split(' ');
                                                _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
                                                _state.label = 2;
                                            case 2:
                                                _state.trys.push([
                                                    2,
                                                    7,
                                                    8,
                                                    9
                                                ]);
                                                _iterator = words[Symbol.iterator]();
                                                _state.label = 3;
                                            case 3:
                                                if (!!(_iteratorNormalCompletion = (_step = _iterator.next()).done)) return [
                                                    3,
                                                    6
                                                ];
                                                word = _step.value;
                                                content = word === words[0] ? word : " ".concat(word);
                                                controller.enqueue({
                                                    content: content,
                                                    done: false
                                                });
                                                return [
                                                    4,
                                                    sleep(chunkDelayMs)
                                                ];
                                            case 4:
                                                _state.sent();
                                                _state.label = 5;
                                            case 5:
                                                _iteratorNormalCompletion = true;
                                                return [
                                                    3,
                                                    3
                                                ];
                                            case 6:
                                                return [
                                                    3,
                                                    9
                                                ];
                                            case 7:
                                                err = _state.sent();
                                                _didIteratorError = true;
                                                _iteratorError = err;
                                                return [
                                                    3,
                                                    9
                                                ];
                                            case 8:
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
                                            case 9:
                                                // Emit final chunk with usage
                                                allWords = responseText.split(' ');
                                                controller.enqueue({
                                                    done: true,
                                                    finishReason: 'stop',
                                                    usage: {
                                                        inputTokens: 10,
                                                        outputTokens: allWords.length,
                                                        totalTokens: 10 + allWords.length
                                                    }
                                                });
                                                controller.close();
                                                return [
                                                    2
                                                ];
                                        }
                                    });
                                })();
                            }
                        })
                    ];
                });
            })();
        }
    };
}
function sleep(ms) {
    return new Promise(function(resolve) {
        return setTimeout(resolve, ms);
    });
}
