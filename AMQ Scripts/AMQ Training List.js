// ==UserScript==
// @name         AMQ Training List
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  try to take over the world!
// @author       You
// @match        https://animemusicquiz.com/
// @icon         https://www.google.com/s2/favicons?sz=64&domain=animemusicquiz.com
// @grant        none
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqWindows.js
// @require      https://raw.githubusercontent.com/TheJoseph98/AMQ-Scripts/master/common/amqScriptInfo.js
// ==/UserScript==

// Inspired by 4LafJ and anticol, script to add missed shows onto a list to train. Keeps track of your record for each song from that show. Can select Op/Ed/Ins
// Command /tracker to enable
// Disabled by default

// TODO: tag blacklist, fix anilist 429 (too many requests) error handling, MAYBE handle reuploads (probably not) 
let accessToken = null;
// don't load on login page
if (document.getElementById("startPage")) return;

// Wait until the LOADING... screen is hidden and load script
let loadInterval = setInterval(() => {
    if (document.getElementById("loadingScreen").classList.contains("hidden")) {
        setup();
        clearInterval(loadInterval);
    }
}, 500);

let trackerSettingsWindow;
let authWindow;
let trackerWindowOpenButton;
let enabled = false;
let addingShows = false;
let totalEntries = null
let deleteInProgress = false

let savedSettings = {
    includeOpenings: true,
    includeEndings: false,
    includeInserts: false,
    ALUsername: "",
    appID: "",
    appSecret: "",
    accessToken: "",
    totalEntries: null,
    maxListEntries: 100
}

function isCorrect(result) {
    let findPlayer = Object.values(quiz.players).find((tmpPlayer) => {
        return tmpPlayer._name === selfName && tmpPlayer.avatarSlot._disabled === false
    });
    if (findPlayer === undefined) {
        return null;
    }
    let playerIdx = Object.values(result.players).findIndex(tmpPlayer => {
        return findPlayer.gamePlayerId === tmpPlayer.gamePlayerId
    });
    return + result.players[playerIdx].correct;
}

function checkIfAdd(songType) {
    if (songType === 3) {
        return savedSettings.includeInserts
    }
    else if (songType === 2) {
        return savedSettings.includeEndings
    }
    else if (songType === 1) {
        return savedSettings.includeOpenings
    }
    return false
}

async function setup() {
    let answerResultsListener = new Listener("answer results", async (result) => {

        if (savedSettings.totalEntries === null && accessToken) {
            savedSettings.totalEntries = await getListCount();
            saveSettings()
        }


        if (enabled) {       
        
            if (savedSettings.totalEntries >= savedSettings.maxListEntries) {
                addingShows = false
                gameChat.systemMessage("List has reached limit, disabling adding shows");
            }

            let showId = result.songInfo.siteIds.aniListId;
            let songName = result.songInfo.songName
            let correctVal = isCorrect(result)
            let songType = result.songInfo.type
            if(correctVal !== null) {
                if(checkIfAdd(songType)) {
                    let mediaEntry = await checkMediaEntry(showId);
                    
                    if (mediaEntry !== null) {
                        let newNotes = handleNotes(mediaEntry, songName, correctVal)
                        await addOrUpdateToList(showId, mediaEntry, newNotes)
                    }
                    else if (!correctVal && addingShows) {
                        let newNotes = handleNotes(mediaEntry, songName, correctVal)
                        await addOrUpdateToList(showId, mediaEntry, newNotes)
                    }
                }
            }
        }
    });    
    
    toggleTracker()
    answerResultsListener.bindListener();
    createAuthWindow()
    createTrackerWindow()
    createQuickLoginWindow()

    loadSettings()

    
    AMQ_addStyle(` 
        #qpOptionContainer {
            z-index: 10;
        }
        #qpTrackerButton {
            width: 30px;
            height: 100%;
            margin-right: 5px;
        }
        .slTrainerTableSettingsContainer {
            padding-left: 10px;
            width: 33%;
            float: left;
        }
        .maxEntryParent {
            width: 100%
        }
        .maxEntryInput {
            color: #000000;
            width: 50%;
            height: 30px;
        }
        .maxEntrySetButton {
            position: relative;
            top: 0;
            right: 0;
        }
        .userInputBox {
            color: #000000;
        }
        .quickLoginButton {
            position: relative;
            right: 0;;
        }
    `);
}

