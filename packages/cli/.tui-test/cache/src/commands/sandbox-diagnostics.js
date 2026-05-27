//# hash=258533a4d1edc03a1eb9d77135ecc016
//# sourceMappingURL=sandbox-diagnostics.js.map

function _define_property(obj, key, value) {
    if (key in obj) {
        Object.defineProperty(obj, key, {
            value: value,
            enumerable: true,
            configurable: true,
            writable: true
        });
    } else {
        obj[key] = value;
    }
    return obj;
}
function _object_spread(target) {
    for(var i = 1; i < arguments.length; i++){
        var source = arguments[i] != null ? arguments[i] : {};
        var ownKeys = Object.keys(source);
        if (typeof Object.getOwnPropertySymbols === "function") {
            ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function(sym) {
                return Object.getOwnPropertyDescriptor(source, sym).enumerable;
            }));
        }
        ownKeys.forEach(function(key) {
            _define_property(target, key, source[key]);
        });
    }
    return target;
}
import { decideSandboxTrigger, detectContainerRuntime } from '@agentsy/runtime';
function runDiagnostics() {
    var detection = detectContainerRuntime();
    var defaultTrigger = decideSandboxTrigger({
        containerAvailable: detection.available
    });
    var untrustedTrigger = decideSandboxTrigger({
        containerAvailable: detection.available,
        trustLevel: 'untrusted'
    });
    return {
        containerRuntime: _object_spread({
            available: detection.available,
            runtime: detection.runtime
        }, detection.socketPath === undefined ? {} : {
            socketPath: detection.socketPath
        }),
        defaultTrigger: {
            mode: defaultTrigger.mode,
            reason: defaultTrigger.reason
        },
        untrustedTrigger: {
            mode: untrustedTrigger.mode,
            reason: untrustedTrigger.reason
        }
    };
}
var defaultIo = {
    stderr: function stderr(msg) {
        console.error(msg);
    },
    stdout: function stdout(msg) {
        console.log(msg);
    }
};
export function runSandboxDiagnosticsCommand(argv) {
    var io = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : defaultIo;
    var _io_stdout;
    var asJson = argv.includes('--json');
    var result = runDiagnostics();
    var stdout = (_io_stdout = io.stdout) !== null && _io_stdout !== void 0 ? _io_stdout : defaultIo.stdout;
    if (asJson) {
        stdout(JSON.stringify(result, null, 2));
        return 0;
    }
    stdout('Sandbox Diagnostics');
    stdout('-------------------');
    stdout("Container runtime:  ".concat(result.containerRuntime.runtime));
    stdout("Container available: ".concat(result.containerRuntime.available));
    if (result.containerRuntime.socketPath !== undefined) {
        stdout("Socket path:        ".concat(result.containerRuntime.socketPath));
    }
    stdout('');
    stdout("Default trigger mode:    ".concat(result.defaultTrigger.mode, " (").concat(result.defaultTrigger.reason, ")"));
    stdout("Untrusted trigger mode:  ".concat(result.untrustedTrigger.mode, " (").concat(result.untrustedTrigger.reason, ")"));
    return 0;
}
