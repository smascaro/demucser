module.exports = {
    ApiResponse: class ApiResponse {
        constructor(status, msg, body) {
            this.status = {
                "code": status,
                "message": msg
            }
            if (body) {
                this.body = body
            } else {
                this.body = {}
            }
        }
        jsonify() {
            return JSON.stringify(this)
        }
    }
}