function createTrackerWindow() {
    trackerSettingsWindow = new AMQWindow({
        width: 600,
        height: 300,
        title: "Tracker Settings",
        draggable: true,
        zIndex: 1070
    });
    trackerSettingsWindow.addPanel({
        width: 1.0,
        height: 150,
        id: "slListInfo"
    })
    trackerSettingsWindow.addPanel({
        width: 1.0,
        height: 50,
        position: {
            x: 0,
            y: 155
        },
        id: "slTrackerSettings"
    })
    trackerSettingsWindow.panels[0].panel
        .append($(`<span style="width: 100%; text-align: center;display: block;"><b>List Info</b></span>`))
        .append($(`<div class="slTrainerTableSettingsContainer"></div>`)
            .append($(`<span style="display: block; text-align: center"><b id=ALUsernameDisplay></b></span>`))
            .append($(`<span style="display: block; text-align: center"><b id=maxListEntriesDisplay></b></span>`))
        )

        .append($(`<div class="slTrainerTableSettingsContainer"></div>`)
            .append($(`<span style="display: block;"><b>Set Max List Entries</b></span>`))
            .append($(`<div class="slCheckbox"></div>`)
                // .append($(`<div class="customCheckbox maxEntryParent"></div>`)
                    .append($(`<input id='slMaxListEntries' type='text' class="maxEntryInput">`))
                // )
                .append($(`<button id="slAddEntriesButton" class="btn btn-primary maxEntrySetButton" type="button">Set</button>`).click(() => {
                    let entryCount = parseInt(slListInfo.querySelector('#slMaxListEntries').value)
                    if(entryCount < 1) {
                        alert("Please input a number greater than 0")
                        return;
                    }
                    else if(isNaN(entryCount) || entryCount === null || entryCount === undefined) {
                        alert("Please input a number")
                        return;
                    }


                    savedSettings.maxListEntries = entryCount
                    saveSettings()
                    updateDOM()
                }))
            )
        )
        .append($(`<div class="slTrainerTableSettingsContainer"></div>`)
            .append($(`<button id="slSwitchListsButton" class="btn btn-primary songListOptionsButton" type="button">Switch lists</button>`).click(() => {
                if(authWindow.isVisible()) {
                    deleteAuth()
                    authWindow.close();
                }
                else {
                    deleteAuth();
                    trackerSettingsWindow.close()
                    authWindow.open();   
                }
            }))
            .append($(`<button id="slDeleteEntriesButton" class="btn btn-danger songListOptionsButton" type="button text-align: left">Delete All Entries</button>`).click(() => {
                deleteAllEntries()
            }))
        )
        $("#ALUsernameDisplay").text("Anilist Username: " + savedSettings.ALUsername)
        $("#maxListEntriesDisplay").text("Max List Entries: " + String(savedSettings.maxListEntries))
    
    trackerSettingsWindow.panels[1].panel
        .append($(`<span style="width: 100%; text-align: center;display: block;"><b>Include Entries</b></span>`))
        .append($(`<div class="slTrainerTableSettingsContainer"></div>`)
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='slIncludeOpenings' type='checkbox'>")
                        .prop("checked", true)
                        .click(function () {
                            savedSettings.includeOpenings = $(this).prop("checked");
                            saveSettings();
                        })
                    )
                    .append($("<label for='slIncludeOpenings'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Include Openings</label>"))
            )
        )
        .append($(`<div class="slTrainerTableSettingsContainer"></div>`)
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='slIncludeEndings' type='checkbox'>")
                        .prop("checked", true)
                        .click(function () {
                            savedSettings.includeEndings = $(this).prop("checked");
                            saveSettings();
                        })
                    )
                    .append($("<label for='slIncludeEndings'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Include Endings</label>"))
            )
        )
        .append($(`<div class="slTrainerTableSettingsContainer"></div>`)
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($("<input id='slIncludeInserts' type='checkbox'>")
                        .prop("checked", true)
                        .click(function () {
                            savedSettings.includeInserts = $(this).prop("checked");
                            saveSettings();
                        })
                    )
                    .append($("<label for='slIncludeInserts'><i class='fa fa-check' aria-hidden='true'></i></label>"))
                )
                .append($("<label>Include Inserts</label>"))
            )
        )

    


    // button to access the song results
    trackerWindowOpenButton = $(`<div id="qpTrackerButton" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-plus qpMenuItem"></i></div>`)
        .click(function () {
            if(!accessToken){
                if(authWindow.isVisible()) {
                    authWindow.close();
                }
                else {
                    authWindow.open();
                }    
            }
            else{
                if(trackerSettingsWindow.isVisible()) {
                    trackerSettingsWindow.close();
                }
                else {
                    trackerSettingsWindow.open();
                }
            }
        })
        .popover({
            placement: "bottom",
            content: "Tracker Settings",
            trigger: "hover"
        });

    let oldWidth = $("#qpOptionContainer").width();
    $("#qpOptionContainer").width(oldWidth + 35);
    $("#qpOptionContainer > div").append(trackerWindowOpenButton);
}

