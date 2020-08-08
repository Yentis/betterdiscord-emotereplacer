/**
 * @name EmoteReplacer
 * @authorId 68834122860077056
 * @website https://github.com/Yentis/betterdiscord-emotereplacer
 * @source https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js
 */

let EmoteReplacer = (() => {
    const config = {
        info: {
            name: 'EmoteReplacer',
            authors: [{
                name: 'Yentis',
                discord_id: '68834122860077056',
                github_username: 'Yentis',
                twitter_username: 'yentis178'
            }],
            version: '1.4.4',
            description: 'Enables different types of formatting in standard Discord chat. Support Server: bit.ly/ZeresServer',
            github: 'https://github.com/Yentis/betterdiscord-emotereplacer',
            github_raw: 'https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js'
        },
        changelog: [{
			title: 'Changes',
            items: ['Add new autocomplete settings', 'Big code cleanup']
		}],
        defaultConfig: [{
                type: 'slider',
                id: 'emoteSize',
                name: 'Emote Size',
                note: 'The size of emotes. (default 48)',
                min: 32,
                max: 128,
                value: 48,
                units: 'px',
                markers: [32, 48, 64, 96, 128]
            }, {
                type: 'slider',
                id: 'autocompleteEmoteSize',
                name: 'Autocomplete Emote Size',
                note: 'The size of emotes in the autocomplete window. (default 15)',
                min: 15,
                max: 64,
                value: 15,
                units: 'px',
                markers: [15, 32, 48, 64]
            }, {
                type: 'slider',
                id: 'autocompleteItems',
                name: 'Autocomplete Items',
                note: 'The amount of emotes shown in the autocomplete window. (default 10)',
                min: 1,
                max: 25,
                value: 10,
                units: ' items',
                markers: [1, 5, 10, 15, 20, 25]
            }
        ],
        main: 'index.js'
    };

    return !ZeresPluginLibrary ? class {
        constructor() {this._config = config;}
        getName() {return config.info.name;}
        getAuthor() {return config.info.authors.map(a => a.name).join(', ');}
        getDescription() {return config.info.description;}
        getVersion() {return config.info.version;}
        load() {
            BdApi.showConfirmationModal('Library Missing', `The library plugin needed for ${config.info.name} is missing. Please click Download Now to install it.`, {
                confirmText: 'Download Now',
                cancelText: 'Cancel',
                onConfirm: () => {
                    require('request').get('https://rauenzi.github.io/BDPluginLibrary/release/0PluginLibrary.plugin.js', async (err, _response, body) => {
                        if (err) return require('electron').shell.openExternal('https://betterdiscord.net/ghdl?url=https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js');
                        await new Promise(r => require('fs').writeFile(require('path').join(BdApi.Plugins.folder, '0PluginLibrary.plugin.js'), body, r));
                    });
                }
            });
        }
        start() {}
        stop() {}
    } : (([Plugin, Api]) => {
        const plugin = (Plugin, Api) => {
            const {DiscordSelectors, DiscordClassModules, Logger, PluginUpdater, EmulatedTooltip} = Api;

            const Uploader = BdApi.findModuleByProps('instantBatchUpload');
            const SelectedChannelStore = BdApi.findModuleByProps('getChannelId');
            const Autocomplete = BdApi.findModuleByProps('autocomplete', 'autocompleteInner');
            const FlexFirst = BdApi.findModuleByProps('flex', 'flexCenter');
            const FlexSecond = BdApi.findModuleByProps('flex', 'flexChild');

            const shouldCompleteTwitch = RegExp.prototype.test.bind(/(?:^|\s)\w{2,}$/);
            const shouldCompleteCommand = RegExp.prototype.test.bind(/((?<!\/)\b(?:yent[A-Z]|:)\w*\b:)(\w*)$/);
            const baseGifsicleUrl = 'https://raw.githubusercontent.com/imagemin/gifsicle-bin/v4.0.1/vendor/';
            const refreshEmotes = `${config.info.name}RefreshEmotes`;
            const mainCSS = `
                #${refreshEmotes} button {
                    background: transparent;
                    color: hsla(0, 0%, 100%, .7);
                    font-size: 1.75em;
                }
                
                #${refreshEmotes}:hover button {
                    color: hsla(0, 0%, 100%, 1);
                }
            `;

            return class EmoteReplacer extends Plugin {
                constructor() {
                    super();

                    if (!DiscordClassModules.Autocomplete) {
                        DiscordClassModules.Autocomplete = {
                            ...Autocomplete,
                            autocomplete: [
                                BdApi.findModuleByProps('autocomplete', 'horizontalAutocomplete').autocomplete,
                                Autocomplete.autocomplete
                            ].join(' ')
                        };
                    }

                    if (!DiscordClassModules.Wrapper) {
                        DiscordClassModules.Wrapper = BdApi.findModuleByProps('wrapper', 'base');
                    }

                    if (!DiscordClassModules.Size) {
                        DiscordClassModules.Size = BdApi.findModuleByProps('size10');
                    }

                    if (!DiscordClassModules.Flex) {
                        DiscordClassModules.Flex = {
                            ...FlexFirst,
                            flex: FlexSecond.flex,
                            flexChild: FlexSecond.flexChild,
                            horizontal: FlexSecond.horizontal
                        }
                    }

                    window.EmoteReplacer = {};

                    this.draft = '';
                    this.cached = {};
                    this.button = null;
                    this.emoteNames = null;
                    this.modifiers = [];

                    this.unpatches = [
                        ZeresPluginLibrary.Patcher.instead(
                            this.getName(),
                            BdApi.findModuleByProps('sendMessage'),
                            'sendMessage',
                            (_, args, original) => this.onSendMessage(args, original)
                        ),
                        ZeresPluginLibrary.Patcher.before(
                            this.getName(),
                            BdApi.findModuleByProps('saveDraft'),
                            'saveDraft',
                            (_, args, original) => this.onSaveDraft(args, original)
                        )
                    ];
                }

                async onStart() {
                    PluginUpdater.checkForUpdate(this.getName(), this.getVersion(), 'https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js');

                    await BdApi.linkJS('pica', '//cdn.jsdelivr.net/gh/yentis/betterdiscord-emotereplacer@058ee1d1d00933e2a55545e9830d67549a8e354a/pica.js');
                    await BdApi.linkJS('gifUtils', '//cdn.jsdelivr.net/gh/yentis/betterdiscord-emotereplacer@642f5344564bc13a5cdff56c40502bf09dba210c/gif-utils.js');
                    BdApi.injectCSS(this.getName(), mainCSS);

                    Promise.all([
                        this.getEmoteNames(),
                        this.getModifiers()
                    ]).then(results => {
                        this.emoteNames = results[0];
                        this.modifiers = results[1];
                        
                        if (this.getTextAreaField()) {
                            this.addRefresh();
                            this.addListener();
                        }
                    }).catch(err => Logger.warn('Failed to get emote names and/or modifiers', err));

                    while (!window.EmoteReplacer.GifUtils) {
                        await new Promise(resolve => setTimeout(resolve, 500));;
                    }

                    const https = require('https');
                    const fs = require('fs');
                    const binFilename = process.platform === 'win32' ? 'gifsicle.exe' : 'gifsicle';
                    const gifsiclePath = BdApi.Plugins.folder + '/' + binFilename;

                    let gifsicleUrl;
                    switch (process.platform) {
                        case 'darwin':
                            gifsicleUrl = `${baseGifsicleUrl}macos/gifsicle`;
                            break;
                        case 'linux':
                            if (process.arch === 'x86') {
                                gifsicleUrl = `${baseGifsicleUrl}linux/x86/gifsicle`;
                            } else {
                                gifsicleUrl = `${baseGifsicleUrl}linux/x64/gifsicle`;
                            }
                            break;
                        case 'freebsd':
                            if (process.arch === 'x86') {
                                gifsicleUrl = `${baseGifsicleUrl}freebsd/x86/gifsicle`;
                            } else {
                                gifsicleUrl = `${baseGifsicleUrl}freebsd/x64/gifsicle`;
                            }
                            break;
                        case 'win32':
                            if (process.arch === 'x86') {
                                gifsicleUrl = `${baseGifsicleUrl}win/x86/gifsicle.exe`;
                            } else {
                                gifsicleUrl = `${baseGifsicleUrl}win/x64/gifsicle.exe`;
                            }
                            break;
                        default:
                            return;
                    }

                    this.gifsicle = gifsiclePath;
                    if (!fs.existsSync(gifsiclePath)) {
                        const file = fs.createWriteStream(gifsiclePath);
                        https.get(gifsicleUrl, (response) => {
                            response.pipe(file);
                            file.on('finish', () => {
                                file.close();
                                fs.chmodSync(gifsiclePath, '0777');
                            });
                        }).on('error', (err) => {
                            fs.unlink(gifsiclePath);
                            Logger.warn('Failed to get Gifsicle', err);
                        });
                    }
                }

                onStop() {
                    const tryUnpatch = fn => {
                        if (typeof fn !== 'function') return;
                        try {
                          // Things can bug out, best to reload, should maybe warn the user?
                          fn();
                        } catch (err) {
                          Logger.warn('Error unpatching', err);
                        }
                    };

                    if (Array.isArray(this.unpatches)) {
                        for (let unpatch of this.unpatches) {
                            tryUnpatch(unpatch);
                        }
                    }

                    $('*').off('.' + this.getName());
                    if (this.button) $(this.button).remove();
                    BdApi.unlinkJS('pica');
                    BdApi.unlinkJS('gifUtils');
                    BdApi.clearCSS(this.getName());
                    
                    window.EmoteReplacer = {};

                    this.draft = null;
                    this.cached = null;
                    this.button = null;
                    this.emoteNames = null;
                    this.modifiers = null;
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
                            this.fetchBlobAndUpload(foundEmote)
                            .catch(() => {
                                if (content === '') return;
                                
                                message.content = content;
                                callDefault(...args);
                            });

                            return;
                        }

                        return callDefault(...args);
                    } catch (err) {
                        Logger.warn('Error in onEnqueue', err);
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
                        Logger.warn('Error in onDispatchEvent', err);
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

                onSwitch() {
                    this.destroyCompletions();
                }

                getSettingsPanel() {
                    const panel = this.buildSettingsPanel();
                    panel.addListener(this.updateSettings.bind(this));
                    return panel.getElement();
                }

                updateSettings(group, id, value) {}

                getTextAreaContainer = () => {
                    return $(`${DiscordSelectors.Textarea.channelTextArea}`);
                }

                getTextAreaField = () => {
                    return $(`${DiscordSelectors.Textarea.textArea}`);
                }

                renderCompletions = _.debounce(() => {
                    const channelTextAreas = this.getTextAreaContainer();
                    const oldAutoComplete = channelTextAreas.children(`.${this.getName()}`);
                    const channelTextArea = $(channelTextAreas[0]);

                    const isTwitch = shouldCompleteTwitch(this.draft);

                    oldAutoComplete.remove();
                    if ((!shouldCompleteTwitch(this.draft) && !shouldCompleteCommand(this.draft)) || !this.prepareCompletions()) {
                        return;
                    }

                    const {completions, matchText, selectedIndex, windowOffset: firstIndex} = this.cached;
                    const matchList = completions.slice(firstIndex, firstIndex + Math.round(this.settings.autocompleteItems));
                        
                    const autocompleteDiv = $('<div>')
                        .addClass(`${DiscordClassModules.Autocomplete.autocomplete} ${this.getName()}`)
                        .on(`wheel.${this.getName()}`, e => this.scrollCompletions(e, {locked: true}))
                        .appendTo(channelTextArea);

                    const autocompleteInnerDiv = $('<div>')
                        .addClass(DiscordClassModules.Autocomplete.autocompleteInner)
                        .appendTo(autocompleteDiv);

                    const titleRow = $('<div>')
                        .addClass(DiscordClassModules.Autocomplete.autocompleteRowVertical)
                        .appendTo(autocompleteInnerDiv);

                    const selector = $('<div>')
                        .addClass(DiscordClassModules.Autocomplete.selector)
                        .appendTo(titleRow);

                    const contentTitle = $('<h3>')
                        .addClass(`${DiscordClassModules.Autocomplete.contentTitle} ${DiscordClassModules.Wrapper.base} ${DiscordClassModules.Size.size12}`)
                        .text(isTwitch ? 'Emoji matching ' : 'Commands ')
                        .appendTo(selector);

                    contentTitle.append(
                        $(`<strong>${matchText}</strong>`)
                    );

                    for (let i = 0; i < matchList.length; i++) {
                        const name = matchList[i][0];
                        const url = matchList[i][1];

                        const emoteRow = $('<div>')
                            .addClass(DiscordClassModules.Autocomplete.autocompleteRowVertical)
                            .on(`mouseenter.${this.getName()}`, _e => {
                                this.cached.selectedIndex = i + firstIndex;
    
                                titleRow.siblings().children()
                                    .removeClass()
                                    .addClass(`${DiscordClassModules.Autocomplete.selector} ${DiscordClassModules.Autocomplete.selectable}`);
                                emoteSelector.addClass(DiscordClassModules.Autocomplete.selectorSelected);
                            })
                            .on(`mousedown.${this.getName()}`, e => {
                                // Prevent loss of focus
                                e.preventDefault();
    
                                this.cached.selectedIndex = i + firstIndex;
                                this.insertSelectedCompletion();
                            })
                            .appendTo(autocompleteInnerDiv);

                        const emoteSelector = $('<div>')
                            .addClass(`${DiscordClassModules.Autocomplete.selector} ${DiscordClassModules.Autocomplete.selectable}`)
                            .appendTo(emoteRow);

                        if (i + firstIndex === selectedIndex) {
                            emoteSelector.addClass(DiscordClassModules.Autocomplete.selectorSelected);
                        }

                        const emoteContainer = $('<div>')
                            .addClass(
                                `${DiscordClassModules.Flex.flex} 
                                ${DiscordClassModules.Flex.horizontal} 
                                ${DiscordClassModules.Flex.justifyStart} 
                                ${DiscordClassModules.Flex.alignCenter} 
                                ${DiscordClassModules.Flex.noWrap} 
                                ${DiscordClassModules.Autocomplete.content}`
                            )
                            .appendTo(emoteSelector);

                        const flexChild = $('<div>')
                            .addClass(DiscordClassModules.Flex.flexChild)
                            .css('flex', '1 1 auto')
                            .appendTo(emoteContainer);

                        if (isTwitch) {
                            flexChild.append(
                                $('<img>')
                                    .attr({
                                        src: url,
                                        alt: name,
                                        title: name
                                    })
                                    .css({
                                        width: Math.round(this.settings.autocompleteEmoteSize),
                                        height: Math.round(this.settings.autocompleteEmoteSize)
                                    })
                                    .addClass(DiscordClassModules.Autocomplete.icon)
                                    .appendTo(flexChild)
                            );
                        }

                        flexChild.append(
                            $('<span>')
                                .addClass(DiscordClassModules.Autocomplete.marginLeft8)
                                .text(name)
                        );
                    }
                }, 250)

                addRefresh() {
                    if (document.getElementById(refreshEmotes)) return;

                    $(`${DiscordSelectors.Textarea.buttons}`).prepend(
                        `<div id="${refreshEmotes}" class="${DiscordClassModules.Textarea.buttonContainer}">
                            <button aria-label="Refresh emote list" type="button" class="${DiscordClassModules.Textarea.button}">↻</button>
                        </div>`
                    );

                    this.button = document.getElementById(refreshEmotes);

                    $(this.button).on('click.' + this.getName(), () => {
                        this.emoteNames = null;
                        BdApi.showToast('Reloading emote database...', {type: 'info'});
                        this.getEmoteNames()
                            .then((names) => {
                                this.emoteNames = names;
                                BdApi.showToast('Emote database reloaded!', {type: 'success'});
                            });
                    });

                    new EmulatedTooltip(this.button, 'Refresh emote list');
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
                            error: (_obj, name, err) => reject(name + ' - ' + err)
                        });
                    });
                }

                getModifiers() {
                    return new Promise((resolve, reject) => {
                        $.ajax({
                            dataType: 'json',
                            url: 'https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/modifiers.json',
                            success: data => resolve(data),
                            error: (_obj, name, err) => reject(name + ' - ' + err)
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
                    const autocompleteItems = Math.round(this.settings.autocompleteItems);

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
                            delta = -autocompleteItems;
                            options = {locked: true, clamped: true};
                            break;

                        // Page Down
                        case 34:
                            delta = autocompleteItems;
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
                    const autocompleteItems = Math.round(this.settings.autocompleteItems);

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
                    const boundLower = _.clamp(sel + preScroll - (autocompleteItems - 1), 0, num - autocompleteItems);
                    const boundUpper = _.clamp(sel - preScroll, 0, num - autocompleteItems);
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
                    emote.channel = SelectedChannelStore.getChannelId();

                    if (url.endsWith('.gif')) {
                        return this.getMetaAndModifyGif(emote);
                    } else {
                        if (this.findCommand(commands, this.getGifModifiers())) {
                            return this.getMetaAndModifyGif(emote);
                        } else {
                            return new Promise((resolve, reject) => {
                                fetch(url)
                                .then(res => res.blob())
                                .then(blob => {
                                    this.compress(blob, commands, (resultBlob) => {
                                        this.uploadFile(resultBlob, name + '.png', emote);
                                        resolve();
                                    });
                                })
                                .catch(err => reject(err));
                            })
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
                    return new Promise((resolve, reject) => {
                        let url = emote.url, commands = emote.commands;
                        let image = new Image();
                        image.onload = () => {
                            this.addResizeCommand(commands, image);
     
                            BdApi.showToast('Processing gif...', {type: 'info'});
                            window.EmoteReplacer.GifUtils.modifyGif({url: url, options: commands, gifsiclePath: this.gifsicle})
                                .then(b64Buffer => {
                                    this.uploadFile(this.b64toBlob(b64Buffer, 'image/gif'), emote.name + '.gif', emote);
                                    resolve();
                                })
                                .catch(err => {
                                    BdApi.showToast('Failed to process gif, ignoring emote.', {type: 'error'});
                                    Logger.warn('Failed to modify gif', err);
                                    reject();
                                });
                        };
                        image.src = url;
                    })
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
                        size = Math.round(this.settings.emoteSize);
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

                uploadFile(blob, fullName, emote) {
                    BdApi.showToast('Uploading...', {type: 'info'});
                    Uploader.upload(emote.channel,
                        new File([blob], fullName), {
                            content: emote.content, invalidEmojis: [], tts: false
                        }, emote.spoiler);
                }

                compress(originalFile, commands, callback) {
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
                    reader.onerror = err => {
                        Logger.warn('Failed to compress image', err);
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

                        window.EmoteReplacer.pica.resize(canvas, resizedCanvas, {alpha: true, unsharpAmount: 70, unsharpRadius: 0.8, unsharpThreshold: 105})
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
    })(ZeresPluginLibrary.buildPlugin(config));
})();
