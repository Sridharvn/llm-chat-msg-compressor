import { CompressionStrategy } from "./strategies";

const yaml = require("js-yaml");

export class YamlStrategy implements CompressionStrategy {
  name = "yaml";

  compress(data: any): any {
    // Serialize to YAML string and wrap in marker
    const s = yaml.dump(data, { noRefs: true, lineWidth: -1 });
    return { $y: s };
  }

  decompress(pkg: any): any {
    if (!pkg || !pkg.$y || typeof pkg.$y !== "string") return pkg;
    return yaml.load(pkg.$y);
  }
}