function createAuthWindow() {
    authWindow = new AMQWindow({
        width: 400,
        height: 775,
        title: "Login",
        draggable: true,
        zIndex: 1070
    });
    authWindow.addPanel({
        width: 1.0,
        height: 695,
        id: "slTrainerAuthWindow"
    });
    authWindow.panels[0].panel
        .append($(`<div class="slTrainerAuthWindow"></div>`)
            .append($(`<span style="display: block;"><b>Your AniList username</b></span>`))
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($(`<input id='slTrainerALUsername' type='text' class="userInputBox">`)
                    )
                )
            )
            .append($(`<span style="display: block;"><b>Your App's ID</b></span>`))
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($(`<input id='slTrainerAppID' type='text' class="userInputBox"> `)
                    )
                )
            )

            .append($(`<span style="display: block;"><b>Your App's Secret</b></span>`))
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($(`<input id='slTrainerAppSecret' type='text' class="userInputBox">`)
                    )
                )
                .append($(`<button id="slGetTrainerCode" class="btn btn-primary songListOptionsButton" type="button">Get Login Code</button>`).click(() => {
                    savedSettings.ALUsername = slTrainerAuthWindow.querySelector('#slTrainerALUsername').value
                    savedSettings.appID = slTrainerAuthWindow.querySelector('#slTrainerAppID').value
                    saveSettings();
                    window.open(`https://anilist.co/api/v2/oauth/authorize?client_id=${slTrainerAuthWindow.querySelector('#slTrainerAppID').value}&response_type=code`, "_blank");
                }))
            )

            .append($(`<span style="display: block;"><b>Your App's Code</b></span>`))
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($(`<input id='slTrainerAppCode' type='text' class="userInputBox"> `)
                    )
                )
                .append($(`<button id="slTrainerAuth" class="btn btn-primary songListOptionsButton" type="button">Authenticate</button>`).click(() => {
                    savedSettings.appSecret = slTrainerAuthWindow.querySelector('#slTrainerAppSecret').value
                    saveSettings();
                    authAL();
                    updateDOM();
                }))
            )
            .append($(`<span style="display: block;"><b>
            Before you do anything, log off your current AniList account and create a brand new one.<br>1. Go to <a href="https://anilist.co/settings/developer"> AniList's Developer Settings </a><br>
            2. Click on "Create New Client"<br>
            3. In "Redirect URL" type "https://anilist.co/api/v2/oauth/pin" and name the app whatever you like<br>
            4. Click on "Save"<br>
            5. Click on the name of the app you just created<br>
            6. Copy "ID" and paste it into "Your App's ID" field<br>
            7. Copy "Secret" and paste it into "Your App's Secret" Field<br>
            8. Click on "Get Login Code"<br>
            9. Make sure you're on the right <a href=""><u><i>EMPTY</i></u></a> account and accept authorization request<br>
            10. Copy that long string of text and paste it into "Your App's Code" and click authenticate.<br><br>
            You are now logged into your AniList account and are able to use this plugin<br>
            </b></span>`))

            .append($(`<div class="slCheckbox"></div>`)
            .append($(`<button id="slAccessTokenLogin" class="btn btn-primary songListOptionsButton" type="button">Login with Access Token</button>`).click(() => {
                console.log("here")
                authWindow.close();
                quickLoginWindow.open();
            }))
            )
        )
    }

