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
            "version": "1.1.0",
            "description": "Enables different types of formatting in standard Discord chat. Support Server: bit.ly/ZeresServer",
            "github": "https://github.com/Yentis/betterdiscord-emotereplacer",
            "github_raw": "https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js"
        },
        "changelog": [{
			"title": "Bugfix",
            "items": ["Fixed text parsing.", "Fixed spoilers.", "Fixed key listeners sometimes triggering twice"]
		}],
        "defaultConfig": [{
            "type": "category",
            "id": "sizeSettings",
            "name": "Size settings",
            "collapsible": false,
            "shown": true,
            "settings": [{
                "type": "textbox",
                "id": "size",
                "name": "Size",
                "note": "What size the emotes should be (in px, 32 - 128).",
                "value": 48
            }]
        }],
        "main": "index.js"
    };

    return !global.ZeresPluginLibrary ? class {
        getName() {return config.info.name;}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        getAuthor() {return config.info.authors.map(a => a.name).join(', ');}
        load() {window.BdApi.alert("Library Missing",`The library plugin needed for ${config.info.name} is missing.<br /><br /> <a href="https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js" target="_blank">Click here to download the library!</a>`);}
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Api) => {
            const {DiscordSelectors, PluginUtilities, Toasts} = Api;

            // If samogot's DiscordInternals lib exists, use it. Otherwise, fall back on bundled code below.
            // See: https://github.com/samogot/betterdiscord-plugins/tree/master/v2/1Lib%20Discord%20Internals
            const DI = window.DiscordInternals;
            const hasLib = !!(DI && DI.versionCompare && DI.versionCompare(DI.version || '', '1.9') >= 0);
		    const WebpackModules = hasLib && DI.WebpackModules || (() => {
	
		        const req = typeof (webpackJsonp) === "function" ? webpackJsonp([], {
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
		            const {cacheOnly = true} = options;
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
		                try {
		                    let m = req(i);
		                    if (m && m.__esModule && m.default && filter(m.default))
		                        return m.default;
		                    if (m && filter(m))
		                        return m;
		                } catch (e) {
		                }
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

            const Uploader = WebpackModules.findByUniqueProperties(['instantBatchUpload']);
            const SelectedChannelStore = WebpackModules.findByUniqueProperties(['getChannelId']);
            const shouldCompleteTwitch = RegExp.prototype.test.bind(/(?:^|\s)\w{2,}$/);
            const shouldCompleteCommand = RegExp.prototype.test.bind(/((?<!\/)\b(?:yent[A-Z]|:)\w*\b:)(\w*)$/);

            return class EmoteReplacer extends Plugin {
                constructor() {
                    super();
                    this.draft;
                    this.unpatches = [];
                    this.unpatches.push(
                        ZeresPluginLibrary.Patcher.instead(
                        this.getName(),
                        ZeresPluginLibrary.DiscordModules.MessageActions,
                        'sendMessage',
                        (_, args, original) => this.onSendMessage(args, original)
                        )
                    );
                    this.unpatches.push(
                        ZeresPluginLibrary.Patcher.before(
                        this.getName(),
                        ZeresPluginLibrary.WebpackModules.findByUniqueProperties(['saveDraft']),
                        'saveDraft',
                        (_, args, original) => this.onSaveDraft(args, original)
                        )
                    );

                    this.cached = {};
                    this.windowSize = 10;
                    this.button = null;
                    this.emoteNames = null;
                    this.modifiers = [];
                    this.mainCSS = `
                    #refreshEmoteReplacer button {
                        transition: transform .1s;
                        background: transparent;
                        color: hsla(0, 0%, 100%, .7);
                        margin: 0 5px;
                    }
                    
                    #refreshEmoteReplacer:hover button {
                        color: hsla(0, 0%, 100%, 1);
                        transform: scale(1.2);
                    }`;
                    this.getTextAreaContainer = () => {
                        return $(`${DiscordSelectors.Textarea.channelTextArea}`);
                    }

                    this.getTextAreaField = () => {
                        return $(`${DiscordSelectors.Textarea.channelTextArea} .da-textArea`);
                    }

                    this.renderCompletions = _.debounce(function () {
                        const channelTextAreas = this.getTextAreaContainer();
                        const oldAutoComplete = channelTextAreas.children(`.${this.getName()}`);
                        const channelTextArea = $(channelTextAreas[0]);

                        const isTwitch = shouldCompleteTwitch(this.draft);
                        if ((!shouldCompleteTwitch(this.draft) && !shouldCompleteCommand(this.draft)) || !this.prepareCompletions()) {
                            oldAutoComplete.remove();
                            return;
                        }

                        const {completions, matchText, selectedIndex, windowOffset: firstIndex} = this.cached;
                        const matchList = completions.slice(firstIndex, firstIndex+this.windowSize);

                        let autoDiv = $('<div>')
                            .addClass(`autocomplete-1vrmpx autocomplete-Z9HwQh ${this.getName()}`)
                            .on(`wheel.${this.getName()}`, e => this.scrollCompletions(e, {locked: true}));
                        let inner = $('<div>', {'class': 'autocompleteInner-zh20B_'})
                            .appendTo(autoDiv);
                        // FIXME: clean up this mess of jQuery
                        let text = isTwitch ? 'Emoji matching ' : 'Commands ';
                        $('<div>', {'class': 'autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa'})
                            .append($('<div>', {'class': 'selector-2IcQBU'})
                                .append($('<div>', {text: text}).append($('<strong>', {text: matchText}))
                                    .addClass('contentTitle-2tG_sM primary400-hm0Rav weightBold-2yjlgw')))
                            .appendTo(inner);
                        inner
                            .append(matchList.map((e,i) => {
                                let row = $('<div>', {'class': 'autocompleteRowVertical-q1K4ky autocompleteRow-2OthDa'});
                                let container = $('<div>')
                                    .addClass('flex-1xMQg5 flex-1O1GKY horizontal-1ae9ci horizontal-2EEEnY flex-1O1GKY directionRow-3v3tfG justifyStart-2NDFzi alignCenter-1dQNNs noWrap-3jynv6 content-Qb0rXO')
                                    .css('flex', '1 1 auto');
                                if (isTwitch) {
                                    container.append($('<img>', {src: e[1], alt: e[0], title: e[0], 'class': `icon-3ZzoN7`,}).attr('draggable', 'false').css('width', '25px').css('top', 0));
                                }
                                container.append($('<div>', {'class': 'marginLeft8-1YseBe', text: e[0]}));
                                let selector = $('<div>', {'class': 'selector-2IcQBU selectable-3dP3y-'})
                                    .append(container)
                                    .appendTo(row);
                                if (i+firstIndex === selectedIndex) {
                                    selector.addClass('selectorSelected-1_M1WV');
                                }
                                row.on(`mouseenter.${this.getName()}`, e => {
                                    this.cached.selectedIndex = i+firstIndex;
                                    row.siblings().children('.selectorSelected-1_M1WV').removeClass('selectorSelected-1_M1WV');
                                    row.children().addClass('selectorSelected-1_M1WV');
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
                    ZLibrary.PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), 'https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js');
                    await PluginUtilities.addScript('pica', '//cdn.jsdelivr.net/gh/yentis/betterdiscord-emotereplacer@bc5bb1f55bc8db09cb1eb97dd7a65666b12d5c46/pica.js');
                    PluginUtilities.addStyle(this.getName()  + '-style', this.mainCSS);
                    this.getEmoteNames().then(names => {
                        this.emoteNames = names;
                        this.getModifiers().then(modifiers => {
                            this.modifiers = modifiers;
                            if (this.getTextAreaField()) {
                                this.addRefresh();
                                this.addListener();
                            }
                        });
                    }).catch((error) => {
                        console.warn('EmoteReplacer: ' + name + ': ' + error);
                    });
                }

                onStop() {
                    const tryUnpatch = fn => {
                        if (typeof fn !== 'function') return;
                        try {
                          // things can bug out, best to reload tbh, should maybe warn the user?
                          fn();
                        } catch (e) {
                          ZeresPluginLibrary.Logger.stacktrace(this.getName(), 'Error unpatching', e);
                        }
                      };
                    if (Array.isArray(this.unpatches)) for (let unpatch of this.unpatches) tryUnpatch(unpatch);

                    $('*').off('.' + this.getName());
                    if (this.button) $(this.button).remove();
                    PluginUtilities.removeScript('pica');
                    PluginUtilities.removeStyle(this.getName() + '-style');
                    this.button = null;
                    this.emoteNames = null;
                }

                onSendMessage(args, callDefault) {
                    const message = args[1];
                    if (!message) return callDefault(...args);

                    try {                        
                        let content = message.content;
                        let foundEmote = this.getTextPos(content);

                        if (foundEmote) {
                            content = content.substring(0, foundEmote.pos) + content.substring(foundEmote.pos + foundEmote.nameAndCommand.length);
                            content.trim();

                            foundEmote.content = content;
                            this.fetchBlobAndUpload(foundEmote);

                            return;
                        }

                        return callDefault(...args);
                    } catch (err) {
                        ZeresPluginLibrary.Logger.stacktrace(this.getName(), 'Error in onEnqueue', err);
                    }
                }

                onSaveDraft(args) {
                    const draft = args[1];
                    if (draft === undefined) return;
                    this.draft = draft;

                    try {
                        const {draft: lastText} = this.cached;
    
                        // If an emote match is impossible, don't override default behavior.
                        // This allows other completion types (like usernames or channels) to work as usual.
                        if (!shouldCompleteTwitch(draft) && !shouldCompleteCommand(draft)) {
                            this.destroyCompletions();
                            return;
                        }
    
                        if (lastText !== draft) {
                            this.renderCompletions();
                        }
                    } catch (err) {
                        ZeresPluginLibrary.Logger.stacktrace(this.getName(), 'Error in onDispatchEvent', err);
                    }
                }

                observer(e) {
                    if (!e.addedNodes.length || !(e.addedNodes[0] instanceof Element)) return;

                    let elem = e.addedNodes[0];
                    let textArea = elem.querySelector(DiscordSelectors.Textarea.textArea);

                    if (textArea && $(textArea).parents(DiscordSelectors.Modals.modal.value).length === 0) {
                        this.addRefresh();
                        this.addListener();
                    }
                }

                getSettingsPanel() {
                    const panel = this.buildSettingsPanel();
                    panel.addListener(this.updateSettings.bind(this));
                    return panel.getElement();
                }

                updateSettings(group, id, value) {}

                addRefresh() {
                    if (document.getElementById('refreshEmoteReplacer')) return;
                    $(`${DiscordSelectors.Textarea.inner}`).prepend(
                        `<div id='refreshEmoteReplacer' class='flex-1xMQg5 flex-1O1GKY da-flex da-flex horizontal-1ae9ci horizontal-2EEEnY flex-1O1GKY directionRow-3v3tfG justifyStart-2NDFzi alignStretch-DpGPf3 noWrap-3jynv6'>
                            <button type='button'>↻</button>
                            <div class='attachButtonDivider-3Glu60 da-attachButtonDivider'></div>
                        </div>`);

                    this.button = document.getElementById('refreshEmoteReplacer');

                    $(this.button).on('click.' + this.getName(), () => {
                        this.emoteNames = null;
                        Toasts.info('Reloading emote database...');
                        this.getEmoteNames()
                            .then((names) => {
                                this.emoteNames = names;
                                Toasts.success('Emote database reloaded!');
                            });
                    });

                    $(this.button).on('mouseover', () => {
                        let tooltip = $('<div>', {'class': 'tooltip-' + this.getName() + ' tooltip-1OS-Ti da-tooltip top-1pTh1F da-top black-2bmmnj da-black'}).html('Refresh emote database.');
                        $('.tooltips-FhwIyl.da-tooltips').append(tooltip);

                        let tooltipRect = tooltip[0].getBoundingClientRect();
                        let buttonRect = this.button.getBoundingClientRect();
                        let left = (buttonRect.left+(buttonRect.width/2)) - (tooltipRect.width/2);
                        let top = buttonRect.top - tooltipRect.height;

                        tooltip.css('left', left + 'px');
                        tooltip.css('top', top + 'px');
                    });

                    $(this.button).on('mouseout', () => {
                        $(`.tooltip-${this.getName()}`).remove();
                    });
                }

                addListener() {
                    let textArea = this.getTextAreaField();
                    if (textArea === undefined) return;
                    
                    textArea.off(`keydown.${this.getName()}`);
                    textArea.on(`keydown.${this.getName()}`, (e) => {
                        this.browseCompletions(e);
                    });
                    
                    textArea.off(`wheel.${this.getName()}`);
                    textArea.on(`wheel.${this.getName()}`, (e) => {
                        this.scrollCompletions(e);
                    });
                    
                    textArea.off(`blur.${this.getName()}`);
                    textArea.on(`blur.${this.getName()}`, (e) => {
                        this.destroyCompletions(e);
                    });
                }

                getEmoteNames() {
                    return new Promise((resolve, reject) => {
                        $.ajax({
                            dataType: 'json',
                            url: 'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes/emotes.json',
                            success: function (data) {
                                let emoteNames = {};

                                for (let key in data) {
                                    if (data.hasOwnProperty(key)) {
                                        let split = data[key].split('.');
                                        let name = split[0];

                                        emoteNames[name] = 'https://raw.githubusercontent.com/Yentis/yentis.github.io/master/emotes/images/' + key + '.' + split[1];
                                    }
                                }

                                resolve(emoteNames);
                            },
                            error: function (obj, name, error) {
                                reject(name + ' - ' + error);
                            }
                        });
                    });
                }

                getModifiers() {
                    return new Promise((resolve, reject) => {
                        $.ajax({
                            dataType: 'json',
                            url: 'https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/modifiers.json',
                            success: data => resolve(data),
                            error: (obj, name, error) => reject(name + ' - ' + error)
                        });
                    });
                }

                getGifModifiers() {
                    let gifModifiers = [];
                    this.modifiers.forEach(modifier => {
                        if (modifier.type === 'gif') {
                            gifModifiers.push(modifier.name);
                        }
                    });
                    return gifModifiers;
                }

                browseCompletions(e) {
                    if (!shouldCompleteTwitch(this.draft) && !shouldCompleteCommand(this.draft)) {
                        return;
                    }

                    let delta = 0, options;

                    switch (e.which) {
                        // Tab
                        case 9:
                            if (!this.prepareCompletions()) {
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

                    if (delta !== 0 && this.prepareCompletions()) {
                        // Prevent Discord's default behavior
                        e.stopPropagation();
                        // Prevent cursor movement
                        e.preventDefault();

                        this.scrollWindow(delta, options);
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
                    const {completions, matchStart, matchText, selectedIndex} = this.cached;

                    if (completions === undefined) {
                        return;
                    }

                    for (let i = 0; i < matchText.length; i++) {
                        document.execCommand('delete');
                    }

                    let selectedCompletion = completions[selectedIndex];
                    let suffix = '-';
                    if (selectedCompletion[1].arguments) {
                        selectedCompletion[1].arguments.forEach(argument => {
                            if (argument === '') {
                                suffix = ' '
                            }
                        });
                    } else suffix = ' ';
                    selectedCompletion[0] += suffix;

                    document.execCommand('insertText', false, selectedCompletion[0]);

                    this.destroyCompletions();
                }

                destroyCompletions() {
                    this.getTextAreaContainer().children(`.${this.getName()}`).remove();
                    this.cached = {};
                    this.renderCompletions.cancel();
                }

                prepareCompletions() {
                    const candidateText = this.draft;
                    const {candidateText: lastText} = this.cached;

                    if (lastText !== candidateText) {
                        if (shouldCompleteTwitch(candidateText)) {
                            const {completions, matchText, matchStart} = this.getCompletionsTwitch(candidateText);
                            this.cached = {candidateText, completions, matchText, matchStart, selectedIndex: 0, windowOffset: 0};
                        } else if (shouldCompleteCommand(candidateText)) {
                            const {completions, matchText, matchStart} = this.getCompletionsCommands(candidateText);
                            this.cached = {candidateText, completions, matchText, matchStart, selectedIndex: 0, windowOffset: 0};
                        }
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
                        if (this.emoteNames.hasOwnProperty(key)) {
                            emoteArray.push([key, this.emoteNames[key]]);
                        }
                    }

                    const completions = emoteArray
                        .filter((emote) => {
                            if (emote[0].toLowerCase().search(match[2]) !== -1){
                                return emote;
                            }
                        });
                    const matchText = match[2], matchStart = match.index + match[1].length;

                    return {completions, matchText, matchStart};
                }

                getCompletionsCommands(text) {
                    const match = text.match(/((?<!\/)\b(yent[A-Z]|:)\w*\b:)(\w*)$/);
                    if (match === null) {
                        return {completions: [], matchText: null, matchStart: -1};
                    }

                    let commandArray = [];
                    this.modifiers.forEach((modifier, index) => {
                        commandArray.push([modifier.name, this.modifiers[index]]);
                    });

                    const completions = commandArray
                        .filter((command) => {
                            if (match[3] === '' || command[0].toLowerCase().search(match[3]) !== -1) {
                                return command;
                            }
                        });
                    const matchText = match[3], matchStart = match.index + match[1].length;

                    return {completions, matchText, matchStart};
                }

                b64toBlob(b64Data, contentType, sliceSize) {
                    contentType = contentType || '';
                    sliceSize = sliceSize || 512;

                    let byteCharacters = atob(b64Data);
                    let byteArrays = [];

                    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
                        let slice = byteCharacters.slice(offset, offset + sliceSize);

                        let byteNumbers = new Array(slice.length);
                        for (let i = 0; i < slice.length; i++) {
                            byteNumbers[i] = slice.charCodeAt(i);
                        }

                        let byteArray = new Uint8Array(byteNumbers);

                        byteArrays.push(byteArray);
                    }

                    return new Blob(byteArrays, {type: contentType});
                }

                getTextPos(value) {
                    let foundEmotes = [];
                    let regexCommand = new RegExp('\\b:\\S{4,}\\b');

                    for (let key in this.emoteNames) {
                        if (this.emoteNames.hasOwnProperty(key)) {
                            let regex = new RegExp('(?<!\\/)\\b' + key + '\\b', 'g');
                            let matches = value.match(regex);
                            let command = value.match(regexCommand);

                            if (!matches || matches.length === 0) continue;
                            for (let i = 0; i < matches.length; i++) {
                                let pos = this.getNthIndexOf(value, key, i);
                                let emote = {
                                    name: key,
                                    nameAndCommand: key,
                                    url: this.emoteNames[key],
                                    emoteLength: key.length,
                                    pos: pos,
                                    spoiler: false,
                                    commands: []
                                };

                                if (command) {
                                    let commands = command[0].substring(1, command[0].length).split(':');
                                    emote.commands = commands.map(command => {
                                        let split = command.split('-');

                                        return [split[0], split[1] || null];
                                    });
                                    emote.nameAndCommand = emote.nameAndCommand + command[0];
                                }
                                
                                let beforeEmote = value.substring(0, pos);
                                let afterEmote = value.substring(pos + emote.nameAndCommand.length);
                                if (beforeEmote.indexOf('||') !== -1 && afterEmote.indexOf('||') !== -1) {
                                    let spoilerStart = beforeEmote.substring(beforeEmote.indexOf('||'))
                                    emote.nameAndCommand = spoilerStart + emote.nameAndCommand;
                                    emote.pos -= spoilerStart.length;
                                    let spoilerEnd = afterEmote.substring(0, afterEmote.indexOf('||')+2);
                                    emote.nameAndCommand = emote.nameAndCommand + spoilerEnd;
                                    emote.spoiler = true;
                                }
                                if (beforeEmote.indexOf('`') === -1 || afterEmote.indexOf('`') === -1) {
                                    foundEmotes.push(emote);
                                }
                            }
                        }
                    }

                    if (foundEmotes.length > 0) {
                        return foundEmotes[foundEmotes.length-1];
                    }
                }

                getNthIndexOf(input, search, nth) {
                    let firstIndex = input.indexOf(search);
                    let startPos = firstIndex + search.length;

                    if (nth == 0) {
                        return firstIndex;
                    } else {
                        let inputAfterFirstOccurrence = input.substring(startPos);
                        let nextOccurrence = this.getNthIndexOf(inputAfterFirstOccurrence, search, nth-1);

                        if (nextOccurrence === -1) {
                            return -1;
                        } else {
                            return startPos + nextOccurrence;  
                        }
                    }
                 }

                fetchBlobAndUpload(emote) {
                    let url = emote.url, name = emote.name, commands = emote.commands ? emote.commands : '';

                    if (url.endsWith('.gif')) {
                        this.getMetaAndModifyGif(emote);
                    } else {
                        if (this.findCommand(commands, this.getGifModifiers())) {
                            this.getMetaAndModifyGif(emote);
                        } else {
                            fetch(url)
                                .then(res => res.blob())
                                .then(blob => {
                                    this.compress(name, blob, commands, (resultBlob) => {
                                        this.uploadFile(resultBlob, name + '.png', emote.content, emote.spoiler);
                                    });
                                });
                        }
                    }
                }

                findCommand(commands, names) {
                    let found = false;

                    if (commands.length > 0) {
                        commands.forEach(command => {
                            names.forEach(name => {
                                if (command[0] === name) found = command;
                            })
                        });
                    }

                    return found;
                }

                getMetaAndModifyGif(emote){
                    let url = emote.url, commands = emote.commands;
                    let image = new Image();
                    image.onload = () => {
                        this.addResizeCommand(commands, image);
 
                        $.ajax({
                            url: 'https://yentis.glitch.me/modifygif',
                            method: 'post',
                            contentType: 'application/json',
                            data: JSON.stringify({
                                url: url,
                                options: commands
                            }),
                            success: (data) => {
                                this.uploadFile(this.b64toBlob(data, 'image/gif'), emote.name + '.gif', emote.content, emote.spoiler);
                            },
                            error: (obj) => {
                                console.warn('EmoteReplacer: ' + obj.responseText);
                            }
                        });
                    };
                    image.src = url;
                }
 
                addResizeCommand(commands, image) {
                    let scaleFactor, sizeSetting = this.getEmoteSize(commands);
            
                    if (image.width < image.height) {
                        scaleFactor = sizeSetting / image.width;
                    } else scaleFactor = sizeSetting / image.height;

                    let wideCommand = this.findCommand(commands, ['wide']);
                    if (wideCommand) {
                        let wideness = this.getEmoteWideness(wideCommand);
                        scaleFactor = (scaleFactor * wideness) + 'x' + scaleFactor;
                    }
 
                    commands.push(['resize', scaleFactor]);
                }

                getEmoteSize(commands) {
                    let resizeCommand;
                    let size;

                    commands.forEach((command, index, object) => {
                        if (command[0] === 'resize') {
                            resizeCommand = command;
                            object.splice(index, 1);
                        }
                    });

                    if (resizeCommand && resizeCommand[1]) {
                        size = resizeCommand[1];
                    } else {
                        size = this.settings.sizeSettings.size;
                    }

                    if (size === 'large' || size === 'big') {
                        return 128;
                    } else if (size === 'medium' || size === 'normal') {
                        return 64;
                    } else if (!isNaN(size)) {
                        return Math.min(Math.max(size, 32), 128);
                    } else {
                        return 48;
                    }
                }

                uploadFile(blob, fullName, content, spoiler) {
                    Uploader.upload(SelectedChannelStore.getChannelId(),
                        new File([blob], fullName), {
                            content: content, invalidEmojis: [], tts: false
                        }, spoiler);
                }

                compress(fileName, originalFile, commands, callback) {
                    const reader = new FileReader();
                    reader.readAsDataURL(originalFile);
                    reader.onload = event => {
                        const img = new Image();
                        img.src = event.target.result;
                        img.onload = () => {
                            this.applyScaling(img, commands)
                                .then((canvas) => {
                                    let ctx = canvas.getContext('2d');
                                    ctx.canvas.toBlob(callback, 'image/png', 1);
                                });
                        };
                    };
                    reader.onerror = error => {
                        console.warn('EmoteReplacer: ' + error);
                        callback();
                    };
                }

                applyScaling(image, commands) {
                    return new Promise((resolve) => {
                        let scaleFactor;
                        let size = this.getEmoteSize(commands);
                        if (image.width < image.height) {
                            scaleFactor = size / image.width;
                        } else scaleFactor = size / image.height;

                        let canvas = document.createElement('canvas');
                        canvas.width = image.width;
                        canvas.height = image.height;

                        let resizedCanvas = document.createElement('canvas');

                        if (commands.length > 0) {
                            canvas = this.applyCommands(image, canvas, commands);
                        } else {
                            canvas.getContext('2d').drawImage(image, 0, 0);
                        }

                        resizedCanvas.width = Math.ceil(canvas.width * scaleFactor);
                        resizedCanvas.height = Math.ceil(canvas.height * scaleFactor);

                        this.pica.resize(canvas, resizedCanvas, {alpha: true, unsharpAmount: 70, unsharpRadius: 0.8, unsharpThreshold: 105})
                            .then(result => resolve(result));
                    });
                }

                applyCommands(image, canvas, commands) {
                    let scaleH = 1,
                        scaleV = 1,
                        posX = 0,
                        posY = 0;
                
                    if (this.findCommand(commands, ['flip'])) {
                        scaleH = -1; // Set horizontal scale to -1 if flip horizontal
                        posX = canvas.width * -1; // Set x position to -100% if flip horizontal
                    }
                    if (this.findCommand(commands, ['flap'])) {
                        scaleV = -1; // Set vertical scale to -1 if flip vertical
                        posY = canvas.height * -1; // Set y position to -100% if flip vertical
                    }
                
                    let ctx = canvas.getContext('2d');

                    let wideCommand = this.findCommand(commands, ['wide']);
                    if (wideCommand) {
                        let wideness = this.getEmoteWideness(wideCommand);
                        image.width = image.width * wideness;
                        canvas.width = canvas.width * wideness;
                    }
                    let rotateCommand = this.findCommand(commands, ['rotate']);
                    if (rotateCommand) {
                        let angle = parseInt(rotateCommand[1]) * Math.PI / 180,
                            sin = Math.sin(angle),
                            cos = Math.cos(angle);
                
                        let newWidth = Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin);
                        let newHeight = Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos);
                
                        canvas.width = newWidth;
                        canvas.height = newHeight;
                
                        ctx.translate(canvas.width/2, canvas.height/2);
                        ctx.rotate(angle);
                
                        posX = -image.width/2;
                        posY = -image.height/2;
                    }

                    ctx.scale(scaleH, scaleV); // Set scale to flip the image
                    ctx.drawImage(image, posX, posY, image.width, image.height); // draw the image
                
                    return canvas;
                };

                getEmoteWideness(wideCommand) {
                    let param = wideCommand[1];
                    if (!isNaN(param)) {
                        return Math.max(Math.min(param, 8), 2);
                    } else if (param === 'extreme') {
                        return 8;
                    } else if (param === 'huge') {
                        return 6;
                    } else if (param === 'big') {
                        return 4;
                    } else {
                        return 2;
                    }
                }
            }
        };
        return plugin(Plugin, Api);
    })(global.ZeresPluginLibrary.buildPlugin(config));
})();
