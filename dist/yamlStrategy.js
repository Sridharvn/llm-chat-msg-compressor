"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YamlStrategy = void 0;
const yaml = require("js-yaml");
class YamlStrategy {
    constructor() {
        this.name = "yaml";
    }
    compress(data) {
        // Serialize to YAML string and wrap in marker
        const s = yaml.dump(data, { noRefs: true, lineWidth: -1 });
        return { $y: s };
    }
    decompress(pkg) {
        if (!pkg || !pkg.$y || typeof pkg.$y !== "string")
            return pkg;
        return yaml.load(pkg.$y);
    }
}
exports.YamlStrategy = YamlStrategy;
