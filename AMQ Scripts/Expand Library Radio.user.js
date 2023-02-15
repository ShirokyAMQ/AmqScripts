// ==UserScript==
// @name         Expand Library Radio
// @version      1.1.3
// @match        https://animemusicquiz.com/
// @match        https://animemusicquiz.com/?forceLogin=True
// @resource     malIds https://raw.githubusercontent.com/Kikimanox/DiscordBotNew/master/data/_amq/annMal.json
// @grant        GM_getResourceText
// ==/UserScript==

var amqList
var anilist
var malIds = JSON.parse(GM_getResourceText("malIds")) // This depends on Kiki actively updating json
var allAnimeSongDetailsList
var isFirstTimeLaunch = true
var shouldAutoplayAfterLoading = shouldAutoplayOnLaunch()

setupRadio()

// Setup
function setupRadio() {
    if (document.getElementById("startPage")) {
        setTimeout(setupRadio, 3000)
        return
    }

    setupUI()
    // loadUserPageFromAnilist()
    loadExpandLibrary()
}

function setupUI() {
    document.body.append(createRadioOverlay())
    document.body.append(createExpandLibraryButton())

    var radioSettingsWindow = createRadioSettingsWindow()
    hide(radioSettingsWindow)
    document.body.append(radioSettingsWindow)

    var radioSettingBackdrop = createRadioSettingBackdrop()
    hide(radioSettingBackdrop)
    document.body.append(radioSettingBackdrop)

    document.head.append(radioInfoScrollAnimationStyle())
}

function loadExpandLibrary() {
    if (document.getElementById("loadingScreen").className !== "gamePage hidden") {
        setTimeout(loadExpandLibrary, 3000)
        return
    }

    var expandLibraryEntryListener = new Listener("expandLibrary questions", function(payload) {
        if (payload.success === false) {
            console.log("Failed expand library loading")
            return
        }
        amqList = payload.questions
        updateAllAnimeSongDetailsList()
    }).bindListener()

    socket.sendCommand({
        type: "library",
        command: "expandLibrary questions"
    })
}

function updateAllAnimeSongDetailsList() {
    allAnimeSongDetailsList = []

    if (allListStatusesAllowed() == false && anilist == undefined) {
        return
    }

    for (var anime of amqList) {
        var malId = parseInt((malIds[anime.annId] ?? "-1").split(" ")[0])

        if (shouldFilterOutCompleted() && (anilist["COMPLETED"] ?? []).includes(malId)) {
            continue
        }
        if (shouldFilterOutWatching() && ((anilist["CURRENT"] ?? []).includes(malId) || (anilist["REPEATING"] ?? []).includes(malId))) {
            continue
        }
        if (shouldFilterOutDropped() && (anilist["DROPPED"] ?? []).includes(malId)) {
            continue
        }
        if (shouldFilterOutPaused() && (anilist["PAUSED"] ?? []).includes(malId)) {
            continue
        }
        if (shouldFilterOutPlanToWatch() && (anilist["PLANNING"] ?? []).includes(malId)) {
            continue
        }

        var songDetailsList = songDetailsListFrom(anime)
        allAnimeSongDetailsList = allAnimeSongDetailsList.concat(songDetailsList)
    }

    if (isFirstTimeLaunch) {
        isFirstTimeLaunch = !queueRandomSong()
    }

    if (shouldAutoplayAfterLoading) {
        expandRadioOverlay()
        pauseOrPlay()
        shouldAutoplayAfterLoading = false
    }
}

function songDetailsListFrom(animeEntry) {
    var expandLibrarySongList = animeEntry.songs
    var animeSongDetailsList = []

    for (var expandLibrarySong of expandLibrarySongList) {
        var songDetails = songDetailsWithMp3From(expandLibrarySong)

        if (songDetails.mp3Link == null) {
            continue
        }
        if (expandLibrarySong.type == 1 && shouldFilterOutOpenings()) {
            continue
        }
        if (expandLibrarySong.type == 2 && shouldFilterOutEndings()) {
            continue
        }
        if (expandLibrarySong.type == 3 && shouldFilterOutInserts()) {
            continue
        }

        songDetails.anime = animeEntry.name
        animeSongDetailsList.push(songDetails)
    }

    return animeSongDetailsList
}

function songDetailsWithMp3From(expandLibrarySong) {
    var songDetails = {
        title: expandLibrarySong.name,
        artist: expandLibrarySong.artist,
        mp3Link: expandLibrarySong.examples.mp3
    }

    return songDetails
}

