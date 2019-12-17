var APIName = APIName || (function () {
    'use strict';
    var stateName = 'PaladinAura',
        states = [
            ['active']
        ],
        name = 'Paladin Aura',
        nameError = name + ' ERROR',
        nameLog = name + ': ',
        
        playerName,
        playerID,

        checkMacros = function () {
            let playerList = findObjs({ _type: 'player', _online: true }),
                gm = _.find(playerList, player => { return playerIsGM(player.id) === true; }),
                macrosArr = [
                    [
                        'PaladinAuraHelp',
                        '!pa help'
                    ]
                ];
            _.each(macrosArr, macro => {
                let macroObj = findObjs({ _type: 'macro', name: macro[0] })[0];
                if (macroObj) {
                    if (macroObj.get('visibleto').includes('all') === false) {
                        macroObj.set('visibleto', 'all');
                        toChat(`**Macro '${macro[0]}' was made visible to all.**`, true);
                    }
                    if (macroObj.get('action') !== macro[1]) {
                        macroObj.set('action', macro[1]);
                        toChat(`**Macro '${macro[0]}' was corrected.**`, true);
                    }
                } else if (gm && playerIsGM(gm.id)) {
                    createObj('macro', {
                        _playerid: gm.id,
                        name: macro[0],
                        action: macro[1],
                        visibleto: 'all'
                    })
                    toChat(`**Macro '${macro[0]}' was created and assigned to ${gm.get('_displayname')}.**`, true);
                }
            })
        },

        showHelp = function () {
            let commandsArr = [
                [
                    '!pa help',
                    'Lists all commands, their parameters, and their usage.',
                    `${code('!pa')} ${code('help')}`
                ],
                [
                    '!pa',
                    'Toggles the Paladin Aura API on and off.'
                ]
            ];
            _.each(commandsArr, command => {
                let output = `&{template:default} {{name=${code(command[0])} Help}}`;
                _.each(command, function (part, index) {
                    if (index < 3) {
                        let section;
                        switch (index) {
                            case 0:
                                section = 'Command';
                                break;
                            case 1:
                                section = 'Function';
                                break;
                            case 2:
                                section = 'Typical Input';
                                break;
                        }
                        output += `{{${section}=${part}}}`;
                    } else {
                        output += `{{${part[0]}=${part[1]}}}`;
                    }
                })
                toPlayer(output);
            })
            return;
        },
        
        handleInput = function (msg) {
            playerName = msg.who.split(' ', 1)[0];
            playerID = msg.playerid;
            if ( msg.type === 'api' && msg.content.split(' ')[0] === '!pa' ) {
                var parts = msg.content.split(' ');
                if ( parts[1] === 'help' ) {
                    showHelp();
                } else if ( !parts[1] && playerIsGM(playerID) ) {
                    toggleActive();
                }
            }
        },

        paladinCheck = function (obj) {
            let page = getObj('page', Campaign().get('playerpageid')),
                pixelsPerSquare = page.get('snapping_increment') * 70,
                unitsPerSquare = page.get('scale_number'),
                allTokens = findObjs({ _type: 'graphic', _subtype: 'token', _pageid: Campaign().get('playerpageid') }),
                playerTokens = _.filter( allTokens, token => {
                    let charID = token.get('represents');
                    return !getObj('character', charID) ? false : getAttrByName(charID, 'npc') == 1 ? false : true;
                }),
                auraTokens = playerTokens;
            if (page.get('scale_units') != 'ft') return;
            auraTokens = _.map(auraTokens, token => {
                let charID = token.get('represents'),
                    output;
                if ( 
                    getAttrByName(charID, 'class').toLowerCase().includes('paladin') && 
                    getAttrByName(charID, 'base_level') >= 6 && 
                    getAttrByName(charID, 'hp') > 0
                ) {
                    output = setOutput('base_level');
                } else {
                    _.each(['multiclass1', 'multiclass2', 'multiclass3'], className => {
                        if ( getAttrByName(charID, className+'_flag') == 1 ) {
                            if ( 
                                getAttrByName(charID, className).toLowerCase().includes('paladin') &&
                                getAttrByName(charID, className+'_lvl') >= 6 &&
                                getAttrByName(charID, 'hp') > 0
                            ) {
                                output = setOutput(className+'_lvl');
                            }
                        }
                    });
                }
                if (output) {
                    return output;
                } else {
                    return token;
                }

                function setOutput(levelAttr) {
                    let output = { 
                        token: token, 
                        level: getAttrByName(charID, levelAttr),
                        left: token.get('left'),
                        top: token.get('top'),
                        chaBonus: getAttrByName(charID, 'charisma_mod'),
                        radius: getAttrByName(charID, levelAttr) >= 18 ? 30 : 10
                    };
                    return output;
                }
            });
            auraTokens = _.filter(auraTokens, obj => {
                if (obj.id) { return false; }
                else { return true; }
            });
            _.each(auraTokens, paladin => {
                _.each(playerTokens, token => {
                    let distLimit = (paladin.radius / unitsPerSquare) * pixelsPerSquare,
                        xDist = Math.abs(token.get('left') - paladin.left),
                        yDist = Math.abs(token.get('top') - paladin.top),
                        distTotal = xDist >= yDist ? distCalc(xDist, yDist) : distCalc(yDist, xDist);
                    if (distTotal <= distLimit) {
                        setBuff(token, `paladin_buff`, paladin.chaBonus);
                    } else {
                        setBuff(token, `paladin_buff`, 0);
                    }

                    function distCalc (distA, distB) {
                        return distA + (Math.floor((distB / pixelsPerSquare) / 2) * pixelsPerSquare);
                    }
                })
            })
        },

        setBuff = function (token, attrName, value) {
            let charID = token.get('represents'),
                char = getObj('character', charID);
            if (!char) {
                error(`Player Character '${token.get('name')}' had no character sheet.`, 2);
                return;
            } else {
                let attr = findObjs({
                    _type: 'attribute',
                    _characterid: charID,
                    name: attrName
                })[0];
                if (!attr) {
                    attr = createObj('attribute', {
                        _characterid: charID,
                        name: attrName,
                        current: 0
                    });
                }
                let attrValue = attr.get('current');
                if (value != attrValue) {
                    let adjust = value - attrValue;
                    attr.setWithWorker('current', value);
                    modAttr(token, 'globalsavemod', adjust);
                }
            }
            return;
        },

        modAttr = function (token, attrName, value) {
            let charID = token.get('represents'),
                char = getObj('character', charID),
                attr = findObjs({
                    _type: 'attribute',
                    _characterid: charID,
                    name: attrName
                })[0];
            if (!attr) {
                attr = createObj('attribute', {
                    _characterid: charID,
                    name: attrName
                });
                attr.setWithWorker('current', value);
                return;
            } else {
                let attrValue = attr.get('current'),
                    adjust = attrValue + value;
                attr.setWithWorker('current', adjust);
                return;
            }
        },

        toggleActive = function () {
            state[`${stateName}_active`] = !getState(`active`);
            toChat(`**Paladin Aura ${getState('active') ? 'Enabled' : 'Disabled'}.**`, getState('active'));
            return;
        },

        getState = function (value) {
            return state[`${stateName}_${value}`];
        },

        code = function (snippet) {
            return `<span style="background-color: rgba(0, 0, 0, 0.5); color: White; padding: 2px; border-radius: 3px;">${snippet}</span>`;
        },

        toChat = function (message, success, target) {
            let style = '<div>',
                whisper = target ? `/w ${target} ` : '';
            if (success === true) {
                style = `<br><div style="background-color: #5cd65c; color: Black; padding: 5px; border-radius: 10px;">`;
            } else if (success === false) {
                style = `<br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">`;
            }
            sendChat(name, `${whisper}${style}${message}</div>`);
        },

        toPlayer = function (message, success) {
            if (!success) {
                sendChat(name, `/w ${playerName} ` + message);
            } else {
                sendChat(name, `/w ${playerName} ` + '<br><div style="background-color: #5cd65c; color: Black; padding: 5px; border-radius: 10px;">' + message + '</div>');
            }
        },

        error = function (error, code) {
            if (playerName) {
                sendChat(nameError, `/w ${playerName} <br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">**${error}** Error code ${code}.</div>`);
            } else {
                sendChat(nameError, `<br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">**${error}** Error code ${code}.</div>`);
            }
            log(nameLog + error + ` Error code ${code}.`);
        },

        startupChecks = function () {
            _.each(states, variable => {
                let values = variable[1] ? variable[1] : [true, false],
                    defaultValue = variable[2] ? variable[2] : true;
                if (!state[`${stateName}_${variable[0]}`] || !values.includes(state[`${stateName}_${variable[0]}`])) {
                    error(`**'${variable[0]}'** value **was '${state[`${stateName}_${variable[0]}`]}'** but has now been **set to its default** value, '${defaultValue}'.`, -1);
                    state[`${stateName}_${variable[0]}`] = defaultValue;
                }
            })
        },
        
        registerEventHandlers = function () {
            on('chat:message', handleInput);
            on('change:graphic', paladinCheck);
        };

    return {
        CheckMacros:checkMacros,
        StartupChecks:startupChecks,
        RegisterEventHandlers:registerEventHandlers
    };
}())

on('ready', function () {
    APIName.CheckMacros();
    APIName.StartupChecks();
    APIName.RegisterEventHandlers();
})