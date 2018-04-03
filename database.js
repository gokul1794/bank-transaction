var mysql = require('mysql')
var util = require('util')
var pool = mysql.createPool({
    connectionLimit: 15,
    host: 'localhost',
    user: 'root',
    password: 'Password123',
    database: 'sys'
})
pool.getConnection((err, connection) => {
    if (err) {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('Database connection was closed.')
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            console.log('Database has too many connections.')
        }
        if (err.code === 'ECONNREFUSED') {
            console.log('Database connection was refused.')
        }
        if (connection) connection.release()
        return
    }
});
pool.query = util.promisify(pool.query)
module.exports = {
    pool,
    mysql
}