// Radio player actions
function playRandomSong() {
    var songIndex = randomSongIndex(allAnimeSongDetailsList.length)
    play(allAnimeSongDetailsList[songIndex])
}

function queueRandomSong() {
    if (allAnimeSongDetailsList.length == 0) {
        return false
    }
    var songIndex = randomSongIndex(allAnimeSongDetailsList.length)
    queue(allAnimeSongDetailsList[songIndex])
    return true
}

function randomSongIndex(songCount) {
    return Math.floor(Math.random() * (songCount))
}

function pauseOrPlay() {
    var radioPlayer = document.getElementById("radioPlayer")

    if (radioPlayer.paused) {
        radioPlayer.play()
    } else {
        radioPlayer.pause()
    }
}

function play(song) {
    var radioPlayer = document.getElementById("radioPlayer")
    queue(song)
    radioPlayer.play()
}

function queue(song) {
    var radioPlayer = document.getElementById("radioPlayer")
    radioPlayer.src = song.mp3Link

    var songInformationLabel = document.getElementById("radioSongInformationLabel")
    songInformationLabel.innerHTML = song.title + " by " + song.artist

    var popoverElement = document.getElementById("radioSongInformationWrapper")
    popoverElement.setAttribute("data-content", song.anime)
}

function adjustVolume(event) {
    let radioPlayer = document.getElementById('radioPlayer')
    let volume = radioPlayer.volume
    let increment = event.deltaY < 0 ? 0.1 : -0.1
    radioPlayer.volume = Math.min(Math.max(volume + increment, 0), 1)
}

// Settings
function shouldAutoplayOnLaunch() {
    return isCookieEnabled("shouldAutoplayOnLaunch")
}

function changeAutoplayOnLaunchSetting() {
    toggleCookie("shouldAutoplayOnLaunch")
}

function shouldFilterOutOpenings() {
    return isCookieEnabled("shouldFilterOutOpenings")
}

function changeOpeningsFilterSetting() {
    toggleCookie("shouldFilterOutOpenings")
    updateAllAnimeSongDetailsList()
}

function shouldFilterOutEndings() {
    return isCookieEnabled("shouldFilterOutEndings")
}

function changeEndingsFilterSetting() {
    toggleCookie("shouldFilterOutEndings")
    updateAllAnimeSongDetailsList()
}

function shouldFilterOutInserts() {
    return isCookieEnabled("shouldFilterOutInserts")
}

function changeInsertsFilterSetting() {
    toggleCookie("shouldFilterOutInserts")
    updateAllAnimeSongDetailsList()
}

function allListStatusesAllowed() {
    return !shouldFilterOutCompleted() && !shouldFilterOutWatching() && !shouldFilterOutDropped() && !shouldFilterOutPlanToWatch() && !shouldFilterOutPaused()
}

function shouldFilterOutCompleted() {
    return isCookieEnabled("shouldFilterOutCompleted")
}

function changeCompletedFilterSetting() {
    toggleCookie("shouldFilterOutCompleted")
    updateAllAnimeSongDetailsList()
}

function shouldFilterOutWatching() {
    return isCookieEnabled("shouldFilterOutWatching")
}

function changeWatchingFilterSetting() {
    toggleCookie("shouldFilterOutWatching")
    updateAllAnimeSongDetailsList()
}

function shouldFilterOutDropped() {
    return isCookieEnabled("shouldFilterOutDropped")
}

function changeDroppedFilterSetting() {
    toggleCookie("shouldFilterOutDropped")
    updateAllAnimeSongDetailsList()
}

function shouldFilterOutPlanToWatch() {
    return isCookieEnabled("shouldFilterOutPlanToWatch")
}

function changePlanToWatchFilterSetting() {
    toggleCookie("shouldFilterOutPlanToWatch")
    updateAllAnimeSongDetailsList()
}

function shouldFilterOutPaused() {
    return isCookieEnabled("shouldFilterOutPaused")
}

function changePausedFilterSetting() {
    toggleCookie("shouldFilterOutPaused")
    updateAllAnimeSongDetailsList()
}

function isCookieEnabled(cookie) {
    return Cookies.get(cookie) === "true"
}

function toggleCookie(cookie) {
    var previousValue = isCookieEnabled(cookie)
    var newValue = (!previousValue).toString()
    Cookies.set(cookie, newValue, { expires: 365 })
}