function createQuickLoginWindow() {
    quickLoginWindow = new AMQWindow({
        width: 400,
        height: 680,
        title: "Login",
        draggable: true,
        zIndex: 1070
    });
    quickLoginWindow.addPanel({
        width: 1.0,
        height: 590,
        id: "slTrainerQuickLoginWindow"
    });

    quickLoginWindow.panels[0].panel
        .append($(`<div class="SlTrainerQuickLoginWindow"></div>`)
            .append($(`<span style="display: block;"><b>Your AniList username</b></span>`))
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($(`<input id='slTrainerLoginALUsername' type='text' class="userInputBox">`)
                    )
                )
            )
            .append($(`<span style="display: block;"><b>Your Access Token</b></span>`))
            .append($(`<div class="slCheckbox"></div>`)
                .append($(`<div class="customCheckbox"></div>`)
                    .append($(`<input id='slTrainerAccessToken' type='text' class="userInputBox"> `)
                    )
                )
                .append($(`<button id="slTrainerAccessToken" class="btn btn-primary songListOptionsButton" type="button">Authenticate</button>`).click(() => {
                    savedSettings.ALUsername = slTrainerQuickLoginWindow.querySelector('#slTrainerLoginALUsername').value
                    savedSettings.accessToken = slTrainerQuickLoginWindow.querySelector('#slTrainerAccessToken').value
                    accessToken = savedSettings.accessToken
                    saveSettings();
                    updateDOM();
                    quickLoginWindow.close();
                    trackerSettingsWindow.open();
                    gameChat.systemMessage("Quick login finished");
                }))
            )
        )

}

function authAL() {
    const xhr = new XMLHttpRequest()

    xhr.onload = () => {
        if (xhr.status === 200) {
            let response = JSON.parse(xhr.responseText)
            accessToken = response.access_token
            savedSettings.accessToken = accessToken
            saveSettings();
            saveAccount()
            alert('Authentication successful!')
            authWindow.close()
        } else {
            console.log(xhr)
            alert('Authentication failed! Check console for details')
        }
    }

    // create a JSON object
    const json = {
        grant_type: 'authorization_code',
        redirect_uri: 'https://anilist.co/api/v2/oauth/pin',
        client_id: slTrainerAuthWindow.querySelector('#slTrainerAppID').value,
        client_secret: slTrainerAuthWindow.querySelector('#slTrainerAppSecret').value,
        code: slTrainerAuthWindow.querySelector('#slTrainerAppCode').value,
    }

    // open request
    xhr.open('POST', 'https://amq-proxy.herokuapp.com/https://anilist.co/api/v2/oauth/token')

    // set `Content-Type` header
    xhr.setRequestHeader('Content-Type', 'application/json')
    xhr.setRequestHeader('Accept', 'application/json')

    // send rquest with JSON payload
    xhr.send(JSON.stringify(json))
}

// save settings to local storage
function saveSettings() {
    localStorage.setItem("trainerListSettings", JSON.stringify(savedSettings));
}


function saveAccount() {
    const loadedAccounts = localStorage.getItem("accounts")
    let jsonAccounts = {}
    if(loadedAccounts !== null ){
        jsonAccounts = JSON.parse(loadedAccounts)
    }
    jsonAccounts[savedSettings.ALUsername] = accessToken
    localStorage.setItem("accounts", JSON.stringify(jsonAccounts));
}

// load settings from local storage
function loadSettings() {
    // load settings, if nothing is loaded, use default settings
    let loadedSettings = localStorage.getItem("trainerListSettings");
    if (loadedSettings !== null) {
        const oldSavedSettings = JSON.parse(loadedSettings); // replaces the object and deletes the key
        Object.keys(oldSavedSettings).forEach((key) => {savedSettings[key] = oldSavedSettings[key];});
        // If the key wasn't added yet, do so here
        if(Object.keys(savedSettings).length > Object.keys(oldSavedSettings).length){
            saveSettings();
        }
        updateSettings();
    }
}

