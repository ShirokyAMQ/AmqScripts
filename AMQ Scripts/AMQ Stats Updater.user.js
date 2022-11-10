// ==UserScript==
// @name         AMQ Stats Updater
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Updates and fetches stats for songs
// @author       You
// @match        https://animemusicquiz.com/
// @icon         https://www.google.com/s2/favicons?domain=animemusicquiz.com
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @require      https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js
// @require      https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js
// ==/UserScript==

// don't load on login page
if (document.getElementById("startPage")) return;

// Wait until the LOADING... screen is hidden and load script
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

let listWindow;
let listWindowTable;
const infoDiv = $("<div></div>").attr("class", "row");
let toggledOn = JSON.parse(localStorage.getItem("toggleSendStats")) || false;
const UPDATE_URL = "https://us-central1-noble-trees-353505.cloudfunctions.net/update_song";
const firebaseConfig = {
    apiKey: "AIzaSyCj1k6pJUd5XqMIsgAP25vJjrHIVxiUShw",
    authDomain: "noble-trees-353505.firebaseapp.com",
    projectId: "noble-trees-353505",
    storageBucket: "noble-trees-353505.appspot.com",
    messagingSenderId: "249762656630",
    appId: "1:249762656630:web:c6bb540f2b50c6d0330a57"
};


function toggleOff() {
    toggledOn = false;
    localStorage.setItem("toggleSendStats", toggledOn);
    $("#qpAmqStats i").removeClass("fa-toggle-on fa-toggle-off").addClass(toggledOn ? "fa-toggle-on" : "fa-toggle-off");
}


async function digestMessage(message) {
  const msgUint8 = new TextEncoder().encode(message);                           // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);           // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer));                     // convert buffer to byte array
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); // convert bytes to hex string
  return hashHex;
}

function formatSamplePoint(start, length) {
    if (isNaN(start) || isNaN(length)) {
        return "Video not loaded";
    }
    let startPoint = Math.floor(start / 60) + ":" + (start % 60 < 10 ? "0" + (start % 60) : start % 60);
    let videoLength = Math.round(length);
    let totalLength = Math.floor(videoLength / 60) + ":" + (videoLength % 60 < 10 ? "0" + (videoLength % 60) : videoLength % 60);
    return startPoint + "/" + totalLength;
}


function createListWindow() {
    let listCloseHandler = function () {
        infoWindow.close();
        settingsWindow.close();
        $(".rowSelected").removeClass("rowSelected");
    }
    listWindow = new AMQWindow({
        title: "Previous Answers",
        width: 650,
        height: 480,
        minWidth: 480,
        minHeight: 350,
        zIndex: 1060,
        closeHandler: listCloseHandler,
        resizable: true,
        draggable: true
    });

    listWindow.addPanel({
        id: "listWindowOptions",
        width: 1.0,
        height: 65
    });

    listWindow.addPanel({
        id: "listWindowTableContainer",
        width: 1.0,
        height: "calc(100% - 65px)",
        position: {
            x: 0,
            y: 65
        },
        scrollable: {
            x: true,
            y: true
        }
    });

    // create the options tab
    listWindow.panels[0].panel
        .append($(`<button class="btn btn-default songListOptionsButton" type="button"><i aria-hidden="true" class="fa fa-trash-o"></i></button>`)
            .dblclick(() => {
                createNewTable();
            })
            .popover({
                placement: "bottom",
                content: "Clear List (double click)",
                trigger: "hover",
                container: "body",
                animation: false
            })
        )
        .append($(`<button class="btn btn-default songListOptionsButton" type="button"><i aria-hidden="true" class="fa fa-plus"></i></button>`)
            .click(() => {
                // openInNewTab();
            })
            .popover({
                placement: "bottom",
                content: "Open in New Tab",
                trigger: "hover",
                container: "body",
                animation: false
            })
        );

    // create results table
    listWindowTable = $(`<table id="ansListWindowTable" class="table floatingContainer"></table>`);
    listWindow.panels[1].panel.append(listWindowTable);


    listWindow.body.attr("id", "ansListWindowBody");
    addTableHeader();
    $("#ansListWindowTable").addClass("compact");
}