// UI Update
function hide(element) {
    element.style.display = "none"
}

function show(element) {
    element.style.display = "block"
}

function showPauseButton() {
    var radioPlayerPlayButtonIcon = document.getElementById("radioPlayButton").children[0]
    radioPlayerPlayButtonIcon.className = "fa fa-pause"
}

function showPlayButton() {
    var radioPlayerPlayButtonIcon = document.getElementById("radioPlayButton").children[0]
    radioPlayerPlayButtonIcon.className = "fa fa-play"
}

function expandRadioOverlay() {
    var radioOverlay = document.getElementById("radioOverlay")
    show(radioOverlay)

    var openRadioButton = document.getElementById("openRadioButton")
    hide(openRadioButton)
}

function collapseRadioOverlay() {
    var radioOverlay = document.getElementById("radioOverlay")
    hide(radioOverlay)

    var openRadioButton = document.getElementById("openRadioButton")
    show(openRadioButton)
}

function openRadioSettings() {
    var radioSettingsWindow = document.getElementById("radioSettingsModal")
    show(radioSettingsWindow)
    setTimeout(function() { radioSettingsWindow.className = "modal fade in" }, 10)

    var radioSettingsBackdrop = document.getElementById("radioSettingsBackdrop")
    show(radioSettingsBackdrop)
    setTimeout(function() { radioSettingsBackdrop.className = "modal-backdrop fade in" }, 10)
}

function closeRadioSettings() {
    var radioSettingsWindow = document.getElementById("radioSettingsModal")
    radioSettingsWindow.className = "modal fade out"
    setTimeout(function() { radioSettingsWindow.style.display = "none" }, 500)

    var radioSettingsBackdrop = document.getElementById("radioSettingsBackdrop")
    radioSettingsBackdrop.className = "modal-backdrop fade out"
    setTimeout(function() { radioSettingsBackdrop.style.display = "none" }, 500)
}

// Anilist
async function loadUserPageFromAnilist() {
    if (document.getElementById("loadingScreen").className !== "gamePage hidden") {
        setTimeout(loadUserPageFromAnilist, 3000)
        return
    }
    var username = document.getElementById("aniListUserNameInput").value
    if (username == '') {
        return
    }

    var url = "https://graphql.anilist.co"
    var httpMethod = "POST"
    var requestBody = userPageRequestBody(username)
    try {
        var response = await responseFrom(url, httpMethod, requestBody)
        updateListsFrom(response)
        updateAllAnimeSongDetailsList()
    } catch (error) {
        console.log(error)
    }
}

function responseFrom(url, method, body) {
    return new Promise(function (resolve, reject) {
        var request = new XMLHttpRequest()
        request.open(method, url, true)
        request.setRequestHeader("Content-Type", "application/json")
        request.setRequestHeader("Accept", "application/json")
        request.timeout = 15 * 1000
        request.onload = function() {
            if (this.status != 200) {
                reject("Request completed with error status: " + this.status + " " + this.statusText)
                return
            }
            resolve(this.response)
        }
        request.ontimeout = function() {
            reject("Request timedout!")
        }
        request.onerror = function() {
            reject("Unexpected network error!")
        }
        request.send(body)
    })
}

function userPageRequestBody(username, page) {
    var query = userPageQuery()
    var variables = { username: username, page: page }
    return JSON.stringify({
        query: query,
        variables: variables
    })
}

function updateListsFrom(response) {
    anilist = {}
    var lists = JSON.parse(response).data.MediaListCollection.lists
    if (lists == null) {
        throw("Invalid or corrupted response from anilist")
    }
    for (var list of lists) {
        anilist[list.status] = formattedMalIds(list.entries)
    }
}

function formattedMalIds(anilistEntries) {
    var malIds = []
    for (var entry of anilistEntries) {
        let entryId = entry.media.idMal
        if (entryId == null) {
            continue
        }
        malIds = malIds.concat(entryId)
    }
    return malIds
}

function userPageQuery() {
    return `
query ($username: String) {
  MediaListCollection(userName: $username, type: ANIME) {
    lists {
      entries {
        media {
          idMal
        }
      }
      status
    }
  }
}
`
}

// UI Elements
function createDiv(id = "", className = "") {
    var div = document.createElement("div")
    div.id = id
    div.className = className
    return div
}

