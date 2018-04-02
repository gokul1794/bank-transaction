const express = require('express')
const bodyParser = require('body-parser');
var pool = require('./database')
var asyncMiddleware = require('./asyncMiddleware');
const uuidv1 = require('uuid/v1');

const transferTwiceTimeOut = 10;
const SUCCESS = "success";
const FAILURE = "failure";

var validator = require('express-validator');

const app = express()

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())
app.use(validator());

app.get('/',(req, res) => res.send({'message':'Hello world! My first Node app.'}) );

app.post('/transactions', asyncMiddleware( async(req,res,next)=>{
	console.log("Transaction time "+ new Date().toString());
	req.checkBody("from", "Enter a valid email address.").isEmail().exists();
	req.checkBody("to","Enter a valid email address.").isEmail().exists();
	req.checkBody("amount","Amount should be a number").isDecimal().exists();
	var errors = req.validationErrors();
	if (errors) {
    res.send({ 
    	"status":FAILURE, 
    	"errors" : errors
    	});
    return;
  	} 
	if(req.body.amount>1&&req.body.from!==req.body.to){
	var checkifFromExistsWithBalance = checkifAccountExists(req.body.from,req.body.amount);
	var checkifToAccountExists = checkifAccountExists(req.body.to,0);
	Promise.all([checkifFromExistsWithBalance,checkifToAccountExists]).then(function(values){
		if(values[0]&&values[1]){
					updateBalance(req.body).then(result=>{
						res.send(result);
					}).catch(err=>{
						res.send(err);
					})
		}else{
			res.send({"status": FAILURE, 
				"errors" : "check account numbers and balances"
			});	
		}
	}).catch(err => {
    console.error(err);
    res.send({"status": FAILURE, 
    			"errors" :err
    			}); 
  });
	}else{
		res.send({ "status": FAILURE,
			 		"errors": "check request body again"
				});
	}
}));

/* Checking if similar transactions exist*/
function checkSimilarTransaction(request){
	return new Promise(async function(resolve,reject){
		try{
		 let sqlStatement = "select * from transactions where fromAccount = ? and toAccount = ? and amount = ? order by transactionDate desc limit 1;"
		 let result = await pool.query(sqlStatement,[request.from,request.to,request.amount]);
		if(result[0]){
			let timeDifference = ((new Date())-result[0].transactionDate)/1000;
			if(timeDifference<transferTwiceTimeOut){
				resolve({"status":FAILURE, 
					"data": "Possible duplicate transaction "+timeDifference.toString()});
			}
			else{
				resolve({"status":SUCCESS,
						 "data": "New transaction, Old transaction was "+timeDifference.toString()+" seconds ago."
							});
			}
		}
		else{
			resolve({"status" : SUCCESS ,
						 "data" : "No record found in the DB, new transaction."
						});
			}
		}catch(err){
			reject({"status" : FAILURE ,
					 "errors" : err
					});
		}
	});
}

/* Updated balances and Inserts into the transaction table */
function updateBalance(request){
	return new Promise(async function(resolve,reject){
		try{
			pool.getConnection(function(err,connection){
				connection.beginTransaction(function(err){
					if(err){
						console.log("Couldn't begin transaction");        //Transaction Error (Rollback and release connection)
            			connection.rollback(function() {
                		connection.release();
                		reject({"status":FAILURE, "errors":err});
                		//Failure
            			});
					}
					checkSimilarTransaction(request)
					.then(result=>{
						if(result.status===SUCCESS){
							updateFromAccount(request,connection)
								.then(updateToAccount(request,connection))
								.then(insertIntoTransaction(request,connection)
								.then(result=>{
									getTransaction(result,connection)
									.then(response=>{
										resolve({"status":SUCCESS,
													"data" : response
													});
										});
									})).catch(function (err) {
        							reject({"status":FAILURE,
        									 "errors":err})
    							});
							}else{
								reject({"status":FAILURE, 
										"errors":"Possible duplicate transaction"
										})
							}
					}).catch(function (err) {
        							reject({"status":FAILURE,
        									 "errors":err})
    							});
				});
			});
		}catch(err){
			reject({"status":FAILURE,
					 "errors":err});
		}
	});
}


