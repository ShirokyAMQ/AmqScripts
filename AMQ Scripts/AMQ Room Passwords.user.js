// ==UserScript==
// @name         AMQ Room Passwords
// @namespace    https://github.com/Mxyuki/AMQ-Scripts
// @version      0.1
// @description  Save the passwords of rooms you joined.
// @author       Mxyuki
// @match        https://animemusicquiz.com/*
// ==/UserScript==

if (document.getElementById("startPage")) return;

let retrievedList = {};

let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

function setup(){
    let storedList = localStorage.getItem('room_info_list');
    if (storedList) {
        retrievedList = JSON.parse(storedList);
    } else {
        retrievedList = {};
    }
}

function passwordSave(){
    let roomPassword = hostModal.getSettings().password;
    let roomHost = lobby.hostName;

    console.log(roomPassword);
    console.log(roomHost);

    if (!retrievedList[roomHost]) {
        retrievedList[roomHost] = [];
    }
    if (!retrievedList[roomHost].includes(roomPassword)) {
        retrievedList[roomHost].push(roomPassword);
    }

    localStorage.setItem('room_info_list', JSON.stringify(retrievedList));
}

new Listener("Join Game", (payload) => {
    setTimeout(function() {
        passwordSave();
    }, 1000);
}).bindListener();

new Listener("Spectate Game", (payload) => {
    setTimeout(function() {
        passwordSave();
    }, 1000);
}).bindListener();