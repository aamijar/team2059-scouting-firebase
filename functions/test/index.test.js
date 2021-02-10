const test = require('firebase-functions-test')();
const myFunctions = require('../index.js')
const assert = require('assert');



describe("add", () => {

    it("add two numbers", () => {
        assert.equal(myFunctions.add(6, 2), 8);
    });
});

describe("multiply", () => {

    it("multiply two numbers", () =>{
        assert.equal(myFunctions.multiply(8,2), 16);
    })
})