/* Updates From account's balance */
function updateFromAccount(request,connection){
	return new Promise(async function(resolve,reject){
		try{
			let sqlStatement = "UPDATE balances SET balances.balance = balances.balance-? where balances.accountNumber = ?";
			connection.query(sqlStatement,[request.amount,request.from],function(error,result){
		 			if(error){
		 				console.log("Error while updating to balances table fromAccount;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject({"status":FAILURE,
        							 "errors":err});
      						});
		 				}
		 	});
		}catch(err){
			reject({"status":FAILURE,
					 "errors":err});
		}
	});
}

/* Updates to account's balance */
function updateToAccount(request,connection){
	return new Promise(async function(resolve,reject){
		try{
			let sqlStatement = "UPDATE balances SET balances.balance = balances.balance+? where balances.accountNumber = ?"
				connection.query(sqlStatement,[request.amount,request.to],function(error,result){
		 			if(error){
		 				console.log("Error while updating to balances table for toAccount;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject({"status":FAILURE,
        						 "errors":err});
      						});
		 				}
		 			});
		}catch(err){
			reject({"status":FAILURE,
					 "errors":err});
		}
	});
}

/* Inserts into the transaction table */
function insertIntoTransaction(request,connection){
	return new Promise(async function(resolve,reject){
		try{
			const referenceNo = uuidv1();
			let sqlStatement = "insert into transactions (transactionRef,amount,fromAccount,toAccount,transactionDate)"+
			 "values(?,?,?,?,CURRENT_TIMESTAMP());"
			result3 = connection.query(sqlStatement,[referenceNo,request.amount,request.from,request.to],function(error,result3){
		 			if(error){
		 				console.log("Error while inserting to Transaction table;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject({"status":FAILURE,
        							 "errors":err});
      						});
		 				}
		 				connection.commit(function(err) {
        		   if (err) {
        		   	console.log("Couldn't commit transaction;Roll back");
          			return connection.rollback(function() {
            		  //throw err;
            		  reject({"status":FAILURE,
            		  			 "errors":err});
          			 });
        			}
		 		});
		 				resolve(referenceNo);
		 			});

		}catch(err){
			reject({"status":FAILURE, "errors":err});
		}
	});
}

/* Get transaction by transactionId */
function getTransaction(transactionId,connection){
	return new Promise(async function(resolve,reject){
		try{
			let sqlStatement = "select * from transactions where transactions.transactionRef=?;"
			let response = connection.query(sqlStatement,[transactionId], function(error,result,fields){
        				//console.log(response);
        				if(error){
        					console.log("Transaction saved but couldn't fetch details.");
        					resolve("Transaction saved but couldn't fetch details.");
        				}
        				//console.log(JSON.stringify(result));
        				resolve(result);
        			});
		}catch(err){
			reject({"status":FAILURE,
					 "errors":err});
		}
	});
}

/* Check if account exists with balance */
function checkifAccountExists(id,amount){
	return new Promise(async function(resolve,reject){
		 try{
		 	let sqlStatement = "SELECT * FROM balances WHERE balances.accountNumber = ? and balances.balance>=? LIMIT 1"
		 	let result = await pool.query(sqlStatement,[id,amount]);
		 	//console.log("Result "+JSON.stringify(result[0]));
		 	resolve(result[0]);
		 }catch(err){
		 	reject({"status":FAILURE,
		 			 "errors":err});
		 }
	});
}

function getBalances(){
	return new Promise(async function(resolve,reject){
		 try{
		 	let result = await pool.query('select * from balances');
		 	//console.log("Result "+JSON.stringify(result[0]));
		 	resolve(result);
		 }catch(err){
		 	reject({"status":FAILURE,
		 			 "errors":err});
		 }
	});
} 

module.exports = {
	getBalances: getBalances,
	checkifAccountExists: checkifAccountExists,
	getTransaction: getTransaction,
	insertIntoTransaction: insertIntoTransaction,
	updateToAccount: updateToAccount,
	updateFromAccount: updateFromAccount,
	updateBalance: updateBalance,
	checkSimilarTransaction: checkSimilarTransaction
}

app.listen(3000, () => console.log('Bank transaction example.'))