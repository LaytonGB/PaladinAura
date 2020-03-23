/* eslint-disable no-undef */
var PaladinAura = (function () {
    var version = '1.0.4';
    var stateName = 'PaladinAura_';
    var states = [
        {
            name: 'active',
            hide: 'true'
        },
        {
            name: 'diagonal_calc_override',
            acceptables: ['none', 'foure', 'threefive', 'pythagorean', 'manhattan'],
            "default": 'none'
        },
        {
            name: 'status_marker',
            "default": 'status_bolt-shield',
            ignore: 'true',
            customConfig: ''
        }
    ];
    var name = 'Paladin Aura';
    var nameError = name + ' ERROR';
    var nameLog = name + ': ';
    var apiCall = '!pa';
    var playerName, playerID, parts;
    /**
     * Checks each macro from the macroArr array to ensure their functions are up to date.
     */
    function checkMacros() {
        var playerList = findObjs({ _type: 'player', _online: true });
        var gm = playerList.find(function (player) {
            return playerIsGM(player.id) === true;
        });
        var macroArr = [
            {
                name: 'PaladinAuraHelp',
                action: apiCall + " help"
            },
            {
                name: 'PaladinAuraToggle',
                action: "" + apiCall
            },
            {
                name: 'PaladinAuraConfig',
                action: apiCall + " config"
            }
        ];
        macroArr.forEach(function (macro) {
            var macroObj = findObjs({
                _type: 'macro',
                name: macro.name
            })[0];
            if (macroObj) {
                if (macroObj.get('visibleto') !== 'all') {
                    macroObj.set('visibleto', 'all');
                    toChat("**Macro '" + macro.name + "' was made visible to all.**", true);
                }
                if (macroObj.get('action') !== macro.action) {
                    macroObj.set('action', macro.action);
                    toChat("**Macro '" + macro.name + "' was corrected.**", true);
                }
            }
            else if (gm && playerIsGM(gm.id)) {
                createObj('macro', {
                    _playerid: gm.id,
                    name: macro.name,
                    action: macro.action,
                    visibleto: 'all'
                });
                toChat("**Macro '" + macro.name + "' was created and assigned to " + (gm.get('_displayname') + ' '.split(' ', 1)[0]) + ".**", true);
            }
        });
    }
    /**
     * Outputs help interface to the roll20 chat.
     */
    function showHelp() {
        var commandsArr = [
            {
                name: apiCall + " help",
                desc: ['Lists all commands, their parameters, and their usage.']
            },
            {
                name: apiCall + " config",
                desc: ['Shows config and buttons that change settings.']
            },
            {
                name: "" + apiCall,
                desc: ['Toggles the Paladin Aura API on and off.'],
                link: 'active'
            }
        ];
        toChat('&{template:default} {{name=' +
            '**VERSION**' +
            '}} {{Current=' +
            version +
            '}}', undefined, playerName);
        commandsArr.forEach(function (command) {
            var output = '&{template:default} {{name=' + code(command.name) + '}}{{Function=';
            for (var i = 0; i < command.desc.length; i++) {
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
        var output = "&{template:default} {{name=" + name + " Config}}";
        states.forEach(function (s) {
            if (s.hide === 'true') {
                return;
            }
            var acceptableValues = s.acceptables
                ? s.acceptables
                : ['true', 'false'];
            var defaultValue = s["default"] ? s["default"] : 'true';
            var currentValue = getState(s.name);
            var stringVals = s.customConfig == undefined
                ? valuesToString(acceptableValues, defaultValue)
                : s.customConfig;
            output += "{{" + s.name + "=[" + currentValue + "](" + apiCall + " config " + s.name + " ?{New " + s.name + " value" + stringVals + "})}}";
        });
        toChat(output, undefined, playerName);
        /**
         * Moves the default value to the start of the array and presents
         * all acceptable values in a drop-down menu format.
         * @param values Acceptable values array.
         * @param defaultValue The state's default value.
         */
        function valuesToString(values, defaultValue) {
            var output = '';
            var index = values.indexOf(defaultValue);
            if (index !== -1) {
                values.splice(index, 1);
                values.unshift(defaultValue);
            }
            values.forEach(function (v) {
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
            state[stateName + parts[2]] +
            ' to ' +
            parts[3] +
            '**.', true, 'gm');
        if (parts[2] == 'status_marker') {
            cleanMarkers(state[stateName + parts[2]]);
        }
        state[stateName + parts[2]] = parts[3];
        showConfig();
        paladinCheck();
    }
    function cleanMarkers(oldMarker) {
        findObjs({
            _type: 'graphic'
        })
            .filter(function (g) {
            return g.get(oldMarker) != 'false';
        })
            .forEach(function (g) {
            g.set(oldMarker, 'false');
        });
    }
    function handleInput(msg) {
        parts = msg.content.split(' ');
        if (msg.type === 'api' && parts[0] === apiCall) {
            playerName = msg.who.split(' ', 1)[0];
            playerID = msg.playerid;
            if ([undefined, 'config', 'help'].includes(parts[1])) {
                if (parts[1] === 'help') {
                    showHelp();
                }
                else if (playerIsGM(playerID)) {
                    if (!parts[1]) {
                        toggleActive();
                    }
                    else if (parts[1] === 'config') {
                        if (parts[2]) {
                            setConfig(parts);
                        }
                        else {
                            showConfig();
                        }
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
        var page = getObj('page', Campaign().get('playerpageid')), pixelsPerSquare = page.get('snapping_increment') * 70, unitsPerSquare = page.get('scale_number'), allTokens = findObjs({
            _type: 'graphic',
            _subtype: 'token',
            _pageid: Campaign().get('playerpageid')
        }), playerTokens = allTokens.filter(function (token) {
            var charID = token.get('represents');
            return !getObj('character', charID)
                ? false
                : +getAttr(charID, 'npc') == 1
                    ? false
                    : true;
        });
        if (page.get('scale_units') != 'ft') {
            return;
        } // stops here if scale is not feet
        var auraTokens = playerTokens.map(function (token) {
            var charID = token.get('represents'), output;
            if (getAttr(charID, 'class')
                .toLowerCase()
                .includes('paladin') &&
                +getAttr(charID, 'base_level') >= 6 &&
                +getAttr(charID, 'hp') > 0) {
                output = setOutput('base_level');
            }
            else {
                ['multiclass1', 'multiclass2', 'multiclass3'].forEach(function (className) {
                    if (+getAttr(charID, className + '_flag') == 1) {
                        if (getAttr(charID, className)
                            .toLowerCase()
                            .includes('paladin') &&
                            +getAttr(charID, className + '_lvl') >= 6 &&
                            +getAttr(charID, 'hp') > 0) {
                            output = setOutput(className + '_lvl');
                        }
                    }
                });
            }
            if (output) {
                return output;
            }
            else {
                return token;
            }
            /**
             * Returns a PaladinObject.
             * @param levelAttr The attribute of the character object that represents their paladin level.
             */
            function setOutput(levelAttr) {
                var output = {
                    token: token,
                    level: +getAttr(charID, levelAttr),
                    left: +token.get('left'),
                    top: +token.get('top'),
                    chaBonus: Math.max(+getAttr(charID, 'charisma_mod'), 1),
                    radius: +getAttr(charID, levelAttr) >= 18 ? 30 : 10
                };
                return output;
            }
        });
        var paladinTokens = auraTokens.filter(function (obj) {
            return obj.token !== undefined;
        });
        playerTokens.forEach(function (token) {
            var saveBonus;
            paladinTokens.forEach(function (paladin) {
                var distLimit = (paladin.radius / unitsPerSquare) * pixelsPerSquare, xDist = Math.abs(token.get('left') - paladin.left), yDist = Math.abs(token.get('top') - paladin.top), distTotal = xDist >= yDist ? distCalc(xDist, yDist) : distCalc(yDist, xDist);
                if (distTotal <= distLimit) {
                    saveBonus =
                        saveBonus >= paladin.chaBonus ? saveBonus : paladin.chaBonus;
                }
                else {
                    saveBonus = saveBonus ? saveBonus : 0;
                }
                function distCalc(distA, distB) {
                    var diagonal = getState('diagonal_calc_override') == 'none'
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
            });
            saveBonus = saveBonus ? saveBonus : 0;
            setBuff(token, saveBonus);
        });
    }
    function getAttr(id, name) {
        var attr = findObjs({
            _type: 'attribute',
            _characterid: id,
            name: name
        });
        if (attr.length > 0) {
            return attr[0].get('current');
        }
        return 'undefined';
    }
    /**
     * Adjusts the Paladin bonus being given to the provided token.
     * @param token The target token.
     * @param value The new value to set the paladin bonus to.
     */
    function setBuff(token, value) {
        setMarker(token, value);
        var charID = token.get('represents'), char = getObj('character', charID);
        if (!char) {
            error("Player Character '" + token.get('name') + "' had no character sheet.", 2);
            return;
        }
        else {
            var attr = findObjs({
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
            var attrValue = attr.get('current');
            if (+value != +attrValue) {
                var adjust = +value - +attrValue;
                attr.setWithWorker('current', value.toString());
                modAttr(token, 'globalsavemod', adjust);
            }
        }
        return;
    }
    function modAttr(token, attrName, value) {
        var charID = token.get('represents'), attr = findObjs({
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
            return;
        }
        else {
            var attrValue = attr.get('current'), adjust = +attrValue + +value;
            attr.setWithWorker('current', adjust.toString());
            return;
        }
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
            updateTokenMarkers();
        }
        function updateTokenMarkers() {
            var output = '|bolt-shield,status_bolt-shield';
            var markerObjs = JSON.parse(Campaign().get('_token_markers') || '[]');
            tokenMarkerSort(markerObjs, 'name').forEach(function (m) {
                if (m.name != 'bolt-shield') {
                    output += '|' + m.name + ',status_' + m.tag;
                }
            });
            states.find(function (s) {
                return s.name == 'status_marker';
            }).customConfig = output;
        }
    }
    /**
     * Returns the array after it has been sorted alphabetically, keeping
     * capitalised items at the front of the array.
     * @param arr An array of objects or strings.
     * @param prop Optional. The property to sort by (for objects).
     */
    function tokenMarkerSort(arr, prop) {
        return arr.sort(function (a, b) {
            return a[prop] < b[prop] ? -1 : a[prop] > b[prop] ? 1 : 0;
        });
    }
    function toggleActive() {
        var stateInitial = getState('active');
        state[stateName + 'active'] = stateInitial == 'true' ? 'false' : 'true';
        var output = "**Paladin Aura " + (stateInitial == 'false' ? 'Enabled' : 'Disabled') + ".**";
        if (stateInitial == 'true') {
            output += '** All aura bonuses set to 0.**';
            // for each token on the player page
            findObjs({
                _type: 'graphic',
                _pageid: Campaign().get('playerpageid')
            })
                // filter out any tokens that represent no sheet
                .filter(function (t) {
                var token = getObj('graphic', t.id);
                var char = getObj('character', token.get('represents'));
                if (char != undefined) {
                    return true;
                }
                return false;
            })
                // for each of the remaining tokens, set buff to zero
                .forEach(function (t) {
                var token = getObj('graphic', t.id);
                setBuff(token, 0);
            });
        }
        else {
            paladinCheck();
        }
        toChat(output, getState('active') == 'true');
    }
    function getState(value) {
        return state[stateName + value];
    }
    function code(snippet) {
        return ('<span style="background-color: rgba(0, 0, 0, 0.5); color: White; padding: 2px; border-radius: 3px;">' +
            snippet +
            '</span>');
    }
    function toChat(message, success, target) {
        var whisper = target ? '/w ' + target + ' ' : '';
        var style = '<div>';
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
            sendChat(nameError, "/w " + playerName + " <br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**" + error + "** Error code " + code + ".</div>");
        }
        else {
            sendChat(nameError, "<br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**" + error + "** Error code " + code + ".</div>");
        }
        log(nameLog + error + (" Error code " + code + "."));
    }
    function startupChecks() {
        states.forEach(function (s) {
            var acceptables = s.acceptables ? s.acceptables : ['true', 'false'];
            var defaultVal = s["default"] ? s["default"] : 'true';
            if (state[stateName + s.name] == undefined ||
                (!acceptables.includes(state[stateName + s.name]) && s.ignore != 'true')) {
                error('"' +
                    s.name +
                    '" value was "' +
                    state[stateName + s.name] +
                    '" but has now been set to its default value, "' +
                    defaultVal +
                    '".', -1);
                state[stateName + s.name] = defaultVal;
            }
        });
    }
    function registerEventHandlers() {
        on('chat:message', handleInput);
        on('change:graphic', paladinCheck);
        on('change:campaign:playerpageid', paladinCheck);
    }
    return {
        CheckMacros: checkMacros,
        StartupChecks: startupChecks,
        RegisterEventHandlers: registerEventHandlers
    };
})();
on('ready', function () {
    PaladinAura.CheckMacros();
    PaladinAura.StartupChecks();
    PaladinAura.RegisterEventHandlers();
});
