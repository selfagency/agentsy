//# hash=478a45fe2185d5229a7e80a74a387e60
//# sourceMappingURL=resolve-provider.js.map

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
import { createLoadBalancedClient } from '@agentsy/gateway';
export function resolveProviderClient(config) {
    return createLoadBalancedClient(_object_spread({
        providers: config.providers
    }, config.model === undefined ? {} : {
        model: config.model
    }, config.strategy === undefined ? {} : {
        strategy: config.strategy
    }, config.circuitBreaker === undefined ? {} : {
        circuitBreaker: config.circuitBreaker
    }, config.retry === undefined ? {} : {
        retry: config.retry
    }));
}
