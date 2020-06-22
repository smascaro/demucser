export class ApiResponse {
    status: ApiResponseStatus
    body: Object
    constructor(statusCode: number, message: string, body: Object) {
        this.status = { code: statusCode, msg: message || "" }
        this.body = body || {}
    }

    jsonify(): string {
        return JSON.stringify(this)
    }
}

export interface ApiResponseStatus {
    msg: string
    code: number
}