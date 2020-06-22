import { ApiResponse } from "../migration/db/api-response"
import { expect } from "chai"
describe('ApiResponse', () => {
    it('must have valid content from ctor', () => {
        let testCode = 123
        let testMessage = 'Test message'
        let testBody = { param1: 'value1', param2: 2, param3: { item: 'item', value: 1 }, array: [1, 2, 3, 4, 5, 6] }
        let response = new ApiResponse(123, 'Test message', testBody)
        expect(response.status).to.not.be.null
        expect(response.status).to.not.be.undefined
        expect(response.status.code).to.be.eq(testCode)
        expect(response.status.msg).to.be.eq(testMessage)
        expect(response.body).to.be.eq(testBody)
    })
})