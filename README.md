# Bank Transaction Problem
Before running the app, make sure you have
1. Nodejs
2. Mysql

`git clone` and do `npm install` in the directory.

Edit the `database.js` file to add your db details.

Make sure mysql is running.

`cd test` and run `npm test` to run all the tests.

1. I have assumed that, a user cannot transfer the same amount to the same person in less than x seconds which is configured in `app.js` for the variable `transferTwiceTimeOut`
2. If database becomes unavailable in the middle of my logic, transaction fails and it rolls back.
3. If two people A and B transfer at the same time, there won't be any issues with concurrency as I believe Mysql is capable of handling ACID transactions and puts in appropriate locks to handle it.
4. Data is validated when the request is made, for simplicity I've assumed that from and to are emails.
5. Used async await.

Use These SQL commands to set the db up quickly if you'd like to test.

```
CREATE TABLE balances (accountNumber VARCHAR(20) NOT NULL UNIQUE, balance DECIMAL(13,4));
```

```
CREATE TABLE transactions(transactionRef varchar(40) NOT NULL UNIQUE, amount DECIMAL(13,4) NOT NULL, fromAccount VARCHAR(20) NOT NULL, toAccount VARCHAR(20) NOT NULL, transactionDate DATETIME);
```

```
insert into balances values('gokul@gmail.com',500);
insert into balances values('abhi@gmail.com',1000);
insert into balances values('avesh@gmail.com',750);
```