function createExpandLibraryButton() {
    var openRadioButton = createDiv("openRadioButton", "button")
    openRadioButton.style.cssText = openRadioButtonStyle()
    openRadioButton.onclick = expandRadioOverlay
    openRadioButton.onwheel = adjustVolume

    var openRadioButtonIcon = createDiv()
    openRadioButtonIcon.innerHTML = "▶"
    openRadioButtonIcon.style.cssText = openRadioButtonIconStyle()
    openRadioButton.append(openRadioButtonIcon)
    return openRadioButton
}

function createRadioOverlay() {
    var radioOverlay = createDiv("radioOverlay")
    radioOverlay.style.cssText = radioOverlayStyle()
    radioOverlay.onwheel = adjustVolume
    hide(radioOverlay)

    radioOverlay.append(createPlayerTitle())
    radioOverlay.append(createSongInformationContainer())
    radioOverlay.append(createPlayerButtons())
    radioOverlay.append(createCollapseButton())
    radioOverlay.append(createSettingsButton())
    radioOverlay.append(createRadioPlayer())
    return radioOverlay
}

function createPlayerTitle() {
    var playerTitleLabel = createDiv()
    playerTitleLabel.innerHTML = "Now Playing"
    playerTitleLabel.style.cssText = playerTitleStyle()
    return playerTitleLabel
}

function createSongInformationContainer() {
    var songInformationLabelWrapper = createDiv("radioSongInformationWrapper", "radioSongInformationWrapper")
    songInformationLabelWrapper.setAttribute("data-toggle", "popover")
    songInformationLabelWrapper.setAttribute("data-trigger", "hover")
    songInformationLabelWrapper.setAttribute("data-content", "")
    songInformationLabelWrapper.setAttribute("data-placement", "right")
    songInformationLabelWrapper.setAttribute("data-container", "body")
    songInformationLabelWrapper.style.cssText = songInformationContainerStyle()

    songInformationLabelWrapper.append(createSongInformationLabel())
    return songInformationLabelWrapper
}

function createSongInformationLabel() {
    var songInformationLabel = createDiv("radioSongInformationLabel", "radioSongInformationLabel")
    songInformationLabel.style.cssText = songInformationStyle()
    songInformationLabel.innerHTML = "Loading"
    return songInformationLabel
}

function createPlayerButtons() {
    var buttonRow = createDiv("radioButtonRow")
    buttonRow.style.cssText = playerButtonRowStyle()
    buttonRow.append(createPlayButton())
    buttonRow.append(createNextSongButton())
    return buttonRow
}

function createPlayButton() {
    var playButton = createDiv("radioPlayButton", "button")
    playButton.style.cssText = playerButtonStyle()
    playButton.onclick = pauseOrPlay

    var playButtonIcon = createDiv("playButtonIcon", "fa fa-play")
    playButtonIcon.style.cssText = playerButtonIconStyle()

    playButton.append(playButtonIcon)
    return playButton
}

function createNextSongButton() {
    var nextSongButton = createDiv("radioNextSongButton", "button")
    nextSongButton.style.cssText = playerButtonStyle()
    nextSongButton.onclick = playRandomSong

    var nextSongButtonIcon = createDiv("nextSongButtonIcon", "fa fa-fast-forward")
    nextSongButtonIcon.style.cssText = playerButtonIconStyle()

    nextSongButton.append(nextSongButtonIcon)
    return nextSongButton
}

function createCollapseButton() {
    var collapseButton = createDiv("collapseButton", "button")
    collapseButton.style.cssText = collapseButtonStyle()
    collapseButton.innerHTML = "✖"
    collapseButton.onclick = collapseRadioOverlay
    return collapseButton
}

function createSettingsButton() {
    var settingsButton = createDiv("settingsButton", "button")
    settingsButton.style.cssText = settingsButtonStyle()
    settingsButton.onclick = openRadioSettings

    var settingsButtonIcon = createDiv("settingsButtonIcon", "fa fa-cog")
    settingsButtonIcon.style.cssText = playerButtonIconStyle()

    settingsButton.append(settingsButtonIcon)
    return settingsButton
}

function createRadioPlayer() {
    var radioPlayer = document.createElement("audio")
    radioPlayer.id = "radioPlayer"
    radioPlayer.onended = playRandomSong
    radioPlayer.onplaying = showPauseButton
    radioPlayer.onpause = showPlayButton

    return radioPlayer
}

function createRadioSettingsWindow() {
    var radioSettingsWindow = createDiv("radioSettingsModal", "modal fade")
    radioSettingsWindow.tabindex = "-1"
    radioSettingsWindow.role = "dialog"

    var radioSettingsWindowDialog = createRadioSettingsWindowDialog()
    radioSettingsWindow.append(radioSettingsWindowDialog)

    return radioSettingsWindow
}

