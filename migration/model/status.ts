export class Status {
    key:number
    value:string
    constructor(id?:number,name?:string){
        this.key=id || -256
        this.value=name || ""
    }
}

export interface IStatus {
    key:number,
    value:string
}