const PaladinAura = (function () {
    const version = '1.0.14';
    function isActiveValue(val) {
        return ['true', 'false'].includes(val);
    }
    function isSheetTypeValue(val) {
        return ['Roll20-OGL', 'Shaped'].includes(val);
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
            name: 'sheet_type',
            acceptables: ['Roll20-OGL', 'Shaped'],
            default: 'Roll20-OGL'
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
        // ! DEBUG
        toChat('**PaladinCheck**', true);
        const unitsPerSquare = page.get('scale_number');
        const pixelsPerSquare = page.get('snapping_increment') * 70;
        const playerTokens = getPlayerTokens();
        // ! DEBUG
        toChat('**Player Tokens:**<br>' +
            playerTokens
                .map((p) => {
                return p.get('name');
            })
                .reduce((lp, np, i) => {
                return i > 0 ? lp + ',<br>' + np : np;
            }, ''), false);
        const paladinObjects = getPaladinsFromTokens(playerTokens);
        // ! DEBUG
        toChat('**Paladins:**<br>' +
            paladinObjects
                .map((p) => {
                return '**' + p.token.get('name') + '** ' + p.chaBonus.toString();
            })
                .reduce((lp, np, i) => {
                return i > 0 ? lp + ',<br>' + np : np;
            }, ''), false);
        playerTokens.forEach((t) => {
            let saveBonus;
            const tIsNPC = charIsNPC(t.get('represents'));
            paladinObjects.forEach((p) => {
                if (getState('sheet_type') == 'Roll20-OGL' &&
                    !tIsNPC &&
                    t.get('represents') == p.id) {
                    if (setAttr(p.id, 'mancer_confirm')
                        .get('current')
                        .trim() == 'on' &&
                        p.chaBonus == +setAttr(p.id, 'globalsavemod').get('current') &&
                        setAttr(p.id, stateName + 'uniq').get('current') != '1') {
                        setAttr(p.id, 'paladin_buff', p.chaBonus.toString());
                        setAttr(p.id, stateName + 'uniq', '1');
                    }
                }
                const distLimit = (p.radius / unitsPerSquare) * pixelsPerSquare;
                const tokenSizeAdjust = t.get('width') == pixelsPerSquare
                    ? 0
                    : (Math.floor(t.get('width') / pixelsPerSquare) - 1) *
                        (pixelsPerSquare / 2);
                const xDist = Math.abs(t.get('left') - p.left) - tokenSizeAdjust;
                const yDist = Math.abs(t.get('top') - p.top) - tokenSizeAdjust;
                const distTotal = xDist >= yDist ? distCalc(xDist, yDist) : distCalc(yDist, xDist);
                const pUniqAttr = getAttr(t.get('represents'), stateName + p.id);
                if (
                // if within distance and
                // either not NPC and not excluded
                // or an NPC and included
                distTotal <= distLimit &&
                    ((!tIsNPC &&
                        (pUniqAttr == undefined ||
                            pUniqAttr.get('current').trim() != 'false')) ||
                        (tIsNPC &&
                            pUniqAttr != undefined &&
                            pUniqAttr.get('current').trim() == 'true'))) {
                    saveBonus = saveBonus >= p.chaBonus ? saveBonus : p.chaBonus;
                }
                else {
                    saveBonus = saveBonus ? saveBonus : 0;
                }
            });
            saveBonus = saveBonus ? saveBonus : 0;
            setBuff(t, saveBonus, tIsNPC);
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
    function setBuff(token, value, isNPC) {
        setMarker(token, value);
        const charID = token.get('represents');
        if (isNPC == undefined) {
            isNPC = charIsNPC(token.get('represents'));
        }
        const attr = setAttr(charID, 'paladin_buff', '0', true);
        const attrValue = attr.get('current');
        if (+value != +attrValue) {
            const adjust = +value - +attrValue;
            attr.setWithWorker('current', value.toString());
            if (getState('sheet_type') == 'Roll20-OGL') {
                if (!isNPC) {
                    modAttr(charID, 'globalsavemod', adjust);
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
                        modAttr(charID, abilityName, adjust, true);
                    });
                    checkNPCsaveSection(charID);
                }
            }
            else if (getState('sheet_type') == 'Shaped') {
                modAttr(charID, '', adjust, isNPC);
            }
        }
    }
    /**
     * Returns a token array consisting of tokens that represent
     * non-npc character sheets.
     */
    function getPlayerTokens() {
        // ! DEBUG
        toChat('getPlayerTokens');
        const allTokens = findObjs({
            _type: 'graphic',
            _subtype: 'token',
            _pageid: Campaign().get('playerpageid'),
            layer: 'objects'
        });
        return allTokens.filter((token) => {
            const charID = token.get('represents');
            const char = getObj('character', charID);
            const uniqAttr = getAttr(charID, stateName + 'uniq');
            const hasUniqAttr = uniqAttr != undefined && +uniqAttr.get('current') == 1;
            // return any token that has a character and
            // is not NPC or has custom attr
            return char != undefined && (!charIsNPC(charID) || hasUniqAttr);
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
        // ! DEBUG
        toChat('getPaladinsFromTokens');
        const attrs = [];
        return (tokens
            // filter out any token which has no paladin class
            // or that is below 6th level
            .filter((t) => {
            let keep;
            const levelAttr = charIsPaladin(t.get('represents'));
            if (levelAttr == undefined) {
                // ! DEBUG
                toChat(t.get('name') + ' **not paladin.**');
                keep = false;
            }
            else {
                // ! DEBUG
                toChat(t.get('name') + ' levelAttr: **' + levelAttr + '**');
                if (ignoreLevel) {
                    keep = true;
                }
                else {
                    keep =
                        +getAttr(t.get('represents'), levelAttr).get('current') >= 6;
                    // ! DEBUG
                    if (keep == false) {
                        toChat('**but level was too low.**');
                    }
                }
            }
            // if token is to be kept, add its level attribute name to attrs array
            if (keep) {
                attrs.push(levelAttr);
            }
            return keep;
        })
            // filter out any token that is at or below 0 hit points
            .filter((t, i) => {
            // ! DEBUG
            toChat(t.get('name') + ' got to conscious filter.');
            let conscious = getAttr(t.get('represents'), 'hp');
            if (conscious == undefined) {
                conscious = getAttr(t.get('represents'), 'HP');
            }
            const isConscious = conscious != undefined && +conscious.get('current') > 0;
            // if unconscious remove from array
            if (!conscious) {
                attrs.splice(i, 1);
            }
            return isConscious;
        })
            // map tokens to output format
            .map((t, i) => {
            return {
                chaBonus: Math.max(+getAttr(t.get('represents'), 'charisma_mod').get('current'), 1),
                id: t.get('represents'),
                level: +getAttr(t.get('represents'), attrs[i]).get('current'),
                radius: +getAttr(t.get('represents'), attrs[i]).get('current') >= 18
                    ? 30
                    : 10,
                token: t,
                top: +t.get('top'),
                left: +t.get('left')
            };
        }));
    }
    /**
     * Returns the name of the attribute for the character's
     * paladin level.
     * @param charID A character ID.
     */
    function charIsPaladin(charID) {
        if (getState('sheet_type') == 'Roll20-OGL') {
            const classAttr = [
                'class',
                'multiclass1',
                'multiclass2',
                'multiclass3'
            ].find((a) => {
                const attr = getAttr(charID, a);
                if (attr == undefined) {
                    return false;
                }
                return attr.get('current').search(/paladin/i) != -1;
            });
            if (classAttr == undefined) {
                return;
            }
            switch (classAttr) {
                case 'class':
                    return 'base_level';
                default:
                    return classAttr + '_lvl';
            }
        }
        else if (getState('sheet_type') == 'Shaped') {
            const attr = getAttr(charID, 'has_paladin_levels');
            if (attr != undefined && +attr.get('current') == 1) {
                return 'paladin_level';
            }
        }
    }
    function charIsNPC(charID) {
        let attr;
        switch (getState('sheet_type')) {
            case 'Roll20-OGL':
                attr = getAttr(charID, 'npc');
                break;
            case 'Shaped':
                attr = getAttr(charID, 'is_npc');
                break;
        }
        if (attr == undefined) {
            return false;
        }
        return +attr.get('current') == 1;
    }
    /**
     * @param charID Target character ID.
     * @param attrName Target attribute (eg. globalsavemod).
     * @param value The difference between the old PaladinBuff and the new one.
     * @param isNPC Token character is an NPC.
     */
    function modAttr(charID, attrName, value, isNPC) {
        // ! DEBUG
        toChat('modAttr');
        if (getState('sheet_type') == 'Roll20-OGL') {
            if (!isNPC) {
                const attr = setAttr(charID, attrName, '0', true);
                const attrVal = +attr.get('current');
                attr.setWithWorker('current', (attrVal + value).toString());
            }
            else {
                const shortAttrName = attrName.slice(0, 3);
                const attrMod = findObjs({
                    _type: 'attribute',
                    _characterid: charID,
                    name: attrName + '_mod'
                })[0];
                const saveFlagAttr = setAttr(charID, 'npc_' + shortAttrName + '_save_flag', '0', true);
                const saveBonusAttr = setAttr(charID, 'npc_' + shortAttrName + '_save', attrMod.get('current'), true);
                let adjust;
                if (+saveFlagAttr.get('current') == 2) {
                    adjust = +saveBonusAttr.get('current') + value;
                }
                else {
                    adjust = +attrMod.get('current') + value;
                }
                saveBonusAttr.setWithWorker('current', adjust.toString());
                if (+saveBonusAttr.get('current') == +attrMod.get('current')) {
                    saveFlagAttr.setWithWorker('current', '0');
                }
                else {
                    saveFlagAttr.setWithWorker('current', '2');
                }
            }
        }
        else if (getState('sheet_type') == 'Shaped') {
            // ! DEBUG
            toChat('Shaped sheet');
            if (!isNPC) {
                // ! DEBUG
                toChat('Not NPC');
                const repModPrefix = 'repeating_modifier_';
                let id = setAttr(charID, stateName + 'repID').get('current');
                if (id.length != 20) {
                    id = generateRowID();
                    setAttr(charID, stateName + 'repID', id);
                }
                // ! DEBUG
                toChat('**Repeating row ID for ' +
                    getObj('character', charID).get('name') +
                    ':**<br>' +
                    id);
                const repAttrs = [
                    {
                        name: 'name',
                        value: 'Paladin Aura Save Bonus',
                        type: 'set'
                    },
                    {
                        name: 'savingthrowtoggle',
                        value: '1',
                        type: 'set'
                    },
                    {
                        name: 'savingthrowmodifier',
                        value: value.toString(),
                        type: 'mod'
                    }
                ];
                repAttrs.forEach((a) => {
                    toChat('!' +
                        a.type +
                        'attr --fbpublic --' +
                        repModPrefix +
                        id +
                        '_' +
                        a.name +
                        '|' +
                        a.value);
                });
            }
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
            const targetIsNPC = charIsNPC(tID);
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
    /**
     * @param charID A character ID string.
     * @param name The attribute name.
     * @returns The attribute if found, else undefined.
     */
    function getAttr(charID, name) {
        const attrs = findObjs({
            _type: 'attribute',
            _characterid: charID,
            name: name
        });
        if (attrs.length > 0) {
            return attrs[0];
        }
        return;
    }
    /**
     * Find the attribute and sets its 'current' value. If the attribute
     * cannot be found it is instead created.
     * @param charID A character ID string.
     * @param name The attribute name.
     * @param value The value to set the attribute to.
     * @param dontOverwrite If true, the attribute's current value will not be overwritten,
     * unless the attribute was newly created.
     * @returns The attribute after the change.
     */
    function setAttr(charID, name, value, dontOverwrite) {
        let attr = getAttr(charID, name);
        let goingToOverwrite;
        if (attr == undefined || attr.get('current').trim() == '') {
            goingToOverwrite = false;
            attr = createObj('attribute', {
                _characterid: charID,
                name: name
            });
        }
        if (value != undefined &&
            // so long as goingToOverwrite and dontOverwrite are not both true
            (goingToOverwrite == false || dontOverwrite != true)) {
            attr.setWithWorker('current', value);
        }
        return attr;
    }
    // can also return a string in the case of "status_marker" StateVar, but is never checked by code
    function getState(value) {
        return state[stateName + value];
    }
    function setState(targetState, newValue) {
        let valid;
        switch (targetState) {
            case 'active':
                valid = isActiveValue(newValue);
                break;
            case 'sheet_type':
                valid = isSheetTypeValue(newValue);
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
    // From ChatSetAttr
    function generateRowID() {
        function generateUUID() {
            var a = 0, b = [], g;
            var c = new Date().getTime() + 0, d = c === a;
            a = c;
            for (var e = new Array(8), f = 7; 0 <= f; f--) {
                e[f] = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(c % 64);
                c = Math.floor(c / 64);
            }
            g = e.join('');
            if (d) {
                for (f = 11; 0 <= f && 63 === b[f]; f--) {
                    b[f] = 0;
                }
                b[f]++;
            }
            else {
                for (f = 0; 12 > f; f++) {
                    b[f] = Math.floor(64 * Math.random());
                }
            }
            for (f = 0; 12 > f; f++) {
                g += '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz'.charAt(b[f]);
            }
            return g;
        }
        return generateUUID().replace(/_/g, 'Z');
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
        checkStates();
        checkPaladinAbilities();
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
            return !charIsNPC(c.id);
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
