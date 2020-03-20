/* eslint-disable no-undef */

const PaladinAura = (function() {
  const version = '1.0.1';

  type StateVar = 'active' | 'diagonal_calc_override' | 'status_marker';

  type StringBool = 'true' | 'false';

  /**
   * @param name A name for this setting. Because this name is to be added to the
   * states object, it is best to keep this name uniform.
   * @param acceptables Optional. Acceptable values for this state.
   * @param default Optional. The default value for this state.
   * @param ignore Optional. If true, this state will not be reset to default
   * regardless of if its current value is outside its acceptable values.
   * @param hide Optional. If true, this state will not show in the config menu.
   * @param customConfig Optional. Sets a custom dropdown menu for the config button.
   */
  interface StateForm {
    name: StateVar;
    acceptables?: string[];
    default?: string;
    ignore?: StringBool;
    hide?: StringBool;
    customConfig?: string;
  }

  interface MacroForm {
    name: string;
    action: string;
    visibleto?: string;
  }

  interface HelpForm {
    name: string;
    desc: string[];
    example?: string[];
    link?: StateVar;
  }

  interface PaladinObject {
    token: Graphic;
    level: number;
    left: number;
    top: number;
    chaBonus: number;
    radius: number;
  }

  const stateName = 'PaladinAura_';
  let states: StateForm[] = [
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
      customConfig: ''
    }
  ];
  const name = 'Paladin Aura';
  const nameError = name + ' ERROR';
  const nameLog = name + ': ';
  const apiCall = '!pa';

  let playerName: string, playerID: string, parts: string[];

  /**
   * Checks each macro from the macroArr array to ensure their functions are up to date.
   */
  function checkMacros() {
    const playerList = findObjs({ _type: 'player', _online: true });
    const gm = playerList.find(player => {
      return playerIsGM(player.id) === true;
    }) as Player;
    const macroArr: MacroForm[] = [
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
    macroArr.forEach(macro => {
      const macroObj = findObjs({
        _type: 'macro',
        name: macro.name
      })[0] as Macro;
      if (macroObj) {
        if (macroObj.get('visibleto') !== 'all') {
          macroObj.set('visibleto', 'all');
          toChat(`**Macro '${macro.name}' was made visible to all.**`, true);
        }
        if (macroObj.get('action') !== macro.action) {
          macroObj.set('action', macro.action);
          toChat(`**Macro '${macro.name}' was corrected.**`, true);
        }
      } else if (gm && playerIsGM(gm.id)) {
        createObj('macro', {
          _playerid: gm.id,
          name: macro.name,
          action: macro.action,
          visibleto: 'all'
        });
        toChat(
          `**Macro '${macro.name}' was created and assigned to ${gm.get(
            '_displayname'
          ) + ' '.split(' ', 1)[0]}.**`,
          true
        );
      }
    });
  }

  /**
   * Outputs help interface to the roll20 chat.
   */
  function showHelp() {
    const commandsArr: HelpForm[] = [
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
    toChat(
      '&{template:default} {{name=' +
        '**VERSION**' +
        '}} {{Current=' +
        version +
        '}}',
      undefined,
      playerName
    );
    commandsArr.forEach(command => {
      let output =
        '&{template:default} {{name=' + code(command.name) + '}}{{Function=';
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
    states.forEach(s => {
      if (s.hide === 'true') return;
      const acceptableValues = s.acceptables
        ? s.acceptables
        : ['true', 'false'];
      const defaultValue = s.default ? s.default : 'true';
      const currentValue = getState(s.name);
      const stringVals =
        s.customConfig == undefined
          ? valuesToString(acceptableValues, defaultValue)
          : s.customConfig;
      output += `{{${s.name}=[${currentValue}](${apiCall} config ${s.name} ?{New ${s.name} value${stringVals}})}}`;
    });
    toChat(output, undefined, playerName);

    /**
     * Moves the default value to the start of the array and presents
     * all acceptable values in a drop-down menu format.
     * @param values Acceptable values array.
     * @param defaultValue The state's default value.
     */
    function valuesToString(values: string[], defaultValue: string) {
      let output = '';
      const index = values.indexOf(defaultValue);
      if (index !== -1) {
        values.splice(index, 1);
        values.unshift(defaultValue);
      }
      values.forEach(v => {
        output += '|' + v;
      });
      return output;
    }
  }

  /**
   * Sets the setting with name equal to @param parts[2] equal to @param parts[3].
   * @param parts An Array of strings, each part is a section of the incoming message.
   */
  function setConfig(parts: string[]): void {
    toChat(
      '**' +
        parts[2] +
        '** has been changed **from ' +
        state[stateName + parts[2]] +
        ' to ' +
        parts[3] +
        '**.',
      true,
      playerName
    );
    if (parts[2] == 'status_marker')
      cleanMarkers(state[stateName + parts[2]], parts[3]);
    state[stateName + parts[2]] = parts[3];
    showConfig();
    paladinCheck();
  }

  function cleanMarkers(oldMarker: string, newMarker: string): void {
    findObjs({
      _type: 'graphic'
    })
      .filter((g: Graphic) => {
        return g.get(oldMarker as any) != 'false';
      })
      .forEach((g: Graphic) => {
        g.set(oldMarker as any, 'false');
      });
  }

  function handleInput(msg: ChatEventData) {
    parts = msg.content.split(' ');
    if (msg.type === 'api' && parts[0] === apiCall) {
      playerName = msg.who.split(' ', 1)[0];
      playerID = msg.playerid;
      if ([undefined, 'config', 'help'].includes(parts[1])) {
        if (parts[1] === 'help') {
          showHelp();
        } else if (playerIsGM(playerID)) {
          if (!parts[1]) {
            toggleActive();
          } else if (parts[1] === 'config') {
            if (parts[2]) {
              setConfig(parts);
            } else {
              showConfig();
            }
          }
        } else {
          error('Command is only accessible to GMs.', 1);
        }
      } else {
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
    if (getState('active') == 'false') return; // stops here if the API is inactive
    let page = getObj('page', Campaign().get('playerpageid')),
      pixelsPerSquare = page.get('snapping_increment') * 70,
      unitsPerSquare = page.get('scale_number'),
      allTokens = findObjs({
        _type: 'graphic',
        _subtype: 'token',
        _pageid: Campaign().get('playerpageid')
      }) as Graphic[],
      playerTokens = allTokens.filter(token => {
        let charID = token.get('represents');
        return !getObj('character', charID)
          ? false
          : +getAttrByName(charID, 'npc') == 1
            ? false
            : true;
      });
    if (page.get('scale_units') != 'ft') return; // stops here if scale is not feet
    let auraTokens = playerTokens.map(token => {
      let charID = token.get('represents'),
        output: PaladinObject;
      if (
        getAttrByName(charID, 'class')
          .toLowerCase()
          .includes('paladin') &&
        +getAttrByName(charID, 'base_level') >= 6 &&
        +getAttrByName(charID, 'hp') > 0
      ) {
        output = setOutput('base_level');
      } else {
        ['multiclass1', 'multiclass2', 'multiclass3'].forEach(className => {
          if (+getAttrByName(charID, className + '_flag') == 1) {
            if (
              getAttrByName(charID, className)
                .toLowerCase()
                .includes('paladin') &&
              +getAttrByName(charID, className + '_lvl') >= 6 &&
              +getAttrByName(charID, 'hp') > 0
            ) {
              output = setOutput(className + '_lvl');
            }
          }
        });
      }
      if (output) {
        return output;
      } else {
        return token;
      }

      /**
       * Returns a PaladinObject.
       * @param levelAttr The attribute of the character object that represents their paladin level.
       */
      function setOutput(levelAttr: string): PaladinObject {
        let output = {
          token: token,
          level: +getAttrByName(charID, levelAttr),
          left: +token.get('left'),
          top: +token.get('top'),
          chaBonus: +getAttrByName(charID, 'charisma_mod'),
          radius: +getAttrByName(charID, levelAttr) >= 18 ? 30 : 10
        };
        return output;
      }
    });
    let paladinTokens = auraTokens.filter((obj: any) => {
      return obj.token !== undefined;
    }) as PaladinObject[];
    playerTokens.forEach(token => {
      let saveBonus: number;
      paladinTokens.forEach(paladin => {
        let distLimit = (paladin.radius / unitsPerSquare) * pixelsPerSquare,
          xDist = Math.abs(token.get('left') - paladin.left),
          yDist = Math.abs(token.get('top') - paladin.top),
          distTotal =
            xDist >= yDist ? distCalc(xDist, yDist) : distCalc(yDist, xDist);
        if (distTotal <= distLimit) {
          saveBonus =
            saveBonus >= paladin.chaBonus ? saveBonus : paladin.chaBonus;
        } else {
          saveBonus = saveBonus ? saveBonus : 0;
        }

        function distCalc(distA: number, distB: number) {
          let diagonal =
            getState('diagonal_calc_override') == 'none'
              ? page.get('diagonaltype')
              : getState('diagonal_calc_override');
          if (diagonal == 'threefive') {
            return (
              distA + Math.floor(distB / pixelsPerSquare / 2) * pixelsPerSquare
            );
          }
          if (diagonal == 'foure') {
            return distA;
          }
          if (diagonal == 'pythagorean') {
            return (
              Math.round(
                Math.sqrt(
                  Math.pow(distA / pixelsPerSquare, 2) +
                    Math.pow(distB / pixelsPerSquare, 2)
                )
              ) * pixelsPerSquare
            );
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

  /**
   * Adjusts the Paladin bonus being given to the provided token.
   * @param token The target token.
   * @param value The new value to set the paladin bonus to.
   */
  function setBuff(token: Graphic, value: number) {
    setMarker(token, value);
    let charID = token.get('represents'),
      char = getObj('character', charID);
    if (!char) {
      error(
        `Player Character '${token.get('name')}' had no character sheet.`,
        2
      );
      return;
    } else {
      let attr = findObjs({
        _type: 'attribute',
        _characterid: charID,
        name: 'paladin_buff'
      })[0] as Attribute;
      if (!attr) {
        attr = createObj('attribute', {
          _characterid: charID,
          name: 'paladin_buff',
          current: '0'
        });
      }
      let attrValue = attr.get('current');
      if (+value != +attrValue) {
        let adjust = +value - +attrValue;
        attr.setWithWorker('current', value.toString());
        modAttr(token, 'globalsavemod', adjust);
      }
    }
    return;
  }

  function modAttr(token: Graphic, attrName: string, value: number) {
    let charID = token.get('represents'),
      attr = findObjs({
        _type: 'attribute',
        _characterid: charID,
        name: attrName
      })[0] as Attribute;
    if (!attr) {
      attr = createObj('attribute', {
        _characterid: charID,
        name: attrName
      });
      attr.setWithWorker('current', value.toString());
      return;
    } else {
      let attrValue = attr.get('current'),
        adjust = +attrValue + +value;
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
  function setMarker(token: Graphic, value: number): void {
    if (value > 0) {
      token.set(getState('status_marker') as any, value);
    } else {
      token.set(getState('status_marker') as any, false);
    }
  }

  function updateCustomConfigs(): void {
    if (Campaign() != undefined) {
      updateTokenMarkers();
    }

    function updateTokenMarkers() {
      let output = '|bolt-shield,status_bolt-shield';
      const markerObjs = JSON.parse(
        Campaign().get('_token_markers') || '[]'
      ) as TokenMarkerObject[];
      tokenMarkerSort(markerObjs, 'name').forEach(m => {
        if (m.name != 'bolt-shield')
          output += '|' + m.name + ',status_' + m.tag;
      });
      states.find(s => {
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
  function tokenMarkerSort(
    arr: TokenMarkerObject[],
    prop?: string
  ): TokenMarkerObject[] {
    return arr.sort((a, b) => {
      return a[prop] < b[prop] ? -1 : a[prop] > b[prop] ? 1 : 0;
    });
  }

  function toggleActive() {
    const stateInitial = getState('active');
    state[stateName + 'active'] = stateInitial == 'true' ? 'false' : 'true';
    let output = `**Paladin Aura ${
      stateInitial == 'false' ? 'Enabled' : 'Disabled'
    }.**`;
    if (stateInitial == 'true') {
      output += '** All aura bonuses set to 0.**';
      // for each token on the player page
      findObjs({
        _type: 'graphic',
        _pageid: Campaign().get('playerpageid')
      })
        // filter out any tokens that represent no sheet
        .filter(t => {
          const token = getObj('graphic', t.id);
          const char = getObj('character', token.get('represents'));
          if (char != undefined) {
            return true;
          }
          return false;
        })
        // for each of the remaining tokens, set buff to zero
        .forEach(t => {
          const token = getObj('graphic', t.id);
          setBuff(token, 0);
        });
    } else {
      paladinCheck();
    }
    toChat(output, getState('active') == 'true');
  }

  function getState(value: StateVar): string {
    return state[stateName + value];
  }

  function code(snippet: string) {
    return (
      '<span style="background-color: rgba(0, 0, 0, 0.5); color: White; padding: 2px; border-radius: 3px;">' +
      snippet +
      '</span>'
    );
  }

  function toChat(message: string, success?: boolean, target?: string): void {
    const whisper = target ? '/w ' + target + ' ' : '';
    let style = '<div>';
    if (success === true) {
      style =
        '<br><div style="background-color: #5cd65c; color: Black; padding: 5px; border-radius: 10px;">';
    } else if (success === false) {
      style =
        '<br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">';
    }
    sendChat(name, whisper + style + message + '</div>');
  }

  function error(error: string, code: number) {
    if (playerName) {
      sendChat(
        nameError,
        `/w ${playerName} <br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**${error}** Error code ${code}.</div>`
      );
    } else {
      sendChat(
        nameError,
        `<br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>**${error}** Error code ${code}.</div>`
      );
    }
    log(nameLog + error + ` Error code ${code}.`);
  }

  function startupChecks() {
    states.forEach(s => {
      const acceptables = s.acceptables ? s.acceptables : ['true', 'false'];
      const defaultVal = s.default ? s.default : 'true';
      if (
        state[stateName + s.name] == undefined ||
        (!acceptables.includes(state[stateName + s.name]) && s.ignore != 'true')
      ) {
        error(
          '"' +
            s.name +
            '" value was "' +
            state[stateName + s.name] +
            '" but has now been set to its default value, "' +
            defaultVal +
            '".',
          -1
        );
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

on('ready', () => {
  PaladinAura.CheckMacros();
  PaladinAura.StartupChecks();
  PaladinAura.RegisterEventHandlers();
});
