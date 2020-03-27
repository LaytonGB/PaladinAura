// TODO
/*
- Create a new function clearAll that does the following:
  - Delete all PaladinSpecific attrs
  - Delete all PaladinAbilities
  - Delete all stateVars
*/

const PaladinAura = (function() {
  const version = '1.0.7';

  type StateVar = 'active' | 'diagonal_calc_override' | 'status_marker';
  type ActiveValues = 'true' | 'false';
  function isActiveValue(val: string): boolean {
    return ['true', 'false'].includes(val);
  }
  type DiagonalCalcValues =
    | 'none'
    | 'foure'
    | 'threefive'
    | 'pythagorean'
    | 'manhattan';
  function isDiagonalCalcValue(val: string): boolean {
    return ['none', 'foure', 'threefive', 'pythagorean', 'manhattan'].includes(
      val
    );
  }
  type StatusMarkerValues = string;
  function isStatusMarkerValue(val: string): boolean {
    return val.slice(0, 6) == 'status';
  }

  /**
   * This is the interface used to check the "states" object, and to ensure that
   * all Roll20 state object changes go smoothly.
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
    ignore?: ActiveValues;
    hide?: ActiveValues;
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
    chaBonus: number;
    id: string;
    left: number;
    level: number;
    radius: number;
    token: Graphic;
    top: number;
  }

  const stateName = 'PaladinAura_';
  const states: StateForm[] = [
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

  let playerName: string, playerID: string, parts: string[];

  /**
   * Returns a string array of all currently in-use page IDs.
   */
  const getActivePages = (): string[] => [
    ...new Set([
      Campaign().get('playerpageid') as string,
      ...(Object.values(Campaign().get('playerspecificpages')) as string[]),
      ...((findObjs({
        type: 'player',
        online: true
      }) as Player[])
        .filter((p) => playerIsGM(p.id))
        .map((p) => p.get('_lastpage'))
        .filter(
          (p) => getObj('page', p).get('scale_units') == 'ft' // excludes pages not measured in feet
        ) as string[])
    ])
  ];

  /**
   * Checks each macro from the macroArr array to ensure their functions are up to date.
   */
  function checkMacros() {
    const playerList = findObjs({ _type: 'player', _online: true });
    const gm = playerList.find((player) => {
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
    macroArr.forEach((macro) => {
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
    commandsArr.forEach((command) => {
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
    states.forEach((s) => {
      if (s.hide == 'true') {
        return;
      }
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
    output += `{{**CAUTION**=[CLEAR ALL](!&#13;?{Are you sure? All custom paladin targets will be lost|Cancel,|I am sure,${apiCall} RESET})}}`;
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
  function setConfig(parts: string[]): void {
    toChat(
      '**' +
        parts[2] +
        '** has been changed **from ' +
        getState(parts[2] as StateVar) +
        ' to ' +
        parts[3] +
        '**.',
      true,
      'gm'
    );
    if (parts[2] == 'status_marker') {
      cleanMarkers(getState(parts[2] as StateVar));
    }
    setState(parts[2] as StateVar, parts[3]);
    showConfig();
    paladinCheck();
  }

  function cleanMarkers(oldMarker?: string): void {
    if (oldMarker == undefined) {
      oldMarker = getState('status_marker');
    }
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

  function handleInput(msg: ApiChatEventData) {
    parts = msg.content.split(' ');
    if (msg.type == 'api' && parts[0] == apiCall) {
      playerName = msg.who.split(' ', 1)[0];
      playerID = msg.playerid;
      if (
        [undefined, 'config', 'help', 'toggleAuraTarget', 'RESET'].includes(
          parts[1]
        )
      ) {
        if (parts[1] == 'help') {
          showHelp();
        } else if (parts[1] == 'toggleAuraTarget') {
          toggleAuraTarget(parts[2], parts[3]);
        } else if (playerIsGM(playerID)) {
          if (!parts[1]) {
            toggleActive();
          } else if (parts[1] == 'config') {
            if (parts[2]) {
              setConfig(parts);
            } else {
              showConfig();
            }
          } else if (parts[1] == 'RESET') {
            clearAll();
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
    if (getState('active') == 'false') {
      return;
    } // stops here if the API is inactive
    const allTokens = findObjs({
      _type: 'graphic',
      _subtype: 'token'
    }) as Graphic[];
    const playerTokens = allTokens.filter((token) => {
      const charID = token.get('represents');
      const char = getObj('character', charID);
      const isNPC = +getAttr(charID, 'npc') == 1;
      // return any token that has a character,
      // is not NPC or has custom attr, and is on an active page
      return (
        char != undefined &&
        (!isNPC ||
          (findObjs({
            _type: 'attribute',
            _characterid: charID
          }) as Attribute[]).find((a) => {
            return a.get('name').includes(stateName);
          }) != undefined) &&
        getActivePages().includes(token.get('_pageid'))
      );
    });
    const auraTokens = playerTokens.map((token) => {
      const charID = token.get('represents');
      let output: PaladinObject;
      if (
        getAttr(charID, 'class')
          .toLowerCase()
          .includes('paladin') &&
        +getAttr(charID, 'base_level') >= 6 &&
        +getAttr(charID, 'hp') > 0
      ) {
        output = setOutput('base_level');
      } else {
        ['multiclass1', 'multiclass2', 'multiclass3'].forEach((className) => {
          if (+getAttr(charID, className + '_flag') == 1) {
            if (
              getAttr(charID, className)
                .toLowerCase()
                .includes('paladin') &&
              +getAttr(charID, className + '_lvl') >= 6 &&
              +getAttr(charID, 'hp') > 0
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
        const output = {
          chaBonus: Math.max(+getAttr(charID, 'charisma_mod'), 1),
          id: charID,
          left: +token.get('left'),
          level: +getAttr(charID, levelAttr),
          radius: +getAttr(charID, levelAttr) >= 18 ? 30 : 10,
          token: token,
          top: +token.get('top')
        };
        return output;
      }
    });
    const paladinTokens = auraTokens.filter((obj: any) => {
      return obj.token !== undefined;
    }) as PaladinObject[];
    paladinTokens.forEach((p) => {
      paladinAbilities(p.id);
    });
    playerTokens.forEach((token) => {
      let saveBonus: number;
      const page = getObj('page', token.get('_pageid'));
      const pixelsPerSquare = page.get('snapping_increment') * 70;
      const unitsPerSquare = page.get('scale_number');
      paladinTokens.forEach((paladin) => {
        const distLimit = (paladin.radius / unitsPerSquare) * pixelsPerSquare;
        const xDist = Math.abs(token.get('left') - paladin.left);
        const yDist = Math.abs(token.get('top') - paladin.top);
        const distTotal =
          xDist >= yDist ? distCalc(xDist, yDist) : distCalc(yDist, xDist);
        if (
          distTotal <= distLimit &&
          getAttr(token.get('represents'), stateName + paladin.id) != 'false'
        ) {
          saveBonus =
            saveBonus >= paladin.chaBonus ? saveBonus : paladin.chaBonus;
        } else {
          saveBonus = saveBonus ? saveBonus : 0;
        }

        function distCalc(distA: number, distB: number) {
          const diagonal =
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
    const charID = token.get('represents');
    const char = getObj('character', charID);
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
      const attrValue = attr.get('current');
      if (+value != +attrValue) {
        const adjust = +value - +attrValue;
        attr.setWithWorker('current', value.toString());
        if (+getAttr(charID, 'npc') != 1) {
          modAttr(token.get('represents'), 'globalsavemod', adjust);
        } else {
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
   * @param charID Target character ID.
   * @param attrName Target attribute (eg. globalsavemod).
   * @param value The difference between the old PaladinBuff and the new one.
   * @param isNPC Token character is an NPC.
   */
  function modAttr(
    charID: string,
    attrName: string,
    value: number,
    isNPC?: boolean
  ) {
    if (isNPC) {
      const shortAttrName = attrName.slice(0, 3);
      let attrMod = findObjs({
        _type: 'attribute',
        _characterid: charID,
        name: attrName + '_mod'
      })[0] as Attribute;
      const NPCattrs = (findObjs({
        _type: 'attribute',
        _characterid: charID
      }) as Attribute[]).filter((a) => {
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
      } else {
        const adjust = +attrMod.get('current') + value;
        saveBonusAttr.setWithWorker('current', adjust.toString());
      }

      if (+saveBonusAttr.get('current') == +attrMod.get('current')) {
        saveFlagAttr.setWithWorker('current', '0');
      } else {
        saveFlagAttr.setWithWorker('current', '2');
      }
    } else {
      let attr = findObjs({
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
      } else {
        const attrValue = attr.get('current');
        const adjust = +attrValue + +value;
        attr.setWithWorker('current', adjust.toString());
      }
    }

    function createAttr(name: string, value?: string): Attribute {
      const output = createObj('attribute', {
        _characterid: charID,
        name: name
      });
      output.setWithWorker('current', value || '0');
      return output;
    }
  }

  function checkNPCsaveSection(charID: string): void {
    let showNPCsaves = findObjs({
      _type: 'attribute',
      _characterid: charID,
      name: 'npc_saving_flag'
    })[0] as Attribute;
    if (showNPCsaves == undefined) {
      showNPCsaves = createObj('attribute', {
        _characterid: charID,
        name: 'npc_saving_flag',
        current: ''
      });
    }
    if (
      (findObjs({
        _type: 'attribute',
        _characterid: charID
      }) as Attribute[]).some((a) => {
        const targetAttrs = [
          'npc_' + 'str' + '_save_flag',
          'npc_' + 'dex' + '_save_flag',
          'npc_' + 'con' + '_save_flag',
          'npc_' + 'int' + '_save_flag',
          'npc_' + 'wis' + '_save_flag',
          'npc_' + 'cha' + '_save_flag'
        ];
        return targetAttrs.includes(a.get('name')) && +a.get('current') != 2;
      })
    ) {
      showNPCsaves.setWithWorker('current', '');
    } else {
      showNPCsaves.setWithWorker('current', '2');
    }
  }

  /**
   * Applies all paladin abilities to a character.
   * @param pID A Character ID.
   */
  function paladinAbilities(pID: string): void {
    interface AbilityObj {
      name: string;
      action: string;
    }
    const paladinAbilityArr: AbilityObj[] = [
      {
        name: 'ToggleAuraTarget',
        action: '!pa toggleAuraTarget @{character_id} @{target|character_id}'
      }
    ];
    let configChanged = false;
    paladinAbilityArr.forEach((a) => {
      const ability = findObjs({
        _type: 'ability',
        _characterid: pID,
        name: a.name
      })[0] as Ability;
      if (ability != undefined) {
        if (ability.get('action') != a.action) {
          configChanged = true;
          ability.set('action', a.action);
        }
      } else {
        configChanged = true;
        createObj('ability', {
          _characterid: pID,
          name: a.name,
          action: a.action,
          istokenaction: true
        });
      }
    });
    if (configChanged) {
      toChat('Some Paladin abilities were wrong. They have been fixed.', true);
    }
  }

  function toggleAuraTarget(pID: string, tID: string): void {
    const paladin = getObj('character', pID);
    const target = getObj('character', tID);
    if (paladin == undefined || target == undefined) {
      error('A target was undefined.', 21);
      return;
    }
    let newValue: string;
    const attr = findObjs({
      _type: 'attribute',
      _characterid: tID,
      name: stateName + pID
    })[0] as Attribute;
    if (attr != undefined) {
      newValue = attr.get('current') == 'true' ? 'false' : 'true';
      attr.set('current', newValue);
    } else {
      const targetIsNPC = +getAttr(tID, 'npc') == 1 ? true : false;
      newValue = targetIsNPC ? 'true' : 'false';
      createObj('attribute', {
        _characterid: tID,
        name: stateName + pID,
        current: newValue
      });
    }
    paladinCheck();
    toChat(
      '**' +
        paladin.get('name') +
        ' has toggled their aura to "' +
        newValue +
        '" for ' +
        target.get('name') +
        '**',
      newValue == 'true'
    );
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
      const markerObjs = JSON.parse(
        Campaign().get('_token_markers') || '[]'
      ) as TokenMarkerObject[];
      states
        .filter((s) => s.customConfig == 'true')
        .forEach((s) => {
          switch (s.name) {
            case 'status_marker': {
              let output = '|bolt-shield,status_bolt-shield';
              tokenMarkerSort(markerObjs, 'name').forEach((m) => {
                if (m.name != 'bolt-shield') {
                  output += '|' + m.name + ',status_' + m.tag;
                }
              });
              s.customConfig = output;
            }
          }
        });
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
    setState('active', stateInitial == 'true' ? 'false' : 'true');
    let output =
      '**Paladin Aura ' +
      (stateInitial == 'false' ? 'Enabled' : 'Disabled') +
      '.**';
    if (stateInitial == 'true') {
      output += '** All aura bonuses set to 0.**';
      // get all tokens
      (findObjs({
        _type: 'graphic',
        _subtype: 'token'
      }) as Graphic[])
        // get rid of any tokens that are not on an active page
        .filter((t) => {
          return getActivePages().includes(t.get('_pageid'));
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
    } else {
      paladinCheck();
    }
    toChat(output, getState('active') == 'true');
  }

  function clearAll(): void {
    const buffAttrs = findObjs({
      _type: 'attribute',
      name: 'paladin_buff'
    }) as Attribute[];
    buffAttrs.forEach((attr) => {
      if (+attr.get('current') != 0 && attr.get('current') != undefined) {
        const token = findObjs({
          represents: attr.get('_characterid')
        })[0] as Graphic;
        setBuff(token, 0);
      }
      attr.remove();
    });
    // Find and remove all paladin aura inclusion / exclusion attrs
    (findObjs({
      _type: 'attribute'
    }) as Attribute[])
      .filter((a) => {
        return a.get('name').includes('PaladinAura_');
      })
      .forEach((a) => {
        a.remove();
      });
    toChat('**All PaladinAura attributes cleared.**', true);
  }

  function getAttr(id: string, name: string): string {
    const attr = findObjs({
      _type: 'attribute',
      _characterid: id,
      name: name
    }) as Attribute[];
    if (attr.length > 0) {
      return attr[0].get('current');
    }
    return 'undefined';
  }

  function getState(value: StateVar): string {
    return state[stateName + value];
  }

  function setState(targetState: StateVar, newValue: string): void {
    let valid: boolean;
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
    } else {
      error(
        'Tried to set state "' +
          targetState +
          '" with unacceptable value "' +
          newValue +
          '".',
        -2
      );
    }
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
    states.forEach((s) => {
      const acceptables = s.acceptables ? s.acceptables : ['true', 'false'];
      const defaultVal = s.default ? s.default : 'true';
      if (
        getState(s.name) == undefined ||
        (!acceptables.includes(getState(s.name)) && s.ignore != 'true')
      ) {
        error(
          '"' +
            s.name +
            '" value was "' +
            getState(s.name) +
            '" but has now been set to its default value, "' +
            defaultVal +
            '".',
          -1
        );
        setState(s.name, defaultVal);
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
