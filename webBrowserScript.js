//Config, you can change the value below.
var _enableHideBlockedChat = true;
var _enableHideBlockedVocal = false; //Only hide Ethilyk for now, planning to use ignore list later.
var _enableSaveEditedContent = true;
var _includeDeletedContent = true;  //Must enable _enableSaveEditedContent.
var _deletedColorOpacity = 0.15;
var _enableNickname = false;
//End of config.

var _enableObserver = true;
var _observer;
var _style;

var _savedContents = {};
var _currentPath = window.location.pathname;
_savedContents[_currentPath] = {};
var _nicknames = {};
var _activeProfile = null;
start();

function start() {
        _savedContents = {};
        _currentPath = window.location.pathname;
        _savedContents[_currentPath] = {};
        _nicknames = {};
        _activeProfile = null;
        addCSS();
        startObserver();
        observe();
}

function observe() {
    updatePath();
    hideBlockedVocal();
    saveEditedContent();
    displayNickname();
    buildEditNicknameUI();
}

function startObserver() {
    _observer = new MutationObserver((mutationsList) => {
        if (_enableObserver)
            observe();
    });

    _observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function saveEditedContent() {
    if (!_enableSaveEditedContent)
        return;

    Object.keys(_savedContents[_currentPath]).forEach((key) => {
        _savedContents[_currentPath][key].isDeleted = true;
    });

    var contents = getContents();

    contents.forEach((content) => {
        var innerText = getTrueInnerText(content);

        if (_savedContents[_currentPath][content.id] == undefined) {
            _savedContents[_currentPath][content.id] = {
                original: innerText,
                lastEdit: "",
                allEdit: "",
                isDeleted: false,
                element: null
            };

            saveElement(content);

        } else {
            _savedContents[_currentPath][content.id].isDeleted = false;

            if (_savedContents[_currentPath][content.id].original != innerText
                && _savedContents[_currentPath][content.id].lastEdit != innerText) {

                _savedContents[_currentPath][content.id].lastEdit = innerText;
                _savedContents[_currentPath][content.id].allEdit += innerText + "\n";
                displaySavedContent(content);
            } else
                keepContentHidden(content);
        }
    });

    displayDeletedContent();
}

function displaySavedContent(content) {
    if (isDisplayable(content)) {
        var savedContentId = "saved-" + content.id;
        var savedContent = document.getElementById(savedContentId);

        if (savedContent == null) {
            savedContent = document.createElement("div");
            savedContent.id = savedContentId;
            savedContent.className = content.className;
            addElementBefore(content, savedContent);
            content.style.display = "none";
        } else
            savedContent.replaceChildren();

        addMsgWithNotesToContent(content, savedContent, _savedContents[_currentPath][content.id].original, " (original)");

        var edits = _savedContents[_currentPath][content.id].allEdit.split("\n");
        edits.forEach((edit) => {
            if (edit != "")
                addMsgWithNotesToContent(content, savedContent, edit, " (edited)");
        });

        saveElement(content);
    }
}

function saveElement(content) {
    if (content.closest("li") == null) {
        console.log("Cant save element");
        console.log(content);
    }

    _savedContents[_currentPath][content.id].element = content.closest("li").cloneNode(true);
    _savedContents[_currentPath][content.id].element.id = "deleted-" + _savedContents[_currentPath][content.id].element.id;
    _savedContents[_currentPath][content.id].element.querySelectorAll('[id^="message-content"]').forEach((element) => {
        element.classList.add("isDeleted");
    });
}

function displayDeletedContent() {
    if (!_enableSaveEditedContent || !_includeDeletedContent)
        return;

    var container = document.querySelector('ol[class*="scrollerInner"]');
    if (container == null)
        return;

    Object.keys(_savedContents[_currentPath]).forEach((key) => {
        if (_savedContents[_currentPath][key].isDeleted
            && document.getElementById(_savedContents[_currentPath][key].element.id) == null
            && !isSelf(_savedContents[_currentPath][key].element)
            && isWithinTimeFrame(_savedContents[_currentPath][key].element)) {

            var toInsertAfter = getElementAfterByDate(_savedContents[_currentPath][key].element);
            if (toInsertAfter != null)
                addElement(toInsertAfter, _savedContents[_currentPath][key].element);

        } else if (!_savedContents[_currentPath][key].isDeleted
            && document.getElementById(_savedContents[_currentPath][key].element.id) != null)
            removeElement(_savedContents[_currentPath][key].element);
    });
}

//Out of time content are not considered deleted.
function isWithinTimeFrame(element) {
    var dateStart = new Date(document.querySelector('ol[class*="scrollerInner"] li:not([id^="deleted-"]) time').getAttribute("datetime"));

    return getElementDate(element) >= dateStart;
}

function getElementAfterByDate(element) {
    var toReturn = null;

    var timeElements = document.querySelectorAll('ol[class*="scrollerInner"] li:not([id^="deleted-"]) time');
    timeElements.forEach((timeElement) => {
        if (new Date(timeElement.getAttribute("datetime")) < getElementDate(element))
            toReturn = timeElement.closest("li");
    });

    if (toReturn == null)
        console.log("No element after date found.");

    return toReturn;
}

function getElementDate(element) {
    return new Date(element.querySelector("time").getAttribute("datetime"));
}

function isSelf(element) {
    return element.querySelector('[id^="message-content"][class*="isSending"]') != null;
}

function addMsgWithNotesToContent(originalContent, savedContent, msg, noteMsg) {
    var editedRef = originalContent.querySelector('span[class*="edited"]');
    if (editedRef == null)
        return;

    var container = document.createElement("div");
    container.textContent = msg;

    var note = document.createElement("span");
    note.className = editedRef.className;
    note.style.color = "var(--text-muted)";
    note.textContent = noteMsg;

    addElement(container, note);
    addElement(savedContent, container);
}

function addElementBefore(element, newElement) {
    _enableObserver = false;
    element.before(newElement);
    _enableObserver = true;
}

function addElement(parent, newElement) {
    _enableObserver = false;
    parent.appendChild(newElement);
    _enableObserver = true;
}

function removeElement(element) {
    _enableObserver = false;
    element.remove();
    _enableObserver = true;
}

function getTrueInnerText(element) {
    return [...element.childNodes]
        .filter(node =>
            node.nodeType === Node.TEXT_NODE ||
            !(node.nodeType === Node.ELEMENT_NODE && node.className.includes("timestamp"))
        )
        .map(node => node.textContent)
        .join("").trim();
}

function keepContentHidden(content) {
    if (isDisplayable(content)) {
        content.style.display = "none";
    }
}

function updatePath() {
    if (_currentPath != window.location.pathname) {
        _currentPath = window.location.pathname;

        if (_savedContents[_currentPath] == undefined)
            _savedContents[_currentPath] = {};

        var contents = getContents();
        contents.forEach((content) => {
            displaySavedContent(content);
        });

        displayDeletedContent();
    }
}

function getContents() {
    //Uploader is a temporally div when a message upload a picture
    return document.querySelectorAll('[id^="message-content"]:not([id^="message-content-Uploader"]):not([class*="repliedTextContent"]):not([class*="isDeleted"])');
}

function hideBlockedVocal() {
    if (!_enableHideBlockedVocal)
        return;

    var userToHide = document.querySelector('[aria-label="Ethilyk"]');  //Hide its container in case CSS isn't working.
    if (userToHide != null)
        userToHide.closest('[class*="draggable"]').style.display = "none";

    var popupToClick = document.querySelector('[class*="focusLock"][aria-labelledby^=":"] button:not([class*="leave"])')
    if (popupToClick != null)
        popupToClick.click();
}

function addCSS() {
    _style = document.createElement("style");

    if (_enableHideBlockedChat)
        _style.textContent += '[class^="groupStart"] { display: none; } ';

    if (_enableHideBlockedVocal) {
        _style.textContent += '[class*="focusLock"][aria-labelledby^=":"] { display: none; } '; //Hide Voice Call Popup
        _style.textContent += '[aria-label="Ethilyk"] { display: none; } '; //User to hide
    }

    if (_enableSaveEditedContent && _includeDeletedContent)
        _style.textContent += '[id^="deleted-"] > :first-child  { background: rgba(255,0,0,' + _deletedColorOpacity + ') } ';

    if (_enableNickname) {
        _style.textContent += `
        #nicknameInput{
            background: rgba(255, 255, 255, 0.75);
            border: none;
            border-radius: 10px;
            text-align: center;
            color: var(--header-primary);
            font-weight: inherit;
            font-style: inherit;
            font- amily: inherit;
            font-size: 100 %;
        } `
    }

    addElement(document.head, _style);
}

function removeCSS() {
    removeElement(_style);
}

function isDisplayable(content) {
    if (_savedContents[_currentPath][content.id] == null || _savedContents[_currentPath][content.id] == undefined)    //Apparently sometime discord creates a fake content and delete it immediatly.
        return false;

    return _savedContents[_currentPath][content.id].allEdit != "" && !isSelf(_savedContents[_currentPath][content.id].element);
}

function getUserId(element) {
    var id = null;
    var splits;

    if (element.className.includes("usernameFont")) //Vocal
        splits = element.closest('[class*="content"]').querySelector('[class*="userAvatar"]').getAttribute("style").split("/");
    else {
        var userContainer = element.closest("li")   //Chat
        if (userContainer != null && !element.parentElement.className.includes("anchor")) {  //Exclude anchor in chat (pinned message), TODO Later
            splits = getImgUrlSplits(userContainer, element);
        }

        else {
            userContainer = element.closest('[class*="userInfo"]'); //Friend List
            if (userContainer != null)
                splits = getImgUrlSplits(userContainer, element);

            else {
                userContainer = element.closest('[class*="layout"]');   //Direct Message
                if (userContainer != null)
                    splits = getImgUrlSplits(userContainer, element);

                else {
                    userContainer = element.closest('[class*="inner"]');   //Profile Page
                    if (userContainer != null)
                        splits = getImgUrlSplits(userContainer, element);
                }
            }
        }
    }

    if (splits == null || splits == undefined)
        return id;

    for (var i = 0; i < splits.length - 1; i++) {
        var split = splits[i];
        if (split.includes("avatar")) {
            id = splits[i + 1];
            break;
        }
    }

    return id;
}

function getImgUrlSplits(userContainer, element) {
    var selector = 'img[class*="avatar"]:not(img[class*="avatarDecoration"]), img[class*="Avatar"]';
    var img = element.parentElement.querySelector(selector);    //Direct container

    if (img == null)
        if (isRepliedMessage(element))
            return null;
        else if (isReplyMessage(element)) { //Use last img avatar for replyMessage
            img = userContainer.querySelectorAll(selector);
            img = img[img.length - 1];
        } else
            img = userContainer.querySelector(selector);

    if (img == null)    //Most likely a group conversation
        return null;

    return img.getAttribute("src").split("/");
}

function isRepliedMessage(element) {
    return element.closest('[class*="repliedMessage"]') != null;
}

function isReplyMessage(element) {
    return element.closest('[aria-describedby*="message-reply"]') != null;
}

function displayNickname() {
    if (!_enableNickname)
        return;

    //Vocal, Chat, Friend List, Direct Message
    var names = document.querySelectorAll('div[class*="usernameFont"], span[class*="username"], div[class*="nameAndDecorators"] div[class*="overflow"]');

    names.forEach((name) => {
        var id = getUserId(name)
        if (id == null)
            return;

        var nickname = _nicknames[id];
        if (nickname != null && nickname != undefined && nickname != "") {
            name.textContent = nickname;
        }
    });
}

function buildEditNicknameUI() {
    if (!_enableNickname)
        return;

    var nameContainer = document.querySelector('[class*="focusLock"][aria-label="User Profile Modal"] [class*="usernameRow"]');
    if (nameContainer == null)
        return;

    var input = nameContainer.querySelector("#nicknameInput");
    if (input != null)
        return;

    _activeProfile = getUserId(nameContainer);

    input = document.createElement("input");
    input.id = "nicknameInput";
    input.type = "text";
    input.placeholder = "Nickname";

    var nickname = _nicknames[_activeProfile];
    if (nickname != null && nickname != undefined && nickname != "")
        input.value = nickname;

    input.addEventListener("change", (event) => {
        _nicknames[_activeProfile] = event.target.value;
    });

    addElement(nameContainer, input);
}
