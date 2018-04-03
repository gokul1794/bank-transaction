var app = require('../app.js');
var assert = require('assert');
var expect = require('expect.js');

var db = require('../database');
var pool = db.pool;

var should = require('chai').should(),
    supertest = require('supertest'),
    api = supertest('http://localhost:3000');

describe('Tests', function() {
    // runs before all tests in this block
    before(async function() {
        try {
            let balancesTable = await pool.query("CREATE TABLE balances (accountNumber VARCHAR(20) NOT NULL UNIQUE, balance DECIMAL(13,4));");
            let transactionsTable = await pool.query("CREATE TABLE transactions(transactionRef varchar(40) NOT NULL UNIQUE, amount DECIMAL(13,4) NOT NULL, " +
                "fromAccount VARCHAR(20) NOT NULL, toAccount VARCHAR(20) NOT NULL, transactionDate DATETIME);");
            let insertBalance1 = await pool.query("insert into balances values('gokul@gmail.com',500);");
            let insertBalance2 = await pool.query("insert into balances values('abhi@gmail.com',1000);");
            let insertBalance3 = await pool.query("insert into balances values('avesh@gmail.com',750);");
            console.log("Initital set up done");
        } catch (err) {
            console.log("Some error");
        }
    });
    // runs after all tests in this block
    after(async function() {
        try {
            let dropbalance = await pool.query("drop table balances;");
            let droptransaction = await pool.query("drop table transactions;");
            console.log("Drop databases");
        } catch (err) {
            console.log("Some error");
        }
    });

    beforeEach(function() {
        // runs before each test in this block
    });

    afterEach(function() {
        // runs after each test in this block
    });
    // test cases

    it('Should return errors for invalid request body', function(done) {
        api.post('/transactions')
            .send({
                "from": "gokulgmail.com",
                "to": "abhigmail.com",
                "amount": 5
            }).end(function(err, res) {
                expect(res.body).to.not.equal(null);
                expect(res.body.status).to.equal('failure');
                done();
            });
    });

    it('Should return error for wrong from account', function(done) {
        api.post('/transactions')
            .send({
                "from": "gokul123@gmail.com",
                "to": "abhi@gmail.com",
                "amount": 5
            }).end(function(err, res) {
                expect(res.body).to.not.equal(null);
                expect(res.body.status).to.equal('failure');
                done();
            });
    });

    it('Should return error for wrong to account', function(done) {
        api.post('/transactions')
            .send({
                "from": "gokul@gmail.com",
                "to": "abhi123@gmail.com",
                "amount": 5
            }).end(function(err, res) {
                expect(res.body).to.not.equal(null);
                expect(res.body.status).to.equal('failure');
                done();
            });
    });

    it('Should return error for wrong amount', function(done) {
        api.post('/transactions')
            .send({
                "from": "gokul@gmail.com",
                "to": "abhi@gmail.com",
                "amount": -100
            }).end(function(err, res) {
                expect(res.body).to.not.equal(null);
                expect(res.body.status).to.equal('failure');
                done();
            });
    });

    it('Transfers 100 bucks to Abhi from Gokul', function(done) {
        api.post('/transactions')
            .send({
                "from": "gokul@gmail.com",
                "to": "abhi@gmail.com",
                "amount": 100
            }).end(function(err, res) {
                expect(res.body).to.not.equal(null);
                expect(res.body.status).to.equal('success');
                done();
            });
    });

    it('Fails on pressing transfer twice', function(done) {
        //Pressing transfer twice
        api.post('/transactions')
            .send({
                "from": "gokul@gmail.com",
                "to": "abhi@gmail.com",
                "amount": 5
            }).end(function(err, res) {
                expect(res.body).to.not.equal(null);
                expect(res.body.status).to.equal('success');

                api.post('/transactions')
                    .send({
                        "from": "gokul@gmail.com",
                        "to": "abhi@gmail.com",
                        "amount": 5
                    }).end(function(err, res) {
                        expect(res.body).to.not.equal(null);
                        expect(res.body.status).to.equal('failure');
                        done();
                    });
            });
    });


    it('Two people transferring at the same time', function(done) {
        //Pressing transfer twice
        api.post('/transactions')
            .send({
                "from": "gokul@gmail.com",
                "to": "avesh@gmail.com",
                "amount": 10
            }).end(function(err, res) {
                expect(res.body).to.not.equal(null);
                expect(res.body.status).to.equal('success');

                api.post('/transactions')
                    .send({
                        "from": "abhi@gmail.com",
                        "to": "avesh@gmail.com",
                        "amount": 100
                    }).end(function(err, res) {
                        expect(res.body).to.not.equal(null);
                        expect(res.body.status).to.equal('success');
                        done();
                    });
            });
    });
});