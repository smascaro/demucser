import { BaseEntity } from "../../infrastructure/base-entity"

export class StatusEntity extends BaseEntity {
    key: number
    value: string

    constructor(key: number, value: string) {
        super()
        this.key = key;
        this.value = value;
    }
}