function updateDOM(){
    $("#ALUsernameDisplay").text("Anilist Username: " + savedSettings.ALUsername)
    $("#maxListEntriesDisplay").text("Max List Entries: " + String(savedSettings.maxListEntries))
}

// update settings after loading 
function updateSettings() {
    $("#slIncludeOpenings").prop("checked", savedSettings.includeOpenings);
    $("#slIncludeEndings").prop("checked", savedSettings.includeEndings);
    $("#slIncludeInserts").prop("checked", savedSettings.includeInserts);
    $("#slTrainerALUsername")[0].value = savedSettings.ALUsername
    $("#slTrainerAppID")[0].value = savedSettings.appID
    $("#slTrainerAppSecret")[0].value = savedSettings.appSecret
    $("#ALUsernameDisplay").text("Anilist Username: " + savedSettings.ALUsername)
    $("#maxListEntriesDisplay").text("Max List Entries: " + String(savedSettings.maxListEntries))
    
    accessToken = savedSettings.accessToken;
}

function checkMediaEntry(showId) {
    function successHandler(response) {
        return response.data.MediaList
    }

    function errorHandler() {
        savedSettings.totalEntries += 1
        saveSettings()
        return null
    }

    var query = `query ($userName: String, $mediaId: Int) { # Define which variables will be used in the query (id)
        MediaList (userName: $userName, mediaId: $mediaId, type: ANIME) { # Insert our variables into the query arguments (id) (type: ANIME is hard-coded in the query)
            id
            notes
        }
    }`;

    let variables = {
        userName: savedSettings.ALUsername,
        mediaId: showId
    };

    return handleRequest(query, variables, successHandler, errorHandler)
}

function handleNotes(mediaEntry, songName, isCorrect){
    if ((mediaEntry === null || mediaEntry.notes === null)) {
        let notes = {}
        notes[songName] = [isCorrect, 1]
        
        return JSON.stringify(notes).replace("]","]\n")
    }
    currentNotes = JSON.parse(mediaEntry.notes);
    [timesCorrect, appearances] = currentNotes[songName] || [0, 0]
    currentNotes[songName] = [timesCorrect + isCorrect, appearances + 1]

    return JSON.stringify(currentNotes).replace("]","]\n")
}

async function addOrUpdateToList(showId, mediaEntry, notes) {
    function successHandler(response) {
        return response
    }

    var query = `mutation ($id: Int, $mediaId: Int, $notes: String) { # Define which variables will be used in the query (id)
        SaveMediaListEntry (id: $id, mediaId: $mediaId, notes: $notes) { # Insert our variables into the query arguments (id) (type: ANIME is hard-coded in the query)
            id
            notes          
        }
    }`;

    let variables = {
        notes: notes
    };
    
    if (mediaEntry === null) {
        variables["mediaId"] = showId
    }
    else {
         variables["id"] = mediaEntry.id
    }

    return handleRequest(query, variables, successHandler)
}

function getAllListEntries(state) {
    function successHandler(response) {
        completedIDs = []
        if (!response.data.MediaListCollection.lists.find(o => o.name === state && o.isCustomList === false)) {
            return [];
        }
        let mediaList = response.data.MediaListCollection.lists.find(o => o.name === state && o.isCustomList === false)
        mediaList.entries.forEach(e => {
            completedIDs.push(e.id)
        });
        return completedIDs
    }
    let query = `query ($userName: String) { # Define which variables will be used in the query (id)
        MediaListCollection (userName: $userName, type: ANIME) { # Insert our variables into the query arguments (id) (type: ANIME is hard-coded in the query)
          lists {
            entries {
              id
            }
            name
            isCustomList
            isSplitCompletedList
            status
          }
        }
      }`

    let variables = {
        userName: savedSettings.ALUsername,
    };

   return handleRequest(query, variables, successHandler)
}

function deleteEntry(entryId) {
    function successHandler(response) {
        return response.data.DeleteMediaListEntry.deleted
    }

    let query = `mutation($mediaListEntryId: Int!) {
        DeleteMediaListEntry(id: $mediaListEntryId) {
            deleted
        }
    }`

    let variables = {
        mediaListEntryId: entryId,
    };

    return handleRequest(query, variables, successHandler)
}

