//META{"name":"EmoteReplacer"}*//

let fieldChecker;
let listenerActive = false;
let oldVal = "";
let emoteNames;
let enabled = true;
const {clipboard, nativeImage} = require("electron");

class EmoteReplacer {
    getName() {return "Emote Replacer";}
    getDescription() {return "Replace text with embedded images";}
    getVersion() {return "0.1.0";}
    getAuthor() {return "Yentis";}

    start() {
        if (!global.ZeresPluginLibrary) return window.BdApi.alert("Library Missing",`The library plugin needed for ${this.getName()} is missing.<br /><br /> <a href="https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js" target="_blank">Click here to download the library!</a>`);
        ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js");
        fieldChecker = setInterval(checkEmoteNames, 100);
    }
    stop() {
        clearInterval(fieldChecker);
        let textArea = $('.textArea-2Spzkt');
        textArea.off("*.emoteReplacer");
        $("#toggleEmoteReplacer").off("click");
        listenerActive = false;
        oldVal = "";
    }

    load() {}

    onSwitch() {
        listenerActive = false;
        fieldChecker = setInterval(checkEmoteNames, 100);
    }
}

function getEmoteNames(callback) {
    $.ajax({
        dataType: "json",
        url: "https://yentis.github.io/emotes/emotes.json",
        success: function (data) {
            let emoteNames = {};

            for (let key in data) {
                if (data.hasOwnProperty(key)) {
                    let split = data[key].split('.');
                    let name = split[0];

                    emoteNames[name] = "https://yentis.github.io/emotes/images/" + key + '.' + split[1];
                }
            }

            callback(emoteNames);
        },
        error: function (obj, name, error) {
            logger(name + ": " + error, "warn");
            callback();
        }
    });
}

function getTextPos(value) {
    let foundEmotes = [];

    for (let key in emoteNames) {
        if (emoteNames.hasOwnProperty(key)) {
            let regex = new RegExp("\\b" + key + "\\b");
            let pos = value.search(regex);

            if(pos !== -1) {
                foundEmotes.push({name: key, url: emoteNames[key], emoteLength: key.length, pos: pos});
            }
        }
    }

    if(foundEmotes.length > 0) {
        return foundEmotes[foundEmotes.length-1];
    }
}

function setSelectionRange(input, selectionStart, selectionEnd) {
    if (input.setSelectionRange) {
        input.focus();
        input.setSelectionRange(selectionStart, selectionEnd);
    } else if (input.createTextRange) {
        let range = input.createTextRange();
        range.collapse(true);
        range.moveEnd('character', selectionEnd);
        range.moveStart('character', selectionStart);
        range.select();
    }
}

function sendKey(target, key, keyCode) {
    const press = new KeyboardEvent("keypress", {key: key, code: key, which: keyCode, keyCode: keyCode, bubbles: true});
    Object.defineProperties(press, {keyCode: {value: keyCode}, which: {value: keyCode}});
    target.dispatchEvent(press);
}

function logger(message, status) {
    console[status]("EmoteReplacer: " + message);
}

function checkEmoteNames() {
    if(!emoteNames) {
        getEmoteNames((names) => {
            emoteNames = names;
            findTextArea();
        });
    } else {
        findTextArea();
    }
}

function findTextArea() {
    let textArea = $('.textArea-2Spzkt');

    if(textArea.length > 0) {
        if(!listenerActive) {
            $(".inner-zqa7da").prepend("<div style='display:flex;'><button id='toggleEmoteReplacer' type='button' style='background:transparent;color:hsla(0,0%,100%,.7);margin:0 5px 0 5px;'>✓</button><div class='attachButtonDivider-3Glu60 da-attachButtonDivider'></div></div>");
            setToggleChar();

            textArea.on("keydown.emoteReplacer", (e) => {
                replaceEmote(e, textArea[0]);
            });

            $("#toggleEmoteReplacer").on("click", (e) => {
                enabled = !enabled;

                if(enabled) {
                    e.target.innerHTML = "✓";
                } else {
                    e.target.innerHTML = "X";
                }
            });

            listenerActive = true;
            clearInterval(fieldChecker);
        }
    }
}

function setToggleChar() {
    let button = document.getElementById("toggleEmoteReplacer");

    if(button) {
        if(enabled) {
            button.innerHTML = "✓";
        } else {
            button.innerHTML = "X";
        }
    }
}

function replaceEmote(e, textArea) {
    if(!enabled) {
        return;
    }

    let newVal = textArea.innerHTML;
    if(oldVal !== newVal){
        oldVal = newVal;

        if(e.key === "Enter") {
            let foundEmote = getTextPos(newVal);
            if(foundEmote) {
                let pos = foundEmote.pos;
                let emoteLength = pos+foundEmote.emoteLength;
                let prevCharacter = textArea.innerHTML[pos-1];

                if(prevCharacter && prevCharacter === " ") {
                    pos = pos-1;
                }

                setSelectionRange(textArea, pos, emoteLength);

                document.execCommand("delete");
                sendKey(textArea, "Enter", 13);

                sendEmote(textArea, foundEmote.url, foundEmote.name);
            }
        }
    }
}

function sendEmote(textArea, url, name) {
    if(url.endsWith("gif")) {
        setTimeout(() => {
            let split = url.split(".");
            url = url.substring(0, url.length -4) + "-s." + split[split.length-1];
            document.execCommand("insertText", false, url);
            sendKey(textArea, "Enter", 13);
        }, 100);
    } else {
        fetch(url)
        .then(res => res.blob())
        .then(blob => {
            compress(name, blob, function (dataURL){
                if(dataURL) {
                    clipboard.write({image: nativeImage.createFromDataURL(dataURL)});
                }
            });
        });

        setTimeout(() => {
            document.execCommand("paste");

            let target = $('.textArea-2Spzkt')[1];
            let timeout = 0;
            while(!target || timeout >= 20) {
                setTimeout(() => {
                    target = $('.textArea-2Spzkt')[1];
                    timeout++;
                }, 100);
            }

            sendKey(target, "Enter", 13);
        }, 500);
    }
}

function compress(fileName, originalFile, callback) {
    const width = 32;
    const reader = new FileReader();
    reader.readAsDataURL(originalFile);
    reader.onload = event => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const elem = document.createElement('canvas');
            const scaleFactor = width / img.width;
            elem.width = width;
            elem.height = img.height * scaleFactor;
            const ctx = elem.getContext('2d');
            // img.width and img.height will give the original dimensions
            ctx.drawImage(img, 0, 0, width, img.height * scaleFactor);
            callback(ctx.canvas.toDataURL("image/png", 1));
        };
    };
    reader.onerror = error => {
        logger(error, "warn");
        callback();
    };
}
