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
            "version": "0.5.1",
            "description": "Enables different types of formatting in standard Discord chat. Support Server: bit.ly/ZeresServer",
            "github": "https://github.com/Yentis/betterdiscord-emotereplacer",
            "github_raw": "https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js"
        },
        "changelog": [
            {"title": "New Stuff", "items": [
                "KawaiiEmotes is no longer needed, feel free to delete it.",
                    "Be sure to redownload the plugin library, it had an issue with automatic updates: https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js"]},
            {"title": "Bugs Squashed", "type": "fixed", "items": ["Autocomplete fixed.", "Autcomplete navigation fixed."]}
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
            const shouldCompleteTwitch = RegExp.prototype.test.bind(/(?:^|\s)\w{2,}$/);

            return class EmoteReplacer extends Plugin {
                constructor() {
                    super();
                    this.cached = {};
                    this.windowSize = 10;
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
                    this.renderCompletions = _.debounce(function () {
                        const textarea = $(`${DiscordSelectors.Textarea.textArea}`)[0];
                        const channelTextArea = $(`${DiscordSelectors.Textarea.inner}`);
                        const oldAutoComplete = channelTextArea.children(`.${this.getName()}`);

                        const candidateText = textarea.value.slice(0, textarea.selectionEnd);
                        if (!shouldCompleteTwitch(candidateText) || !this.prepareCompletions(candidateText)) {
                            oldAutoComplete.remove();
                            return;
                        }

                        const {completions, matchText, selectedIndex, windowOffset: firstIndex} = this.cached;
                        const matchList = completions.slice(firstIndex, firstIndex+this.windowSize);

                        let autoDiv = $("<div>")
                            .addClass(`autocomplete-1vrmpx autocomplete-i9yVHs ${this.getName()}`)
                            .on(`wheel.${this.getName()}`, e => this.scrollCompletions(e, {locked: true}));
                        let inner = $("<div>", {"class": "autocompleteInner-zh20B_"})
                            .appendTo(autoDiv);
                        // FIXME: clean up this mess of jQuery
                        $("<div>", {"class": "autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa"})
                            .append($("<div>", {"class": "selector-2IcQBU"})
                                .append($("<div>", {text: "Emoji matching "}).append($("<strong>", {text: matchText}))
                                    .addClass("contentTitle-2tG_sM primary400-hm0Rav weightBold-2yjlgw")))
                            .appendTo(inner);
                        inner
                            .append(matchList.map((e,i) => {
                                let row = $("<div>", {"class": "autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa"});
                                let selector = $("<div>", {"class": "selector-2IcQBU selectable-3dP3y-"})
                                    .append($("<div>")
                                        .addClass("flex-1xMQg5 flex-1O1GKY horizontal-1ae9ci horizontal-2EEEnY flex-1O1GKY directionRow-3v3tfG justifyStart-2NDFzi alignCenter-1dQNNs noWrap-3jynv6 content-Qb0rXO")
                                        .css("flex", "1 1 auto")
                                        .append($("<img>", {src: e[1], alt: e[0], title: e[0], "class": `icon-3ZzoN7`,}).attr("draggable", "false").css("width", "25px").css('top', 0))
                                        .append($("<div>", {"class": "marginLeft8-1YseBe", text: e[0]})))
                                    .appendTo(row);

                                if (i+firstIndex === selectedIndex) {
                                    selector.addClass("selectorSelected-1_M1WV");
                                }
                                row.on(`mouseenter.${this.getName()}`, e => {
                                    this.cached.selectedIndex = i+firstIndex;
                                    row.siblings().children(".selectorSelected-1_M1WV").removeClass("selectorSelected-1_M1WV");
                                    row.children().addClass("selectorSelected-1_M1WV");
                                }).on(`mousedown.${this.getName()}`, e => {
                                    this.cached.selectedIndex = i+firstIndex;
                                    this.insertSelectedCompletion();
                                    // Prevent loss of focus
                                    e.preventDefault();
                                });
                                return row;
                            }));

                        oldAutoComplete.remove();

                        channelTextArea
                            .append(autoDiv);
                    }, 250)
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
                    let textarea = $(`${DiscordSelectors.Textarea.channelTextArea} textarea`);

                    textarea.on(`keyup.${this.getName()} keypress.${this.getName()} click.${this.getName()}`, (e) => {
                        this.checkCompletions(e);
                    });
                    textarea.on(`keydown.${this.getName()}`, (e) => {
                        this.replaceEmote(e);
                        this.browseCompletions(e);
                    });
                    textarea.on(`wheel.${this.getName()}`, (e) => {
                        this.scrollCompletions(e);
                    });
                    textarea.on(`blur.${this.getName()}`, (e) => {
                        this.destroyCompletions(e);
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
                                let content = textArea.innerHTML.replace(foundEmote.name, "").trim();

                                this.setSelectionRange(textArea, 0, textArea.innerHTML.length);
                                document.execCommand("delete");

                                if(foundEmote.url.endsWith("gif")) {
                                    this.getGifUrl(foundEmote.url).then((newUrl) => {
                                        this.fetchBlobAndUpload(newUrl, foundEmote.name, content);
                                    }).catch((error) => {
                                        console.warn("EmoteReplacer: " + error);
                                    });
                                } else {
                                    this.fetchBlobAndUpload(foundEmote.url, foundEmote.name, content);
                                }
                            }
                        }
                    }
                }

                browseCompletions(e) {
                    let textarea = e.target;

                    const candidateText = textarea.value.slice(0, textarea.selectionEnd);
                    if (!shouldCompleteTwitch(candidateText)) {
                        return;
                    }

                    let delta = 0, options;

                    switch (e.which) {
                        // Tab
                        case 9:
                            const candidateText = textarea.value.slice(0, textarea.selectionEnd);
                            if (!this.prepareCompletions(candidateText)) {
                                break;
                            }

                            // Prevent Discord's default behavior (send message)
                            e.stopPropagation();
                            // Prevent adding a tab or line break to text
                            e.preventDefault();

                            this.insertSelectedCompletion();
                            break;

                        // Up
                        case 38:
                            delta = -1;
                            break;

                        // Down
                        case 40:
                            delta = 1;
                            break;

                        // Page Up
                        case 33:
                            delta = -this.windowSize;
                            options = {locked: true, clamped: true};
                            break;

                        // Page Down
                        case 34:
                            delta = this.windowSize;
                            options = {locked: true, clamped: true};
                            break;
                    }

                    if (delta !== 0 && this.prepareCompletions(candidateText)) {
                        // Prevent Discord's default behavior
                        e.stopPropagation();
                        // Prevent cursor movement
                        e.preventDefault();

                        this.scrollWindow(delta, options);
                    }
                }

                checkCompletions(e) {
                    let textarea = e.target;

                    const candidateText = textarea.value.slice(0, textarea.selectionEnd);
                    const {candidateText: lastText} = this.cached;

                    // If an emote match is impossible, don't override default behavior.
                    // This allows other completion types (like usernames or channels) to work as usual.
                    if (!shouldCompleteTwitch(candidateText)) {
                        this.destroyCompletions();
                        return;
                    }

                    // Don't override enter when there are no actual completions.
                    // This allows message sending to work as usual.
                    if (e.key === "Enter") {
                        return;
                    }

                    // For any other key, always override, even when there are no actual completions.
                    // This prevents Discord's emoji autocompletion from kicking in intermittently.
                    e.stopPropagation();

                    if (lastText !== candidateText) {
                        this.renderCompletions();
                    }
                }

                scrollCompletions(e, options) {
                    const delta = Math.sign(e.originalEvent.deltaY);
                    this.scrollWindow(delta, options);
                }

                scrollWindow(delta, {locked=false, clamped=false} = {}) {
                    const preScroll = 2;
                    const {completions, selectedIndex: prevSel, windowOffset} = this.cached;

                    if (completions === undefined || completions.length === 0) {
                        return;
                    }

                    // Change selected index
                    const num = completions.length;
                    let sel = prevSel + delta;
                    if (clamped) {
                        sel = _.clamp(sel, 0, num-1);
                    } else {
                        sel = (sel % num) + (sel<0 ? num : 0);
                    }
                    this.cached.selectedIndex = sel;

                    // Clamp window position to bounds based on new selected index
                    const boundLower = _.clamp(sel + preScroll - (this.windowSize-1), 0, num-this.windowSize);
                    const boundUpper = _.clamp(sel - preScroll, 0, num-this.windowSize);
                    this.cached.windowOffset = _.clamp(windowOffset + (locked ? delta : 0), boundLower, boundUpper);

                    // Render immediately
                    this.renderCompletions();
                    this.renderCompletions.flush();
                }

                insertSelectedCompletion() {
                    const {completions, matchStart, selectedIndex} = this.cached;
                    console.log(this.cached);

                    if (completions === undefined) {
                        return;
                    }

                    const textarea = $(`${DiscordSelectors.Textarea.textArea}`)[0];
                    textarea.focus();
                    // Set beginning of selection at start of partial emote text; end of selection end remains where it is
                    textarea.selectionStart = matchStart;
                    document.execCommand("insertText", false, completions[selectedIndex][0] + " ");

                    this.destroyCompletions();
                }

                destroyCompletions() {
                    $(`${DiscordSelectors.Textarea.inner}`).children(`.${this.getName()}`).remove();
                    this.cached = {};
                    this.renderCompletions.cancel();
                }

                prepareCompletions(candidateText) {
                    const {candidateText: lastText} = this.cached;

                    if (lastText !== candidateText) {
                        const {completions, matchText, matchStart} = this.getCompletionsTwitch(candidateText);
                        this.cached = {candidateText, completions, matchText, matchStart, selectedIndex: 0, windowOffset: 0};
                    }

                    const {completions} = this.cached;
                    return (completions !== undefined && completions.length !== 0);
                }

                getCompletionsTwitch(text) {
                    const match = text.match(/(^|\s)(\w{2,})$/);
                    if (match === null) {
                        return {completions: [], matchText: null, matchStart: -1};
                    }

                    let emoteArray = [];
                    for (let key in this.emoteNames) {
                        if(this.emoteNames.hasOwnProperty(key)) {
                            emoteArray.push([key, this.emoteNames[key]]);
                        }
                    }

                    const completions = emoteArray
                        .filter((emote) => {
                            if(emote[0].toLowerCase().search(match[2]) !== -1){
                                return emote;
                            }
                        });
                    const matchText = match[2], matchStart = match.index + match[1].length;

                    return {completions, matchText, matchStart};
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

                fetchBlobAndUpload(url, name, content = "") {
                    fetch(url)
                        .then(res => res.blob())
                        .then(blob => {
                            let extension = url.split(".").pop();
                            let fullName = name + "." + extension;

                            if(url.endsWith("png")) {
                                this.compress(name, blob, (resultBlob) => {
                                    this.uploadFile(resultBlob, fullName, content);
                                });
                            } else {
                                this.uploadFile(blob, fullName, content);
                            }
                        });
                }

                uploadFile(blob, fullName, content) {
                    Uploader.upload(SelectedChannelStore.getChannelId(),
                        new File([blob], fullName), {
                            content: content, invalidEmojis: [], tts: false
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
                            const scaleFactor = width / img.width;
                            let ctx = this.downScaleImage(img, scaleFactor).getContext("2d");
                            ctx.canvas.toBlob(callback, "image/png", 1);
                        };
                    };
                    reader.onerror = error => {
                        console.warn("EmoteReplacer: " + error);
                        callback();
                    };
                }

                downScaleImage(img, scale) {
                    let imgCV = document.createElement('canvas');
                    imgCV.width = img.width;
                    imgCV.height = img.height;
                    let imgCtx = imgCV.getContext('2d');
                    imgCtx.drawImage(img, 0, 0);
                    return this.downScaleCanvas(imgCV, scale);
                }

                downScaleCanvas(cv, scale) {
                    if (!(scale < 1) || !(scale > 0)) throw ('scale must be a positive number <1 ');
                    let sqScale = scale * scale; // square scale = area of source pixel within target
                    let sw = cv.width; // source image width
                    let sh = cv.height; // source image height
                    let tw = Math.ceil(sw * scale); // target image width
                    let th = Math.ceil(sh * scale); // target image height
                    let sx = 0, sy = 0, sIndex = 0; // source x,y, index within source array
                    let tx = 0, ty = 0, yIndex = 0, tIndex = 0; // target x,y, x,y index within target array
                    let tX = 0, tY = 0; // rounded tx, ty
                    let w = 0, nw = 0, wx = 0, nwx = 0, wy = 0, nwy = 0; // weight / next weight x / y
                    // weight is weight of current source point within target.
                    // next weight is weight of current source point within next target's point.
                    let crossX = false; // does scaled px cross its current px right border ?
                    let crossY = false; // does scaled px cross its current px bottom border ?
                    let sBuffer = cv.getContext('2d').
                    getImageData(0, 0, sw, sh).data; // source buffer 8 bit rgba
                    let tBuffer = new Float32Array(4 * sw * sh); // target buffer Float32 rgb
                    let sR = 0, sG = 0,  sB = 0; // source's current point r,g,b
                    // untested !
                    let sA = 0;  //source alpha

                    for (sy = 0; sy < sh; sy++) {
                        ty = sy * scale; // y src position within target
                        tY = 0 | ty;     // rounded : target pixel's y
                        yIndex = 4 * tY * tw;  // line index within target array
                        crossY = (tY !== (0 | ty + scale));
                        if (crossY) { // if pixel is crossing botton target pixel
                            wy = (tY + 1 - ty); // weight of point within target pixel
                            nwy = (ty + scale - tY - 1); // ... within y+1 target pixel
                        }
                        for (sx = 0; sx < sw; sx++, sIndex += 4) {
                            tx = sx * scale; // x src position within target
                            tX = 0 |  tx;    // rounded : target pixel's x
                            tIndex = yIndex + tX * 4; // target pixel index within target array
                            crossX = (tX !== (0 | tx + scale));
                            if (crossX) { // if pixel is crossing target pixel's right
                                wx = (tX + 1 - tx); // weight of point within target pixel
                                nwx = (tx + scale - tX - 1); // ... within x+1 target pixel
                            }
                            sR = sBuffer[sIndex    ];   // retrieving r,g,b for curr src px.
                            sG = sBuffer[sIndex + 1];
                            sB = sBuffer[sIndex + 2];
                            sA = sBuffer[sIndex + 3];

                            if (!crossX && !crossY) { // pixel does not cross
                                // just add components weighted by squared scale.
                                tBuffer[tIndex    ] += sR * sqScale;
                                tBuffer[tIndex + 1] += sG * sqScale;
                                tBuffer[tIndex + 2] += sB * sqScale;
                                tBuffer[tIndex + 3] += sA * sqScale;
                            } else if (crossX && !crossY) { // cross on X only
                                w = wx * scale;
                                // add weighted component for current px
                                tBuffer[tIndex    ] += sR * w;
                                tBuffer[tIndex + 1] += sG * w;
                                tBuffer[tIndex + 2] += sB * w;
                                tBuffer[tIndex + 3] += sA * w;
                                // add weighted component for next (tX+1) px
                                nw = nwx * scale;
                                tBuffer[tIndex + 4] += sR * nw; // not 3
                                tBuffer[tIndex + 5] += sG * nw; // not 4
                                tBuffer[tIndex + 6] += sB * nw; // not 5
                                tBuffer[tIndex + 7] += sA * nw; // not 6
                            } else if (crossY && !crossX) { // cross on Y only
                                w = wy * scale;
                                // add weighted component for current px
                                tBuffer[tIndex    ] += sR * w;
                                tBuffer[tIndex + 1] += sG * w;
                                tBuffer[tIndex + 2] += sB * w;
                                tBuffer[tIndex + 3] += sA * w;
                                // add weighted component for next (tY+1) px
                                nw = nwy * scale;
                                tBuffer[tIndex + 4 * tw    ] += sR * nw; // *4, not 3
                                tBuffer[tIndex + 4 * tw + 1] += sG * nw; // *4, not 3
                                tBuffer[tIndex + 4 * tw + 2] += sB * nw; // *4, not 3
                                tBuffer[tIndex + 4 * tw + 3] += sA * nw; // *4, not 3
                            } else { // crosses both x and y : four target points involved
                                // add weighted component for current px
                                w = wx * wy;
                                tBuffer[tIndex    ] += sR * w;
                                tBuffer[tIndex + 1] += sG * w;
                                tBuffer[tIndex + 2] += sB * w;
                                tBuffer[tIndex + 3] += sA * w;
                                // for tX + 1; tY px
                                nw = nwx * wy;
                                tBuffer[tIndex + 4] += sR * nw; // same for x
                                tBuffer[tIndex + 5] += sG * nw;
                                tBuffer[tIndex + 6] += sB * nw;
                                tBuffer[tIndex + 7] += sA * nw;
                                // for tX ; tY + 1 px
                                nw = wx * nwy;
                                tBuffer[tIndex + 4 * tw    ] += sR * nw; // same for mul
                                tBuffer[tIndex + 4 * tw + 1] += sG * nw;
                                tBuffer[tIndex + 4 * tw + 2] += sB * nw;
                                tBuffer[tIndex + 4 * tw + 3] += sA * nw;
                                // for tX + 1 ; tY +1 px
                                nw = nwx * nwy;
                                tBuffer[tIndex + 4 * tw + 4] += sR * nw; // same for both x and y
                                tBuffer[tIndex + 4 * tw + 5] += sG * nw;
                                tBuffer[tIndex + 4 * tw + 6] += sB * nw;
                                tBuffer[tIndex + 4 * tw + 7] += sA * nw;
                            }
                        } // end for sx
                    } // end for sy

                    // create result canvas
                    let resCV = document.createElement('canvas');
                    resCV.width = tw;
                    resCV.height = th;
                    let resCtx = resCV.getContext('2d');
                    let imgRes = resCtx.getImageData(0, 0, tw, th);
                    let tByteBuffer = imgRes.data;
                    // convert float32 array into a UInt8Clamped Array
                    let pxIndex = 0; //
                    for (sIndex = 0, tIndex = 0; pxIndex < tw * th; sIndex += 4, tIndex += 4, pxIndex++) {
                        tByteBuffer[tIndex] = Math.ceil(tBuffer[sIndex]);
                        tByteBuffer[tIndex + 1] = Math.ceil(tBuffer[sIndex + 1]);
                        tByteBuffer[tIndex + 2] = Math.ceil(tBuffer[sIndex + 2]);
                        tByteBuffer[tIndex + 3] = Math.ceil(tBuffer[sIndex + 3]);
                    }
                    // writing result to canvas.
                    resCtx.putImageData(imgRes, 0, 0);
                    return resCV;
                }
            }
        };
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
