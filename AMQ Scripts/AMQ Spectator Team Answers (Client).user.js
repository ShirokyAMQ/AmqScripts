// ==UserScript==
// @name         AMQ Spectator Team Answers (Client)
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  try to take over the world!
// @author       You
// @match        https://animemusicquiz.com/*
// @icon         https://www.google.com/s2/favicons?domain=animemusicquiz.com
// @grant        none
// ==/UserScript==

const SOCKET_URL = 'wss://amqbot-server.herokuapp.com/';

(function() {
    'use strict';

    const messageHeaderString = '⠀'

    let ws;

    const loadingScreen = document.getElementById('loadingScreen')

    if (loadingScreen) {
        new MutationObserver((mutationRecord, mutationObserver) => {
            setup()
            mutationObserver.disconnect()
        }).observe(loadingScreen, { attributes: true })
    }

    function setup() {
        ChatBox.prototype.writeMessage = (function(_super) {
            return function() {
                if (arguments[1].startsWith(messageHeaderString)) return
                return _super.apply(this, arguments)
            }
        })(ChatBox.prototype.writeMessage)

        socket._socket._callbacks.$command[0] = (function(_super) {
            return function() {
                if (arguments.length > 0 && arguments[0].command === 'chat message' && arguments[0].data.hasOwnProperty('message') && arguments[0].data.message.startsWith(messageHeaderString)) {
                    if (ws && ws.readyState === ws.OPEN) return

                    const payload = arguments[0].data

                    const message = payload.message.substring(messageHeaderString.length).split(':')

                    if (message.length === 2) {
                        const token = message.pop()
                        connect(token)
                    }
                    return
                }
                return _super.apply(this, arguments)
            }
        })(socket._socket._callbacks.$command[0])
    }

    function connect(token) {
        ws = new WebSocket(SOCKET_URL)

        ws.addEventListener('open', (event) => {
            ws.send(JSON.stringify({
                type: 'subscribe',
                player: selfName,
                token
            }))
        })

        ws.addEventListener('message', (event) => {
            try {
                const message = JSON.parse(event.data)
                onMessage(message)
            } catch {}
        })
    }

    function onMessage(message) {
        if (!quiz) return
        if (!quiz.inQuiz) return

        if (message.type === 'answer') {
            window.postMessage({type: "ignore id", id: message.gamePlayerId}, location.origin)
            quiz.players[message.gamePlayerId].answer = message.answer
        }
    }
})();