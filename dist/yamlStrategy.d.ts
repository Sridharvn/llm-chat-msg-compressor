import { CompressionStrategy } from "./strategies";
export declare class YamlStrategy implements CompressionStrategy {
    name: string;
    compress(data: any): any;
    decompress(pkg: any): any;
}