function addTableHeader() {
    let header = $(`<tr class="header"></tr>`)
    let userCol = $(`<td><b>User</b></td>`);
    let answerCol = $(`<td><b>Answer</b></td>`);
    let animeCol = $(`<td><b>Anime</b></td>`);
    let typeCol = $(`<td><b>Type</b></td>`);
    let sampleCol = $(`<td><b>Sample</b></td>`);


    header.append(userCol);
    header.append(answerCol);
    header.append(animeCol);
    header.append(typeCol);
    header.append(sampleCol);
    listWindowTable.append(header);
}

function addTableEntry(username, newSong) {
    let newRow = $(`<tr class="songData clickAble"></tr>`)
        .click(function () {
            if (!$(this).hasClass("rowSelected")) {
                $(".rowSelected").removeClass("rowSelected");
                $(this).addClass("rowSelected");
            }
            else {
                $(".rowSelected").removeClass("rowSelected");
            }
        })
        .hover(function () {
            $(this).addClass("hover");
        }, function () {
            $(this).removeClass("hover");
        })


    let user = $(`<td></td>`).text(username);
    let answer = $(`<td></td>`).text(newSong.answer);
    let anime = $(`<td></td>`).text(newSong.anime);
    let type = $(`<td></td>`).text(newSong.type);
    let samplePoint = $(`<td></td>`).text(formatSamplePoint(newSong.sample, newSong.length));

    newRow.append(user);
    newRow.append(answer);
    newRow.append(anime);
    newRow.append(type);
    newRow.append(samplePoint);
    listWindowTable.append(newRow);
}

function createNewTable() {
    listWindowTable.children().remove();
    addTableHeader();
}


function sendData(songId, result) {
    let data = {
        id: songId,
        songName: result.songInfo.songName,
        artist: result.songInfo.artist,
        anime: result.songInfo.animeNames,
        // songNumber: parseInt($("#qpCurrentSongCount").text()),
        type: result.songInfo.type === 3 ? "Insert Song" : (result.songInfo.type === 2 ? "Ending " + result.songInfo.typeNumber : "Opening " + result.songInfo.typeNumber),
        startSample: quizVideoController.moePlayers[quizVideoController.currentMoePlayerId].startPoint,
        videoLength: parseFloat(quizVideoController.moePlayers[quizVideoController.currentMoePlayerId].$player.find("video")[0].duration.toFixed(2)),
    };
    let findPlayer = Object.values(quiz.players).find((tmpPlayer) => {
        return tmpPlayer._name === selfName && tmpPlayer.avatarSlot._disabled === false
    });
    if (findPlayer !== undefined) {
        let playerIdx = Object.values(result.players).findIndex(tmpPlayer => {
            return findPlayer.gamePlayerId === tmpPlayer.gamePlayerId
        });
        data.correct = result.players[playerIdx].correct;
        // data.answer = quiz.players[findPlayer.gamePlayerId].avatarSlot.$answerContainerText.text();
    }
    data.username = selfName;
    data.answer = $("#qpAnswerInput")[0].value;
    data.teamMode = quiz.teamMode;
    data.isSpectator = quiz.isSpectator;

    $.ajax({
        type: "POST",
        url: UPDATE_URL,
        data: JSON.stringify(data),
        contentType: "application/json",
        dataType: "json"
    }).fail((jqXHR, textStatus, error) => {
        gameChat.systemMessage("Error sending data: " + textStatus);
        gameChat.systemMessage(JSON.stringify(error, Object.getOwnPropertyNames(error)));

        toggleOff();
    });
}

