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

app.get('/transactions', (req, res) => {
	//Connect to DB
	//Handle transfer two times
	//Handle database unavailability (With a transactional rollback)
	//TWo people transfer to the same third person(Try with a test case?)
	//Validate request data
	//Use async await
	//console.log("Request "+JSON.stringify(req.body));	
	checkifAccountExists(req.body.from)
	getBalances().then(result =>{
		res.json(result);
	});
	
})

app.post('/transactions1', asyncMiddleware( async(req,res,next)=>{
	req.checkBody("from", "Enter a valid email address.").isEmail().exists();
	req.checkBody("to","Enter a valid email address.").isEmail().exists();
	req.checkBody("amount","Amount should be a number").exists();
	var errors = req.validationErrors();
	if (errors) {
    res.send(errors);
    return;
  	} 
	// const user = await getBalances().then(alert);
	checkifAccountExists(req.body.from,req.body.amount)
	.then(result=>{
		if(result!=null&&result!==undefined){
			checkifAccountExists(req.body.to,0).then(result=>{
				if(result!=null&&result!==undefined){
					//res.send("Both accounts exist");
					console.log("Both accounts exist");
					updateBalance(req.body).then(result=>{
						console.log("Result came till here "+JSON.stringify(result));
						res.send(result);
					})
				}else{
					res.send("To account doesn't exist");
				}
			})
		}else{
			res.send("from account doesn't exist");
		}
	});
	
}));

function updateBalance(request){
	return new Promise(async function(resolve,reject){
		 try{
		 pool.getConnection(function(err, connection) {
		 	connection.beginTransaction(function(err){
		 		if (err) {                  //Transaction Error (Rollback and release connection)
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
		 				return connection.rollback(function() {
        					throw error;
        					reject(err);
      						});
		 				}
		 				console.log(JSON.stringify(result1));
		 		result2 = connection.query("UPDATE balances SET balances.balance = balances.balance+"
		 		+request.amount+" where balances.accountNumber = '"+request.to+"'",function(error,result2){
		 			if(error){
		 				return connection.rollback(function() {
        					throw error;
        					reject(err);
      						});
		 				}
		 				console.log(JSON.stringify(result2));
		 		const referenceNo = uuidv1();
		 		result3 = connection.query("insert into transactions (transactionRef,amount,fromAccount,toAccount,transactionDate) values('"+referenceNo+"',"+request.amount+",'"+request.from+"','"+request.to+"',CURRENT_TIMESTAMP());",function(error,result3){
		 			if(error){
		 				return connection.rollback(function() {
        					throw error;
        					reject(err);
      						});
		 				}
		 				console.log(JSON.stringify(result3));
		 		connection.commit(function(err) {
        		   if (err) {
          			return connection.rollback(function() {
            		  throw err;
            		  reject(err);
          			 });
        			}
        			console.log('success!');
        			let response = connection.query("select * from transactions where transactions.transactionRef='"+referenceNo+"';", function(error,result,fields){
        				//console.log(response);
        				console.log(JSON.stringify(result));
        				resolve(result);
        			});
        			//resolve([result1,result2]);
      			});
		 				
		 	});
		 				
		 });
		});
		 		//resolve([result1,result2,result3]);
		 		
	});
		 });
		
	}catch(err){
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
		 	throw new Error(err);
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
		 	throw new Error(err);
		 	reject(err);
		 }
	});
} 

app.listen(3000, () => console.log('Bank transaction example.'))