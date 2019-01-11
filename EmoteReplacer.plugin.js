//META{"name":"EmoteReplacer","displayName":"Emote Replacer","website":"https://github.com/Yentis/betterdiscord-emotereplacer","source":"https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js"}*//

let EmoteReplacer = (() => {
    const config = {
        "info": {
            "name": "EmoteReplacer",
            "authors": [{
                "name": "Yentis",
                "discord_id": "68834122860077056",
                "github_username": "Yentis",
                "twitter_username": "yentis178"
            }],
            "version": "0.3.0",
            "description": "Enables different types of formatting in standard Discord chat. Support Server: bit.ly/ZeresServer",
            "github": "https://github.com/Yentis/betterdiscord-emotereplacer",
            "github_raw": "https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js"
        },
        "changelog": [{
            "title": "What's New?",
            "items": ["General improvements."]
        }],
        "main": "index.js"
    };

    return !global.ZeresPluginLibrary ? class {
        getName() {return config.info.name;}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        getAuthor() {return config.info.authors.map(a => a.name).join(", ");}
        load() {window.BdApi.alert("Library Missing",`The library plugin needed for ${config.info.name} is missing.<br /><br /> <a href="https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js" target="_blank">Click here to download the library!</a>`);}
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Api) => {
            const {DiscordSelectors, PluginUtilities} = Api;
            const {clipboard, nativeImage} = require("electron");
            return class EmoteReplacer extends Plugin {
                constructor() {
                    super();
                    this.oldVal = "";
                    this.enabled = true;
                    this.button = null;
                    this.emoteNames = null;
                    this.awaitingTextArea = false;
                    this.mainCSS = `
                    #toggleEmoteReplacer button {
                        transition: transform .1s;
                        background: transparent;
                        color: hsla(0, 0%, 100%, .7);
                        margin: 0 5px;
                    }
                    
                    #toggleEmoteReplacer:hover button {
                        color: hsla(0, 0%, 100%, 1);
                        transform: scale(1.2);
                    }`;
                }

                onStart() {
                    ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js");
                    PluginUtilities.addStyle(this.getName()  + "-style", this.mainCSS);
                    this.getEmoteNames().then((names) => {
                        this.emoteNames = names;
                        $(`${DiscordSelectors.Textarea.channelTextArea} textarea`).each(() => {
                            this.addToggle();
                        });
                    }).catch((error) => {
                        console.warn("EmoteReplacer: " + name + ": " + error);
                    });
                }

                onStop() {
                    $("*").off("." + this.getName());
                    if(this.button) $(this.button).remove();
                    PluginUtilities.removeStyle(this.getName() + "-style");
                }

                observer(e) {
                    if(!e.addedNodes.length || !(e.addedNodes[0] instanceof Element)) return;

                    let elem = e.addedNodes[0];
                    let textarea = elem.querySelector(DiscordSelectors.Textarea.textArea);
                    let uploadModal = $(elem).is(DiscordSelectors.Modals.modal.value);

                    if(this.awaitingTextArea && uploadModal){
                        this.sendKey($(elem).find("textarea")[0], "Enter", 13);
                        this.awaitingTextArea = false;
                    } else if(textarea && $(textarea).parents(DiscordSelectors.Modals.modal.value).length === 0) {
                        this.addToggle();
                        this.addListener();
                    }
                }

                addToggle() {
                    if(document.getElementById("toggleEmoteReplacer")) return;
                    $(`${DiscordSelectors.Textarea.inner}`).prepend(
                        `<div id='toggleEmoteReplacer' class='flex-1xMQg5 flex-1O1GKY da-flex da-flex horizontal-1ae9ci horizontal-2EEEnY flex-1O1GKY directionRow-3v3tfG justifyStart-2NDFzi alignStretch-DpGPf3 noWrap-3jynv6'>
                            <button type='button'></button>
                            <div class='attachButtonDivider-3Glu60 da-attachButtonDivider'></div>
                        </div>`);

                    this.button = document.getElementById("toggleEmoteReplacer");
                    this.setToggleChar();

                    $(this.button).on("click." + this.getName(), () => {
                        this.enabled = !this.enabled;
                        this.setToggleChar();
                    });
                }

                addListener() {
                    $(`${DiscordSelectors.Textarea.channelTextArea} textarea`).on("keydown." + this.getName(), (e) => {
                        this.replaceEmote(e);
                    });
                }

                setToggleChar() {
                    if(this.button) {
                        let toggle = $("#toggleEmoteReplacer button")[0];

                        if(this.enabled) {
                            toggle.innerHTML = "✓";
                        } else {
                            toggle.innerHTML = "X";
                        }
                    }
                }

                getEmoteNames() {
                    return new Promise((resolve, reject) => {
                        $.ajax({
                            dataType: "json",
                            url: "https://yentis.github.io/emotes/emotes.json",
                            success: function (data) {
                                let emoteNames = {};

                                for (let key in data) {
                                    if(data.hasOwnProperty(key)) {
                                        let split = data[key].split('.');
                                        let name = split[0];

                                        emoteNames[name] = "https://yentis.github.io/emotes/images/" + key + '.' + split[1];
                                    }
                                }

                                resolve(emoteNames);
                            },
                            error: function (obj, name, error) {
                                reject(name + " - " + error);
                            }
                        });
                    });
                }

                replaceEmote(e) {
                    if(!this.enabled) return;

                    let textArea = e.target;
                    let newVal = textArea.innerHTML;
                    if(this.oldVal !== newVal){
                        this.oldVal = newVal;

                        if(e.key === "Enter") {
                            let foundEmote = this.getTextPos(newVal);

                            if(foundEmote) {
                                let pos = foundEmote.pos;
                                let emoteLength = pos+foundEmote.emoteLength;
                                let prevCharacter = textArea.innerHTML[pos-1];

                                if(prevCharacter && prevCharacter === " ") {
                                    pos = pos-1;
                                }

                                this.setSelectionRange(textArea, pos, emoteLength);
                                document.execCommand("delete");
                                this.sendKey(textArea, "Enter", 13);
                                this.sendEmote(textArea, foundEmote.url, foundEmote.name);
                            }
                        }
                    }
                }

                getTextPos(value) {
                    let foundEmotes = [];

                    for (let key in this.emoteNames) {
                        if(this.emoteNames.hasOwnProperty(key)) {
                            let regex = new RegExp("\\b" + key + "\\b");
                            let pos = value.search(regex);

                            if(pos !== -1) {
                                foundEmotes.push({name: key, url: this.emoteNames[key], emoteLength: key.length, pos: pos});
                            }
                        }
                    }

                    if(foundEmotes.length > 0) {
                        return foundEmotes[foundEmotes.length-1];
                    }
                }

                setSelectionRange(input, selectionStart, selectionEnd) {
                    if(input.setSelectionRange) {
                        input.focus();
                        input.setSelectionRange(selectionStart, selectionEnd);
                    } else if(input.createTextRange) {
                        let range = input.createTextRange();
                        range.collapse(true);
                        range.moveEnd('character', selectionEnd);
                        range.moveStart('character', selectionStart);
                        range.select();
                    }
                }

                sendKey(target, key, keyCode) {
                    const press = new KeyboardEvent("keypress", {key: key, code: key, which: keyCode, keyCode: keyCode, bubbles: true});
                    Object.defineProperties(press, {keyCode: {value: keyCode}, which: {value: keyCode}});
                    target.dispatchEvent(press);
                }

                sendEmote(textArea, url, name) {
                    if(url.endsWith("gif")) {
                        let split = url.split(".");
                        url = url.substring(0, url.length -4) + "-s." + split[split.length-1];
                        setTimeout(() => {
                            document.execCommand("insertText", false, url);
                            this.sendKey(textArea, "Enter", 13);
                        }, 100);
                    } else {
                        fetch(url)
                            .then(res => res.blob())
                            .then(blob => {
                                this.compress(name, blob, (dataURL) => {
                                    if(dataURL) {
                                        clipboard.write({image: nativeImage.createFromDataURL(dataURL)});
                                        document.execCommand("paste");
                                        this.awaitingTextArea = true;
                                    }
                                });
                            });
                    }
                }

                compress(fileName, originalFile, callback) {
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
                        console.warn("EmoteReplacer: " + error);
                        callback();
                    };
                }
            }
        };
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
