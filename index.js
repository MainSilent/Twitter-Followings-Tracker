const config = require('./config.json')
const { writeFile, readFile, unlink } = require('fs')
const TeleBot = require('telebot')
const database = require('./database')
const api = require('./api')

const token = config.TELEGRAM_BOT_TOKEN
const bot = new TeleBot(token)

let users = []
readFile('./users.json', (err, data) => {
    if (err) console.log(err)
    users = JSON.parse(data)
})

function addUser(id) {
    users.push(id)
    writeFile('users.json', JSON.stringify(users), err => err && console.log(err))
}

function syncFollowings(username, init=false) {
    database.getUser(username)
    .then(rest_id => {
        api.getFollowings(rest_id)
        .then(async followings => {
            await followings.forEach(following => {
                database.addFollowing(rest_id, following)
                    .then(result => {
                        if (result && !init)
                            users.forEach(user => bot.sendMessage(user, `New Following\n\nUser: ${username}\n\nFollowing: ${following}`))
                    })
                    .catch(console.error)
            })
            
            database.unsetinit(username)
        })
        .catch(console.error)
    })
    .catch(console.error)

    init && setTimeout(() => database.unsetinit(username), 45 * 1000)
}

bot.on(['/start', '/hello'], (msg) => {
    if (users.indexOf(msg.from.id) == -1)
        addUser(msg.from.id)
    msg.reply.text('Bot started')
})

bot.on('/add', msg => {
    const username = msg.text.split(" ")[1]
    api.getUser(username)
        .then(user => {
            user.username = username
            database.add(user)
                .then(result => {
                    result ? msg.reply.text(`${user.image}\n\nName: ${user.name}\n\nUser added successfully\n\nPlease wait until the synchronization before sending any commands`) : msg.reply.text("User already exists")
                    database.updateFollowingsCount(user.rest_id, user.followings_count)
                    syncFollowings(username, true)
                })
                .catch(e => msg.reply.text("Error: " + e))
        })
        .catch(msg.reply.text)
})

bot.on('/listusers', async msg => {
    let raw_users = ""

    await database.listUsers()
        .then(users => {
            users.forEach(user => {
                raw_users += `${user.username}\n\n`
            })
            !raw_users ? msg.reply.text("Error: empty users list") : msg.reply.text(raw_users)
        })
        .catch(msg.reply.text)

})

bot.on('/list', msg => {
    let raw_users = ""
    const username = msg.text.split(" ")[1]

    database.list(username)
        .then(users => {
            users.forEach(user => {
                raw_users += `${user.username}\n\n`
            })
            !raw_users ? msg.reply.text("Empty followings list\n\nIf you added the user recently, Please wait until the synchronization") : msg.reply.text(raw_users)
                .catch(() => {
                    writeFile(`./${msg.message_id}`, raw_users, (err) => {
                        if (err) msg.reply.text(err)

                        bot.sendDocument(msg.chat.id, `./${msg.message_id}`, { fileName: username })
                            .then(() => {
                                unlink(`./${msg.message_id}`, err => err && console.log(err))
                            })
                            .catch(console.log)
                    })
                })
        })
        .catch(msg.reply.text)
})

bot.on('/remove', msg => {
    const username = msg.text.split(" ")[1]
    database.remove(username)
        .then(() => {
            msg.reply.text("User removed successfully")
        })
        .catch(msg.reply.text)
})

bot.start()

setInterval(() => {
    database.listUsers()
        .then(users => {
            users.forEach(user => {
                if (!user.init) {
                    api.getUser(user.username)
                        .then(res => {
                            if (res.followings_count !== user.followings) {
                                database.updateFollowingsCount(user.rest_id, res.followings_count)
                                syncFollowings(user.username)
                            }
                        })
                        .catch(console.error)
                }
            })
        })
        .catch(console.error)
}, 60 * 1000)
