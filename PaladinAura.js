const PaladinAura = (function () {
    const version = '1.0.13';
    function isActiveValue(val) {
        return ['true', 'false'].includes(val);
    }
    function isDiagonalCalcValue(val) {
        return ['none', 'foure', 'threefive', 'pythagorean', 'manhattan'].includes(val);
    }
    function isStatusMarkerValue(val) {
        return val.slice(0, 6) == 'status';
    }
    const stateName = 'PaladinAura_';
    const states = [
        {
            name: 'active',
            hide: 'true'
        },
        {
            name: 'diagonal_calc_override',
            acceptables: ['none', 'foure', 'threefive', 'pythagorean', 'manhattan'],
            default: 'none'
        },
        {
            name: 'status_marker',
            default: 'status_bolt-shield',
            ignore: 'true',
            customConfig: 'true'
        }
    ];
    const name = 'Paladin Aura';
    const nameError = name + ' ERROR';
    const nameLog = name + ': ';
    const apiCall = '!pa';
    let playerName, playerID, parts;
    /**
     * Checks each macro from the macroArr array to ensure their functions are up to date.
     */
    function checkMacros() {
        const playerList = findObjs({ _type: 'player', _online: true });
        const gm = playerList.find((player) => {
            return playerIsGM(player.id) === true;
        });
        const macroArr = [
            {
                name: 'PaladinAuraHelp',
                action: `${apiCall} help`
            },
            {
                name: 'PaladinAuraToggle',
                action: `${apiCall}`
            },
            {
                name: 'PaladinAuraConfig',
                action: `${apiCall} config`
            }
        ];
        macroArr.forEach((macro) => {
            const macroObj = findObjs({
                _type: 'macro',
                name: macro.name
            })[0];
            if (macroObj) {
                if (macroObj.get('visibleto') !== 'all') {
                    macroObj.set('visibleto', 'all');
                    toChat(`**Macro '${macro.name}' was made visible to all.**`, true);
                }
                if (macroObj.get('action') !== macro.action) {
                    macroObj.set('action', macro.action);
                    toChat(`**Macro '${macro.name}' was corrected.**`, true);
                }
            }
            else if (gm && playerIsGM(gm.id)) {
                createObj('macro', {
                    _playerid: gm.id,
                    name: macro.name,
                    action: macro.action,
                    visibleto: 'all'
                });
                toChat(`**Macro '${macro.name}' was created and assigned to ${gm.get('_displayname') + ' '.split(' ', 1)[0]}.**`, true);
            }
        });
    }
    /**
     * Outputs help interface to the roll20 chat.
     */
    function showHelp() {
        const commandsArr = [
            {
                name: `${apiCall} help`,
                desc: ['Lists all commands, their parameters, and their usage.']
            },
            {
                name: `${apiCall} config`,
                desc: ['Shows config and buttons that change settings.']
            },
            {
                name: `${apiCall}`,
                desc: ['Toggles the Paladin Aura API on and off.'],
                link: 'active'
            }
        ];
        toChat('&{template:default} {{name=' +
            '**VERSION**' +
            '}} {{Current=' +
            version +
            '}}', undefined, playerName);
        commandsArr.forEach((command) => {
            let output = '&{template:default} {{name=' + code(command.name) + '}}{{Function=';
            for (let i = 0; i < command.desc.length; i++) {
                if (i % 2 === 1) {
                    output += '{{=';
                }
                output += command.desc[i] + '}}';
            }
            if (command.link !== undefined) {
                output += '{{Current Setting=' + getState(command.link) + '}}';
            }
            toChat(output, undefined, playerName);
        });
    }
    function showConfig() {
        updateCustomConfigs();
        let output = `&{template:default} {{name=${name} Config}}`;
        states.forEach((s) => {
            if (s.hide == 'true') {
                return;
            }
            const acceptableValues = s.acceptables
                ? s.acceptables
                : ['true', 'false'];
            const defaultValue = s.default ? s.default : 'true';
            const currentValue = getState(s.name);
            const stringVals = s.customConfig == undefined
                ? valuesToString(acceptableValues, defaultValue)
                : s.customConfig;
            output += `{{${s.name}=[${currentValue}](${apiCall} config ${s.name} ?{New ${s.name} value${stringVals}})}}`;
        });
        output += `{{**CAUTION**=[CLEAR ALL](!&#13;?{Are you sure? All custom paladin targets will be lost|Cancel,|I am sure,${apiCall} RESET})}}`;
        toChat(output, undefined, playerName);
        /**
         * Moves the default value to the start of the array and presents
         * all acceptable values in a drop-down menu format.
         * @param values Acceptable values array.
         * @param defaultValue The state's default value.
         */
        function valuesToString(values, defaultValue) {
            let output = '';
            const index = values.indexOf(defaultValue);
            if (index !== -1) {
                values.splice(index, 1);
                values.unshift(defaultValue);
            }
            values.forEach((v) => {
                output += '|' + v;
            });
            return output;
        }
    }
    /**
     * Sets the setting with name equal to @param parts[2] equal to @param parts[3].
     * @param parts An Array of strings, each part is a section of the incoming message.
     */
    function setConfig(parts) {
        toChat('**' +
            parts[2] +
            '** has been changed **from ' +
            getState(parts[2]) +
            ' to ' +
            parts[3] +
            '**.', true, 'gm');
        if (parts[2] == 'status_marker') {
            cleanMarkers(getState(parts[2]));
        }
        setState(parts[2], parts[3]);
        showConfig();
        paladinCheck();
    }
    function cleanMarkers(oldMarker) {
        if (oldMarker == undefined) {
            oldMarker = getState('status_marker');
        }
        if (oldMarker != undefined) {
            findObjs({
                _type: 'graphic'
            })
                .filter((g) => {
                return g.get(oldMarker) != 'false';
            })
                .forEach((g) => {
                g.set(oldMarker, 'false');
            });
        }
    }
    function handleInput(msg) {
        parts = msg.content.split(' ');
        if (msg.type == 'api' && parts[0] == apiCall) {
            playerName = msg.who.split(' ', 1)[0];
            playerID = msg.playerid;
            if ([undefined, 'config', 'help', 'toggleAuraTarget', 'RESET'].includes(parts[1])) {
                if (parts[1] == 'help') {
                    showHelp();
                }
                else if (parts[1] == 'toggleAuraTarget') {
                    toggleAuraTarget(parts[2], parts[3]);
                }
                else if (playerIsGM(playerID)) {
                    if (!parts[1]) {
                        toggleActive();
                    }
                    else if (parts[1] == 'config') {
                        if (parts[2]) {
                            setConfig(parts);
                        }
                        else {
                            showConfig();
                        }
                    }
                    else if (parts[1] == 'RESET') {
                        clearAll();
                    }
                }
                else {
                    error('Command is only accessible to GMs.', 1);
                }
            }
            else {
                error('Command ' + code(msg.content) + ' not understood.', 0);
            }
        }
    }
    /**
     * If PaladinAura's "active" state is true,
     * searches all tokens on the current page to find paladins and
     * then applies a bonus onto those paladins and all within
     * range of them.
     */
    function paladinCheck() {
        if (getState('active') == 'false') {
            return;
        } // stops here if the API is inactive
        const page = getObj('page', Campaign().get('playerpageid'));
        if (page.get('scale_units') != 'ft') {
            return;
        } // stops here if the page is not measured in feet
        const unitsPerSquare = page.get('scale_number');
        const pixelsPerSquare = page.get('snapping_increment') * 70;
        const playerTokens = getPlayerTokens();
        const paladinObjects = getPaladinsFromTokens(playerTokens);
        playerTokens.forEach((t) => {
            let saveBonus;
            const tIsNPC = +getAttr(t.get('represents'), 'npc') == 1;
            paladinObjects.forEach((p) => {
                if (t.get('represents') == p.id &&
                    getAttr(p.id, 'mancer_confirm').trim() == 'on' &&
                    p.chaBonus == +getAttr(p.id, 'globalsavemod') &&
                    getAttr(p.id, stateName + 'uniq') != '1') {
                    setAttr(p.id, 'paladin_buff', p.chaBonus.toString());
                    setAttr(p.id, stateName + 'uniq', '1');
                }
                const distLimit = (p.radius / unitsPerSquare) * pixelsPerSquare;
                const tokenSizeAdjust = t.get('width') == pixelsPerSquare
                    ? 0
                    : (Math.floor(t.get('width') / pixelsPerSquare) - 1) *
                        (pixelsPerSquare / 2);
                const xDist = Math.abs(t.get('left') - p.left) - tokenSizeAdjust;
                const yDist = Math.abs(t.get('top') - p.top) - tokenSizeAdjust;
                const distTotal = xDist >= yDist ? distCalc(xDist, yDist) : distCalc(yDist, xDist);
                if (distTotal <= distLimit &&
                    ((!tIsNPC &&
                        getAttr(t.get('represents'), stateName + p.id).trim() != 'false') ||
                        (tIsNPC &&
                            getAttr(t.get('represents'), stateName + p.id).trim() == 'true'))) {
                    saveBonus = saveBonus >= p.chaBonus ? saveBonus : p.chaBonus;
                }
                else {
                    saveBonus = saveBonus ? saveBonus : 0;
                }
            });
            saveBonus = saveBonus ? saveBonus : 0;
            setBuff(t, saveBonus);
        });
        function distCalc(distA, distB) {
            const diagonal = getState('diagonal_calc_override') == 'none'
                ? page.get('diagonaltype')
                : getState('diagonal_calc_override');
            if (diagonal == 'threefive') {
                return (distA + Math.floor(distB / pixelsPerSquare / 2) * pixelsPerSquare);
            }
            if (diagonal == 'foure') {
                return distA;
            }
            if (diagonal == 'pythagorean') {
                return (Math.round(Math.sqrt(Math.pow(distA / pixelsPerSquare, 2) +
                    Math.pow(distB / pixelsPerSquare, 2))) * pixelsPerSquare);
            }
            if (diagonal == 'manhattan') {
                return distA + distB;
            }
        }
    }
    /**
     * Adjusts the Paladin bonus being given to the provided token.
     * @param token The target token.
     * @param value The new value to set the paladin bonus to.
     */
    function setBuff(token, value) {
        setMarker(token, value);
        const charID = token.get('represents');
        const char = getObj('character', charID);
        if (!char) {
            error(`Player Character '${token.get('name')}' had no character sheet.`, 2);
            return;
        }
        else {
            let attr = findObjs({
                _type: 'attribute',
                _characterid: charID,
                name: 'paladin_buff'
            })[0];
            if (!attr) {
                attr = createObj('attribute', {
                    _characterid: charID,
                    name: 'paladin_buff',
                    current: '0'
                });
            }
            const attrValue = attr.get('current');
            if (+value != +attrValue) {
                const adjust = +value - +attrValue;
                attr.setWithWorker('current', value.toString());
                if (+getAttr(charID, 'npc') != 1) {
                    modAttr(token.get('represents'), 'globalsavemod', adjust);
                }
                else {
                    [
                        'strength',
                        'dexterity',
                        'constitution',
                        'intelligence',
                        'wisdom',
                        'charisma'
                    ].forEach((abilityName) => {
                        modAttr(token.get('represents'), abilityName, adjust, true);
                    });
                    checkNPCsaveSection(charID);
                }
            }
        }
    }
    /**
     * Returns a token array consisting of tokens that represent
     * non-npc character sheets.
     */
    function getPlayerTokens() {
        return findObjs({
            _type: 'graphic',
            _subtype: 'token',
            _pageid: Campaign().get('playerpageid'),
            layer: 'objects'
        }).filter((token) => {
            const charID = token.get('represents');
            const char = getObj('character', charID);
            const isNPC = +getAttr(charID, 'npc') == 1;
            const hasUniqAttr = +getAttr(charID, stateName + 'uniq') == 1;
            // return any token that has a character and
            // is not NPC or has custom attr
            return char != undefined && (!isNPC || hasUniqAttr);
        });
    }
    /**
     * Searches an array of tokens for all paladins and returns those
     * paladins as an array of paladin objects.
     * @param tokens A token array from which to find paladins.
     * @param ignoreLevel Optional. A boolean that if true, ignores the
     * level of the tokens in their paladin calculation.
     */
    function getPaladinsFromTokens(tokens, ignoreLevel) {
        const attrs = [];
        return (tokens
            // filter out any token which has no paladin class
            // or that is below 6th level
            .filter((t, i) => {
            let keep;
            const levelAttr = charIsPaladin(t.get('represents'));
            if (levelAttr == undefined) {
                keep = false;
            }
            else {
                if (ignoreLevel) {
                    keep = true;
                }
                else {
                    keep = +getAttr(t.get('represents'), levelAttr) >= 6;
                }
            }
            // if token is to be kept, replace the class attr with the level attr
            if (keep) {
                attrs[i] = levelAttr;
            }
            return keep;
        })
            // filter out any token that is at or below 0 hit points
            .filter((t, i) => {
            const conscious = +getAttr(t.get('represents'), 'hp') > 0
                ? true
                : +getAttr(t.get('represents'), 'HP') > 0;
            // if unconscious remove from array
            if (!conscious) {
                attrs.splice(i, 1);
            }
            return conscious;
        })
            // map tokens to output format
            .map((t, i) => {
            return {
                chaBonus: Math.max(+getAttr(t.get('represents'), 'charisma_mod'), 1),
                id: t.get('represents'),
                left: +t.get('left'),
                level: +getAttr(t.get('represents'), attrs[i]),
                radius: +getAttr(t.get('represents'), attrs[i]) >= 18 ? 30 : 10,
                token: t,
                top: +t.get('top')
            };
        }));
    }
    /**
     * Returns the name of the attribute for the character's
     * paladin level.
     * @param charID A character ID.
     */
    function charIsPaladin(charID) {
        let levelAttr;
        const classAttr = [
            'class',
            'multiclass1',
            'multiclass2',
            'multiclass3'
        ].find((a) => {
            return getAttr(charID, a).search(/paladin/i) != -1;
        });
        if (classAttr == undefined) {
            return;
        }
        switch (classAttr) {
            case 'class':
                levelAttr = 'base_level';
                break;
            default:
                levelAttr = classAttr + '_lvl';
                break;
        }
        return levelAttr;
    }
    /**
     * @param charID Target character ID.
     * @param attrName Target attribute (eg. globalsavemod).
     * @param value The difference between the old PaladinBuff and the new one.
     * @param isNPC Token character is an NPC.
     */
    function modAttr(charID, attrName, value, isNPC) {
        if (isNPC) {
            const shortAttrName = attrName.slice(0, 3);
            let attrMod = findObjs({
                _type: 'attribute',
                _characterid: charID,
                name: attrName + '_mod'
            })[0];
            const NPCattrs = findObjs({
                _type: 'attribute',
                _characterid: charID
            }).filter((a) => {
                return a.get('name').includes('npc_' + shortAttrName + '_');
            });
            let saveFlagAttr = NPCattrs.find((a) => {
                return a.get('name') == 'npc_' + shortAttrName + '_save_flag';
            });
            let saveBonusAttr = NPCattrs.find((a) => {
                return a.get('name') == 'npc_' + shortAttrName + '_save';
            });
            if (attrMod == undefined) {
                attrMod = createAttr(attrName);
            }
            if (saveFlagAttr == undefined) {
                saveFlagAttr = createAttr('npc_' + shortAttrName + '_save_flag');
            }
            if (saveBonusAttr == undefined) {
                saveBonusAttr = createAttr('npc_' + shortAttrName + '_save');
            }
            if (+saveFlagAttr.get('current') == 2) {
                const adjust = +saveBonusAttr.get('current') + value;
                saveBonusAttr.setWithWorker('current', adjust.toString());
            }
            else {
                const adjust = +attrMod.get('current') + value;
                saveBonusAttr.setWithWorker('current', adjust.toString());
            }
            if (+saveBonusAttr.get('current') == +attrMod.get('current')) {
                saveFlagAttr.setWithWorker('current', '0');
            }
            else {
                saveFlagAttr.setWithWorker('current', '2');
            }
        }
        else {
            let attr = findObjs({
                _type: 'attribute',
                _characterid: charID,
                name: attrName
            })[0];
            if (!attr) {
                attr = createObj('attribute', {
                    _characterid: charID,
                    name: attrName
                });
                attr.setWithWorker('current', value.toString());
            }
            else {
                const attrValue = attr.get('current');
                const adjust = +attrValue + +value;
                attr.setWithWorker('current', adjust.toString());
            }
        }
        function createAttr(name, value) {
            const output = createObj('attribute', {
                _characterid: charID,
                name: name
            });
            output.setWithWorker('current', value || '0');
            return output;
        }
    }
    function checkNPCsaveSection(charID) {
        let showNPCsaves = findObjs({
            _type: 'attribute',
            _characterid: charID,
            name: 'npc_saving_flag'
        })[0];
        if (showNPCsaves == undefined) {
            showNPCsaves = createObj('attribute', {
                _characterid: charID,
                name: 'npc_saving_flag',
                current: ''
            });
        }
        if (findObjs({
            _type: 'attribute',
            _characterid: charID
        }).some((a) => {
            const targetAttrs = [
                'npc_' + 'str' + '_save_flag',
                'npc_' + 'dex' + '_save_flag',
                'npc_' + 'con' + '_save_flag',
                'npc_' + 'int' + '_save_flag',
                'npc_' + 'wis' + '_save_flag',
                'npc_' + 'cha' + '_save_flag'
            ];
            return targetAttrs.includes(a.get('name')) && +a.get('current') != 2;
        })) {
            showNPCsaves.setWithWorker('current', '');
        }
        else {
            showNPCsaves.setWithWorker('current', '2');
        }
    }
    function toggleAuraTarget(pID, tID) {
        const paladin = getObj('character', pID);
        const target = getObj('character', tID);
        if (paladin == undefined || target == undefined) {
            error('A target was undefined.', 21);
            return;
        }
        setAttr(tID, stateName + 'uniq', '1');
        let newValue;
        const attr = findObjs({
            _type: 'attribute',
            _characterid: tID,
            name: stateName + pID
        })[0];
        if (attr != undefined) {
            newValue = attr.get('current') == 'true' ? 'false' : 'true';
            attr.set('current', newValue);
        }
        else {
            const targetIsNPC = +getAttr(tID, 'npc') == 1 ? true : false;
            newValue = targetIsNPC ? 'true' : 'false';
            createObj('attribute', {
                _characterid: tID,
                name: stateName + pID,
                current: newValue
            });
        }
        paladinCheck();
        toChat('**' +
            paladin.get('name') +
            ' has toggled their aura to "' +
            newValue +
            '" for ' +
            target.get('name') +
            '**', newValue == 'true');
    }
    /**
     * Sets or removes a marker on a token based on the bonus it has started
     * or stopped recieving respectively.
     * @param token A token object.
     * @param value A number.
     */
    function setMarker(token, value) {
        if (value > 0) {
            token.set(getState('status_marker'), value);
        }
        else {
            token.set(getState('status_marker'), false);
        }
    }
    function updateCustomConfigs() {
        if (Campaign() != undefined) {
            states
                .filter((s) => {
                return s.customConfig == 'true';
            })
                .forEach((s) => {
                switch (s.name) {
                    case 'status_marker':
                        updateTokenMarkers(s);
                        break;
                    default:
                        error('Custom config for setting "' +
                            s.name +
                            '" could not be found.', -4);
                }
            });
        }
        function updateTokenMarkers(s) {
            const markerObjs = JSON.parse(Campaign().get('_token_markers') || '[]');
            let output = '|bolt-shield,status_bolt-shield';
            tokenMarkerSort(markerObjs, 'name').forEach((m) => {
                if (m.name != 'bolt-shield') {
                    output += '|' + m.name + ',status_' + m.tag;
                }
            });
            s.customConfig = output;
        }
    }
    /**
     * Returns the array after it has been sorted alphabetically, keeping
     * capitalised items at the front of the array.
     * @param arr An array of objects or strings.
     * @param prop Optional. The property to sort by (for objects).
     */
    function tokenMarkerSort(arr, prop) {
        return arr.sort((a, b) => {
            return a[prop] < b[prop] ? -1 : a[prop] > b[prop] ? 1 : 0;
        });
    }
    function toggleActive() {
        const stateInitial = getState('active');
        setState('active', stateInitial == 'true' ? 'false' : 'true');
        let output = '**Paladin Aura ' +
            (stateInitial == 'false' ? 'Enabled' : 'Disabled') +
            '.**';
        if (stateInitial == 'true') {
            output += '** All aura bonuses set to 0.**';
            // get all tokens
            findObjs({
                _type: 'graphic',
                _subtype: 'token'
            })
                // filter out any tokens that represent no sheet
                .filter((t) => {
                const token = getObj('graphic', t.id);
                const char = getObj('character', token.get('represents'));
                if (char != undefined) {
                    return true;
                }
                return false;
            })
                // for each of the remaining tokens, set buff to zero
                .forEach((t) => {
                const token = getObj('graphic', t.id);
                setBuff(token, 0);
            });
            cleanMarkers();
        }
        else {
            paladinCheck();
        }
        toChat(output, getState('active') == 'true');
    }
    function clearAll() {
        const buffAttrs = findObjs({
            _type: 'attribute',
            name: 'paladin_buff'
        });
        buffAttrs.forEach((attr) => {
            if (+attr.get('current') != 0 && attr.get('current') != undefined) {
                const token = findObjs({
                    represents: attr.get('_characterid')
                })[0];
                setBuff(token, 0);
            }
            attr.remove();
        });
        // Find and remove all paladin aura inclusion / exclusion attrs
        findObjs({
            _type: 'attribute'
        })
            .filter((a) => {
            return a.get('name').includes(stateName);
        })
            .forEach((a) => {
            a.remove();
        });
        // Find and remove all paladin abilities
        findObjs({
            _type: 'ability',
            name: 'ToggleAuraTarget'
        }).forEach((a) => {
            a.remove();
        });
        // Delete each stateVar
        states.forEach((s) => {
            delete state[stateName + s.name];
        });
        toChat('**All PaladinAura attributes, abilities, and settings cleared.**', true);
    }
    function getAttr(charID, name) {
        const attrs = findObjs({
            _type: 'attribute',
            _characterid: charID,
            name: name
        });
        if (attrs.length > 0) {
            return attrs[0].get('current');
        }
        return 'undefined';
    }
    function setAttr(charID, name, value) {
        let attr = findObjs({
            _type: 'attribute',
            _characterid: charID,
            name: name
        })[0];
        if (attr == undefined) {
            attr = createObj('attribute', {
                _characterid: charID,
                name: name
            });
        }
        attr.setWithWorker('current', value);
        return attr;
    }
    function getState(value) {
        return state[stateName + value];
    }
    function setState(targetState, newValue) {
        let valid;
        switch (targetState) {
            case 'active':
                valid = isActiveValue(newValue);
                break;
            case 'diagonal_calc_override':
                valid = isDiagonalCalcValue(newValue);
                break;
            case 'status_marker':
                valid = isStatusMarkerValue(newValue);
                break;
        }
        if (valid) {
            state[stateName + targetState] = newValue;
        }
        else {
            error('Tried to set state "' +
                targetState +
                '" with unacceptable value "' +
                newValue +
                '".', -2);
        }
    }
    function code(snippet) {
        return ('<span style="background-color: rgba(0, 0, 0, 0.5); color: White; padding: 2px; border-radius: 3px;">' +
            snippet +
            '</span>');
    }
    function toChat(message, success, target) {
        const whisper = target ? '/w ' + target + ' ' : '';
        let style = '<div>';
        if (success === true) {
            style =
                '<br><div style="background-color: #5cd65c; color: Black; padding: 5px; border-radius: 10px;">';
        }
        else if (success === false) {
            style =
                '<br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">';
        }
        sendChat(name, whisper + style + message + '</div>');
    }
    function error(error, code) {
        if (playerName) {
            sendChat(nameError, `/w ${playerName} <br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**${error}** Error code ${code}.</div>`);
        }
        else {
            sendChat(nameError, `<br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**${error}** Error code ${code}.</div>`);
        }
        log(nameLog + error + ` Error code ${code}.`);
    }
    function checkHP(attr, prev) {
        if (attr.get('name').toLowerCase() == 'hp' &&
            (+attr.get('current') == 0 || +prev.current == 0) &&
            charIsPaladin(attr.get('_characterid')) != undefined) {
            paladinCheck();
        }
    }
    function startupChecks() {
        checkPaladinAbilities();
        checkStates();
    }
    /**
     * Finds all paladin characters and checks their abilities.
     * If a paladin's abilities are found to be incorrect, they
     * will be corrected and the user will be notified.
     */
    function checkPaladinAbilities() {
        const paladinAbilityArr = [
            {
                name: 'ToggleAuraTarget',
                action: '!pa toggleAuraTarget @{character_id} @{target|character_id}'
            }
        ];
        const allChars = findObjs({
            _type: 'character'
        }).filter((c) => {
            return +getAttr(c.id, 'npc') != 1;
        });
        const paladins = allChars.filter((c) => {
            return charIsPaladin(c.id) != undefined;
        });
        let configChanged = false;
        paladins.forEach((p) => {
            paladinAbilityArr.forEach((a) => {
                const ability = findObjs({
                    _type: 'ability',
                    _characterid: p.id,
                    name: a.name
                })[0];
                if (ability == undefined) {
                    configChanged = true;
                    createObj('ability', {
                        _characterid: p.id,
                        name: a.name,
                        action: a.action,
                        istokenaction: true
                    });
                }
                else {
                    if (ability.get('action') != a.action) {
                        configChanged = true;
                        ability.set('action', a.action);
                    }
                }
            });
        });
        if (configChanged) {
            toChat('Some paladin abilities were wrong or missing. They have been fixed or added respectively.', true);
        }
    }
    function checkStates() {
        let changedStates = 0, lastState, lastOldValue, lastNewValue;
        states.forEach((s) => {
            const acceptables = s.acceptables ? s.acceptables : ['true', 'false'];
            const defaultVal = s.default ? s.default : 'true';
            if (getState(s.name) == undefined ||
                (!acceptables.includes(getState(s.name)) && s.ignore != 'true')) {
                changedStates++;
                lastState = s.name;
                lastOldValue = getState(s.name);
                lastNewValue = defaultVal;
                setState(s.name, defaultVal);
            }
        });
        if (changedStates == 1) {
            error('"' +
                lastState +
                '" value was "' +
                lastOldValue +
                '" but has now been set to its default value, "' +
                lastNewValue +
                '".', -1);
        }
        else if (changedStates > 1) {
            toChat('**Multiple settings were wrong or un-set. They have now been corrected. ' +
                'If this is your first time running the PaladinAura API, this is normal.**', true);
        }
    }
    function registerEventHandlers() {
        on('chat:message', handleInput);
        on('change:graphic', paladinCheck);
        on('change:attribute', checkHP);
        on('change:campaign:playerpageid', paladinCheck);
    }
    return {
        CheckMacros: checkMacros,
        StartupChecks: startupChecks,
        RegisterEventHandlers: registerEventHandlers
    };
})();
on('ready', () => {
    PaladinAura.CheckMacros();
    PaladinAura.StartupChecks();
    PaladinAura.RegisterEventHandlers();
});
