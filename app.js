const express = require('express')
const bodyParser = require('body-parser');
var pool = require('./database')
var asyncMiddleware = require('./asyncMiddleware');
var mysql = require('mysql')
const uuidv1 = require('uuid/v1');

const transferTwiceTimeOut = 10;
const SUCCESS = "success";
const FAILURE = "failure";

var validator = require('express-validator');

const app = express()

app.use(bodyParser.urlencoded({
    extended: false
}));
app.use(bodyParser.json())
app.use(validator());

app.post('/transactions', asyncMiddleware(async (req, res, next) => {
    req.checkBody("from", "Enter a valid email address.").isEmail().exists();
    req.checkBody("to", "Enter a valid email address.").isEmail().exists();
    req.checkBody("amount", "Amount should be a number").isDecimal().exists();
    var errors = req.validationErrors();
    if (errors) {
        res.send({
            "status": FAILURE,
            "errors": errors
        });
        return;
    }
    if (req.body.amount > 1 && req.body.from !== req.body.to) {

        let checkifFromExistsWithBalance = await checkifAccountExists(req.body.from, req.body.amount);
        let checkifToAccountExists = await checkifAccountExists(req.body.to, 0);

        if (checkifToAccountExists && checkifFromExistsWithBalance) {
            pool.getConnection((err, connection) => {
                connection.beginTransaction(async function(err) {
                    if (err) {
                        console.log("Couldn't begin transaction"); //Transaction Error (Rollback and release connection)
                        connection.rollback(function() {
                            connection.release();
                            res.send({
                                "status": FAILURE,
                                "errors": err
                            });
                        });
                    }
                    let similarTransactionCheck = await checkSimilarTransaction(req.body);
                    if (similarTransactionCheck.status === SUCCESS) {
                        let updateFrom = await updateAccount(req.body, true, connection);
                        let updateTo = await updateAccount(req.body, false, connection);
                        let insertTrans = await insertIntoTransaction(req.body, connection);
                        let result = await getTransaction(insertTrans, connection, function(data) {
                            res.send({
                                "status": SUCCESS,
                                "data": data
                            });
                        });
                    } else {
                        res.send({
                            "status": FAILURE,
                            "errors": similarTransactionCheck.data
                        });
                    }
                });
            });
        } else {
            res.send({
                "status": FAILURE,
                "errors": "check account numbers and balances"
            });
        }
    } else {
        res.send({
            "status": FAILURE,
            "errors": "check request body again"
        });
    }
}));

/* Checking if similar transactions exist*/
let checkSimilarTransaction = async (request) => {
    try {
        let query = "select * from transactions where fromAccount = ? and toAccount = ? and amount = ? order by transactionDate desc limit 1;"
        let inserts = [request.from, request.to, request.amount];
        let sqlStatement = mysql.format(query,inserts);
        let result = await pool.query(sqlStatement);
        if (result[0]) {
            let timeDifference = ((new Date()) - result[0].transactionDate) / 1000;
            if (timeDifference < transferTwiceTimeOut) {
                return ({
                    "status": FAILURE,
                    "data": "Possible duplicate transaction " + timeDifference.toString()
                });
            } else {
                return ({
                    "status": SUCCESS,
                    "data": "New transaction, Old transaction was " + timeDifference.toString() + " seconds ago."
                });
            }
        } else {
            return ({
                "status": SUCCESS,
                "data": "No record found in the DB, new transaction."
            });
        }
    } catch (err) {
        console.log(err);
        return {
            "status": FAILURE,
            "errors": err
        };
    }
}
/* Updates From and To account's balance respectively */
let updateAccount = async (request, operator, connection) => {
    try {
        let query = operator ? "UPDATE balances SET balances.balance = balances.balance-? where balances.accountNumber = ?" : "UPDATE balances SET balances.balance = balances.balance+? where balances.accountNumber = ?";
        let requestPerson = operator ? request.from : request.to;
        let inserts = [request.amount, requestPerson];
        let sqlStatement = mysql.format(query,inserts);
        let response = await connection.query(sqlStatement, (error, result) => {
            if (error) {
                console.log("Error while updating to balances table fromAccount;Roll back");
                return connection.rollback();
            };

        });
        return response;
    } catch (err) {
        console.log(err);
        return {
            "status": FAILURE,
            "errors": err
        };
    }
}

/* Inserts into the transaction table */
let insertIntoTransaction = async (request, connection) => {
    try {
        const referenceNo = uuidv1();
        let query = "insert into transactions (transactionRef,amount,fromAccount,toAccount,transactionDate) values(?,?,?,?,CURRENT_TIMESTAMP());"
        let inserts = [referenceNo, request.amount, request.from, request.to]
        let sqlStatement = mysql.format(query,inserts);
        result3 = await connection.query(sqlStatement, (error, result3) => {
            if (error) {
                console.log("Error while inserting to Transaction table;Roll back");
                return connection.rollback();
            }
            connection.commit(function(err) {
                if (err) {
                    console.log("Couldn't commit transaction;Roll back");
                    return connection.rollback();
                }
            });
        });
        return referenceNo;
    } catch (err) {
        console.log(err);
        return {
            "status": FAILURE,
            "errors": err
        };
    }
}

/* Get transaction by transactionId */
let getTransaction = async (transactionId, connection, callback) => {
    try {
        console.log(transactionId);
        let query = "select * from transactions where transactions.transactionRef=?;";
        let inserts = [transactionId];
        let sqlStatement = mysql.format(query,inserts);
        let response = await connection.query(sqlStatement, (err, result) => {
            callback(result)
        });
    } catch (err) {
        console.log(err);
        return {
            "status": FAILURE,
            "errors": err
        };
    }
}

/* Check if account exists with balance */
let checkifAccountExists = async (id, amount) => {
    try {
        let query = "SELECT * FROM balances WHERE balances.accountNumber = ? and balances.balance>=? LIMIT 1"
        let inserts =  [id, amount];
        let sqlStatement = mysql.format(query,inserts);
        let result = await pool.query(sqlStatement);
        return result[0];
    } catch (err) {
        console.log(err);
        return {
            "status": FAILURE,
            "errors": err
        };
    }
}

module.exports = {
    checkifAccountExists,
    getTransaction,
    insertIntoTransaction,
    updateAccount,
    checkSimilarTransaction
}

app.listen(3000, () => console.log('Bank transaction example.'))