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
            "version": "0.4.0",
            "description": "Enables different types of formatting in standard Discord chat. Support Server: bit.ly/ZeresServer",
            "github": "https://github.com/Yentis/betterdiscord-emotereplacer",
            "github_raw": "https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js"
        },
        "changelog": [{
            "title": "What's New?",
            "items": ["Gifs no longer have links!", "You can choose between 3 emote sizes."]
        }],
        "defaultConfig": [{
            "type": "category",
            "id": "sizeSettings",
            "name": "Size settings",
            "collapsible": false,
            "shown": true,
            "settings": [{
                "type": "dropdown",
                "id": "size",
                "name": "Size",
                "note": "What size the emotes should be.",
                "value": 32,
                "options": [{
                    "label": "32px",
                    "value": 32
                }, {
                    "label": "64px",
                    "value": 64
                }, {
                    "label": "128px",
                    "value": 128
                }]
            }, {
                "type": "textbox",
                "id": "sampleText",
                "name": "Sample Text",
                "note": "Sample Text",
                "value": "Sample Text",
            }]
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

            // If samogot's DiscordInternals lib exists, use it. Otherwise, fall back on bundled code below.
            // See: https://github.com/samogot/betterdiscord-plugins/tree/master/v2/1Lib%20Discord%20Internals
            const DI = window.DiscordInternals;
            const hasLib = !!(DI && DI.versionCompare && DI.versionCompare(DI.version || "", "1.9") >= 0);
            const WebpackModules = hasLib && DI.WebpackModules || (() => {

                const req = typeof(webpackJsonp) == "function" ? webpackJsonp([], {
                    '__extra_id__': (module, exports, req) => exports.default = req
                }, ['__extra_id__']).default : webpackJsonp.push([[], {
                    '__extra_id__': (module, exports, req) => module.exports = req
                }, [['__extra_id__']]]);
                delete req.m['__extra_id__'];
                delete req.c['__extra_id__'];

                /**
                 * Predicate for searching module
                 * @callback modulePredicate
                 * @param {*} module Module to test
                 * @return {boolean} Returns `true` if `module` matches predicate.
                 */

                /**
                 * Look through all modules of internal Discord's Webpack and return first one that matches filter predicate.
                 * At first this function will look through already loaded modules cache. If no loaded modules match, then this function tries to load all modules and match for them. Loading any module may have unexpected side effects, like changing current locale of moment.js, so in that case there will be a warning the console. If no module matches, this function returns `null`. You should always try to provide a predicate that will match something, but your code should be ready to receive `null` in case of changes in Discord's codebase.
                 * If module is ES6 module and has default property, consider default first; otherwise, consider the full module object.
                 * @param {modulePredicate} filter Predicate to match module
                 * @param {object} [options] Options object.
                 * @param {boolean} [options.cacheOnly=false] Set to `true` if you want to search only the cache for modules.
                 * @return {*} First module that matches `filter` or `null` if none match.
                 */
                const find = (filter, options = {}) => {
                    const {cacheOnly = false} = options;
                    for (let i in req.c) {
                        if (req.c.hasOwnProperty(i)) {
                            let m = req.c[i].exports;
                            if (m && m.__esModule && m.default && filter(m.default))
                                return m.default;
                            if (m && filter(m))
                                return m;
                        }
                    }
                    if (cacheOnly) {
                        console.warn('Cannot find loaded module in cache');
                        return null;
                    }
                    console.warn('Cannot find loaded module in cache. Loading all modules may have unexpected side effects');
                    for (let i = 0; i < req.m.length; ++i) {
                        let m = req(i);
                        if (m && m.__esModule && m.default && filter(m.default))
                            return m.default;
                        if (m && filter(m))
                            return m;
                    }
                    console.warn('Cannot find module');
                    return null;
                };

                /**
                 * Look through all modules of internal Discord's Webpack and return first object that has all of following properties. You should be ready that in any moment, after Discord update, this function may start returning `null` (if no such object exists anymore) or even some different object with the same properties. So you should provide all property names that you use, and often even some extra properties to make sure you'll get exactly what you want.
                 * @see Read {@link find} documentation for more details how search works
                 * @param {string[]} propNames Array of property names to look for
                 * @param {object} [options] Options object to pass to {@link find}.
                 * @return {object} First module that matches `propNames` or `null` if none match.
                 */
                const findByUniqueProperties = (propNames, options) => find(module => propNames.every(prop => module[prop] !== undefined), options);

                /**
                 * Look through all modules of internal Discord's Webpack and return first object that has `displayName` property with following value. This is useful for searching for React components by name. Take into account that not all components are exported as modules. Also, there might be several components with the same name.
                 * @see Use {@link ReactComponents} as another way to get react components
                 * @see Read {@link find} documentation for more details how search works
                 * @param {string} displayName Display name property value to look for
                 * @param {object} [options] Options object to pass to {@link find}.
                 * @return {object} First module that matches `displayName` or `null` if none match.
                 */
                const findByDisplayName = (displayName, options) => find(module => module.displayName === displayName, options);

                return {find, findByUniqueProperties, findByDisplayName};
            })();

            const Uploader = WebpackModules.findByUniqueProperties(['upload']);
            const SelectedChannelStore = WebpackModules.findByUniqueProperties(['getChannelId']);
            const request = window.require("request");

            return class EmoteReplacer extends Plugin {
                constructor() {
                    super();
                    this.oldVal = "";
                    this.enablePlugin = true;
                    this.button = null;
                    this.emoteNames = null;
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

                async onStart() {
                    ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), "https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js");
                    await PluginUtilities.addScript("gifsicle-stream", "//cdn.jsdelivr.net/gh/yentis/betterdiscord-emotereplacer@f577a9fbbfa807e82de52b37b5f6df7310ad0c16/gifsicle.js");
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
                    PluginUtilities.removeScript("gifsicle-stream");
                    PluginUtilities.removeStyle(this.getName() + "-style");
                }

                observer(e) {
                    if(!e.addedNodes.length || !(e.addedNodes[0] instanceof Element)) return;

                    let elem = e.addedNodes[0];
                    let textarea = elem.querySelector(DiscordSelectors.Textarea.textArea);

                    if(textarea && $(textarea).parents(DiscordSelectors.Modals.modal.value).length === 0) {
                        this.addToggle();
                        this.addListener();
                    }
                }

                getSettingsPanel() {
                    const panel = this.buildSettingsPanel();
                    panel.addListener(this.updateSettings.bind(this));
                    return panel.getElement();
                }

                updateSettings(group, id, value) {}

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
                        this.enablePlugin = !this.enablePlugin;
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

                        if(this.enablePlugin) {
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
                    if(!this.enablePlugin) return;

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

                                if(textArea.innerHTML.endsWith(" ")){
                                    emoteLength += 1;
                                }

                                this.setSelectionRange(textArea, pos, emoteLength);
                                document.execCommand("delete");
                                this.sendKey(textArea, "Enter", 13);

                                if(foundEmote.url.endsWith("gif")) {
                                    this.getGifUrl(foundEmote.url).then((newUrl) => {
                                        this.fetchBlobAndUpload(newUrl, foundEmote.name);
                                    }).catch((error) => {
                                        console.warn("EmoteReplacer: " + error);
                                    });
                                } else {
                                    this.fetchBlobAndUpload(foundEmote.url, foundEmote.name);
                                }
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

                getGifUrl(url) {
                    return new Promise((resolve, reject) => {
                        let split = url.split(".");
                        let smallUrl = url.substring(0, url.length -4) + "-" + this.settings.sizeSettings.size + "." + split[split.length-1];

                        request({url: smallUrl, encoding: null}, (error, response) => {
                            if (error) {
                                reject(error);
                            }

                            if(response.statusCode !== 404) {
                                resolve(smallUrl);
                            } else {
                                resolve(url);
                            }
                        });
                    });
                }

                fetchBlobAndUpload(url, name) {
                    fetch(url)
                        .then(res => res.blob())
                        .then(blob => {
                            let extension = url.split(".").pop();
                            let fullName = name + "." + extension;

                            if(url.endsWith("png")) {
                                this.compress(name, blob, (resultBlob) => {
                                    this.uploadFile(resultBlob, fullName);
                                });
                            } else {
                                this.uploadFile(blob, fullName);
                            }
                        });
                }

                uploadFile(blob, fullName) {
                    Uploader.upload(SelectedChannelStore.getChannelId(),
                        new File([blob], fullName), {
                            content: "", invalidEmojis: [], tts: false
                        }, false);
                }

                compress(fileName, originalFile, callback) {
                    const width = this.settings.sizeSettings.size;
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
                            ctx.canvas.toBlob(callback, "image/png", 1);
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