function setup() {
    firebase.initializeApp(firebaseConfig);
    var db = firebase.firestore();

    let container = $("div.qpSideContainer > div.row:nth-child(4)").after(infoDiv).parent();
    // fix up this box size
    container.css({
        "overflow": "visible",
        "position": "absolute",
        "top": 0,
        "left": 0,
    });
    container.children().css("background-color", "inherit");

    // let quizReadyListener = new Listener("quiz ready", (data) => {});

    // get song data on answer reveal
    let answerResultsListener = new Listener("answer results", (result) => {
        let songName = result.songInfo.songName;
        let artist = result.songInfo.artist;

        Promise.all([digestMessage(songName), digestMessage(artist)]).then((v) => {
            let songId = v[0] + "_" + v[1];

            let docRef = db.collection("songs").doc(songId);

            docRef.get().then((doc) => {
                infoDiv.html("<h5><b>Stats</b></h5>");
                if (doc.exists) {
                    let data = doc.data();
                    let playCounts = $("<p></p>");
                    // let answerTable = $("<table id=\"lastAnswers\"><tr><th>User</th><th>Answer</th></tr><tbody></tbody></table>");
                    var selfSolo = 0, selfTeam = 0, selfSpec = 0;
                    var lastPlayed;

                    createNewTable();
                    Object.getOwnPropertyNames(data).forEach((prop) => {
                        if (prop.startsWith("data_")) {
                            let userData = data[prop];
                            var username = prop.slice(5);

                            let soloCount = userData['solo_count'] ?? 0;
                            let teamCount = userData['team_count'] ?? 0;
                            let specCount = userData['spec_count'] ?? 0;
                            let correct = userData['correct'] ?? 0;
                            let correctRatio = correct / soloCount;

                            if (username == selfName) {
                                selfSolo = soloCount;
                                selfTeam = teamCount;
                                selfSpec = specCount;
                                lastPlayed = userData['latest'];
                            }
                            if (soloCount > 0) {
                                playCounts.append(`<br><b>${username}</b>: ${correct}/${soloCount} (${(correctRatio * 100).toFixed(2)}%)`);
                            }

                            let lastAnswers = userData['last_answers'];
                            if (lastAnswers !== undefined) {
                                // last ones are the most recent
                                for (let i = lastAnswers.length - 1; i >= 0; i--) {
                                    const ans = lastAnswers[i];
                                    addTableEntry(username, ans);
                                    // jquery is smart about appending to tables
                                    // answerTable.append(`<tr><td>${username}</td><td>${ans['answer']}</td></tr>`);
                                }
                            }
                        }
                    });
                    if (lastPlayed !== undefined) {
                        playCounts.prepend(`<br>Last played: <br>${lastPlayed.toDate().toLocaleString()}`);
                    }
                    playCounts.prepend(`${selfSolo} solo / ${selfTeam} team / ${selfSpec} spec`);
                    infoDiv.append(playCounts);
                    infoDiv.append($("<p><b>Previous Answers</b></p>").click(() => listWindow.open()));
                    // infoDiv.append(answerTable);
                } else {
                    infoDiv.append("<p>No stats available</p>");
                }

                // ensure we only send data after we try to fetch
                // and if nothing went wrong
                if (toggledOn) {
                    sendData(songId, result);
                }
            }).catch((err) => {
                gameChat.systemMessage(`Error fetching data for ${songId}: ${JSON.stringify(err, Object.getOwnPropertyNames(err))}`);
                toggleOff();
            });

            // if (toggledOn) {
                // sendData(songId, result);
                // want to
                // setTimeout(sendData, 200, songId, result);
            // }
        });
    });

    createListWindow();

    // let quizOverListener = new Listener("quiz over", (roomSettings) => {});

    // triggers when loading rooms in the lobby, this is to detect when a player leaves the lobby to reset the song list table
    // let quizLeaveListener = new Listener("New Rooms", (rooms) => {});

    // quizReadyListener.bindListener();
    answerResultsListener.bindListener();
    // quizOverListener.bindListener();
    // quizLeaveListener.bindListener();

    let oldWidth = $("#qpOptionContainer").width();
    $("#qpOptionContainer").width(oldWidth + 35);
    $("#qpOptionContainer > div").append($("<div></div>")
        .attr("id", "qpAmqStats")
        .attr("class", "clickAble qpOption")
        .html(`<i aria-hidden="true" class="fa fa-toggle-${(toggledOn ? "on" : "off")} qpMenuItem"></i>`)
        .click(() => {
            toggledOn = !toggledOn;
            localStorage.setItem("toggleSendStats", toggledOn);
            $("#qpAmqStats i").removeClass("fa-toggle-on fa-toggle-off").addClass(toggledOn ? "fa-toggle-on" : "fa-toggle-off");
        })
        .popover({
            content: "Toggle updating song stats",
            trigger: "hover",
            placement: "bottom"
        })
    );

    // CSS
    AMQ_addStyle(`
        #qpOptionContainer {
            z-index: 10;
        }
        #qpSongListButton {
            width: 30px;
            height: 100%;
            margin-right: 5px;
        }
    `);
}