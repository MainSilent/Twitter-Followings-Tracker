const sqlite3 = require('sqlite3')
const db = new sqlite3.Database("./data.sqlite3")

function unsetinit(username) {
    db.run(`UPDATE users SET init = 0 WHERE username = "${username}"`, err => {
        err && console.error(err)
    })
}

function getUser(username) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE username = "${username}"`, (err, user) => {
            if (err) reject('Failed query the user')
            !user ? reject('User not found') : resolve(user.rest_id)  
        })
    })
}

function add(user) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE username = "${user.username}"`, (err, result) => {
            if (err) reject('Failed query the new user')
    
            if (result == undefined) {
                db.run("INSERT INTO users (username, rest_id) VALUES (?, ?)", [user.username, user.rest_id], err => {
                    if (err) reject('Failed to insert new user to database')
                    
                    resolve(true)
                })
            }
            else
                resolve(false)
        })
    })
}

function addFollowing(rest_id, following) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE rest_id = "${rest_id}"`, (err, result) => {
            if (err) reject('Failed query the user')

            if (result == undefined)
                reject("User does not exist")
            else
                db.get(`SELECT * FROM followings WHERE username = "${following}" and user_id = ${result.id}`, (err, res) => {
                    if (err) reject('Failed query the new following')
                    
                    if (res == undefined) {
                        db.run("INSERT INTO followings (username, user_id) VALUES (?, ?)", [following, result.id], err => {
                            if (err) reject('Failed to insert new following to database')
        
                            resolve(true)
                        })
                    }
                    else
                        resolve(false)
                })
        })
    })
}

function updateFollowingsCount(user_id, count) {
    db.run("UPDATE users SET followings = ? WHERE rest_id = ?", [count, user_id], err => {
        if (err) console.log('Failed to insert new following to database: ', err)
    })
}

function list(username) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT id FROM users WHERE username = "${username}"`, (err, result) => {
            if (err) reject("Failed to query the user")

            if (result == undefined)
                reject("User does not exist")
            else
                db.all("SELECT username FROM followings WHERE user_id = ?", result.id, (err, result) => {
                    if (err) reject("Failed to get user followings")

                    resolve(result)
                })
        })
    })
}

function listUsers() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM users", (err, result) => {
            if (err) reject("Failed to query the user")

            resolve(result)
        })
    })
}

function remove(username) {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM users WHERE username = "${username}"`, (err, result) => {
            
            if (result == undefined)
                reject("User does not exist")
            else
                db.all("DELETE FROM users WHERE username = ?", username, (err, result) => {
                    if (err) reject("Failed to remove user")

                    resolve()
                })
        })
    })
}

module.exports = {
    add: add,
    getUser: getUser,
    addFollowing: addFollowing,
    updateFollowingsCount: updateFollowingsCount,
    list: list,
    listUsers: listUsers,
    unsetinit: unsetinit,
    remove: remove
}