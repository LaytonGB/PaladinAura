/* eslint-disable no-undef */

interface StateForm {
  name: StateVar;
  acceptables?: string[];
  default?: string;
  ignore?: boolean;
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

type StateVar = 'active' | 'diagonal_calc_override';

interface PaladinObject {
  token: Graphic;
  level: number;
  left: number;
  top: number;
  chaBonus: number;
  radius: number;
}

const PaladinAura = (() => {
  const stateName = 'PaladinAura_';
  const states: StateForm[] = [
    { name: 'active' },
    {
      name: 'diagonal_calc_override',
      acceptables: ['none', 'foure', 'threefive', 'pythagorean', 'manhattan'],
      default: 'none'
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
    commandsArr.forEach(command => {
      let output =
        '&{template:default} {{name=' + code(command.name) + '}}{{Function=';
      for (let i = 0; i < command.desc.length; i++) {
        if (i % 2 === 1) {
          output += '{{=';
        }
        output += command.desc[i] + '}}';
      }
      if (command.link) {
        output += '{{Current Setting=' + getState(command.link) + '}}';
      }
      toChat(output, undefined, playerName);
    });
  }

  function showConfig() {
    let output = `&{template:default} {{name=${name} Config}}`;
    states.forEach(s => {
      const acceptableValues = s.acceptables
        ? s.acceptables
        : ['true', 'false'];
      const defaultValue = s.default ? s.default : 'true';
      const currentValue = getState(s.name);
      const stringVals = valuesToString(acceptableValues, defaultValue);
      output += `{{${s.name}=[${currentValue}](${apiCall} config ${s.name} ?{New ${s.name} value${stringVals}})}}`;
    });
    toChat(output, undefined, playerName);

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
      `**${parts[2]}** has been changed **from ${
        state[`${stateName}_${parts[2]}`]
      } to ${parts[3]}**.`,
      true,
      playerName
    );
    state[`${stateName}_${parts[2]}`] = parts[3];
    showConfig();
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

  function paladinCheck() {
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
    if (page.get('scale_units') != 'ft') return;
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
      setBuff(token, 'paladin_buff', saveBonus);
    });
  }

  function setBuff(token: Graphic, attrName: string, value: string | number) {
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
        name: attrName
      })[0] as Attribute;
      if (!attr) {
        attr = createObj('attribute', {
          _characterid: charID,
          name: attrName,
          current: '0'
        });
      }
      let attrValue = attr.get('current');
      if (value != attrValue) {
        let adjust = +value - +attrValue;
        attr.setWithWorker('current', value.toString());
        modAttr(token, 'globalsavemod', adjust);
      }
    }
    return;
  }

  function modAttr(
    token: { get: (arg0: string) => any },
    attrName: string,
    value: string | number
  ) {
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

  function toggleActive() {
    state[stateName + 'active'] = !getState('active');
    toChat(
      `**Paladin Aura ${getState('active') ? 'Enabled' : 'Disabled'}.**`,
      getState('active')
    );
  }

  function getState(value: StateVar) {
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
        !state[stateName + s.name] ||
        !acceptables.includes(state[stateName + s.name])
      ) {
        error(
          '**"' +
            s.name[0] +
            '" value was "' +
            state['stateName' + 's.name'] +
            '" but has now been set to its default value, "' +
            defaultVal +
            '".**',
          -1
        );
        state[stateName + s.name] = defaultVal;
      }
    });
  }

  function registerEventHandlers() {
    on('chat:message', handleInput);
    on('change:graphic', paladinCheck);
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