function createRadioSettingsWindowDialog() {
    var radioSettingsWindowDialog = createDiv("radioSettingsWindowDialog", "modal-dialog")
    radioSettingsWindowDialog.role = "document"
    radioSettingsWindowDialog.style.cssText = radioSettingsWindowDialogStyle()

    var radioSettingsWindowContent = createRadioSettingsWindowContent()
    radioSettingsWindowDialog.append(radioSettingsWindowContent)
    return radioSettingsWindowDialog
}

function createRadioSettingsWindowContent() {
    var radioSettingsWindowContent = createDiv("radioSettingsWindowContent", "modal-content")
    radioSettingsWindowContent.append(createRadioSettingsHeader())
    radioSettingsWindowContent.append(createRadioSettingsBody())
    return radioSettingsWindowContent
}

function createRadioSettingsHeader() {
    var header = createDiv("radioSettingsHeader", "modal-header")

    var headerCloseButton = createRadioSettingsCloseButton()
    header.append(headerCloseButton)

    var headerTitle = document.createElement("h2")
    headerTitle.className = "modal-title"
    headerTitle.innerHTML = "Radio Settings"
    header.append(headerTitle)

    return header
}

function createRadioSettingsCloseButton() {
    var headerCloseButton = createDiv("settingsHeaderCloseButton", "close")
    headerCloseButton.onclick = closeRadioSettings

    var headerCloseButtonIcon = document.createElement("span") // FIXME: can this be div
    headerCloseButtonIcon.innerHTML = "×"
    headerCloseButton.append(headerCloseButtonIcon)
    return headerCloseButton
}

function createRadioSettingsBody() {
    var settingsBody = createDiv("radioSettingsBody", "modal-body")
    var settingsTable = document.createElement("table")
    settingsTable.style.cssText = radioSettingsTableStyle()

    createAutoplayOnLaunchSetting(settingsTable.insertRow(-1))
    createSongTypeFilterSettings(settingsTable.insertRow(-1))
    //createListStatusFilterSettings(settingsTable.insertRow(-1))
    //createListStatusFilterSettings2(settingsTable.insertRow(-1))

    settingsBody.append(settingsTable)
    return settingsBody
}

function createAutoplayOnLaunchSetting(row) {
    row.insertCell(0).append(createSettingLabel("Autoplay after loading"))
    row.cells[0].colSpan = "5"
    row.insertCell(1).append(createCheckbox("autoplayOnLaunchCheckbox", shouldAutoplayOnLaunch(), changeAutoplayOnLaunchSetting))
}

function createSongTypeFilterSettings(row) {
    row.insertCell(0).append(createSettingLabel("OP"))
    row.insertCell(1).append(createCheckbox("openingsCheckbox", !shouldFilterOutOpenings(), changeOpeningsFilterSetting))
    row.insertCell(2).append(createSettingLabel("ED"))
    row.insertCell(3).append(createCheckbox("endingsCheckbox", !shouldFilterOutEndings(), changeEndingsFilterSetting))
    row.insertCell(4).append(createSettingLabel("IN"))
    row.insertCell(5).append(createCheckbox("insertsCheckbox", !shouldFilterOutInserts(), changeInsertsFilterSetting))
}

function createListStatusFilterSettings(row) {
    row.insertCell(0).append(createSettingLabel("C"))
    row.insertCell(1).append(createCheckbox("completedCheckbox", !shouldFilterOutCompleted(), changeCompletedFilterSetting))
    row.insertCell(2).append(createSettingLabel("W"))
    row.insertCell(3).append(createCheckbox("watchingCheckbox", !shouldFilterOutWatching(), changeWatchingFilterSetting))
    row.insertCell(4).append(createSettingLabel("D"))
    row.insertCell(5).append(createCheckbox("droppedCheckbox", !shouldFilterOutDropped(), changeDroppedFilterSetting))
}

function createListStatusFilterSettings2(row) {
    row.insertCell(0)
    row.insertCell(1).append(createSettingLabel("H"))
    row.insertCell(2).append(createCheckbox("pausedCheckbox", !shouldFilterOutPaused(), changePausedFilterSetting))
    row.insertCell(3).append(createSettingLabel("P"))
    row.insertCell(4).append(createCheckbox("plantowatchCheckbox", !shouldFilterOutPlanToWatch(), changePlanToWatchFilterSetting))
    row.insertCell(5)
}