async function deleteAllEntries() {
    enabled = false
    gameChat.systemMessage("Disabling tracker to delete all entries on the list");
    deleteInProgress = true
    let entries = await getAllListEntries("Watching")
    for(let i = 0; i < entries.length; i++){
        await deleteEntry(entries[i])
    }
    deleteInProgress = false
    savedSettings.totalEntries = null
}

async function getListCount() {
    function successHandler(response) {
        return response.data.User.statistics.anime.statuses.find(e => e.status === "CURRENT").count
    }

    let query = `query ($userName: String) { # Define which variables will be used in the query (id)
        User (name: $userName) { # Insert our variables into the query arguments (id) (type: ANIME is hard-coded in the query)
            statistics {
              anime {
                statuses {
                  status
                  count
                }
              }
            }
          }
      }`

      variables = {
        userName: savedSettings.ALUsername
      }

    return await handleRequest(query, variables, successHandler)
}
async function handleRequest(query, variables, successHandler, errorHandler, rerun) {
    return new Promise(function (resolve, reject) {
        const xhr = new XMLHttpRequest()

        //open request
        xhr.open('POST', 'https://graphql.anilist.co')

        // set `Content-Type` header
        xhr.setRequestHeader('Content-Type', 'application/json')
        xhr.setRequestHeader('Accept', 'application/json')
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken)
        
        xhr.onload = () => {
            if (xhr.status === 200) {
                let response = JSON.parse(xhr.response)
                resolve(successHandler(response))

            } else if (xhr.status === 404) {
                if (errorHandler === undefined) {
                    gameChat.systemMessage("Resource not found!");
                    alert('Resource not found!') 
                }
                resolve(errorHandler())
            } else if (xhr.status === 401 || xhr.status === 400) {
                console.log(xhr)
                alert('Authentication failed! Please login in again')
                savedSettings.accessToken = ''
                deleteAuth()
                saveSettings()
                authWindow.open();
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            } else if (xhr.status === 429) { //TODO Fix timeout
                let timeout = parseFloat(xhr.getResponseHeader('retry-after')) * 1000 || 15000
                setTimeout(async () => {
                    console.log("running again")
                    await handleRequest(query, variables, successHandler, errorHandler, null, true)
                }, timeout)
                gameChat.systemMessage(`Processing limit reached (~23 elements). Please try again in ${timeout} miliseconds`)
            } else {
                console.log(xhr)
                gameChat.systemMessage("Something bad happened and I couldn't complete the request. Try again (details have been printed to console)")
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            }
        }
        xhr.onerror = function () {
            console.log(xhr)
            gameChat.systemMessage("Something bad happened and I couldn't complete the request. Try again (details have been printed to console)")
            reject({
                status: this.status,
                statusText: xhr.statusText
            });
        };

        // create a JSON object
        const json = {
            query: query,
            variables: variables
        }

        // send rquest with JSON payload
        xhr.send(JSON.stringify(json))
    })
}

function toggleTracker() {
    'use strict';

    document.getElementById("gcInput").addEventListener('keydown', (event) => {
        const commandPrefix = '/'

        if (event.which !== 13) return
        if (!event.target.value.trim().startsWith(commandPrefix)) return

        const args = event.target.value.trim().split(/\s+/)
        const command = args[0].substring(commandPrefix.length)

        if (command === 'tracker') {
            // if(deleteInProgress){
            //     gameChat.systemMessage("Delete in progress, trainer cannot be enabled");
            //     return;
            // }
            event.preventDefault()
            event.target.value = ''

            enabled = !enabled
            addingShows = enabled;
            if(quiz.gameMode === "Ranked") return;
            gameChat.systemMessage(enabled?"Training tracker is enabled" : "Training tracker is disabled");        
        }
    })

}

function deleteAuth() {
    enabled = false
    gameChat.systemMessage("Training tracker is disabled");
    accessToken = ""
    savedSettings.accessToken = ""
    savedSettings.appID = ""
    savedSettings.ALUsername = ""
    savedSettings.appSecret = ""
    saveSettings()
}

