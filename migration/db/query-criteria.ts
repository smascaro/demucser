export class QueryOptions {
    omitErrors?: boolean
    sort?: QueryOptionsSort
    limit?: number
    offset?: number

}

export enum QueryOptionsSort {
    NEWEST = 1,
    OLDEST = 2,
    POPULAR = 3
}
