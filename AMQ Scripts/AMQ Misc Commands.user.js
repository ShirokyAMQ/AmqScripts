// ==UserScript==
// @name         AMQ Misc Commands
// @namespace    https://github.com/nyamu-amq
// @version      0.1
// @description  enable chat commands
// @description  -- /assign_spies : assign targets to spies in spy vs spy mode
// @description  -- /assign_aliens n: assign aliens in find the alien
// @author       me
// @match        https://animemusicquiz.com/*
// @grant        none

// ==/UserScript==
var autothrow='';
new Listener("Game Chat Message", (payload) => {
	processChatCommand(payload);
}).bindListener();
new Listener("game chat update", (payload) => {
	payload.messages.forEach(message => {
		processChatCommand(message);
	});
}).bindListener();

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function checkLobby(target) {
	if(!lobby.getPlayerByName(target)) return false;
	return true;
}
function checkSpec(target) {
	for(var user of gameChat.spectators) {
		if(user.name===target) return true;
	}
	return false;
}

function processChatCommand(payload) {
	if(payload.sender !== selfName) {
        processUserCommand(payload)
        return;
    }
	if(payload.message.startsWith("/assign_spies")) {
		if(quiz.gameMode === 'Ranked') return;
		if(!quiz.inQuiz && !lobby.inLobby) return;
        var names = []
        for (const key in lobby.players) {
            names.push(lobby.players[key]._name);
        }
        shuffleArray(names);
        for (var i = 0; i < names.length; i++) {
            const assassin = names[i];
            const spy = names[(i + 1) % names.length];
            setTimeout((from, target) => {
                socket.sendCommand({
                    type: "social",
                    command: "chat message",
                    data: { target: from, message: target },
                });
            }, 500 * i, assassin, spy);
        }
    } else if (payload.message.startsWith("/assign_aliens")) {
        var numAliens=payload.message.substr("/assign_aliens ".length)*1;
        var names = [];
        for (const key in lobby.players) {
            names.push(lobby.players[key]._name);
        }
        shuffleArray(names);
        var alienList = "aliens: " + names.slice(0, numAliens).join(" ");
        for (var i = 0; i < names.length; i++) {
            setTimeout((target, isAlien) => {
                var message = isAlien ? alienList : "human";
                socket.sendCommand({
                    type: "social",
                    command: "chat message",
                    data: { target: target, message: message },
                });
            }, 1000 * i, names[i], i < numAliens);
        }
        // host is speccing
        if (names.indexOf(selfName) == -1) {
            console.log(alienList);
            window.alert(alienList);
        }
    }
}

function processUserCommand(payload) {
    if (payload.message.startsWith("/host")) {
        if(!lobby.isHost) return;
        var target=payload.sender;
        if(!checkLobby(target) && !checkSpec(target)) return;
        lobby.promoteHost(target);
    } else if (payload.message.startsWith("/pause")) {
        if(!quiz.inQuiz) return;
		if(!quiz.isHost) return;
		if(!quiz.pauseButton.pauseOn) {
			socket.sendCommand({
				type: "quiz",
				command: "quiz pause",
			});
		}
    } else if (payload.message.startsWith("/lobby")) {
        if(!quiz.inQuiz) return;
		if(!quiz.isHost) return;
		// quiz.startReturnLobbyVote();
        socket.sendCommand({
		 	type: "quiz",
		 	command: "start return lobby vote",
		});
    } else if (payload.message.startsWith("/start")) {
        if (!lobby.isHost) return;
        if (quiz.inQuiz) return;
        // lobby.fireMainButtonEvent();
        socket.sendCommand({
            type: "lobby",
            command: "start game",
        });
    }
}
