# bank-transaction
Transfer money from A to B
SQL Tables
```CREATE TABLE balances (accountNumber VARCHAR(20) NOT NULL UNIQUE, balance DECIMAL(13,4));```
```CREATE TABLE transactions(transactionRef varchar(40) NOT NULL UNIQUE, amount DECIMAL(13,4) NOT NULL, 
fromAccount VARCHAR(20) NOT NULL, toAccount VARCHAR(20) NOT NULL, transactionDate DATETIME);```

For sake of simplicity, It is assumed that the from and to account is an email.

