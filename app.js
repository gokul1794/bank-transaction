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

app.get('/transactions1', (req, res) => {
	//Connect to DB Done
	//Handle transfer two times
	//Handle database unavailability (With a transactional rollback) Done
	//TWo people transfer to the same third person(Try with a test case?)
	//Validate request data Done
	//Use async await Done
	//console.log("Request "+JSON.stringify(req.body));	
	checkifAccountExists(req.body.from)
	getBalances().then(result =>{
		res.json(result);
	});
	
})

app.post('/transactions', asyncMiddleware( async(req,res,next)=>{
	req.checkBody("from", "Enter a valid email address.").isEmail().exists();
	req.checkBody("to","Enter a valid email address.").isEmail().exists();
	req.checkBody("amount","Amount should be a number").isDecimal().exists();
	var errors = req.validationErrors();
	if (errors) {
    res.send(errors);
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
						res.send(err);
					})
		}else{
			res.send("check account numbers and balances");	
		}
	}).catch(err => {
    console.error(err);
    res.send(err); 
  });
	}else{
		res.send("Amount value not set right")
	}
}));

function updateBalance(request){
	return new Promise(async function(resolve,reject){
		 try{
		 pool.getConnection(function(err, connection) {
		 	connection.beginTransaction(function(err){
		 		if (err) {          
		 		console.log("Couldn't begin transaction");        //Transaction Error (Rollback and release connection)
            	connection.rollback(function() {
                connection.release();
                reject(err);
                //Failure
            		});
        		} 
        		let result2,result3;
		 		let result1 = connection.query("UPDATE balances SET balances.balance = balances.balance-"
		 		+request.amount+" where balances.accountNumber = '"+request.from+"'",function(error,result1){
		 			if(error){
		 				console.log("Error while updating to balances table fromAccount;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject(err);
      						});
		 				}
		 				console.log(JSON.stringify(result1));
		 		result2 = connection.query("UPDATE balances SET balances.balance = balances.balance+"
		 		+request.amount+" where balances.accountNumber = '"+request.to+"'",function(error,result2){
		 			if(error){
		 				console.log("Error while updating to balances table for toAccount;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject(err);
      						});
		 				}
		 				console.log(JSON.stringify(result2));
		 		const referenceNo = uuidv1();
		 		result3 = connection.query("insert into transactions (transactionRef,amount,fromAccount,toAccount,transactionDate) values('"+referenceNo+"',"+request.amount+",'"+request.from+"','"+request.to+"',CURRENT_TIMESTAMP());",function(error,result3){
		 			if(error){
		 				console.log("Error while inserting to Transaction table;Roll back");
		 				return connection.rollback(function() {
        					//throw error;
        					reject(err);
      						});
		 				}
		 				console.log(JSON.stringify(result3));
		 		connection.commit(function(err) {
        		   if (err) {
        		   	console.log("Couldn't commit transaction;Roll back");
          			return connection.rollback(function() {
            		  //throw err;
            		  reject(err);
          			 });
        			}
        			console.log('success!');
        			let response = connection.query("select * from transactions where transactions.transactionRef='"+referenceNo+"';", function(error,result,fields){
        				//console.log(response);
        				if(error){
        					console.log("Transaction saved but couldn't fetch details.");
        					resolve("Transaction saved but couldn't fetch details.");
        				}
        				console.log(JSON.stringify(result));
        				resolve(result);
        			});
      			});
		 				
		 	});
		 				
		 });
		});
	   });
	});	
	}catch(err){
		console.log("Error");
		console.log(err);
		throw new Error(err);
		reject(err);
		}
	});
}

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