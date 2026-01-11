export interface DataRefinementOptions {
    enabled?: boolean;
    precision?: number;
    pruneEmpty?: boolean;
    pruneNull?: boolean;
}
export declare const refineData: (root: any, options?: DataRefinementOptions) => any;
