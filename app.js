const express = require('express')
const bodyParser = require('body-parser');
var pool = require('./database')
var asyncMiddleware = require('./asyncMiddleware');
const uuidv1 = require('uuid/v1');

var validator = require('express-validator');

const app = express()

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json())
app.use(validator());

app.get('/',(req, res) => res.send('Hello world! My first Node app.'))

app.post('/transactions', asyncMiddleware( async(req,res,next)=>{
	req.checkBody("from", "Enter a valid email address.").isEmail().exists();
	req.checkBody("to","Enter a valid email address.").isEmail().exists();
	req.checkBody("amount","Amount should be a number").isDecimal().exists();
	var errors = req.validationErrors();
	if (errors) {
    res.send({ "errors" : errors});
    return;
  	} 
	// const user = await getBalances().then(alert);
	if(req.body.amount>1){
	var checkifFromExistsWithBalance = checkifAccountExists(req.body.from,req.body.amount);
	var checkifToAccountExists = checkifAccountExists(req.body.to,0);
	Promise.all([checkifFromExistsWithBalance,checkifToAccountExists]).then(function(values){
		if(values[0]&&values[1]){
					updateBalance(req.body).then(result=>{
						res.send(result);
					}).catch(err=>{
						res.send({"errors" :err});
					})
		}else{
			res.send("check account numbers and balances");	
		}
	}).catch(err => {
    console.error(err);
    res.send({"errors" :err}); 
  });
	}else{
		res.send({ "error ": "Amount value not set right"})
	}
}));

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
                		reject(err);
                		//Failure
            			});
					}
					updateFromAccount(request,connection)
					.then(updateToAccount(request,connection))
					.then(insertIntoTransaction(request,connection).then(result=>{
						getTransaction(result,connection).then(response=>{
							resolve(response);
						});
					})).catch(function (err) { // <- See this <<<<<<<<
        				reject(err)
    				});
				});
			});
		}catch(err){
			reject(err);
		}
	});
}


/* Updates From account's balance */
function updateFromAccount(request,connection){
	return new Promise(async function(resolve,reject){
		try{
			connection.query("UPDATE balances SET balances.balance = balances.balance-"
		 		+request.amount+" where balances.accountNumber = '"+request.from+"'",function(error,result){
		 			if(error){
		 				console.log("Error while updating to balances table fromAccount;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject(err);
      						});
		 				}
		 	});
		}catch(err){
			reject(err);
		}
	});
}

/* Updates to account's balance */
function updateToAccount(request,connection){
	return new Promise(async function(resolve,reject){
		try{
				connection.query("UPDATE balances SET balances.balance = balances.balance+"
		 		+request.amount+" where balances.accountNumber = '"+request.to+"'",function(error,result){
		 			if(error){
		 				console.log("Error while updating to balances table for toAccount;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject(err);
      						});
		 				}
		 			});
		}catch(err){
			reject(err);
		}
	});
}

/* Inserts into the transaction table */
function insertIntoTransaction(request,connection){
	return new Promise(async function(resolve,reject){
		try{
			const referenceNo = uuidv1();
			result3 = connection.query("insert into transactions (transactionRef,amount,fromAccount,toAccount,transactionDate) values('"+referenceNo+"',"+request.amount+",'"+request.from+"','"+request.to+"',CURRENT_TIMESTAMP());",function(error,result3){
		 			if(error){
		 				console.log("Error while inserting to Transaction table;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject(err);
      						});
		 				}
		 				connection.commit(function(err) {
        		   if (err) {
        		   	console.log("Couldn't commit transaction;Roll back");
          			return connection.rollback(function() {
            		  //throw err;
            		  reject(err);
          			 });
        			}
		 		})
		 				resolve(referenceNo);
		 			});

		}catch(err){
			reject(err);
		}
	});
}

/* Get transaction by transactionId */
function getTransaction(transactionId,connection){
	return new Promise(async function(resolve,reject){
		try{
			let response = connection.query("select * from transactions where transactions.transactionRef='"+transactionId+"';", function(error,result,fields){
        				//console.log(response);
        				if(error){
        					console.log("Transaction saved but couldn't fetch details.");
        					resolve("Transaction saved but couldn't fetch details.");
        				}
        				console.log(JSON.stringify(result));
        				resolve(result);
        			});
		}catch(err){
			reject(err);
		}
	});
}

/* Check if account exists with balance */
function checkifAccountExists(id,amount){
	return new Promise(async function(resolve,reject){
		 try{
		 	let result = await pool.query("SELECT * FROM balances WHERE balances.accountNumber = '"+id+"' and balances.balance>="+amount+" LIMIT 1");
		 	//console.log("Result "+JSON.stringify(result[0]));
		 	resolve(result[0]);
		 }catch(err){
		 	reject(err);
		 }
	});
}

function getBalances(){
	return new Promise(async function(resolve,reject){
		 try{
		 	let result = await pool.query('select * from balances');
		 	//console.log("Result "+JSON.stringify(result[0]));
		 	resolve(result[0]);
		 }catch(err){
		 	reject(err);
		 }
	});
} 

app.listen(3000, () => console.log('Bank transaction example.'))