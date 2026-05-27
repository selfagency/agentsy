//# hash=492da6d060cbac81633e7b6803b341c9
//# sourceMappingURL=content-address-stats.js.map

import { createDedupStore, migrateContentToDedupStore } from '@agentsy/memory';
var defaultIo = {
    stderr: function stderr(msg) {
        console.error(msg);
    },
    stdout: function stdout(msg) {
        console.log(msg);
    }
};
export function runContentAddressStatsCommand(argv) {
    var io = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : defaultIo;
    var _io_stdout;
    var sampleArg = argv.find(function(a) {
        return a.startsWith('--sample=');
    });
    var sampleContents = sampleArg === undefined ? [
        'Hello, world!',
        'Hello, world!',
        'Unique content A',
        'Unique content B',
        'Unique content A'
    ] : sampleArg.replace('--sample=', '').split(',').filter(Boolean);
    var asJson = argv.includes('--json');
    var stdout = (_io_stdout = io.stdout) !== null && _io_stdout !== void 0 ? _io_stdout : defaultIo.stdout;
    var store = createDedupStore();
    var stats = migrateContentToDedupStore(sampleContents, store);
    if (asJson) {
        stdout(JSON.stringify({
            deduped: stats.deduped,
            deduplicationRatio: stats.total > 0 ? (stats.deduped / stats.total).toFixed(3) : '0.000',
            entries: store.entries().map(function(e) {
                return {
                    refCount: e.refCount,
                    size: e.fingerprint.size,
                    value: e.fingerprint.value
                };
            }),
            total: stats.total,
            unique: stats.unique
        }, null, 2));
        return 0;
    }
    stdout('Content-Addressing Statistics');
    stdout('-----------------------------');
    stdout("Total items ingested:  ".concat(stats.total));
    stdout("Deduplicated:          ".concat(stats.deduped));
    stdout("Unique content blobs:  ".concat(stats.unique));
    var ratio = stats.total > 0 ? (stats.deduped / stats.total * 100).toFixed(1) : '0.0';
    stdout("Dedup ratio:           ".concat(ratio, "%"));
    stdout('');
    stdout('Fingerprints:');
    var _iteratorNormalCompletion = true, _didIteratorError = false, _iteratorError = undefined;
    try {
        for(var _iterator = store.entries()[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true){
            var entry = _step.value;
            stdout("  ".concat(entry.fingerprint.value, " (").concat(entry.fingerprint.size, " bytes, refs=").concat(entry.refCount, ")"));
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
