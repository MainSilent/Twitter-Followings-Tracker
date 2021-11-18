const axios = require('axios')
const { BOT_USERS } = require('./config.json')

let userIndex = 0
let headers = {
    'Authorization': "Bearer " + BOT_USERS[userIndex].TWITTER_BEARER_TOKEN,
    'content-type': 'application/json',
    'cookie': `auth_token=${BOT_USERS[userIndex].TWITTER_AUTH_TOKEN}; ct0=${BOT_USERS[userIndex].TWITTER_CSRF_KEY}`,
    'x-csrf-token': BOT_USERS[userIndex].TWITTER_CSRF_KEY,
}

function nextUser() {
    if ((userIndex + 1) == BOT_USERS.length)
        userIndex = 0
    else
        userIndex++
        
    headers = {
        'Authorization': "Bearer " + BOT_USERS[userIndex].TWITTER_BEARER_TOKEN,
        'content-type': 'application/json',
        'cookie': `auth_token=${BOT_USERS[userIndex].TWITTER_AUTH_TOKEN}; ct0=${BOT_USERS[userIndex].TWITTER_CSRF_KEY}`,
        'x-csrf-token': BOT_USERS[userIndex].TWITTER_CSRF_KEY,
    }
}

function validTwitteUser(u) {
    return /^[a-zA-Z0-9_]{1,15}$/.test(u);
}

function getUser(username) {
    return new Promise(async (resolve, reject) => {
        !validTwitteUser(username) || !username && reject("Invalid username")

        const variable = {
            "screen_name": username,
            "withSafetyModeUserFields": false,
            "withSuperFollowsUserFields": false,
            "withNftAvatar": false
        }
        await axios({
            method: 'GET',
            url: "https://twitter.com/i/api/graphql/1CL-tn62bpc-zqeQrWm4Kw/UserByScreenName?variables="+encodeURI(JSON.stringify(variable)),
            headers: headers
        })
        .then(res => {
            if (!res.data.data.user)
                reject("User not found")

            const data = res.data.data.user.result

            data.legacy.protected && reject("User is protected")

            resolve({
                id: data.id,
                rest_id: data.rest_id,
                name: data.legacy.name,
                image: data.legacy.profile_image_url_https,
                followings_count: data.legacy.friends_count
            })
        })
        .catch(e => {
            if (err.response.status == 429) {
                nextUser()
                resolve(getUser(username))
            }   
            else 
                reject(e)
        })
    })
}

function _getFollowings(user_id, cursor="-1") {
    return new Promise(async (resolve, reject) => {
        const variable = {
            "userId": user_id,
            "count": 1000,
            "cursor": cursor,
            "withTweetQuoteCount": false,
            "includePromotedContent": false, 
            "withSuperFollowsUserFields": true, 
            "withUserResults": true, 
            "withNftAvatar": false, 
            "withBirdwatchPivots": false,
            "withReactionsMetadata": false,
            "withReactionsPerspective": false,
            "withSuperFollowsTweetFields": true
        }
        await axios({
            method: 'GET',
            url: "https://twitter.com/i/api/graphql/dxq4kpfK7FGemy3zsBCv-Q/Following?variables="+encodeURI(JSON.stringify(variable)),
            headers: headers
        })
        .then(res => resolve(res.data.data.user.result.timeline.timeline.instructions))
        .catch(err => {
            nextUser()

            if (err.response.status == 429)
                resolve(_getFollowings(user_id, cursor))
            else 
                reject("Failed to get followings")
        })
    })
}

function getFollowings(user_id) {
    return new Promise(async (resolve, reject) => {
        let next_cursor = "-1"
        const users = []
        
        async function next() {
            await _getFollowings(user_id, next_cursor)
            .then(instructions => {
                instructions.forEach(instruction => {
                    if (instruction.entries !== undefined) {
                        instruction.entries.forEach(async _entry => {
                            const entry = _entry.content.itemContent
                            if (entry !== undefined) {
                                const user = entry.user_results.result
                                if (user.__typename !== "UserUnavailable")
                                    users.push(user.legacy.screen_name)
                            } else if (_entry.content.cursorType === "Bottom") {
                                next_cursor = _entry.content.value

                                if (next_cursor.split("|")[0] === '0') {
                                    resolve(users)
                                    return
                                }

                                await next()
                            }
                        })
                    }
                })
            })
            .catch(reject)
        }
        await next()
    })
}

module.exports = {
    getUser: getUser,
    getFollowings: getFollowings
}