function createSettingLabel(title) {
    var label = document.createElement("label")
    label.innerHTML = title
    label.style.cssText = radioSettingTitleStyle()
    return label
}

function createCheckbox(id, isChecked, onClick) {
    var checkboxContainer = document.createElement("div")
    checkboxContainer.className = "customCheckbox"
    checkboxContainer.style.cssText = radioSettingCheckboxStyle()

    var checkbox = document.createElement("input")
    checkbox.type = "checkbox"
    checkbox.id = id
    checkbox.checked = isChecked
    checkbox.onclick = onClick
    checkboxContainer.append(checkbox)

    var iconLabel = document.createElement("label")
    iconLabel.htmlFor = id

    var checkedIcon = document.createElement("div")
    checkedIcon.className = "fa fa-check"
    iconLabel.append(checkedIcon)
    checkboxContainer.append(iconLabel)
    return checkboxContainer
}

function createRadioSettingBackdrop() {
    var settingsBackdropFade = createDiv("radioSettingsBackdrop", "modal-backdrop fade")
    return settingsBackdropFade
}

// Styles
function openRadioButtonStyle() {
    return [
        "width: 12px",
        "height: 52px",
        "background: #424242",
        "box-shadow: 0 0 10px 2px rgb(0, 0, 0)",
        "position: absolute",
        "top: 5%"
    ].join(";")
}

function openRadioButtonIconStyle() {
    return [
        "color: #d9d9d9",
        "position: absolute",
        "top: 16px"
    ].join(";")
}

function radioOverlayStyle() {
    return [
        "width: 150px",
        "height: 52px",
        "background: rgb(66, 66, 66)",
        "box-shadow: 0 0 10px 2px rgb(0, 0, 0)",
        "position: absolute",
        "top: 5%"
    ].join(";")
}

function playerTitleStyle() {
    return [
        "color: #d9d9d9",
        "text-align: center"
    ].join(";")
}

function songInformationContainerStyle() {
    return [
        "width: 90%",
        "left: 5%",
        "position: relative",
        "overflow: hidden"
    ].join(";")
}

function songInformationStyle() {
    return [
        "color: #d9d9d9",
        "white-space: nowrap",
        "font-size: 10px",
        "width: fit-content",
        "transform: translateX(100%)",
        "animation: songTitleScroll 15s linear infinite"
    ].join(";")
}

function playerButtonRowStyle() {
    return [
        "text-align: center"
    ].join(";")
}

function playerButtonStyle() {
    return [
        "width: 15px",
        "padding-left: 3px",
        "padding-right: 3px",
        "display: inline"
    ].join(";")
}

function playerButtonIconStyle() {
    return [
        "color: #d9d9d9",
        "font-size: 15px",
        "vertical-align: text-top"
    ].join(";")
}

function collapseButtonStyle() {
    return [
        "position: absolute",
        "right: 5px",
        "top: 0px"
    ].join(";")
}

function settingsButtonStyle() {
    return [
        "position: absolute",
        "right: 3px",
        "bottom: 0px"
    ].join(";")
}

function radioSettingsWindowDialogStyle() {
    return [
        "width: 300px"
    ].join(";")
}

function radioSettingsTableStyle() {
    return [
        "width: 100%"
    ].join(";")
}

function radioSettingCheckboxStyle() {
    return [
        "vertical-align: middle"
    ].join(";")
}

function radioSettingTitleStyle() {
    return [
        "padding-left: 10px"
    ].join(";")
}

function radioInfoScrollAnimationStyle() {
    var scrollingAnimationStyle = document.createElement("style")
    scrollingAnimationStyle.innerHTML = `
        @-moz-keyframes songTitleScroll {
        0%   { -moz-transform: translateX(150px); }
        100% { -moz-transform: translateX(-100%); }
        }
        @-webkit-keyframes songTitleScroll {
        0%   { -webkit-transform: translateX(150px); }
        100% { -webkit-transform: translateX(-100%); }
        }
        @keyframes songTitleScroll {
        0%   {
        -moz-transform: translateX(150px);
        -webkit-transform: translateX(150px);
        transform: translateX(150px);
        }
        100% {
        -moz-transform: translateX(-100%);
        -webkit-transform: translateX(-100%);
        transform: translateX(-100%);
        }
        }`
    return scrollingAnimationStyle
}
